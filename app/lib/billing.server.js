export const PLAN_PRO = "Pro";
export const FREE_BADGE_LIMIT = Number(process.env.FREE_BADGE_LIMIT || 3);
export const BILLING_ENABLED = process.env.BILLING_ENABLED === "1";

export async function getActivePlan(billing) {
  if (!BILLING_ENABLED) {
    return { hasPro: false, charge: null, enabled: false };
  }

  try {
    const result = await billing.check({
      plans: [PLAN_PRO],
      isTest: process.env.NODE_ENV !== "production",
    });

    return {
      hasPro: Boolean(result?.hasActivePayment),
      charge: result?.appSubscriptions?.[0] ?? null,
      enabled: true,
    };
  } catch (error) {
    console.warn("Billing check failed", error);
    return { hasPro: false, charge: null, enabled: true };
  }
}

export async function requestProPlan({ billing }) {
  if (!BILLING_ENABLED) {
    return null;
  }

  if (!process.env.SHOPIFY_APP_URL) {
    throw new Error("SHOPIFY_APP_URL is required before billing can be requested.");
  }

  const returnUrl = new URL("/app/badges", process.env.SHOPIFY_APP_URL).toString();

  await billing.request({
    plan: PLAN_PRO,
    isTest: process.env.NODE_ENV !== "production",
    returnUrl,
  });
}

export async function cancelProPlan({ billing }) {
  if (!BILLING_ENABLED) {
    return null;
  }

  const plan = await getActivePlan(billing);
  const subscriptionId = plan.charge?.id;

  if (!subscriptionId) {
    return null;
  }

  return billing.cancel({
    subscriptionId,
    isTest: process.env.NODE_ENV !== "production",
    prorate: true,
  });
}

export function isPlanLimitExceeded({ hasPro, mappingCount }) {
  return !hasPro && mappingCount > FREE_BADGE_LIMIT;
}
