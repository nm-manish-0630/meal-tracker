import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DigestService {
  constructor(private readonly prisma: PrismaService) {}

  async sendDailyDigest() {
    throw new NotImplementedException('Daily digest job not yet implemented');
  }
}
