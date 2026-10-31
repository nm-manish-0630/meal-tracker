import { Body, Controller, HttpCode, Post, UnauthorizedException, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { isValidAdminPassword } from './admin-auth.guard';
import { adminLoginSchema, type AdminLoginInput } from './dto/admin-login.schema';

// Deliberately NOT behind AdminAuthGuard — this is the bootstrap check the frontend uses
// to validate a candidate password before storing it and switching to the X-Admin-Password
// header for every other /admin/* call.
@Controller('admin')
export class AdminAuthController {
  @Post('login')
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(adminLoginSchema))
  login(@Body() dto: AdminLoginInput) {
    if (!isValidAdminPassword(dto.password)) {
      throw new UnauthorizedException('Invalid admin password');
    }
  }
}
