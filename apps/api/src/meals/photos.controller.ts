import { Controller, Delete, HttpCode, Param } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { uuidParamSchema } from '../common/uuid-param.schema';
import { MealsService } from './meals.service';

@Controller('photos')
export class PhotosController {
  constructor(private readonly mealsService: MealsService) {}

  @Delete(':photoId')
  @HttpCode(204)
  deletePhoto(@Param('photoId', new ZodValidationPipe(uuidParamSchema)) photoId: string) {
    return this.mealsService.deletePhoto(photoId);
  }
}
