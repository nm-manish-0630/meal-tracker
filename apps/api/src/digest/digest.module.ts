import { Module } from '@nestjs/common';
import { MealsModule } from '../meals/meals.module';
import { R2Module } from '../r2/r2.module';
import { SlackModule } from '../slack/slack.module';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';

@Module({
  imports: [MealsModule, R2Module, SlackModule],
  controllers: [DigestController],
  providers: [DigestService],
})
export class DigestModule {}
