-- DropIndex
DROP INDEX "photos_meal_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "photos_meal_id_upload_order_key" ON "photos"("meal_id", "upload_order");
