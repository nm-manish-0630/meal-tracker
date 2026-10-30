import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// A hand-rolled fake rather than a mocking library — matches this repo's existing style
// of plain vi.fn()-based doubles with no deep-mocking dependency.
function buildFakePrisma() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    trainerGroup: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    appSettings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    notificationPreference: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
  return prisma as unknown as PrismaService & typeof prisma;
}

describe('AdminService', () => {
  let prisma: ReturnType<typeof buildFakePrisma>;
  let service: AdminService;

  beforeEach(() => {
    prisma = buildFakePrisma();
    service = new AdminService(prisma);
  });

  describe('deactivateUser', () => {
    it('throws when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.deactivateUser('missing-id')).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('sets isActive=false rather than deleting the row', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await service.deactivateUser('u1');
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isActive: false } });
    });
  });

  describe('deleteTrainerGroup', () => {
    it('throws when the group does not exist', async () => {
      prisma.trainerGroup.findUnique.mockResolvedValue(null);
      await expect(service.deleteTrainerGroup('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('unassigns every member before deleting the group row', async () => {
      prisma.trainerGroup.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.user.updateMany.mockResolvedValue({ count: 2 });
      prisma.trainerGroup.delete.mockResolvedValue({ id: 'g1' });

      await service.deleteTrainerGroup('g1');

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { trainerGroupId: 'g1' },
        data: { trainerGroupId: null },
      });
      expect(prisma.trainerGroup.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    });
  });

  describe('getSettings', () => {
    it('returns the existing row when one exists', async () => {
      prisma.appSettings.findFirst.mockResolvedValue({ id: 's1' });
      const result = await service.getSettings();
      expect(result).toEqual({ id: 's1' });
      expect(prisma.appSettings.create).not.toHaveBeenCalled();
    });

    it('creates a default row when none exists, instead of 404ing', async () => {
      prisma.appSettings.findFirst.mockResolvedValue(null);
      prisma.appSettings.create.mockResolvedValue({ id: 's1' });
      const result = await service.getSettings();
      expect(result).toEqual({ id: 's1' });
      expect(prisma.appSettings.create).toHaveBeenCalledOnce();
    });
  });

  describe('setNotificationPreference', () => {
    it('throws when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.setNotificationPreference('missing-id', { channel: 'slack', channelIdentifier: 'D123', isPrimary: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('unsets other primary preferences before creating a new primary one', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.notificationPreference.findFirst.mockResolvedValue(null);
      prisma.notificationPreference.create.mockResolvedValue({ id: 'np1' });

      await service.setNotificationPreference('u1', { channel: 'slack', channelIdentifier: 'D123', isPrimary: true });

      expect(prisma.notificationPreference.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { isPrimary: false },
      });
      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: { userId: 'u1', channel: 'slack', channelIdentifier: 'D123', isPrimary: true },
      });
    });

    it('updates the existing preference for that channel instead of creating a duplicate', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.notificationPreference.findFirst.mockResolvedValue({ id: 'np1' });
      prisma.notificationPreference.update.mockResolvedValue({ id: 'np1' });

      await service.setNotificationPreference('u1', { channel: 'slack', channelIdentifier: 'D456', isPrimary: false });

      expect(prisma.notificationPreference.updateMany).not.toHaveBeenCalled();
      expect(prisma.notificationPreference.update).toHaveBeenCalledWith({
        where: { id: 'np1' },
        data: { channelIdentifier: 'D456', isPrimary: false },
      });
      expect(prisma.notificationPreference.create).not.toHaveBeenCalled();
    });
  });
});
