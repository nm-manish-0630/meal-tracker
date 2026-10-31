import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { addUtcDays, startOfUtcDay } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import type { ConfirmUploadInput } from './dto/confirm-upload.schema';
import type { HistoryQueryInput } from './dto/history-query.schema';
import type { UpdateMealInput } from './dto/update-meal.schema';
import type { UploadUrlInput } from './dto/upload-url.schema';

const MAX_PHOTOS_PER_MEAL = 5;
const CATCHUP_WINDOW_DAYS = 7;

@Injectable()
export class MealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async createUploadUrl(dto: UploadUrlInput) {
    const client = await this.prisma.user.findUnique({ where: { id: dto.clientId } });
    if (!client || client.role !== 'client') {
      throw new NotFoundException('Client not found');
    }

    const capturedAt = new Date(dto.capturedAt);
    const mealDate = new Date(
      Date.UTC(capturedAt.getUTCFullYear(), capturedAt.getUTCMonth(), capturedAt.getUTCDate()),
    );

    const meal = await this.prisma.meal.upsert({
      where: {
        userId_mealType_mealDate: {
          userId: dto.clientId,
          mealType: dto.mealType,
          mealDate,
        },
      },
      create: { userId: dto.clientId, mealType: dto.mealType, mealDate },
      update: {},
    });

    const extension = dto.contentType.split('/')[1];
    const r2ObjectKey = `photos/${meal.id}/${randomUUID()}.${extension}`;
    const uploadUrl = await this.r2.getUploadUrl(r2ObjectKey, dto.contentType);

    return { mealId: meal.id, uploadUrl, r2ObjectKey };
  }

  async confirmUpload(dto: ConfirmUploadInput) {
    const meal = await this.prisma.meal.findUnique({ where: { id: dto.mealId } });
    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    const photoCount = await this.prisma.photo.count({ where: { mealId: dto.mealId } });
    if (photoCount >= MAX_PHOTOS_PER_MEAL) {
      throw new BadRequestException(`Meal already has the maximum of ${MAX_PHOTOS_PER_MEAL} photos`);
    }

    try {
      const photo = await this.prisma.photo.create({
        data: {
          mealId: dto.mealId,
          r2ObjectKey: dto.r2ObjectKey,
          fileSize: dto.fileSize,
          uploadOrder: photoCount + 1,
          capturedAt: new Date(dto.capturedAt),
          uploadedAt: new Date(),
        },
      });

      await this.enqueueDigestDelivery(meal, photo.id, 'enqueued');

      return { photoId: photo.id, uploadOrder: photo.uploadOrder };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Concurrent upload to this meal, please retry');
      }
      throw error;
    }
  }

  async getClientSummary(clientId: string) {
    const client = await this.prisma.user.findUnique({ where: { id: clientId } });
    if (!client || client.role !== 'client') {
      throw new NotFoundException('Client not found');
    }
    return { id: client.id, name: client.name };
  }

  async getHistory(query: HistoryQueryInput) {
    const client = await this.prisma.user.findUnique({ where: { id: query.clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const mealDateFilter: { gte?: Date; lte?: Date } = {};
    if (query.from) mealDateFilter.gte = new Date(query.from);
    if (query.to) mealDateFilter.lte = new Date(query.to);

    const meals = await this.prisma.meal.findMany({
      where: {
        userId: query.clientId,
        ...(Object.keys(mealDateFilter).length > 0 ? { mealDate: mealDateFilter } : {}),
      },
      include: { photos: { orderBy: { uploadOrder: 'asc' } } },
      orderBy: [{ mealDate: 'desc' }, { createdAt: 'asc' }],
    });

    return Promise.all(
      meals.map(async (meal) => ({
        id: meal.id,
        mealType: meal.mealType,
        mealDate: meal.mealDate.toISOString().slice(0, 10),
        photos: await Promise.all(
          meal.photos.map(async (photo) => ({
            id: photo.id,
            uploadOrder: photo.uploadOrder,
            capturedAt: photo.capturedAt,
            fileSize: photo.fileSize,
            downloadUrl: await this.r2.getDownloadUrl(photo.r2ObjectKey),
          })),
        ),
      })),
    );
  }

  async updateMeal(mealId: string, dto: UpdateMealInput) {
    const meal = await this.prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    try {
      return await this.prisma.meal.update({ where: { id: mealId }, data: { mealType: dto.mealType } });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(`A ${dto.mealType} meal already exists for this day`);
      }
      throw error;
    }
  }

  async deleteMeal(mealId: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id: mealId }, include: { photos: true } });
    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    await Promise.all(meal.photos.map((photo) => this.r2.deleteObject(photo.r2ObjectKey)));
    await this.prisma.photo.deleteMany({ where: { mealId } });
    await this.prisma.meal.delete({ where: { id: mealId } });
  }

  async deletePhoto(photoId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    await this.r2.deleteObject(photo.r2ObjectKey);
    await this.prisma.photo.delete({ where: { id: photoId } });
  }

  // Event-driven enqueue (ADR-012): the only place a digest_deliveries row is created or
  // gains a photo. One atomic INSERT ... ON CONFLICT DO UPDATE per trainer, so concurrent
  // photo confirms for the same meal never drop each other's append to photo_progress.
  async enqueueDigestDelivery(meal: { id: string; userId: string; mealDate: Date }, photoId: string, stage: string) {
    const cutoff = addUtcDays(startOfUtcDay(new Date()), -CATCHUP_WINDOW_DAYS);
    if (meal.mealDate < cutoff) return;

    const client = await this.prisma.user.findUnique({ where: { id: meal.userId } });
    if (!client?.trainerGroupId) return;

    const trainers = await this.prisma.user.findMany({
      where: { trainerGroupId: client.trainerGroupId, role: 'trainer', isActive: true },
      select: { id: true },
    });

    const photoProgressEntry = JSON.stringify([{ photo_id: photoId, status: 'pending' }]);
    const attemptLogEntry = JSON.stringify([{ at: new Date().toISOString(), stage }]);

    for (const trainer of trainers) {
      await this.prisma.$executeRaw`
        INSERT INTO digest_deliveries (id, meal_id, meal_date, trainer_id, status, photo_progress, attempt_count, attempt_log, created_at)
        VALUES (${randomUUID()}, ${meal.id}, ${meal.mealDate}, ${trainer.id}, 'pending', ${photoProgressEntry}::jsonb, 0, ${attemptLogEntry}::jsonb, now())
        ON CONFLICT (meal_id, trainer_id) DO UPDATE SET
          photo_progress = digest_deliveries.photo_progress || ${photoProgressEntry}::jsonb,
          status = 'pending',
          attempt_count = CASE WHEN digest_deliveries.status = 'sent' THEN 0 ELSE digest_deliveries.attempt_count END,
          attempt_log = digest_deliveries.attempt_log || ${attemptLogEntry}::jsonb
      `;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
