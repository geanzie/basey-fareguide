-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordResetOtp" TEXT,
ADD COLUMN     "passwordResetOtpExpiry" TIMESTAMP(3);
