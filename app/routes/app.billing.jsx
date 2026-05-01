import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

function serializeBillingError(error) {
  const errorData = error?.errorData ?? error?.response?.errors ?? null;
  const firstMessage = Array.isArray(errorData)
    ? errorData.map((item) => item?.message).find(Boolean)
    : errorData?.message;

  return firstMessage || error?.message || "Shopify could not start the billing confirmation flow.";
}

export const loader = async ({ request }) => {
  const { getActivePlan, requestProPlan, BILLING_ENABLED } = await import("../lib/billing.server.js");
  const { billing } = await authenticate.admin(request);

  if (!BILLING_ENABLED) {
    throw redirect("/app/pricing");
  }

  const plan = await getActivePlan(billing);
  if (plan.hasPro) {
    throw redirect("/app/badges");
  }

  try {
    await requestProPlan({ billing });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    const message = serializeBillingError(error);
    console.error("Billing request failed", {
      message,
      name: error?.name ?? null,
      status: error?.response?.code ?? error?.response?.status ?? null,
      errorData: error?.errorData ?? null,
    });

    throw redirect(`/app/pricing?billing_error=${encodeURIComponent(message)}`);
  }

  throw redirect("/app/badges");
};
