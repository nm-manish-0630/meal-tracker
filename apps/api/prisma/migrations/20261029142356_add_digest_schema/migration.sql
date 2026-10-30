-- AlterTable
ALTER TABLE "users" ADD COLUMN     "trainer_group_id" UUID;

-- CreateTable
CREATE TABLE "trainer_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "digest_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "channel_identifier" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" UUID NOT NULL,
    "digest_time" TIME NOT NULL DEFAULT '20:00:00',
    "digest_time_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_runs" (
    "id" UUID NOT NULL,
    "run_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "window_opened_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_messages" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "run_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "slack_channel_id" TEXT,
    "slack_message_ts" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "attempt_log" JSONB NOT NULL DEFAULT '[]',
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_deliveries" (
    "id" UUID NOT NULL,
    "digest_message_id" UUID,
    "meal_id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "trainer_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "photo_progress" JSONB NOT NULL DEFAULT '[]',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "attempt_log" JSONB NOT NULL DEFAULT '[]',
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digest_runs_run_date_key" ON "digest_runs"("run_date");

-- CreateIndex
CREATE UNIQUE INDEX "digest_messages_trainer_id_run_date_key" ON "digest_messages"("trainer_id", "run_date");

-- CreateIndex
CREATE UNIQUE INDEX "digest_deliveries_meal_id_trainer_id_key" ON "digest_deliveries"("meal_id", "trainer_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_trainer_group_id_fkey" FOREIGN KEY ("trainer_group_id") REFERENCES "trainer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_messages" ADD CONSTRAINT "digest_messages_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_digest_message_id_fkey" FOREIGN KEY ("digest_message_id") REFERENCES "digest_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
