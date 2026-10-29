import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'whatsapp-bot' };
  }
}
