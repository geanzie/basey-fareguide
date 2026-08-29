-- Social sign-in (Google / Facebook) for PUBLIC users.
-- A user may link several provider identities; each provider identity maps to at most one user.

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'FACEBOOK');

-- AlterTable
-- Existing rows all registered with a password they chose, so the default is correct for them.
ALTER TABLE "users"
  ADD COLUMN "hasUsablePassword" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "user_oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "user_oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_oauth_accounts_provider_providerAccountId_key" ON "user_oauth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "user_oauth_accounts_userId_idx" ON "user_oauth_accounts"("userId");

-- AddForeignKey
ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
