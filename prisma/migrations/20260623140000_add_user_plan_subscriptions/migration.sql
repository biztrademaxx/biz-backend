-- Extend payment_transactions for subscription checkout; add user_plan_subscriptions.

ALTER TABLE "payment_transactions" ALTER COLUMN "promotionChannel" DROP NOT NULL;
ALTER TABLE "payment_transactions" ALTER COLUMN "packageType" DROP NOT NULL;
ALTER TABLE "payment_transactions" ALTER COLUMN "durationDays" DROP NOT NULL;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "subscriptionRole" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "planSlug" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "planName" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "billingNote" TEXT;

CREATE INDEX IF NOT EXISTS "payment_transactions_purpose_subscriptionRole_idx"
  ON "payment_transactions"("purpose", "subscriptionRole");

CREATE TABLE IF NOT EXISTS "user_plan_subscriptions" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "planSlug" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "billingNote" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "amountInr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "paymentTransactionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_plan_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_plan_subscriptions_paymentTransactionId_key"
  ON "user_plan_subscriptions"("paymentTransactionId");

CREATE INDEX IF NOT EXISTS "user_plan_subscriptions_userId_role_status_idx"
  ON "user_plan_subscriptions"("userId", "role", "status");

CREATE INDEX IF NOT EXISTS "user_plan_subscriptions_planSlug_idx"
  ON "user_plan_subscriptions"("planSlug");

ALTER TABLE "user_plan_subscriptions"
  ADD CONSTRAINT "user_plan_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_plan_subscriptions"
  ADD CONSTRAINT "user_plan_subscriptions_paymentTransactionId_fkey"
  FOREIGN KEY ("paymentTransactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
