import { Controller, Get, Param } from '@nestjs/common';
import { uuidParamSchema } from '../common/uuid-param.schema';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MealsService } from './meals.service';

// Open, unauthenticated by design (ADR-004) — a client-facing display-name lookup so
// the client/per-day screens can show "Hi Niti" instead of the raw client_id, the same
// way the trainer-facing /trainer/group/{id}/clients endpoint already returns names.
@Controller('clients')
export class ClientsController {
  constructor(private readonly mealsService: MealsService) {}

  @Get(':clientId')
  getClient(@Param('clientId', new ZodValidationPipe(uuidParamSchema)) clientId: string) {
    return this.mealsService.getClientSummary(clientId);
  }
}
