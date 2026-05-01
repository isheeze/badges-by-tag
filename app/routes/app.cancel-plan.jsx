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
  const { billing } = await authenticate.admin(request);

  if (!BILLING_ENABLED) {
    throw redirect("/app/pricing");
  }

  try {
    await cancelProPlan({ billing });
  } catch (error) {
    const message = billingErrorMessage(error);
    console.error("Billing cancellation failed", {
      message,
      errorData: error?.errorData ?? null,
    });

    throw redirect(`/app/pricing?billing_error=${encodeURIComponent(message)}`);
  }

  throw redirect("/app/pricing");
};
