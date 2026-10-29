import { Module } from '@nestjs/common';
import { SmtpMailerService } from './smtp-mailer.service';

@Module({
  providers: [SmtpMailerService],
  exports: [SmtpMailerService],
})
export class EmailModule {}
