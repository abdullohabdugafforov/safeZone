-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'SECOND_SPACE_ENTERED';
ALTER TYPE "AlertType" ADD VALUE 'SECOND_SPACE_LEFT';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "in_other_space" BOOLEAN NOT NULL DEFAULT false;
