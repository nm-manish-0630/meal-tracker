import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import type { ConfirmUploadInput } from './dto/confirm-upload.schema';
import type { UploadUrlInput } from './dto/upload-url.schema';

const MAX_PHOTOS_PER_MEAL = 5;

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

      return { photoId: photo.id, uploadOrder: photo.uploadOrder };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Concurrent upload to this meal, please retry');
      }
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
