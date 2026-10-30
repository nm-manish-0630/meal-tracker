import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminAuthGuard, isValidAdminPassword } from './admin-auth.guard';

function contextWithHeader(password: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-admin-password': password } }),
    }),
  } as unknown as ExecutionContext;
}

describe('isValidAdminPassword', () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  afterEach(() => {
    process.env.ADMIN_PASSWORD = originalPassword;
  });

  it('matches when the password equals ADMIN_PASSWORD', () => {
    process.env.ADMIN_PASSWORD = 'correct-horse';
    expect(isValidAdminPassword('correct-horse')).toBe(true);
  });

  it('fails closed when ADMIN_PASSWORD is unset, even with an empty candidate', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(isValidAdminPassword('')).toBe(false);
    expect(isValidAdminPassword(undefined)).toBe(false);
  });

  it('rejects a mismatched password', () => {
    process.env.ADMIN_PASSWORD = 'correct-horse';
    expect(isValidAdminPassword('wrong')).toBe(false);
  });
});

describe('AdminAuthGuard', () => {
  const guard = new AdminAuthGuard();
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'correct-horse';
  });

  afterEach(() => {
    process.env.ADMIN_PASSWORD = originalPassword;
  });

  it('allows the request through when the header matches', () => {
    expect(guard.canActivate(contextWithHeader('correct-horse'))).toBe(true);
  });

  it('throws UnauthorizedException when the header is missing', () => {
    expect(() => guard.canActivate(contextWithHeader(undefined))).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the header is wrong', () => {
    expect(() => guard.canActivate(contextWithHeader('nope'))).toThrow(UnauthorizedException);
  });
});
