-- User feedback about the system itself (not about a ride, which is an incident report).
-- Any signed-in user submits one; an admin triages it by moving the status and adding notes.

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('FARE_CALCULATOR', 'MAP_ROUTES', 'ACCOUNT', 'BUG', 'SUGGESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "rating" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_feedback_status_createdAt_idx" ON "user_feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "user_feedback_userId_idx" ON "user_feedback"("userId");

-- CreateIndex
CREATE INDEX "user_feedback_category_idx" ON "user_feedback"("category");

-- AddForeignKey
-- The submission belongs to the account: delete the account, delete what it said.
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- The reviewing admin is optional audit metadata: keep the feedback if that account goes away.
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
