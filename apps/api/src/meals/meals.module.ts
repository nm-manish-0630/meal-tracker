import { Module } from '@nestjs/common';
import { R2Module } from '../r2/r2.module';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';

@Module({
  imports: [R2Module],
  controllers: [MealsController],
  providers: [MealsService],
})
export class MealsModule {}
