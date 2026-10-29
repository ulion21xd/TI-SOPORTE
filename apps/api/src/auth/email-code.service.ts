import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { SmtpMailerService } from '../email/smtp-mailer.service';

interface OtpChallenge {
  salt: Buffer;
  digest: Buffer;
  expiresAt: number;
  attempts: number;
}

interface RateBucket {
  startedAt: number;
  count: number;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_IP = 10;
const MAX_VERIFY_ATTEMPTS_PER_EMAIL = 10;
const MAX_VERIFY_ATTEMPTS_PER_IP = 30;
const MAX_ATTEMPTS_PER_CODE = 5;

@Injectable()
export class EmailCodeService {
  // Both this key and the challenges are process-local: codes are never persisted in plaintext or on disk.
  private readonly hashKey = randomBytes(32);
  private readonly challenges = new Map<string, OtpChallenge>();
  private readonly requestEmailBuckets = new Map<string, RateBucket>();
  private readonly requestIpBuckets = new Map<string, RateBucket>();
  private readonly verifyEmailBuckets = new Map<string, RateBucket>();
  private readonly verifyIpBuckets = new Map<string, RateBucket>();

  constructor(private readonly mailer: SmtpMailerService) {}

  async requestCode(rawEmail: string, rawIp: string): Promise<{ message: string }> {
    const email = this.normalizeAndValidateEmail(rawEmail);
    const ip = rawIp || 'unknown';
    const now = Date.now();
    this.removeExpiredChallenges(now);
    this.consumeRateLimit(this.requestEmailBuckets, email, MAX_REQUESTS_PER_EMAIL, now);
    this.consumeRateLimit(this.requestIpBuckets, ip, MAX_REQUESTS_PER_IP, now);

    // Verify SMTP before checking the allowlist so an unconfigured server does not reveal account membership.
    await this.mailer.verifyConfiguration();
    const allowedEmails = this.getAllowedEmails();
    if (!allowedEmails.has(email)) {
      return { message: 'Si la dirección está autorizada, recibirás un código temporal.' };
    }

    this.challenges.delete(email);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const salt = randomBytes(16);
    const digest = this.digest(email, salt, code);
    await this.mailer.sendOneTimeCode(email, code);

    this.challenges.set(email, { salt, digest, expiresAt: now + OTP_TTL_MS, attempts: 0 });
    return { message: 'Si la dirección está autorizada, recibirás un código temporal.' };
  }

  verifyCode(rawEmail: string, rawCode: string, rawIp: string): { verified: boolean } {
    const email = this.normalizeAndValidateEmail(rawEmail);
    const ip = rawIp || 'unknown';
    const now = Date.now();
    this.removeExpiredChallenges(now);
    this.consumeRateLimit(this.verifyEmailBuckets, email, MAX_VERIFY_ATTEMPTS_PER_EMAIL, now);
    this.consumeRateLimit(this.verifyIpBuckets, ip, MAX_VERIFY_ATTEMPTS_PER_IP, now);

    const challenge = this.challenges.get(email);
    if (!challenge || !/^\d{6}$/.test(rawCode)) return { verified: false };

    const candidate = this.digest(email, challenge.salt, rawCode);
    const matches = timingSafeEqual(candidate, challenge.digest);
    if (matches) {
      this.challenges.delete(email);
      return { verified: true };
    }

    challenge.attempts += 1;
    if (challenge.attempts >= MAX_ATTEMPTS_PER_CODE) this.challenges.delete(email);
    return { verified: false };
  }

  private normalizeAndValidateEmail(rawEmail: string): string {
    const email = rawEmail.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({ code: 'INVALID_EMAIL', message: 'Ingresa un correo electrónico válido.' });
    }
    return email;
  }

  private getAllowedEmails(): Set<string> {
    const configured = process.env.OTP_ALLOWED_EMAILS?.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean) ?? [];
    if (configured.length === 0) {
      throw new ServiceUnavailableException({
        code: 'OTP_ALLOWLIST_NOT_CONFIGURED',
        message: 'El servicio de verificación no está configurado; no se confirmó el envío.',
      });
    }
    return new Set(configured);
  }

  private consumeRateLimit(map: Map<string, RateBucket>, key: string, limit: number, now: number): void {
    const bucket = map.get(key);
    if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
      map.set(key, { startedAt: now, count: 1 });
      return;
    }
    if (bucket.count >= limit) {
      throw new HttpException({
        code: 'OTP_RATE_LIMITED',
        message: 'Se alcanzó el límite temporal de intentos. Espera antes de volver a intentarlo.',
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    bucket.count += 1;
  }

  private digest(email: string, salt: Buffer, code: string): Buffer {
    return createHmac('sha256', this.hashKey).update(email).update(salt).update(code).digest();
  }

  private removeExpiredChallenges(now: number): void {
    for (const [email, challenge] of this.challenges) {
      if (challenge.expiresAt <= now) this.challenges.delete(email);
    }
    for (const buckets of [this.requestEmailBuckets, this.requestIpBuckets, this.verifyEmailBuckets, this.verifyIpBuckets]) {
      for (const [key, bucket] of buckets) {
        if (now - bucket.startedAt >= RATE_WINDOW_MS) buckets.delete(key);
      }
    }
  }
}
