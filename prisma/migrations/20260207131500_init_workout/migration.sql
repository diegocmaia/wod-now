-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "timeCapSeconds" INTEGER NOT NULL,
    "equipment" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false
);
