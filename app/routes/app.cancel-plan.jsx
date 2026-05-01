import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

function billingErrorMessage(error) {
  const errorData = error?.errorData ?? error?.response?.errors ?? null;
  const firstMessage = Array.isArray(errorData)
    ? errorData.map((item) => item?.message).find(Boolean)
    : errorData?.message;

  return firstMessage || error?.message || "Shopify could not cancel the active subscription.";
}

export const loader = async () => {
  throw redirect("/app/pricing");
};

export const action = async ({ request }) => {
  const { cancelProPlan, BILLING_ENABLED } = await import("../lib/billing.server.js");
  const { billing, session } = await authenticate.admin(request);
  const pricingUrl = buildPricingUrl(request, session.shop);

  if (!BILLING_ENABLED) {
    throw redirect(pricingUrl);
  }

  try {
    await cancelProPlan({ billing });
  } catch (error) {
    const message = billingErrorMessage(error);
    console.error("Billing cancellation failed", {
      message,
      errorData: error?.errorData ?? null,
    });

    throw redirect(buildPricingUrl(request, session.shop, { billing_error: message }));
  }

  throw redirect(pricingUrl);
};

function buildPricingUrl(request, shopDomain, extraParams = {}) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  params.set("shop", shopDomain);
  params.set("embedded", "1");
  params.delete("id_token");

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return `/app/pricing?${params.toString()}`;
}
