/* eslint-disable react/prop-types */
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { getBadgeMappings } = await import("../lib/badge-metafields.server.js");
  const { getActivePlan, FREE_BADGE_LIMIT, BILLING_ENABLED } = await import("../lib/billing.server.js");
  const { admin, billing, session } = await authenticate.admin(request);
  const [mappings, publishedTheme, plan] = await Promise.all([
    getBadgeMappings(admin),
    getPublishedTheme(admin).catch(() => null),
    getActivePlan(billing),
  ]);
  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  return {
    badgeCount: mappings.length,
    hasBadges: mappings.length > 0,
    publishedThemeName: publishedTheme?.name ?? null,
    themeLinks: buildThemeEditorLinks(session.shop, apiKey),
    billing: {
      enabled: BILLING_ENABLED,
      hasPro: plan.hasPro,
      freeLimit: FREE_BADGE_LIMIT,
      limitLabel: plan.hasPro ? "Unlimited" : String(FREE_BADGE_LIMIT),
    },
  };
};

async function getPublishedTheme(admin) {
  const response = await admin.graphql(
    `#graphql
    query PublishedTheme {
      themes(first: 20) {
        nodes { id name role }
      }
    }`,
  );
  const result = await response.json();
  const themes = result?.data?.themes?.nodes ?? [];
  return themes.find((theme) => theme.role === "MAIN") ?? null;
}

function buildThemeEditorLinks(shopDomain, apiKey) {
  const blockId = `${apiKey}/product-badges`;
  const base = `https://${shopDomain}/admin/themes/current/editor`;

  return {
    home: `${base}?${new URLSearchParams({ template: "index", addAppBlockId: blockId, target: "newAppsSection" }).toString()}`,
    product: `${base}?${new URLSearchParams({ template: "product", addAppBlockId: blockId, target: "mainSection" }).toString()}`,
  };
}

function Step({ complete, title, children, action, status }) {
  return (
    <div style={styles.step}>
      <div style={complete ? styles.stepDone : styles.stepOpen}>
        {complete ? <span style={styles.checkIcon} aria-hidden="true" /> : null}
      </div>
      <div style={styles.stepBody}>
        <div style={styles.stepTitleRow}>
          <h3 style={styles.stepTitle}>{title}</h3>
          {status ? <span style={complete ? styles.statusDone : styles.statusOpen}>{status}</span> : null}
        </div>
        <p style={styles.subdued}>{children}</p>
      </div>
      {action ? <div style={styles.stepAction}>{action}</div> : null}
    </div>
  );
}

export default function HomePage() {
  const { badgeCount, hasBadges, publishedThemeName, themeLinks, billing } = useLoaderData();
  const planName = billing.enabled && billing.hasPro ? "Pro" : "Free";
  const withinFreeLimit = badgeCount <= billing.freeLimit;
  const themeDetected = Boolean(publishedThemeName);
  const billingReady = !billing.enabled || billing.hasPro || withinFreeLimit;
  const completedSteps = [hasBadges, themeDetected, billingReady].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 3) * 100);
  const nextAction = !hasBadges
    ? { label: "Create badge mappings", href: "/app/badges" }
    : !themeDetected
      ? { label: "Open theme editor", href: themeLinks.home, target: "_top" }
      : !billingReady
        ? { label: "View pricing", href: "/app/pricing" }
        : { label: "Manage badges", href: "/app/badges" };

  return (
    <s-page heading="Badges by Tag">
      <s-button slot="primary-action" variant="primary" href={nextAction.href} {...(nextAction.target ? { target: nextAction.target } : {})}>{nextAction.label}</s-button>
      <s-button slot="secondary-actions" href="/app/pricing">View pricing</s-button>

      <s-section>
        <div style={styles.grid}>
          <div style={styles.mainStack}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.heading}>Setup checklist</h2>
                  <p style={styles.subdued}>Finish the required setup before relying on badges in a live theme.</p>
                </div>
                <strong style={styles.progressNumber}>{progressPercent}%</strong>
              </div>
              <div style={styles.progressTrack} aria-label={`${progressPercent}% complete`}>
                <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
              </div>
              <div style={styles.steps}>
                <Step complete={hasBadges} title="Create badge mappings" status={hasBadges ? `${badgeCount} saved` : "Required"} action={<s-button href="/app/badges">Open badges</s-button>}>
                  Add product-tag rules like new, sale, or bestseller and choose the badge design.
                </Step>
                <Step complete={themeDetected} title="Confirm your live theme" status={themeDetected ? "Detected" : "Needs check"}>
                  {publishedThemeName ? `Detected live theme: ${publishedThemeName}.` : "Open the theme editor and select your live theme."}
                </Step>
                <Step complete={billingReady} title="Confirm plan limits" status={billingReady ? "Ready" : "Action needed"} action={!billingReady ? <s-button href="/app/pricing">View pricing</s-button> : null}>
                  {billing.enabled
                    ? withinFreeLimit || billing.hasPro
                      ? "Your current badge count is allowed by the active plan."
                      : `You have ${badgeCount} badges, which is above the free limit of ${billing.freeLimit}.`
                    : "Billing is disabled for this development app. Plan enforcement can be enabled before public release."}
                </Step>
                <Step complete={false} title="Add the Product Badges block" status="Manual check" action={<s-button href={themeLinks.home} target="_top" variant="primary">Open theme editor</s-button>}>
                  Add the app block to a featured collection product card or product page, then preview a tagged product. This step is verified in the theme editor.
                </Step>
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.heading}>How badges work</h2>
              <div style={styles.infoGrid}>
                <div><h3 style={styles.cardTitle}>1. Tag products</h3><p style={styles.subdued}>Use Shopify product tags such as new, sale, eco, or bestseller.</p></div>
                <div><h3 style={styles.cardTitle}>2. Map badges</h3><p style={styles.subdued}>Create badge labels and styles in the app. Mappings are saved in shop metafields.</p></div>
                <div><h3 style={styles.cardTitle}>3. Render in theme</h3><p style={styles.subdued}>The theme app block reads the storefront-visible metafield and renders matching badges.</p></div>
              </div>
            </div>
          </div>

          <div style={styles.sideStack}>
            <div style={styles.panel}>
              <h2 style={styles.heading}>Status</h2>
              <div style={styles.metricRow}><span>Saved badges</span><strong>{badgeCount}</strong></div>
              <div style={styles.metricRow}><span>Plan</span><strong>{planName}</strong></div>
              <div style={styles.metricRow}><span>Limit</span><strong>{billing.enabled ? billing.limitLabel : "Dev off"}</strong></div>
              <div style={styles.metricRow}><span>Live theme</span><strong>{publishedThemeName ?? "Not detected"}</strong></div>
              {!withinFreeLimit && !billing.hasPro ? <div style={styles.warning}>You are over the free limit. Remove badges or upgrade before saving changes.</div> : null}
            </div>

            <div style={styles.panel}>
              <h2 style={styles.heading}>Theme shortcuts</h2>
              <div style={styles.buttonStack}>
                <s-button href={themeLinks.home} target="_top" variant="primary">Add to home page</s-button>
                <s-button href={themeLinks.product} target="_top">Add to product page</s-button>
              </div>
            </div>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

const styles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20, alignItems: "start" },
  mainStack: { display: "grid", gap: 16, minWidth: 0 },
  sideStack: { display: "grid", gap: 16, minWidth: 0 },
  panel: { border: "1px solid #dcdfe4", borderRadius: 8, background: "#fff", padding: 16 },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  heading: { margin: 0, fontSize: 16, lineHeight: "24px", fontWeight: 700, color: "#202223" },
  subdued: { margin: "6px 0 0", color: "#616a75", lineHeight: "20px" },
  progressNumber: { color: "#202223", fontSize: 18, lineHeight: "24px" },
  progressTrack: { height: 8, borderRadius: 999, background: "#edf0f2", overflow: "hidden", marginTop: 14 },
  progressFill: { height: "100%", borderRadius: 999, background: "#108043" },
  steps: { display: "grid", gap: 12, marginTop: 14 },
  step: { display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", gap: 12, alignItems: "center", border: "1px solid #e1e3e5", borderRadius: 8, padding: 12 },
  stepDone: { width: 24, height: 24, borderRadius: "50%", background: "#108043", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 },
  stepOpen: { width: 24, height: 24, borderRadius: "50%", border: "1px solid #babfc3" },
  checkIcon: { width: 10, height: 6, borderLeft: "2px solid #fff", borderBottom: "2px solid #fff", transform: "rotate(-45deg)", marginTop: -2 },
  stepBody: { minWidth: 0 },
  stepTitleRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  stepTitle: { margin: 0, fontSize: 14, lineHeight: "20px", fontWeight: 700, color: "#202223" },
  statusDone: { borderRadius: 999, background: "#edf9f0", color: "#0b3d18", padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  statusOpen: { borderRadius: 999, background: "#f6f6f7", color: "#616a75", padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  stepAction: { display: "flex", justifyContent: "flex-end" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginTop: 14 },
  cardTitle: { margin: 0, fontSize: 14, lineHeight: "20px", fontWeight: 700 },
  metricRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #edf0f2" },
  warning: { marginTop: 12, border: "1px solid #e5c56f", borderRadius: 8, background: "#fff5db", color: "#4f3500", padding: 12, lineHeight: "20px" },
  buttonStack: { display: "grid", gap: 8, marginTop: 14 },
};

export const headers = (headersArgs) => boundary.headers(headersArgs);
