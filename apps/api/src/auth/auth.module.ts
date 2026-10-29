import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { EmailCodeController } from './email-code.controller';
import { EmailCodeService } from './email-code.service';

@Module({
  imports: [EmailModule],
  controllers: [EmailCodeController],
  providers: [EmailCodeService],
})
export class AuthModule {}
