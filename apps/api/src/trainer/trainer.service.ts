import { Injectable, NotFoundException } from '@nestjs/common';
import { MealsService } from '../meals/meals.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TrainerMealsQueryInput } from './dto/trainer-meals-query.schema';

@Injectable()
export class TrainerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mealsService: MealsService,
  ) {}

  async getGroupClients(groupId: string) {
    const group = await this.prisma.trainerGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Trainer group not found');
    }

    const clients = await this.prisma.user.findMany({
      where: { trainerGroupId: groupId, role: 'client', isActive: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      clients.map(async (client) => {
        const lastPhoto = await this.prisma.photo.findFirst({
          where: { meal: { userId: client.id } },
          orderBy: { uploadedAt: 'desc' },
          select: { uploadedAt: true },
        });
        return { id: client.id, name: client.name, lastUploadAt: lastPhoto?.uploadedAt ?? null };
      }),
    );
  }

  async getClientMeals(clientId: string, query: TrainerMealsQueryInput) {
    return this.mealsService.getHistory({ clientId, from: query.from, to: query.to });
  }
}
