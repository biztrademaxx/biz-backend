import crypto from "crypto";

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

function getRazorpayCredentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export type RazorpayOrderResult =
  | { ok: true; orderId: string; amount: number; currency: string }
  | { ok: false; status: 401 | 500; message: string };

export async function createRazorpayOrder(params: {
  amount: number;
  currency?: string;
  receipt: string;
}): Promise<RazorpayOrderResult> {
  const creds = getRazorpayCredentials();
  if (!creds) {
    return {
      ok: false,
      status: 500,
      message: "Razorpay credentials are not configured on the server",
    };
  }

  const currency = params.currency ?? "INR";

  try {
    const response = await fetch(RAZORPAY_ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuthHeader(creds.keyId, creds.keySecret),
      },
      body: JSON.stringify({
        amount: params.amount,
        currency,
        receipt: params.receipt,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      amount?: number;
      currency?: string;
      error?: { description?: string; code?: string };
    };

    if (response.status === 401) {
      const detail = data.error?.description ?? "Invalid Key ID or Key Secret";
      console.error("Razorpay auth failed:", detail, "keyId:", creds.keyId.slice(0, 12) + "...");
      return {
        ok: false,
        status: 401,
        message:
          "Razorpay authentication failed. Regenerate Test API keys in Razorpay Dashboard → Account & Settings → API Keys, update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env, then restart the server.",
      };
    }

    if (!response.ok || !data.id) {
      const detail = data.error?.description ?? data.error?.code ?? "Failed to create order";
      return { ok: false, status: 500, message: detail };
    }

    return {
      ok: true,
      orderId: data.id,
      amount: data.amount ?? params.amount,
      currency: data.currency ?? currency,
    };
  } catch (error) {
    console.error("Razorpay create order error:", error);
    return { ok: false, status: 500, message: "Failed to create Razorpay order" };
  }
}

export type VerifyPaymentResult =
  | { ok: true }
  | { ok: false; status: 400 | 500; message: string };

export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): VerifyPaymentResult {
  const creds = getRazorpayCredentials();
  if (!creds) {
    return { ok: false, status: 500, message: "Razorpay credentials are not configured on the server" };
  }

  const { orderId, paymentId, signature } = params;
  if (!orderId || !paymentId || !signature) {
    return { ok: false, status: 400, message: "Missing payment verification fields" };
  }

  const expected = crypto
    .createHmac("sha256", creds.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expected !== signature) {
    return { ok: false, status: 400, message: "Payment signature verification failed" };
  }

  return { ok: true };
}
