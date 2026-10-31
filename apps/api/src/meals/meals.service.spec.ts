import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { R2Service } from '../r2/r2.service';
import { MealsService } from './meals.service';

function buildFakePrisma() {
  const prisma = { user: { findUnique: vi.fn() } };
  return prisma as unknown as PrismaService & typeof prisma;
}

describe('MealsService', () => {
  let prisma: ReturnType<typeof buildFakePrisma>;
  let service: MealsService;

  beforeEach(() => {
    prisma = buildFakePrisma();
    service = new MealsService(prisma, {} as R2Service);
  });

  describe('getClientSummary', () => {
    it('throws when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getClientSummary('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws when the user is not a client', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Dana', role: 'trainer' });
      await expect(service.getClientSummary('u1')).rejects.toThrow(NotFoundException);
    });

    it('returns the id and name for a client', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Niti', role: 'client' });
      await expect(service.getClientSummary('u1')).resolves.toEqual({ id: 'u1', name: 'Niti' });
    });
  });
});
