import { Body, Controller, Get, Post, Query, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { confirmUploadSchema, type ConfirmUploadInput } from './dto/confirm-upload.schema';
import { historyQuerySchema, type HistoryQueryInput } from './dto/history-query.schema';
import { uploadUrlSchema, type UploadUrlInput } from './dto/upload-url.schema';
import { MealsService } from './meals.service';

@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post('upload-url')
  @UsePipes(new ZodValidationPipe(uploadUrlSchema))
  createUploadUrl(@Body() dto: UploadUrlInput) {
    return this.mealsService.createUploadUrl(dto);
  }

  @Post('confirm-upload')
  @UsePipes(new ZodValidationPipe(confirmUploadSchema))
  confirmUpload(@Body() dto: ConfirmUploadInput) {
    return this.mealsService.confirmUpload(dto);
  }

  @Get('history')
  @UsePipes(new ZodValidationPipe(historyQuerySchema))
  getHistory(@Query() query: HistoryQueryInput) {
    return this.mealsService.getHistory(query);
  }
}
