/* eslint-disable no-undef, react/prop-types */
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    supportEmail: process.env.SUPPORT_EMAIL || "support@example.com",
    privacyPolicyUrl: process.env.PRIVACY_POLICY_URL || "",
    termsUrl: process.env.TERMS_URL || "",
    listingUrl: process.env.SHOPIFY_APP_LISTING_URL || "",
  };
};

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={styles.detailValue}>{value}</strong>
    </div>
  );
}

function ChecklistItem({ children }) {
  return (
    <li style={styles.checkItem}>
      <span style={styles.checkDot} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default function SupportPage() {
  const { supportEmail, privacyPolicyUrl, termsUrl, listingUrl } = useLoaderData();

  return (
    <s-page heading="Support">
      <s-section>
        <div style={styles.grid}>
          <div style={styles.mainStack}>
            <div style={styles.panel}>
              <h2 style={styles.heading}>Help and troubleshooting</h2>
              <p style={styles.subdued}>
                Use this page when a merchant or reviewer needs to understand setup, support, or data handling.
              </p>
              <div style={styles.actionRow}>
                <s-button href={`mailto:${supportEmail}`} variant="primary">Email support</s-button>
                <s-button href="/app/badges">Manage badges</s-button>
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.heading}>Common setup checks</h2>
              <ul style={styles.checkList}>
                <ChecklistItem>Create at least one badge mapping and save it.</ChecklistItem>
                <ChecklistItem>Add a matching product tag in Shopify admin.</ChecklistItem>
                <ChecklistItem>Add the Product Badges app block in the theme editor.</ChecklistItem>
                <ChecklistItem>For collection cards, keep the block inside the product card area and use the autofilled Product setting.</ChecklistItem>
                <ChecklistItem>Preview both desktop and mobile layouts in the theme editor.</ChecklistItem>
              </ul>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.heading}>Data handling</h2>
              <p style={styles.subdued}>
                Badge mappings are saved as shop metafields in Shopify. The app does not store customer-level data. Session records are removed on uninstall and shop redact webhooks.
              </p>
            </div>
          </div>

          <div style={styles.sideStack}>
            <div style={styles.panel}>
              <h2 style={styles.heading}>Contact</h2>
              <DetailRow label="Support email" value={supportEmail} />
              <div style={styles.linkStack}>
                {privacyPolicyUrl ? <s-button href={privacyPolicyUrl} target="_blank">Privacy policy</s-button> : null}
                {termsUrl ? <s-button href={termsUrl} target="_blank">Terms</s-button> : null}
                {listingUrl ? <s-button href={listingUrl} target="_blank">App listing</s-button> : null}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.heading}>Review readiness</h2>
              <ul style={styles.checkList}>
                <ChecklistItem>Embedded app navigation is available inside Shopify admin.</ChecklistItem>
                <ChecklistItem>Billing page explains free and paid plans.</ChecklistItem>
                <ChecklistItem>Mandatory privacy webhooks are implemented.</ChecklistItem>
                <ChecklistItem>Theme app extension has merchant-facing settings.</ChecklistItem>
              </ul>
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
  heading: { margin: 0, fontSize: 16, lineHeight: "24px", fontWeight: 700, color: "#202223" },
  subdued: { margin: "6px 0 0", color: "#616a75", lineHeight: "20px" },
  actionRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 },
  detailRow: { display: "grid", gap: 4, padding: "10px 0", borderBottom: "1px solid #edf0f2" },
  detailLabel: { color: "#616a75", fontSize: 12, lineHeight: "16px" },
  detailValue: { color: "#202223", lineHeight: "20px", overflowWrap: "anywhere" },
  checkList: { display: "grid", gap: 10, margin: "14px 0 0", padding: 0, listStyle: "none", lineHeight: "20px" },
  checkItem: { display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", gap: 8, alignItems: "start" },
  checkDot: { width: 8, height: 8, borderRadius: "50%", background: "#108043", marginTop: 6 },
  linkStack: { display: "grid", gap: 8, marginTop: 14 },
};

export const headers = (headersArgs) => boundary.headers(headersArgs);
