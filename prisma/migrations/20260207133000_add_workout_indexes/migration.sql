-- CreateIndex
CREATE INDEX "idx_workouts_is_published" ON "Workout"("isPublished");

-- CreateIndex
CREATE INDEX "idx_workouts_id_lookup" ON "Workout"("id");
