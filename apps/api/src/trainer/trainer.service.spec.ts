import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealsService } from '../meals/meals.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TrainerService } from './trainer.service';

function buildFakePrisma() {
  const prisma = {
    trainerGroup: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    photo: { findFirst: vi.fn() },
  };
  return prisma as unknown as PrismaService & typeof prisma;
}

function buildFakeMealsService() {
  return { getHistory: vi.fn() } as unknown as MealsService & { getHistory: ReturnType<typeof vi.fn> };
}

describe('TrainerService', () => {
  let prisma: ReturnType<typeof buildFakePrisma>;
  let mealsService: ReturnType<typeof buildFakeMealsService>;
  let service: TrainerService;

  beforeEach(() => {
    prisma = buildFakePrisma();
    mealsService = buildFakeMealsService();
    service = new TrainerService(prisma, mealsService);
  });

  describe('getGroupClients', () => {
    it('throws when the group does not exist', async () => {
      prisma.trainerGroup.findUnique.mockResolvedValue(null);
      await expect(service.getGroupClients('missing-group')).rejects.toThrow(NotFoundException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('lists only active clients in the group, with their last upload time', async () => {
      prisma.trainerGroup.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.user.findMany.mockResolvedValue([{ id: 'c1', name: 'Niti' }]);
      prisma.photo.findFirst.mockResolvedValue({ uploadedAt: new Date('2026-10-30T12:00:00.000Z') });

      const result = await service.getGroupClients('g1');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { trainerGroupId: 'g1', role: 'client', isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([{ id: 'c1', name: 'Niti', lastUploadAt: new Date('2026-10-30T12:00:00.000Z') }]);
    });

    it('reports a null lastUploadAt for a client with no photos yet', async () => {
      prisma.trainerGroup.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.user.findMany.mockResolvedValue([{ id: 'c1', name: 'Niti' }]);
      prisma.photo.findFirst.mockResolvedValue(null);

      const result = await service.getGroupClients('g1');

      expect(result).toEqual([{ id: 'c1', name: 'Niti', lastUploadAt: null }]);
    });
  });

  describe('getClientMeals', () => {
    it('delegates to MealsService.getHistory with the client id and date range', async () => {
      mealsService.getHistory.mockResolvedValue([]);
      await service.getClientMeals('c1', { from: '2026-10-01', to: '2026-10-31' });
      expect(mealsService.getHistory).toHaveBeenCalledWith({ clientId: 'c1', from: '2026-10-01', to: '2026-10-31' });
    });
  });
});
