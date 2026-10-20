import express from "express";
import request from "supertest";
import prisma from "../../src/config/prisma";
import { AuthService } from "../../src/services/auth.service";
import pricingRouter from "../../src/modules/admin/subscriptions/plan-pricing.routes";
import subscriptionsRouter from "../../src/modules/subscriptions/subscriptions.routes";
import { createSubscriptionPaymentOrder, activateSubscriptionAfterPayment } from "../../src/modules/subscriptions/subscriptions.service";
import { createRazorpayOrder } from "../../src/modules/payments/razorpay.service";

jest.mock("../../src/config/prisma", () => ({
  __esModule: true,
  default: {
    adminAppSetting: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    adminLog: { create: jest.fn() },
    paymentTransaction: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    userPlanSubscription: { create: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("../../src/services/auth.service", () => ({ AuthService: { verifyAccessToken: jest.fn() } }));
jest.mock("../../src/modules/payments/razorpay.service", () => ({ createRazorpayOrder: jest.fn() }));
jest.mock("../../src/modules/events/event-ranking.service", () => ({
  syncOrganizerPlanTierForUser: jest.fn().mockResolvedValue(undefined),
}));

const db = prisma as unknown as {
  adminAppSetting: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
  adminLog: { create: jest.Mock };
  paymentTransaction: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  userPlanSubscription: { create: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};
const verify = AuthService.verifyAccessToken as jest.Mock;
const gateway = createRazorpayOrder as jest.Mock;
const saved = new Map<string, { amountInr: number }>();
const app = express();
app.use(express.json());
app.use("/api/admin/subscription-plans", pricingRouter);
app.use("/api", subscriptionsRouter);

function admin(role = "SUPER_ADMIN", permissions: string[] = []) {
  verify.mockReturnValue({ sub: "admin-1", role, domain: "ADMIN", permissions });
}

beforeEach(() => {
  jest.clearAllMocks();
  saved.clear();
  admin();
  db.adminAppSetting.findUnique.mockImplementation(async ({ where }) =>
    saved.has(where.key) ? { key: where.key, value: saved.get(where.key) } : null);
  db.adminAppSetting.findMany.mockImplementation(async ({ where }) =>
    [...saved].filter(([key]) => where.key.in.includes(key)).map(([key, value]) => ({ key, value })));
  db.adminAppSetting.upsert.mockImplementation(async ({ where, update }) => {
    saved.set(where.key, update.value);
    return { key: where.key, value: update.value };
  });
  db.adminLog.create.mockResolvedValue({});
  db.$transaction.mockImplementation(async (callback) => callback(prisma));
  db.paymentTransaction.create.mockResolvedValue({ id: "payment-1" });
  gateway.mockImplementation(async ({ amount }) => ({ ok: true, orderId: "order-1", amount, currency: "INR" }));
});

it("serves all four organizer defaults publicly without creating settings", async () => {
  const response = await request(app).get("/api/subscriptions/plans?role=ORGANIZER").expect(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.body.data.map((plan: { amountInr: number }) => plan.amountInr)).toEqual([0, 10000, 25000, 50000]);
  expect(db.adminAppSetting.upsert).not.toHaveBeenCalled();
});

it("saves an audited price used by both public pricing and Razorpay orders", async () => {
  await request(app).patch("/api/admin/subscription-plans/organizer-silver")
    .set("Authorization", "Bearer admin").send({ amountInr: 12345.67 }).expect(200);
  expect(db.adminLog.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ adminId: "admin-1", resourceId: "organizer-silver",
      details: { previousAmountInr: 10000, amountInr: 12345.67, currency: "INR" } }),
  }));
  const response = await request(app).get("/api/subscriptions/plans?role=ORGANIZER").expect(200);
  expect(response.body.data[1].amountInr).toBe(12345.67);
  expect(response.body.data[2].amountInr).toBe(25000);
  const order = await createSubscriptionPaymentOrder({
    userId: "user-1", role: "ORGANIZER", planSlug: "organizer-silver", expectedAmountInr: 12345.67,
  });
  expect(order).toMatchObject({ amount: 1234567, plan: { amountInr: 12345.67 } });
  expect(gateway).toHaveBeenCalledWith(expect.objectContaining({ amount: 1234567 }));
  expect(db.paymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ amountInr: 12345.67, amountPaise: 1234567 }),
  }));
});

it("rejects stale displayed prices before contacting the gateway", async () => {
  saved.set("subscription-price:organizer-gold", { amountInr: 30000 });
  const result = await createSubscriptionPaymentOrder({
    userId: "user-1", role: "ORGANIZER", planSlug: "organizer-gold", expectedAmountInr: 25000,
  });
  expect(result).toMatchObject({ error: "PRICE_CHANGED" });
  expect(gateway).not.toHaveBeenCalled();
  expect(db.paymentTransaction.create).not.toHaveBeenCalled();
});

it.each([null, "", "12000", 0, -1, 0.99, 1.001, 10000000.01, {}, true])(
  "rejects invalid admin amount %p without writing", async (amountInr) => {
    await request(app).patch("/api/admin/subscription-plans/organizer-silver")
      .set("Authorization", "Bearer admin").send({ amountInr }).expect(400);
    expect(db.adminAppSetting.upsert).not.toHaveBeenCalled();
    expect(db.adminLog.create).not.toHaveBeenCalled();
  },
);

it.each([1, 1.01, 10000000])("accepts valid amount %p", async (amountInr) => {
  const response = await request(app).patch("/api/admin/subscription-plans/organizer-silver")
    .set("Authorization", "Bearer admin").send({ amountInr }).expect(200);
  expect(response.body.data.amountInr).toBe(amountInr);
});

it("keeps the Free plan at zero and rejects unrelated plans", async () => {
  await request(app).patch("/api/admin/subscription-plans/organizer-free")
    .set("Authorization", "Bearer admin").send({ amountInr: 100 }).expect(400);
  await request(app).patch("/api/admin/subscription-plans/visitor-user")
    .set("Authorization", "Bearer admin").send({ amountInr: 100 }).expect(404);
  expect(db.adminAppSetting.upsert).not.toHaveBeenCalled();
});

it("requires admin authentication for reads and writes", async () => {
  await request(app).get("/api/admin/subscription-plans").expect(401);
  await request(app).patch("/api/admin/subscription-plans/organizer-gold").send({ amountInr: 200 }).expect(401);
  verify.mockReturnValue({ sub: "user-1", role: "ORGANIZER", domain: "USER" });
  await request(app).get("/api/admin/subscription-plans").set("Authorization", "Bearer user").expect(403);
  await request(app).patch("/api/admin/subscription-plans/organizer-gold")
    .set("Authorization", "Bearer user").send({ amountInr: 200 }).expect(403);
  expect(db.adminAppSetting.upsert).not.toHaveBeenCalled();
});

it("requires the new permission for sub-admins on both reads and writes", async () => {
  admin("SUB_ADMIN", ["financial-subscriptions"]);
  await request(app).get("/api/admin/subscription-plans").set("Authorization", "Bearer sub").expect(403);
  await request(app).patch("/api/admin/subscription-plans/organizer-gold")
    .set("Authorization", "Bearer sub").send({ amountInr: 200 }).expect(403);
  admin("SUB_ADMIN", ["subscription-plans"]);
  await request(app).get("/api/admin/subscription-plans").set("Authorization", "Bearer sub").expect(200);
  await request(app).patch("/api/admin/subscription-plans/organizer-gold")
    .set("Authorization", "Bearer sub").send({ amountInr: 200 }).expect(200);
  expect(db.adminLog.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ adminType: "SUB_ADMIN" }),
  }));
});

it("fails closed when saved prices cannot be read", async () => {
  db.adminAppSetting.findMany.mockRejectedValueOnce(new Error("database unavailable"));
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  await request(app).get("/api/subscriptions/plans?role=ORGANIZER").expect(500);
  db.adminAppSetting.findUnique.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(createSubscriptionPaymentOrder({
    userId: "user-1", role: "ORGANIZER", planSlug: "organizer-silver",
  })).rejects.toThrow("database unavailable");
  expect(gateway).not.toHaveBeenCalled();
  log.mockRestore();
});

it("rejects an invalid public role", async () => {
  await request(app).get("/api/subscriptions/plans?role=ADMIN").expect(400);
});

it("leaves visitor and exhibitor prices unchanged", async () => {
  saved.set("subscription-price:organizer-silver", { amountInr: 12000 });
  const response = await request(app).get("/api/subscriptions/plans?role=VISITOR").expect(200);
  expect(response.body.data.map((plan: { amountInr: number }) => plan.amountInr)).toEqual([0, 2000, 5000]);
  const exhibitor = await request(app).get("/api/subscriptions/plans?role=EXHIBITOR").expect(200);
  expect(exhibitor.body.data.map((plan: { amountInr: number }) => plan.amountInr)).toEqual([0, 10000, 12999]);
});

it("activates an existing paid order at its original amount after prices change", async () => {
  saved.set("subscription-price:organizer-silver", { amountInr: 15000 });
  db.paymentTransaction.findUnique.mockResolvedValue({
    id: "paid-before-change", userId: "user-1", purpose: "SUBSCRIPTION", status: "PAID",
    userPlanSubscription: null, planSlug: "organizer-silver", subscriptionRole: "ORGANIZER",
    planName: "Silver Plan", billingNote: "per year", amountInr: 10000,
  });
  db.userPlanSubscription.create.mockImplementation(async ({ data }) => ({
    ...data, id: "subscription-1", createdAt: new Date(), updatedAt: new Date(),
  }));
  const result = await activateSubscriptionAfterPayment({ userId: "user-1", paymentTransactionId: "paid-before-change" });
  expect(result).toMatchObject({ success: true, subscription: { amountInr: 10000 } });
  expect(db.userPlanSubscription.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ amountInr: 10000, paymentTransactionId: "paid-before-change" }),
  });
});
