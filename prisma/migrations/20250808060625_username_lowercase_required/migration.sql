/*
  Warnings:

  - Made the column `username_lowercase` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "username_lowercase" SET NOT NULL;
