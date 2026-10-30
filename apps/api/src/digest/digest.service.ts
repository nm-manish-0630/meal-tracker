import { Injectable, Logger } from '@nestjs/common';
import type { DigestStatus } from '@repo/shared/digest-status';
import type { MealType } from '@repo/shared/meal-type';
import { startOfUtcDay, toDateOnlyString } from '../common/date.util';
import { MealsService } from '../meals/meals.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { SlackService } from '../slack/slack.service';
import { composeDigestBlocks } from './digest-message.util';
import { digestTimeToUtc } from './digest-window.util';

const MAX_ATTEMPTS = 4;
const DEFAULT_DIGEST_TIME = new Date(Date.UTC(1970, 0, 1, 20, 0, 0));

interface PhotoProgressEntry {
  photo_id: string;
  status: 'pending' | 'uploaded' | 'failed';
  slack_file_id?: string;
}

interface AttemptLogEntry {
  attempt?: number;
  at: string;
  stage: string;
  error?: string;
}

function asPhotoProgress(value: unknown): PhotoProgressEntry[] {
  return Array.isArray(value) ? (value as PhotoProgressEntry[]) : [];
}

function asAttemptLog(value: unknown): AttemptLogEntry[] {
  return Array.isArray(value) ? (value as AttemptLogEntry[]) : [];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Prisma's Json input type requires an index signature our typed entries don't have;
// round-tripping through JSON strips that mismatch without losing any data.
function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

// Window Gate (Step 0) → Consolidate (Step 0.5) → Drain (Step 1) → Close Out (Step 2) →
// Reconciliation (Step 3) — see docs/SYSTEM_DESIGN.md "Daily Digest Job" and ADR-010/012/013.
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slack: SlackService,
    private readonly r2: R2Service,
    private readonly mealsService: MealsService,
  ) {}

  async sendDailyDigest() {
    const now = new Date();
    const runDate = startOfUtcDay(now);

    const windowOpen = await this.openWindowIfDue(runDate, now);
    if (windowOpen) {
      await this.composeAndPostHeaders(runDate);
    }
    await this.drainDeliveries();
    await this.closeOut(runDate);
    const reconciledCount = await this.reconciliationSweep();
    await this.r2Reconciliation();

    const counts = await this.collectCounts(runDate);
    return { runDate: toDateOnlyString(runDate), windowOpen, reconciledCount, ...counts };
  }

  // Step 0 — mark today's window open, once. Nothing is generated here; it only gates
  // Step 0.5 below. `digestRun.upsert` with an empty `update` makes repeated ticks a no-op.
  private async openWindowIfDue(runDate: Date, now: Date): Promise<boolean> {
    const settings = await this.prisma.appSettings.findFirst();
    const digestTime = settings?.digestTime ?? DEFAULT_DIGEST_TIME;
    const timezone = settings?.digestTimeTimezone ?? 'UTC';
    const target = digestTimeToUtc(runDate, digestTime, timezone);
    if (now < target) return false;

    await this.prisma.digestRun.upsert({
      where: { runDate },
      create: { runDate, windowOpenedAt: now },
      update: {},
    });
    return true;
  }

  // Step 0.5 — compose & post each trainer's one daily message (ADR-013).
  private async composeAndPostHeaders(runDate: Date) {
    const unclaimedTrainers = await this.prisma.digestDelivery.findMany({
      where: { status: 'pending', digestMessageId: null },
      select: { trainerId: true },
      distinct: ['trainerId'],
    });

    for (const { trainerId } of unclaimedTrainers) {
      await this.composeAndPostHeaderForTrainer(trainerId, runDate);
    }
  }

  private async composeAndPostHeaderForTrainer(trainerId: string, runDate: Date) {
    const message = await this.prisma.digestMessage.upsert({
      where: { trainerId_runDate: { trainerId, runDate } },
      create: { trainerId, runDate },
      update: {},
    });

    if (message.slackMessageTs || message.attemptCount >= MAX_ATTEMPTS) return;

    const claimed = await this.prisma.digestDelivery.findMany({
      where: { trainerId, status: 'pending', digestMessageId: null },
      include: { meal: { include: { user: true } } },
    });
    if (claimed.length === 0) return;

    const nextAttemptCount = message.attemptCount + 1;
    const existingLog = asAttemptLog(message.attemptLog);

    const notificationPreference = await this.prisma.notificationPreference.findFirst({
      where: { userId: trainerId, channel: 'slack', isPrimary: true },
    });

    if (!notificationPreference) {
      await this.failHeaderAttempt(message.id, nextAttemptCount, existingLog, 'no primary slack notification_preference for trainer');
      return;
    }

    const clientNames = [...new Set(claimed.map((delivery) => delivery.meal.user.name))];
    const blocks = composeDigestBlocks(
      clientNames.length === 1 ? clientNames[0] ?? null : null,
      runDate,
      claimed.map((delivery) => ({
        mealDate: delivery.mealDate,
        mealType: delivery.meal.mealType as MealType,
        photoCount: asPhotoProgress(delivery.photoProgress).length,
      })),
    );

    try {
      const { ts, channelId } = await this.slack.postMessage(notificationPreference.channelIdentifier, blocks);
      await this.prisma.digestMessage.update({
        where: { id: message.id },
        data: {
          slackMessageTs: ts,
          slackChannelId: channelId,
          attemptCount: nextAttemptCount,
          attemptLog: toJsonValue([...existingLog, { attempt: nextAttemptCount, at: new Date().toISOString(), stage: 'message_post' }]),
          lastAttemptAt: new Date(),
        },
      });
      await this.prisma.digestDelivery.updateMany({
        where: { id: { in: claimed.map((delivery) => delivery.id) } },
        data: { digestMessageId: message.id },
      });
    } catch (error) {
      await this.failHeaderAttempt(message.id, nextAttemptCount, existingLog, errorMessage(error));
    }
  }

  private async failHeaderAttempt(messageId: string, attemptCount: number, existingLog: AttemptLogEntry[], error: string) {
    const status: DigestStatus = attemptCount >= MAX_ATTEMPTS ? 'failed_permanent' : 'pending';
    await this.prisma.digestMessage.update({
      where: { id: messageId },
      data: {
        attemptCount,
        attemptLog: toJsonValue([...existingLog, { attempt: attemptCount, at: new Date().toISOString(), stage: 'message_post', error }]),
        lastAttemptAt: new Date(),
        status,
      },
    });
    if (status === 'failed_permanent') {
      this.logger.error(`Digest message ${messageId} permanently failed: ${error}`);
    }
  }

  // Step 1 — drain: thread photos under each trainer's already-posted message.
  private async drainDeliveries() {
    const deliveries = await this.prisma.digestDelivery.findMany({
      where: { status: 'pending', attemptCount: { lt: MAX_ATTEMPTS }, digestMessage: { slackMessageTs: { not: null } } },
      include: { digestMessage: true, meal: { include: { photos: true } } },
    });

    for (const delivery of deliveries) {
      await this.drainOneDelivery(delivery);
    }
  }

  private async drainOneDelivery(delivery: {
    id: string;
    attemptCount: number;
    photoProgress: unknown;
    attemptLog: unknown;
    digestMessage: { slackChannelId: string | null; slackMessageTs: string | null } | null;
    meal: { photos: { id: string; r2ObjectKey: string }[] };
  }) {
    const nextAttemptCount = delivery.attemptCount + 1;
    const photoProgress = asPhotoProgress(delivery.photoProgress).map((entry) => ({ ...entry }));
    const existingLog = asAttemptLog(delivery.attemptLog);
    const newLogEntries: AttemptLogEntry[] = [];
    const photosById = new Map(delivery.meal.photos.map((photo) => [photo.id, photo]));
    const channelId = delivery.digestMessage?.slackChannelId;
    const threadTs = delivery.digestMessage?.slackMessageTs;

    for (const entry of photoProgress) {
      if (entry.status === 'uploaded') continue;

      const photo = photosById.get(entry.photo_id);
      if (!photo || !channelId || !threadTs) {
        entry.status = 'failed';
        newLogEntries.push({
          attempt: nextAttemptCount,
          at: new Date().toISOString(),
          stage: `photo:${entry.photo_id}`,
          error: !photo ? 'photo row not found' : 'digest message has no slack channel/thread yet',
        });
        continue;
      }

      try {
        const bytes = await this.r2.getObjectBytes(photo.r2ObjectKey);
        const fileId = await this.slack.uploadPhotoToThread({
          channelId,
          threadTs,
          filename: photo.r2ObjectKey.split('/').pop() ?? `${photo.id}.jpg`,
          bytes,
        });
        entry.status = 'uploaded';
        entry.slack_file_id = fileId;
        newLogEntries.push({ attempt: nextAttemptCount, at: new Date().toISOString(), stage: `photo:${entry.photo_id}` });
      } catch (error) {
        entry.status = 'failed';
        newLogEntries.push({
          attempt: nextAttemptCount,
          at: new Date().toISOString(),
          stage: `photo:${entry.photo_id}`,
          error: errorMessage(error),
        });
      }
    }

    const allUploaded = photoProgress.every((entry) => entry.status === 'uploaded');
    const status: DigestStatus = allUploaded ? 'sent' : nextAttemptCount >= MAX_ATTEMPTS ? 'failed_permanent' : 'pending';
    const attemptLog = [...existingLog, ...newLogEntries];

    await this.prisma.digestDelivery.update({
      where: { id: delivery.id },
      data: {
        photoProgress: toJsonValue(photoProgress),
        attemptCount: nextAttemptCount,
        attemptLog: toJsonValue(attemptLog),
        lastAttemptAt: new Date(),
        status,
      },
    });

    if (status === 'failed_permanent') {
      this.logger.error(`Digest delivery ${delivery.id} permanently failed`, JSON.stringify(attemptLog));
    }
  }

  // Step 2 — close out: mark each trainer's message sent once nothing pending remains
  // under it, then close today's run once every message for today is terminal.
  private async closeOut(runDate: Date) {
    const pendingMessages = await this.prisma.digestMessage.findMany({
      where: { runDate, status: 'pending' },
      include: { deliveries: { where: { status: 'pending' }, select: { id: true } } },
    });

    for (const message of pendingMessages) {
      if (message.deliveries.length === 0) {
        await this.prisma.digestMessage.update({ where: { id: message.id }, data: { status: 'sent' } });
      }
    }

    const stillPending = await this.prisma.digestMessage.count({ where: { runDate, status: 'pending' } });
    if (stillPending === 0) {
      await this.prisma.digestRun.updateMany({ where: { runDate, completedAt: null }, data: { completedAt: new Date() } });
    }
  }

  // Step 3 — reconciliation sweep: catch anything a failed enqueue might have missed (ADR-012).
  private async reconciliationSweep(): Promise<number> {
    const orphans = await this.prisma.$queryRaw<{ photo_id: string; meal_id: string; user_id: string; meal_date: Date }[]>`
      SELECT p.id as photo_id, p.meal_id, m.user_id, m.meal_date
      FROM photos p
      JOIN meals m ON m.id = p.meal_id
      WHERE m.meal_date >= CURRENT_DATE - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM digest_deliveries d
          WHERE d.meal_id = p.meal_id
            AND d.photo_progress @> jsonb_build_array(jsonb_build_object('photo_id', p.id))
        )
    `;

    for (const orphan of orphans) {
      await this.mealsService.enqueueDigestDelivery(
        { id: orphan.meal_id, userId: orphan.user_id, mealDate: orphan.meal_date },
        orphan.photo_id,
        'reconciliation-enqueue',
      );
    }

    return orphans.length;
  }

  // R2 object reconciliation (ADR-009) — piggybacks on this same hourly run.
  private async r2Reconciliation(): Promise<void> {
    const objects = await this.r2.listAllObjects();
    if (objects.length === 0) return;

    const existing = await this.prisma.photo.findMany({
      where: { r2ObjectKey: { in: objects.map((object) => object.key) } },
      select: { r2ObjectKey: true },
    });
    const existingKeys = new Set(existing.map((photo) => photo.r2ObjectKey));
    const graceCutoff = Date.now() - 24 * 60 * 60 * 1000;

    for (const object of objects) {
      if (!existingKeys.has(object.key) && object.lastModified.getTime() < graceCutoff) {
        await this.r2.deleteObject(object.key);
      }
    }
  }

  private async collectCounts(runDate: Date) {
    const [messagesSent, messagesPending, sameDayDelivered, sameDayPending, catchupDelivered, catchupPending, failedPermanent] =
      await Promise.all([
        this.prisma.digestMessage.count({ where: { runDate, status: 'sent' } }),
        this.prisma.digestMessage.count({ where: { runDate, status: 'pending' } }),
        this.prisma.digestDelivery.count({ where: { mealDate: runDate, status: 'sent' } }),
        this.prisma.digestDelivery.count({ where: { mealDate: runDate, status: 'pending' } }),
        this.prisma.digestDelivery.count({ where: { mealDate: { lt: runDate }, status: 'sent' } }),
        this.prisma.digestDelivery.count({ where: { mealDate: { lt: runDate }, status: 'pending' } }),
        this.prisma.digestDelivery.count({ where: { status: 'failed_permanent' } }),
      ]);

    return { messagesSent, messagesPending, sameDayDelivered, sameDayPending, catchupDelivered, catchupPending, failedPermanent };
  }
}
