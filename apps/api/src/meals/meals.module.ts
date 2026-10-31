import { Module } from '@nestjs/common';
import { R2Module } from '../r2/r2.module';
import { ClientsController } from './clients.controller';
import { MealsController } from './meals.controller';
import { PhotosController } from './photos.controller';
import { MealsService } from './meals.service';

@Module({
  imports: [R2Module],
  controllers: [MealsController, PhotosController, ClientsController],
  providers: [MealsService],
  exports: [MealsService],
})
export class MealsModule {}
