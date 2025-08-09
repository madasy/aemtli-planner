-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "exceptions" TEXT[] DEFAULT ARRAY[]::TEXT[];
