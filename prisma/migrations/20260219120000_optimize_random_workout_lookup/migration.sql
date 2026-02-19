-- CreateIndex
CREATE INDEX "idx_workouts_is_published_id" ON "Workout"("isPublished", "id");

-- CreateIndex
CREATE INDEX "idx_workouts_is_published_timecap_id" ON "Workout"("isPublished", "timeCapSeconds", "id");
