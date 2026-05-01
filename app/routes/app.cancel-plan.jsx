import { Buffer } from "node:buffer";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

export default function CancelPlanRoute() {
  return null;
}

function billingErrorMessage(error) {
  const errorData = error?.errorData ?? error?.response?.errors ?? null;
  const firstMessage = Array.isArray(errorData)
    ? errorData.map((item) => item?.message).find(Boolean)
    : errorData?.message;

  return firstMessage || error?.message || "Shopify could not cancel the active subscription.";
}

export const loader = async ({ request }) => {
  return cancelPlan(request);
};

export const action = async ({ request }) => {
  return cancelPlan(request);
};

async function cancelPlan(request) {
  const { cancelProPlan, BILLING_ENABLED, FREE_BADGE_LIMIT } = await import("../lib/billing.server.js");
  const { getBadgeMappings, setBadgeMappings } = await import("../lib/badge-metafields.server.js");
  const { admin, billing, session } = await authenticate.admin(request);
  const pricingUrl = buildPricingUrl(request, session.shop);

  if (!BILLING_ENABLED) {
    throw redirect(pricingUrl);
  }

  let cancelled = false;
  try {
    await cancelProPlan({ billing });
    cancelled = true;
  } catch (error) {
    const message = billingErrorMessage(error);
    console.error("Billing cancellation failed", {
      message,
      errorData: error?.errorData ?? null,
    });

    if (!isAlreadyFreeBillingError(message)) {
      throw redirect(buildPricingUrl(request, session.shop, { billing_error: message }));
    }
  }

  const trimResult = await trimMappingsToFreeLimit({
    admin,
    freeLimit: FREE_BADGE_LIMIT,
    getBadgeMappings,
    setBadgeMappings,
  });
  const status = trimResult.trimmed
    ? { plan_notice: `Downgraded to Free. Kept the first ${FREE_BADGE_LIMIT} badge mappings and removed ${trimResult.removedCount}.` }
    : cancelled
      ? { plan_notice: "Downgraded to Free." }
      : {};

  throw redirect(buildPricingUrl(request, session.shop, status));
}

function isAlreadyFreeBillingError(message) {
  const normalized = message.toLowerCase();
  return normalized.includes("not found") || normalized.includes("does not exist") || normalized.includes("no active");
}

async function trimMappingsToFreeLimit({ admin, freeLimit, getBadgeMappings, setBadgeMappings }) {
  const mappings = await getBadgeMappings(admin);
  if (mappings.length <= freeLimit) {
    return { trimmed: false, removedCount: 0 };
  }

  const keptMappings = mappings.slice(0, freeLimit);
  await setBadgeMappings(admin, keptMappings);

  return {
    trimmed: true,
    removedCount: mappings.length - keptMappings.length,
  };
}

function buildPricingUrl(request, shopDomain, extraParams = {}) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  params.set("shop", shopDomain);
  params.set("embedded", "1");
  if (!params.get("host")) {
    const shopName = shopDomain.replace(".myshopify.com", "");
    params.set("host", Buffer.from(`admin.shopify.com/store/${shopName}`).toString("base64"));
  }
  params.delete("billing_error");
  params.delete("plan_notice");
  params.delete("id_token");

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return `/app/pricing?${params.toString()}`;
}
