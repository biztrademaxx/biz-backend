-- Payment transactions for Razorpay promotion checkout (backend source of truth).

CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "purpose" TEXT NOT NULL DEFAULT 'PROMOTION',
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "receipt" TEXT NOT NULL,
    "promotionChannel" TEXT NOT NULL,
    "eventId" UUID,
    "organizerId" UUID,
    "exhibitorId" UUID,
    "packageType" TEXT NOT NULL,
    "targetCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durationDays" INTEGER NOT NULL,
    "amountInr" DOUBLE PRECISION NOT NULL,
    "promotionId" UUID,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_transactions_razorpayOrderId_key" ON "payment_transactions"("razorpayOrderId");
CREATE UNIQUE INDEX "payment_transactions_razorpayPaymentId_key" ON "payment_transactions"("razorpayPaymentId");
CREATE UNIQUE INDEX "payment_transactions_promotionId_key" ON "payment_transactions"("promotionId");
CREATE INDEX "payment_transactions_userId_status_idx" ON "payment_transactions"("userId", "status");
CREATE INDEX "payment_transactions_promotionChannel_eventId_idx" ON "payment_transactions"("promotionChannel", "eventId");

ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
