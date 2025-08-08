/*
  Warnings:

  - A unique constraint covering the columns `[username_lowercase]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."User_username_key";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "username_lowercase" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_lowercase_key" ON "public"."User"("username_lowercase");
