import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class SmtpMailerService {
  private readonly logger = new Logger(SmtpMailerService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT);
    const secureText = process.env.SMTP_SECURE?.trim().toLowerCase();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM?.trim();

    if (!host || !Number.isInteger(port) || port <= 0 || !['true', 'false'].includes(secureText ?? '') || !user || !pass || !from) {
      throw new ServiceUnavailableException({
        code: 'SMTP_NOT_CONFIGURED',
        message: 'El servicio de correo no está configurado; no se confirmó el envío.',
      });
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secureText === 'true',
      auth: { user, pass },
      // Fail promptly if the SMTP host accepts TCP but does not complete SMTP delivery.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    return this.transporter;
  }

  async verifyConfiguration(): Promise<void> {
    const transporter = this.getTransporter();
    try {
      await transporter.verify();
    } catch (error: unknown) {
      this.transporter = null;
      this.logSafeSmtpFailure('verify', error);
      throw new ServiceUnavailableException({
        code: 'SMTP_UNAVAILABLE',
        message: 'El servicio de correo no está disponible; no se confirmó el envío.',
      });
    }
  }

  async sendOneTimeCode(to: string, code: string): Promise<void> {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM!.trim();
    try {
      await transporter.sendMail({
        from,
        to,
        subject: 'Código de verificación · Grupo Nodos IT',
        text: `Tu código temporal de verificación es: ${code}\n\nVence en cinco minutos. Si no solicitaste este código, ignora este mensaje.`,
        html: `<p>Tu código temporal de verificación es:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>Vence en cinco minutos. Si no solicitaste este código, ignora este mensaje.</p>`,
      });
    } catch (error: unknown) {
      this.logSafeSmtpFailure('sendMail', error);
      throw new ServiceUnavailableException({
        code: 'SMTP_DELIVERY_UNCONFIRMED',
        message: 'No se pudo confirmar el envío del código. Intenta más tarde o contacta al equipo de TI.',
      });
    }
  }

  private logSafeSmtpFailure(stage: 'verify' | 'sendMail', error: unknown): void {
    const details = error && typeof error === 'object'
      ? error as { code?: unknown; responseCode?: unknown; command?: unknown }
      : {};
    const safeToken = (value: unknown): string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : 'unknown';
    const responseCode = typeof details.responseCode === 'number' ? String(details.responseCode) : 'unknown';
    this.logger.error(`SMTP ${stage} failed; code=${safeToken(details.code)}; responseCode=${responseCode}; command=${safeToken(details.command)}`);
  }
}
