-- CreateEnum
CREATE TYPE "DutyKind" AS ENUM ('FIXED', 'HONOR');

-- CreateTable
CREATE TABLE "Duty" (
    "id" SERIAL NOT NULL,
    "kind" "DutyKind" NOT NULL,
    "label" TEXT NOT NULL,
    "assignees" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Duty_pkey" PRIMARY KEY ("id")
);
