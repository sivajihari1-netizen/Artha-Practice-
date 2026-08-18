-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "categoryOptionId" TEXT,
ADD COLUMN     "statusOptionId" TEXT;

-- CreateTable
CREATE TABLE "TaskStatusOption" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "systemKey" TEXT,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStatusOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCategoryOption" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "systemKey" TEXT,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCategoryOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskStatusOption_firmId_sortOrder_idx" ON "TaskStatusOption"("firmId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TaskStatusOption_firmId_key_key" ON "TaskStatusOption"("firmId", "key");

-- CreateIndex
CREATE INDEX "TaskCategoryOption_firmId_sortOrder_idx" ON "TaskCategoryOption"("firmId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCategoryOption_firmId_key_key" ON "TaskCategoryOption"("firmId", "key");

-- AddForeignKey
ALTER TABLE "TaskStatusOption" ADD CONSTRAINT "TaskStatusOption_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCategoryOption" ADD CONSTRAINT "TaskCategoryOption_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_statusOptionId_fkey" FOREIGN KEY ("statusOptionId") REFERENCES "TaskStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryOptionId_fkey" FOREIGN KEY ("categoryOptionId") REFERENCES "TaskCategoryOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
