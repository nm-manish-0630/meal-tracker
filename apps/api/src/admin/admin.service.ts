import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTrainerGroupInput } from './dto/create-trainer-group.schema';
import type { CreateUserInput } from './dto/create-user.schema';
import type { NotificationPreferenceInput } from './dto/notification-preference.schema';
import type { UpdateSettingsInput } from './dto/update-settings.schema';
import type { UpdateTrainerGroupInput } from './dto/update-trainer-group.schema';
import type { UpdateUserInput } from './dto/update-user.schema';

const DEFAULT_DIGEST_TIME = new Date(Date.UTC(1970, 0, 1, 20, 0, 0));

function timeStringToDate(value: string): Date {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds ?? 0));
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.user.findMany({
      include: { trainerGroup: { select: { id: true, name: true } } },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createUser(dto: CreateUserInput) {
    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          role: dto.role,
          trainerGroupId: dto.trainerGroupId ?? null,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async updateUser(id: string, dto: UpdateUserInput) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.trainerGroupId !== undefined && { trainerGroupId: dto.trainerGroupId }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  // Soft delete only (ADR-004/System Design) — historical meals/photos must survive.
  async deactivateUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  async setNotificationPreference(userId: string, dto: NotificationPreferenceInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Keep "at most one primary preference per user" true across channels, since the
      // digest job resolves a trainer's Slack channel via `isPrimary: true` (DigestService).
      if (dto.isPrimary) {
        await tx.notificationPreference.updateMany({ where: { userId }, data: { isPrimary: false } });
      }

      const existing = await tx.notificationPreference.findFirst({ where: { userId, channel: dto.channel } });
      if (existing) {
        return tx.notificationPreference.update({
          where: { id: existing.id },
          data: { channelIdentifier: dto.channelIdentifier, isPrimary: dto.isPrimary },
        });
      }

      return tx.notificationPreference.create({
        data: {
          userId,
          channel: dto.channel,
          channelIdentifier: dto.channelIdentifier,
          isPrimary: dto.isPrimary,
        },
      });
    });
  }

  async listTrainerGroups() {
    const groups = await this.prisma.trainerGroup.findMany({
      include: { users: { select: { role: true } } },
      orderBy: [{ name: 'asc' }],
    });

    return groups.map(({ users, ...group }) => ({
      ...group,
      trainerCount: users.filter((user) => user.role === 'trainer').length,
      clientCount: users.filter((user) => user.role === 'client').length,
    }));
  }

  async createTrainerGroup(dto: CreateTrainerGroupInput) {
    return this.prisma.trainerGroup.create({
      data: { name: dto.name, digestTimezone: dto.digestTimezone },
    });
  }

  async updateTrainerGroup(id: string, dto: UpdateTrainerGroupInput) {
    const group = await this.prisma.trainerGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException('Trainer group not found');
    }

    return this.prisma.trainerGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.digestTimezone !== undefined && { digestTimezone: dto.digestTimezone }),
      },
    });
  }

  // Unassigns every member back to "no group" before removing the row — no orphaned FK
  // (UI_SPEC.md's Admin Dashboard section; System Design's endpoint table omits this verb).
  async deleteTrainerGroup(id: string) {
    const group = await this.prisma.trainerGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException('Trainer group not found');
    }

    await this.prisma.$transaction([
      this.prisma.user.updateMany({ where: { trainerGroupId: id }, data: { trainerGroupId: null } }),
      this.prisma.trainerGroup.delete({ where: { id } }),
    ]);
  }

  async getSettings() {
    const existing = await this.prisma.appSettings.findFirst();
    if (existing) return existing;
    return this.prisma.appSettings.create({ data: { digestTime: DEFAULT_DIGEST_TIME } });
  }

  async updateSettings(dto: UpdateSettingsInput) {
    const settings = await this.getSettings();
    return this.prisma.appSettings.update({
      where: { id: settings.id },
      data: {
        ...(dto.digestTime !== undefined && { digestTime: timeStringToDate(dto.digestTime) }),
        ...(dto.digestTimeTimezone !== undefined && { digestTimeTimezone: dto.digestTimeTimezone }),
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
