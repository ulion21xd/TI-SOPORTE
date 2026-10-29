import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EmailCodeService } from './email-code.service';

interface EmailCodeRequestBody {
  email?: unknown;
  code?: unknown;
}

@Controller('auth/email-code')
export class EmailCodeController {
  constructor(private readonly emailCodeService: EmailCodeService) {}

  @Post('request')
  @HttpCode(HttpStatus.ACCEPTED)
  requestCode(@Body() body: EmailCodeRequestBody, @Req() request: Request): Promise<{ message: string }> {
    return this.emailCodeService.requestCode(typeof body?.email === 'string' ? body.email : '', request.ip ?? 'unknown');
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body() body: EmailCodeRequestBody, @Req() request: Request): { verified: boolean } {
    return this.emailCodeService.verifyCode(
      typeof body?.email === 'string' ? body.email : '',
      typeof body?.code === 'string' ? body.code : '',
      request.ip ?? 'unknown',
    );
  }
}
