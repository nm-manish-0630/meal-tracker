import { Module } from '@nestjs/common';
import { MealsModule } from '../meals/meals.module';
import { TrainerController } from './trainer.controller';
import { TrainerService } from './trainer.service';

@Module({
  imports: [MealsModule],
  controllers: [TrainerController],
  providers: [TrainerService],
})
export class TrainerModule {}
