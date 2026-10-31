import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { uuidParamSchema } from '../common/uuid-param.schema';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { createTrainerGroupSchema, type CreateTrainerGroupInput } from './dto/create-trainer-group.schema';
import { createUserSchema, type CreateUserInput } from './dto/create-user.schema';
import { notificationPreferenceSchema, type NotificationPreferenceInput } from './dto/notification-preference.schema';
import { updateSettingsSchema, type UpdateSettingsInput } from './dto/update-settings.schema';
import { updateTrainerGroupSchema, type UpdateTrainerGroupInput } from './dto/update-trainer-group.schema';
import { updateUserSchema, type UpdateUserInput } from './dto/update-user.schema';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Post('users')
  @UsePipes(new ZodValidationPipe(createUserSchema))
  createUser(@Body() dto: CreateUserInput) {
    return this.adminService.createUser(dto);
  }

  @Put('users/:id')
  updateUser(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserInput,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @HttpCode(204)
  deactivateUser(@Param('id', new ZodValidationPipe(uuidParamSchema)) id: string) {
    return this.adminService.deactivateUser(id);
  }

  @Post('users/:id/notification-preferences')
  setNotificationPreference(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(notificationPreferenceSchema)) dto: NotificationPreferenceInput,
  ) {
    return this.adminService.setNotificationPreference(id, dto);
  }

  @Get('trainer-groups')
  listTrainerGroups() {
    return this.adminService.listTrainerGroups();
  }

  @Post('trainer-groups')
  @UsePipes(new ZodValidationPipe(createTrainerGroupSchema))
  createTrainerGroup(@Body() dto: CreateTrainerGroupInput) {
    return this.adminService.createTrainerGroup(dto);
  }

  @Put('trainer-groups/:id')
  updateTrainerGroup(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateTrainerGroupSchema)) dto: UpdateTrainerGroupInput,
  ) {
    return this.adminService.updateTrainerGroup(id, dto);
  }

  @Delete('trainer-groups/:id')
  @HttpCode(204)
  deleteTrainerGroup(@Param('id', new ZodValidationPipe(uuidParamSchema)) id: string) {
    return this.adminService.deleteTrainerGroup(id);
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @UsePipes(new ZodValidationPipe(updateSettingsSchema))
  updateSettings(@Body() dto: UpdateSettingsInput) {
    return this.adminService.updateSettings(dto);
  }
}
