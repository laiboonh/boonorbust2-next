-- AlterTable assets: add missing columns
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "price_currency"    TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "price_updated_at"  TIMESTAMP(3);
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "dividend_updated_at" TIMESTAMP(3);

-- AlterTable asset_tags: add user_id, backfill from tags, then set NOT NULL
ALTER TABLE "asset_tags" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

UPDATE "asset_tags" at
SET "user_id" = (SELECT "user_id" FROM "tags" WHERE "id" = at.tag_id)
WHERE at."user_id" IS NULL;

ALTER TABLE "asset_tags" ALTER COLUMN "user_id" SET NOT NULL;
