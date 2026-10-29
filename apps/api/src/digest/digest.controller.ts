import { Controller, Post } from '@nestjs/common';
import { DigestService } from './digest.service';

@Controller('cron')
export class DigestController {
  constructor(private readonly digestService: DigestService) {}

  @Post('send-daily-digest')
  sendDailyDigest() {
    return this.digestService.sendDailyDigest();
  }
}
