import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

// ADR-004: the Admin Dashboard is the one surface behind a shared password (no JWT/OAuth).
// Fails closed if ADMIN_PASSWORD isn't configured — an unset env var must never mean "open".
export function isValidAdminPassword(password: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && password === expected;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const password = request.headers['x-admin-password'];

    if (typeof password !== 'string' || !isValidAdminPassword(password)) {
      throw new UnauthorizedException('Invalid or missing admin password');
    }

    return true;
  }
}
