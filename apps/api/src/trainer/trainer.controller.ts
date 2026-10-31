import { Controller, Get, Param, Query } from '@nestjs/common';
import { uuidParamSchema } from '../common/uuid-param.schema';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { trainerMealsQuerySchema, type TrainerMealsQueryInput } from './dto/trainer-meals-query.schema';
import { TrainerService } from './trainer.service';

@Controller('trainer')
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  @Get('group/:groupId/clients')
  getGroupClients(@Param('groupId', new ZodValidationPipe(uuidParamSchema)) groupId: string) {
    return this.trainerService.getGroupClients(groupId);
  }

  @Get('clients/:clientId/meals')
  getClientMeals(
    @Param('clientId', new ZodValidationPipe(uuidParamSchema)) clientId: string,
    @Query(new ZodValidationPipe(trainerMealsQuerySchema)) query: TrainerMealsQueryInput,
  ) {
    return this.trainerService.getClientMeals(clientId, query);
  }
}
