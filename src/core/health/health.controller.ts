import { Controller, Get } from '@nestjs/common';
import { Public } from '@core/auth';

@Controller('health')
@Public()
export class HealthController {
  @Get('live')
  live() {
    return { status: 'ok' };
  }
}
