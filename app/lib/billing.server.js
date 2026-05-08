export const PLAN_PRO = "Pro";
export const FREE_BADGE_LIMIT = Number(process.env.FREE_BADGE_LIMIT || 3);
export const BILLING_ENABLED = process.env.BILLING_ENABLED === "1";
const BILLING_TEST_MODE = process.env.NODE_ENV !== "production";

export async function getActivePlan(billing, admin) {
  if (!BILLING_ENABLED) {
    return { hasPro: false, charge: null, enabled: false };
  }

  try {
    const result = await billing.check({
      plans: [PLAN_PRO],
      isTest: BILLING_TEST_MODE,
    });

    if (result?.hasActivePayment) {
      return {
        hasPro: true,
        charge: result?.appSubscriptions?.[0] ?? null,
        enabled: true,
      };
    }
  } catch (error) {
    console.warn("Billing check failed", error);
  }

  const activeSubscription = await getActiveProSubscription(admin);
  return {
    hasPro: Boolean(activeSubscription),
    charge: activeSubscription,
    enabled: true,
  };
}

export async function requestProPlan({ billing }) {
  if (!BILLING_ENABLED) {
    return null;
  }

  if (!process.env.SHOPIFY_APP_URL) {
    throw new Error("SHOPIFY_APP_URL is required before billing can be requested.");
  }

  await billing.request({
    plan: PLAN_PRO,
    isTest: BILLING_TEST_MODE,
  });
}

export async function cancelProPlan({ billing, admin }) {
  if (!BILLING_ENABLED) {
    return null;
  }

  const plan = await getActivePlan(billing, admin);
  const subscriptionId = plan.charge?.id;

  if (!subscriptionId) {
    return null;
  }

  return billing.cancel({
    subscriptionId,
    isTest: BILLING_TEST_MODE,
    prorate: true,
  });
}

export function isPlanLimitExceeded({ hasPro, mappingCount }) {
  return !hasPro && mappingCount > FREE_BADGE_LIMIT;
}

async function getActiveProSubscription(admin) {
  if (!admin) {
    return null;
  }

  try {
    const response = await admin.graphql(
      `#graphql
      query ActiveAppSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
          }
        }
      }`,
    );
    const result = await response.json();
    const subscriptions = result?.data?.currentAppInstallation?.activeSubscriptions ?? [];

    return subscriptions.find((subscription) => subscription?.name === PLAN_PRO && subscription?.status === "ACTIVE") ?? null;
  } catch (error) {
    console.warn("Active subscription query failed", error);
    return null;
  }
}
