/* eslint-disable react/prop-types */
import { Buffer } from "node:buffer";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const PRO_PRICE = "$4.99";
const PRO_TRIAL_DAYS = 7;

export const loader = async ({ request }) => {
  const { getActivePlan, FREE_BADGE_LIMIT, BILLING_ENABLED } = await import("../lib/billing.server.js");
  const url = new URL(request.url);
  const { billing, session } = await authenticate.admin(request);
  const plan = await getActivePlan(billing);

  return {
    billing: {
      enabled: BILLING_ENABLED,
      hasPro: plan.hasPro,
      freeLimit: FREE_BADGE_LIMIT,
      limitLabel: plan.hasPro ? "Unlimited" : String(FREE_BADGE_LIMIT),
      trialDays: PRO_TRIAL_DAYS,
      error: url.searchParams.get("billing_error"),
      notice: url.searchParams.get("plan_notice"),
      upgradeUrl: buildEmbeddedAppUrl("/app/billing", session.shop, url.searchParams),
      cancelUrl: buildEmbeddedAppUrl("/app/pricing", session.shop, url.searchParams, { billing_action: "cancel" }),
    },
  };
};

export const action = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("billing_action") !== "cancel") {
    throw redirect(buildEmbeddedAppUrl("/app/pricing", getShopFromParams(url.searchParams), url.searchParams));
  }

  return cancelPlan(request);
};

function buildEmbeddedAppUrl(pathname, shopDomain, currentParams, extraParams = {}) {
  const params = new URLSearchParams(currentParams);
  params.set("shop", shopDomain);
  params.set("embedded", "1");

  if (!params.get("host")) {
    const shopName = shopDomain.replace(".myshopify.com", "");
    params.set("host", Buffer.from(`admin.shopify.com/store/${shopName}`).toString("base64"));
  }

  params.delete("id_token");
  params.delete("billing_error");
  params.delete("plan_notice");
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return `${pathname}?${params.toString()}`;
}

function getShopFromParams(params) {
  return params.get("shop") || "";
}

function billingErrorMessage(error) {
  const errorData = error?.errorData ?? error?.response?.errors ?? null;
  const firstMessage = Array.isArray(errorData)
    ? errorData.map((item) => item?.message).find(Boolean)
    : errorData?.message;

  return firstMessage || error?.message || "Shopify could not cancel the active subscription.";
}

async function cancelPlan(request) {
  const { cancelProPlan, BILLING_ENABLED, FREE_BADGE_LIMIT } = await import("../lib/billing.server.js");
  const { getBadgeMappings, setBadgeMappings } = await import("../lib/badge-metafields.server.js");
  const url = new URL(request.url);
  const { admin, billing, session } = await authenticate.admin(request);
  const pricingUrl = buildEmbeddedAppUrl("/app/pricing", session.shop, url.searchParams);

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
      throw redirect(buildEmbeddedAppUrl("/app/pricing", session.shop, url.searchParams, { billing_error: message }));
    }
  }

  const trimResult = await trimMappingsToFreeLimit({
    admin,
    freeLimit: FREE_BADGE_LIMIT,
    getBadgeMappings,
    setBadgeMappings,
  });
  const notice = trimResult.trimmed
    ? `Downgraded to Free. Kept the first ${FREE_BADGE_LIMIT} badge mappings and removed ${trimResult.removedCount}.`
    : cancelled
      ? "Downgraded to Free."
      : "Free plan is active.";

  throw redirect(buildEmbeddedAppUrl("/app/pricing", session.shop, url.searchParams, { plan_notice: notice }));
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

function PlanCard({ title, price, cadence, description, features, action, highlighted, current }) {
  return (
    <div style={highlighted ? styles.featuredCard : styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.planTitle}>{title}</h2>
        {current ? <span style={styles.currentBadge}>Current</span> : null}
      </div>
      <div>
        <span style={styles.price}>{price}</span>
        {cadence ? <span style={styles.cadence}>{cadence}</span> : null}
      </div>
      <p style={styles.subdued}>{description}</p>
      <ul style={styles.featureList}>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
      <div style={styles.action}>{action}</div>
    </div>
  );
}

function CompareRow({ label, free, pro }) {
  return (
    <div style={styles.compareRow}>
      <div style={styles.compareLabel}>{label}</div>
      <div>{free}</div>
      <div>{pro}</div>
    </div>
  );
}

function DowngradeAction({ cancelUrl, freeLimit }) {
  function handleDowngrade() {
    const confirmed = window.confirm(
      `Downgrading to Free keeps the first ${freeLimit} badge mappings and removes any extra mappings. Continue?`,
    );

    if (confirmed) {
      const form = document.createElement("form");
      form.method = "post";
      form.action = cancelUrl;
      form.style.display = "none";
      document.body.appendChild(form);
      form.submit();
    }
  }

  return (
    <div style={styles.downgradeStack}>
      <p style={styles.warningText}>Downgrading keeps the first {freeLimit} badge mappings and removes any extra mappings.</p>
      <button type="button" onClick={handleDowngrade} style={styles.dangerButton}>Downgrade to Free</button>
    </div>
  );
}

export default function PricingPage() {
  const { billing } = useLoaderData();
  const currentPlan = billing.enabled && billing.hasPro ? "Pro" : "Free";

  return (
    <s-page heading="Pricing">
      <s-section>
        <div style={styles.headerPanel}>
          <div>
            <h2 style={styles.heading}>Choose the right badge plan</h2>
            <p style={styles.subdued}>Start with a small free setup, then upgrade when the store needs more badge campaigns.</p>
          </div>
          <div style={styles.currentPlanBox}>
            <div style={styles.currentPlanRow}>
              <span style={styles.currentPlanLabel}>Current plan</span>
              <strong>{currentPlan}</strong>
            </div>
            <div style={styles.currentPlanRow}>
              <span style={styles.currentPlanLabel}>Limit</span>
              <strong>{billing.limitLabel}</strong>
            </div>
          </div>
        </div>

        {billing.error ? (
          <div style={styles.alert}>
            <strong>Could not update billing.</strong>
            <p style={styles.noticeText}>{billing.error}</p>
          </div>
        ) : null}
        {billing.notice ? (
          <div style={styles.success}>
            <strong>{billing.notice}</strong>
          </div>
        ) : null}

        <div style={styles.grid}>
          <PlanCard
            title="Free"
            price="$0"
            current={currentPlan === "Free"}
            description="For stores that need a small set of simple product badges."
            features={[
              `Up to ${billing.freeLimit} badge mappings`,
              "Theme app block",
              "Tag-based badge display",
              "Badge colors and style presets",
              "Storefront display controls",
            ]}
            action={<s-button href="/app/badges" variant={currentPlan === "Free" ? "primary" : undefined}>{currentPlan === "Free" ? "Manage badges" : "Use Free"}</s-button>}
          />
          <PlanCard
            title="Pro"
            price={PRO_PRICE}
            cadence="/ month"
            current={currentPlan === "Pro"}
            description="For stores that need more badge campaigns and advanced customization."
            highlighted
            features={[
              "Unlimited badge mappings",
              "All badge design presets",
              "All storefront display controls",
              "Priority setup workflow",
              `${billing.trialDays}-day free trial when billing is enabled`,
            ]}
            action={
              billing.hasPro ? (
                <DowngradeAction cancelUrl={billing.cancelUrl} freeLimit={billing.freeLimit} />
              ) :
              billing.enabled ? <a href={billing.upgradeUrl} style={styles.primaryButton}>Upgrade to Pro</a> :
              <s-button disabled>Available after public setup</s-button>
            }
          />
        </div>

        <div style={styles.panel}>
          <h2 style={styles.heading}>Plan comparison</h2>
          <div style={styles.compareTable}>
            <div style={styles.compareHeader}>
              <div></div>
              <strong>Free</strong>
              <strong>Pro</strong>
            </div>
            <CompareRow label="Badge mappings" free={`${billing.freeLimit} included`} pro="Unlimited" />
            <CompareRow label="Theme app block" free="Included" pro="Included" />
            <CompareRow label="Badge styles" free="Included" pro="Included" />
            <CompareRow label="Storefront display controls" free="Included" pro="Included" />
            <CompareRow label="Best for" free="New stores" pro="Growing catalog campaigns" />
          </div>
        </div>

        {!billing.enabled ? (
          <div style={styles.notice}>
            Billing is disabled for this development app because Shopify only allows Billing API charges for public-distribution apps. Before launch, set up public distribution and enable <code>BILLING_ENABLED=1</code>.
          </div>
        ) : null}

        <div style={styles.faqGrid}>
          <div style={styles.panel}>
            <h2 style={styles.heading}>Billing behavior</h2>
            <p style={styles.subdued}>Free-plan limits are enforced when badge mappings are saved. Stores on Pro can save unlimited mappings.</p>
          </div>
          <div style={styles.panel}>
            <h2 style={styles.heading}>Launch note</h2>
            <p style={styles.subdued}>The upgrade button starts Shopify&apos;s hosted billing confirmation when public billing is enabled.</p>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

const styles = {
  headerPanel: { border: "1px solid #dcdfe4", borderRadius: 8, background: "#fff", padding: 18, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "stretch" },
  card: { border: "1px solid #dcdfe4", borderRadius: 8, background: "#fff", padding: 18, display: "grid", gap: 12 },
  featuredCard: { border: "2px solid #008060", borderRadius: 8, background: "#fff", padding: 18, display: "grid", gap: 12 },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  heading: { margin: 0, fontSize: 16, lineHeight: "24px", fontWeight: 700, color: "#202223" },
  planTitle: { margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 700, color: "#202223" },
  price: { fontSize: 28, lineHeight: "34px", fontWeight: 750, color: "#202223" },
  cadence: { marginLeft: 4, color: "#616a75", fontSize: 14 },
  subdued: { margin: 0, color: "#616a75", lineHeight: "20px" },
  featureList: { margin: 0, paddingLeft: 0, color: "#202223", lineHeight: "24px", listStyle: "none" },
  action: { marginTop: 8 },
  downgradeStack: { display: "grid", gap: 10 },
  warningText: { margin: 0, color: "#6f4e00", lineHeight: "20px", fontSize: 13 },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 36, padding: "7px 12px", borderRadius: 6, background: "#008060", color: "#fff", fontWeight: 700, textDecoration: "none", border: "1px solid #008060" },
  dangerButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 36, padding: "7px 12px", borderRadius: 6, background: "#ffffff", color: "#8e1f0b", fontWeight: 700, border: "1px solid #d72c0d", textDecoration: "none", cursor: "pointer" },
  currentBadge: { borderRadius: 999, background: "#edf9f0", color: "#0b3d18", padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  currentPlanBox: { border: "1px solid #dcdfe4", borderRadius: 8, padding: "10px 12px", minWidth: 180, display: "grid", gap: 8 },
  currentPlanRow: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" },
  currentPlanLabel: { color: "#616a75", fontSize: 12, lineHeight: "16px" },
  panel: { border: "1px solid #dcdfe4", borderRadius: 8, background: "#fff", padding: 16, marginTop: 16 },
  compareTable: { overflowX: "auto" },
  compareHeader: { display: "grid", gridTemplateColumns: "minmax(160px, 1fr) minmax(90px, 160px) minmax(90px, 160px)", gap: 12, padding: "12px 0", borderBottom: "1px solid #edf0f2", minWidth: 360 },
  compareRow: { display: "grid", gridTemplateColumns: "minmax(160px, 1fr) minmax(90px, 160px) minmax(90px, 160px)", gap: 12, padding: "12px 0", borderBottom: "1px solid #edf0f2", lineHeight: "20px", minWidth: 360 },
  compareLabel: { fontWeight: 700, color: "#202223" },
  faqGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  notice: { marginTop: 16, border: "1px solid #b4c6e7", borderRadius: 8, background: "#eef4ff", color: "#082c5f", padding: 12, lineHeight: "20px" },
  alert: { marginBottom: 16, border: "1px solid #e6a3a3", borderRadius: 8, background: "#fff1f1", color: "#5c1111", padding: 12 },
  success: { marginBottom: 16, border: "1px solid #95c9a5", borderRadius: 8, background: "#edf9f0", color: "#0b3d18", padding: 12 },
  noticeText: { margin: "6px 0 0", lineHeight: "20px" },
};

export const headers = (headersArgs) => boundary.headers(headersArgs);
