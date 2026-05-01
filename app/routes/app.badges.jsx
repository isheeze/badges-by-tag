/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { data, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { BADGE_STYLE_DEFAULTS, BADGE_STYLE_OPTIONS, contrastColor, normalizeBadgeMappings } from "../lib/badge-mappings.js";
const DESIGN_PRESETS = [
  { name: "Classic", bgColor: "#16a34a", textColor: "#ffffff", shape: "pill", size: "medium", textCase: "uppercase", border: "none", shadow: "soft" },
  { name: "Sale", bgColor: "#dc2626", textColor: "#ffffff", shape: "pill", size: "large", textCase: "uppercase", border: "dark", shadow: "bold" },
  { name: "Minimal", bgColor: "#ffffff", textColor: "#202223", shape: "rounded", size: "small", textCase: "none", border: "dark", shadow: "none" },
  { name: "Premium", bgColor: "#111827", textColor: "#facc15", shape: "square", size: "medium", textCase: "title", border: "light", shadow: "soft" },
  { name: "Soft", bgColor: "#fef3c7", textColor: "#92400e", shape: "rounded", size: "medium", textCase: "title", border: "dark", shadow: "none" },
];

const PRESETS = [
  { tag: "new", label: "New Arrival", ...stylePreset("Classic") },
  { tag: "bestseller", label: "Bestseller", ...stylePreset("Premium") },
  { tag: "sale", label: "On Sale", ...stylePreset("Sale") },
  { tag: "eco", label: "Eco-Friendly", bgColor: "#15803d", textColor: "#ffffff", shape: "rounded", size: "medium", textCase: "title", border: "light", shadow: "soft" },
  { tag: "limited", label: "Limited", bgColor: "#7c3aed", textColor: "#ffffff", shape: "square", size: "small", textCase: "uppercase", border: "light", shadow: "bold" },
  { tag: "bundle", label: "Bundle Deal", bgColor: "#0369a1", textColor: "#ffffff", shape: "pill", size: "medium", textCase: "title", border: "none", shadow: "soft" },
];

const emptyForm = {
  tag: "",
  label: "",
  bgColor: "#16a34a",
  textColor: "#ffffff",
  ...BADGE_STYLE_DEFAULTS,
};

function stylePreset(name) {
  const preset = DESIGN_PRESETS.find((item) => item.name === name) ?? DESIGN_PRESETS[0];
  return {
    bgColor: preset.bgColor,
    textColor: preset.textColor,
    shape: preset.shape,
    size: preset.size,
    textCase: preset.textCase,
    border: preset.border,
    shadow: preset.shadow,
  };
}

export const loader = async ({ request }) => {
  const { getBadgeMappings } = await import("../lib/badge-metafields.server.js");
  const { getActivePlan, FREE_BADGE_LIMIT, BILLING_ENABLED } = await import("../lib/billing.server.js");
  const url = new URL(request.url);
  const { admin, billing, session } = await authenticate.admin(request);
  const [mappings, publishedTheme, plan] = await Promise.all([
    getBadgeMappings(admin),
    getPublishedTheme(admin).catch(() => null),
    getActivePlan(billing),
  ]);
  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  return {
    mappings,
    publishedThemeName: publishedTheme?.name ?? null,
    themeLinks: buildThemeEditorLinks(session.shop, apiKey),
    billing: {
      enabled: BILLING_ENABLED,
      hasPro: plan.hasPro,
      freeLimit: FREE_BADGE_LIMIT,
      error: url.searchParams.get("billing_error"),
    },
  };
};

export const action = async ({ request }) => {
  const { setBadgeMappings } = await import("../lib/badge-metafields.server.js");
  const { getActivePlan, isPlanLimitExceeded, FREE_BADGE_LIMIT } = await import("../lib/billing.server.js");
  const { admin, billing } = await authenticate.admin(request);
  const formData = await request.formData();

  let submittedMappings;
  try {
    submittedMappings = JSON.parse(formData.get("mappings") || "[]");
  } catch {
    return data({ ok: false, error: "The badge mappings payload is invalid." }, { status: 400 });
  }

  const cleanedMappings = normalizeBadgeMappings(submittedMappings);
  const plan = await getActivePlan(billing);

  if (isPlanLimitExceeded({ hasPro: plan.hasPro, mappingCount: cleanedMappings.length })) {
    return data(
      {
        ok: false,
        billingRequired: true,
        error: `The free plan supports up to ${FREE_BADGE_LIMIT} badges. Upgrade to Pro to save more.`,
        mappings: cleanedMappings,
      },
      { status: 402 },
    );
  }

  const result = await setBadgeMappings(admin, cleanedMappings);

  if (!result.ok) {
    return data(
      {
        ok: false,
        error: "Shopify could not save the badge mappings.",
        errors: result.errors,
        mappings: result.mappings,
      },
      { status: 422 },
    );
  }

  return { ok: true, mappings: result.mappings };
};

async function getPublishedTheme(admin) {
  const response = await admin.graphql(
    `#graphql
    query PublishedTheme {
      themes(first: 20) {
        nodes {
          id
          name
          role
        }
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
    home: `${base}?${new URLSearchParams({
      template: "index",
      addAppBlockId: blockId,
      target: "newAppsSection",
    }).toString()}`,
    product: `${base}?${new URLSearchParams({
      template: "product",
      addAppBlockId: blockId,
      target: "mainSection",
    }).toString()}`,
  };
}
function normalizeTag(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}


function BadgePreview({ label, bgColor, textColor, shape, size, textCase, border, shadow }) {
  const resolvedShape = shape || BADGE_STYLE_DEFAULTS.shape;
  const resolvedSize = size || BADGE_STYLE_DEFAULTS.size;
  const resolvedTextCase = textCase || BADGE_STYLE_DEFAULTS.textCase;
  const resolvedBorder = border || BADGE_STYLE_DEFAULTS.border;
  const resolvedShadow = shadow || BADGE_STYLE_DEFAULTS.shadow;

  return (
    <span
      style={{
        ...styles.badgePreviewSize[resolvedSize],
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "100%",
        borderRadius: styles.badgePreviewShape[resolvedShape],
        background: bgColor,
        color: textColor,
        fontWeight: 700,
        lineHeight: "16px",
        textTransform: styles.badgePreviewTextCase[resolvedTextCase],
        border: styles.badgePreviewBorder[resolvedBorder],
        boxShadow: styles.badgePreviewShadow[resolvedShadow],
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label || "Badge"}
    </span>
  );
}

function BadgeForm({ form, error, onChange, onCancel, onSave, submitLabel }) {
  const previewTextColor = form.textColor || contrastColor(form.bgColor);

  function applyDesignPreset(preset) {
    onChange({
      ...form,
      bgColor: preset.bgColor,
      textColor: preset.textColor,
      shape: preset.shape,
      size: preset.size,
      textCase: preset.textCase,
      border: preset.border,
      shadow: preset.shadow,
    });
  }

  return (
    <div style={styles.formPanel}>
      <div style={styles.designPresetPanel}>
        <div>
          <h3 style={styles.smallHeading}>Design preset</h3>
          <p style={styles.microCopy}>Apply a starting style, then adjust the fields below.</p>
        </div>
        <div style={styles.designPresetGrid}>
          {DESIGN_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyDesignPreset(preset)}
              style={styles.designPresetButton}
            >
              <BadgePreview
                label={preset.name}
                bgColor={preset.bgColor}
                textColor={preset.textColor}
                shape={preset.shape}
                size={preset.size}
                textCase={preset.textCase}
                border={preset.border}
                shadow={preset.shadow}
              />
            </button>
          ))}
        </div>
      </div>
      <div style={styles.formGrid}>
        <label style={styles.field}>
          <span style={styles.label}>Product tag</span>
          <input
            value={form.tag}
            onChange={(event) => onChange({ ...form, tag: event.target.value })}
            placeholder="new"
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span style={styles.label}>Badge label</span>
          <input
            value={form.label}
            onChange={(event) => onChange({ ...form, label: event.target.value })}
            placeholder="New Arrival"
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span style={styles.label}>Background color</span>
          <input
            type="color"
            value={form.bgColor}
            onChange={(event) => onChange({ ...form, bgColor: event.target.value })}
            style={{ ...styles.input, padding: 4 }}
          />
        </label>
        <label style={styles.field}>
          <span style={styles.label}>Text color</span>
          <input
            type="color"
            value={form.textColor || contrastColor(form.bgColor)}
            onChange={(event) => onChange({ ...form, textColor: event.target.value })}
            style={{ ...styles.input, padding: 4 }}
          />
        </label>
        <SelectField label="Shape" value={form.shape} options={BADGE_STYLE_OPTIONS.shapes} onChange={(value) => onChange({ ...form, shape: value })} />
        <SelectField label="Size" value={form.size} options={BADGE_STYLE_OPTIONS.sizes} onChange={(value) => onChange({ ...form, size: value })} />
        <SelectField label="Text case" value={form.textCase} options={BADGE_STYLE_OPTIONS.textCases} onChange={(value) => onChange({ ...form, textCase: value })} />
        <SelectField label="Border" value={form.border} options={BADGE_STYLE_OPTIONS.borders} onChange={(value) => onChange({ ...form, border: value })} />
        <SelectField label="Shadow" value={form.shadow} options={BADGE_STYLE_OPTIONS.shadows} onChange={(value) => onChange({ ...form, shadow: value })} />
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
      <div style={styles.formFooter}>
        <BadgePreview
          label={form.label}
          bgColor={form.bgColor}
          textColor={previewTextColor}
          shape={form.shape}
          size={form.size}
          textCase={form.textCase}
          border={form.border}
          shadow={form.shadow}
        />
        <div style={styles.actions}>
          <s-button onClick={onCancel}>Cancel</s-button>
          <s-button variant="primary" onClick={onSave}>{submitLabel}</s-button>
        </div>
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.input}>
        {options.map((option) => (
          <option key={option} value={option}>{formatOption(option)}</option>
        ))}
      </select>
    </label>
  );
}

function formatOption(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function BadgesPage() {
  const { mappings: initialMappings, publishedThemeName, themeLinks, billing } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [mappings, setMappings] = useState(initialMappings ?? []);
  const [form, setForm] = useState(emptyForm);
  const [editingIndex, setEditingIndex] = useState(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setMappings(initialMappings ?? []);
    setDirty(false);
  }, [initialMappings]);

  useEffect(() => {
    if (actionData?.ok) {
      setMappings(actionData.mappings ?? []);
      setDirty(false);
    }
  }, [actionData]);

  const existingTags = useMemo(() => new Set(mappings.map((mapping) => mapping.tag)), [mappings]);
  const isSaving = navigation.state !== "idle" && navigation.formAction?.endsWith("/app/badges");
  const justSaved = actionData?.ok && !dirty && !isSaving;
  const overFreeLimit = billing?.enabled && !billing.hasPro && mappings.length > billing.freeLimit;

  function updateMappings(nextMappings) {
    setMappings(nextMappings);
    setDirty(true);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingIndex(null);
    setError("");
  }

  function startCreate(mapping = emptyForm) {
    setForm({ ...emptyForm, ...mapping });
    setEditingIndex(-1);
    setError("");
  }

  function startEdit(index) {
    setForm({ ...emptyForm, ...mappings[index] });
    setEditingIndex(index);
    setError("");
  }

  function saveDraft() {
    const tag = normalizeTag(form.tag);
    const label = form.label.trim();

    if (!tag || !label) {
      setError("Tag and label are required.");
      return;
    }

    const duplicate = mappings.some((mapping, index) => mapping.tag === tag && index !== editingIndex);
    if (duplicate) {
      setError("Each badge needs a unique product tag.");
      return;
    }

    const nextMapping = {
      tag,
      label,
      bgColor: form.bgColor,
      textColor: form.textColor || contrastColor(form.bgColor),
      shape: form.shape,
      size: form.size,
      textCase: form.textCase,
      border: form.border,
      shadow: form.shadow,
    };

    if (editingIndex === -1) {
      updateMappings([...mappings, nextMapping]);
    } else {
      updateMappings(mappings.map((mapping, index) => (index === editingIndex ? nextMapping : mapping)));
    }

    resetForm();
  }

  function addPreset(preset) {
    if (existingTags.has(preset.tag)) return;
    updateMappings([...mappings, preset]);
  }

  function saveToShopify() {
    const formData = new FormData();
    formData.append("mappings", JSON.stringify(normalizeBadgeMappings(mappings)));
    submit(formData, { method: "post", action: "/app/badges" });
  }

  return (
    <s-page heading="Badges by Tag">
      <s-button slot="primary-action" variant="primary" onClick={saveToShopify} disabled={!dirty || isSaving || overFreeLimit} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving" : justSaved ? "Saved" : "Save mappings"}
      </s-button>
      <s-button slot="secondary-actions" onClick={() => startCreate()}>
        Add badge
      </s-button>

      <s-section>
        <div style={styles.layout}>
          <div style={styles.mainColumn}>
            {justSaved ? <div style={styles.success}>Mappings saved to Shopify.</div> : null}
            {billing?.error ? (
              <div style={styles.alert}>
                <strong>Could not start billing.</strong>
                <p style={styles.noticeText}>{billing.error}</p>
              </div>
            ) : null}
            {billing?.enabled && !billing.hasPro ? (
              <div style={overFreeLimit ? styles.warning : styles.info}>
                <strong>Free plan: {billing.freeLimit} badges included.</strong>
                <p style={styles.noticeText}>
                  {overFreeLimit
                    ? `You have ${mappings.length} badges. Remove badges or upgrade to Pro before saving.`
                    : `${Math.max(billing.freeLimit - mappings.length, 0)} free badge slots remaining.`}
                </p>
                {overFreeLimit ? <s-button href="/app/billing" variant="primary">Upgrade to Pro</s-button> : null}
              </div>
            ) : null}
            {actionData?.error ? (
              <div style={styles.alert}>
                <strong>{actionData.error}</strong>
                {actionData.billingRequired ? <div style={styles.noticeAction}><s-button href="/app/billing" variant="primary">Upgrade to Pro</s-button></div> : null}
                {actionData.errors?.length ? (
                  <ul style={styles.errorList}>
                    {actionData.errors.map((item, index) => <li key={index}>{item.message}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.heading}>Badge mappings</h2>
                  <p style={styles.subdued}>Create mappings from Shopify product tags to storefront badge labels.</p>
                </div>
              </div>

              {editingIndex !== null ? (
                <BadgeForm
                  form={form}
                  error={error}
                  onChange={setForm}
                  onCancel={resetForm}
                  onSave={saveDraft}
                  submitLabel={editingIndex === -1 ? "Add draft" : "Update draft"}
                />
              ) : null}

              {mappings.length === 0 ? (
                <div style={styles.emptyState}>
                  <h3 style={styles.emptyTitle}>No badge mappings yet</h3>
                  <p style={styles.subdued}>Add a badge manually or use a preset, then save the mappings to Shopify.</p>
                  <s-button variant="primary" onClick={() => startCreate()}>Add first badge</s-button>
                </div>
              ) : (
                <div style={styles.list}>
                  {mappings.map((mapping, index) => (
                    <div key={mapping.tag} style={styles.row}>
                      <div style={styles.rowContent}>
                        <BadgePreview
                          label={mapping.label}
                          bgColor={mapping.bgColor}
                          textColor={mapping.textColor}
                          shape={mapping.shape}
                          size={mapping.size}
                          textCase={mapping.textCase}
                          border={mapping.border}
                          shadow={mapping.shadow}
                        />
                        <code style={styles.tag}>tag: {mapping.tag}</code>
                      </div>
                      <div style={styles.actions}>
                        <s-button onClick={() => startEdit(index)}>Edit</s-button>
                        <s-button tone="critical" onClick={() => updateMappings(mappings.filter((_, itemIndex) => itemIndex !== index))}>
                          Delete
                        </s-button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={styles.sideColumn}>
            <div style={styles.panel}>
              <h2 style={styles.heading}>Quick presets</h2>
              <div style={styles.presetList}>
                {PRESETS.map((preset) => {
                  const added = existingTags.has(preset.tag);
                  return (
                    <div key={preset.tag} style={styles.presetRow}>
                      <BadgePreview
                        label={preset.label}
                        bgColor={preset.bgColor}
                        textColor={preset.textColor}
                        shape={preset.shape}
                        size={preset.size}
                        textCase={preset.textCase}
                        border={preset.border}
                        shadow={preset.shadow}
                      />
                      <s-button disabled={added} onClick={() => addPreset(preset)}>{added ? "Added" : "Add"}</s-button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.heading}>Plan</h2>
              <p style={styles.subdued}>
                {billing?.hasPro
                  ? "Pro is active. You can save unlimited badge mappings."
                  : `Free includes ${billing?.freeLimit ?? 3} badge mappings. Upgrade when you need more.`}
              </p>
              {!billing?.hasPro ? <div style={styles.linkStack}><s-button href="/app/billing">Upgrade to Pro</s-button></div> : null}
            </div>
            <div style={styles.panel}>
              <h2 style={styles.heading}>Theme setup</h2>
              <p style={styles.subdued}>
                {publishedThemeName
                  ? `Live theme: ${publishedThemeName}. Use these links to add the Product Badges block in the theme editor.`
                  : "Use these links to add the Product Badges block in the theme editor."}
              </p>
              <div style={styles.linkStack}>
                <s-button href={themeLinks.home} target="_top" variant="primary">Add to home page</s-button>
                <s-button href={themeLinks.product} target="_top">Add to product page</s-button>
              </div>
              <p style={styles.subdued}>For featured collection product cards, add the block inside the product card area and keep the Product setting on the closest/autofilled product.</p>
            </div>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

const styles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 20,
    alignItems: "start",
  },
  mainColumn: { minWidth: 0, display: "grid", gap: 12 },
  sideColumn: { display: "grid", gap: 16, minWidth: 0 },
  panel: {
    border: "1px solid #dcdfe4",
    borderRadius: 8,
    background: "#ffffff",
    padding: 16,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
    marginBottom: 16,
  },
  heading: { margin: 0, fontSize: 16, lineHeight: "24px", fontWeight: 700, color: "#202223" },
  smallHeading: { margin: 0, fontSize: 14, lineHeight: "20px", fontWeight: 700, color: "#202223" },
  subdued: { margin: "6px 0 0", color: "#616a75", lineHeight: "20px" },
  microCopy: { margin: "2px 0 0", color: "#616a75", fontSize: 12, lineHeight: "18px" },
  emptyState: {
    display: "grid",
    justifyItems: "center",
    gap: 12,
    border: "1px dashed #babfc3",
    borderRadius: 8,
    padding: 28,
    textAlign: "center",
  },
  emptyTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: "#202223" },
  list: { display: "grid", gap: 10 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    border: "1px solid #e1e3e5",
    borderRadius: 8,
    padding: "12px 14px",
  },
  rowContent: { display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "wrap" },
  tag: { color: "#616a75", fontSize: 13 },
  actions: { display: "flex", gap: 8, alignItems: "center" },
  formPanel: { border: "1px solid #dcdfe4", borderRadius: 8, padding: 14, marginBottom: 14, background: "#f9fafb" },
  designPresetPanel: { display: "grid", gap: 10, marginBottom: 14 },
  designPresetGrid: { display: "flex", gap: 8, flexWrap: "wrap" },
  designPresetButton: {
    minHeight: 38,
    border: "1px solid #c9cccf",
    borderRadius: 6,
    background: "#ffffff",
    padding: "6px 8px",
    cursor: "pointer",
  },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  field: { display: "grid", gap: 6, fontSize: 13, fontWeight: 650, color: "#202223" },
  label: { lineHeight: "18px" },
  input: { width: "100%", minHeight: 38, border: "1px solid #c9cccf", borderRadius: 6, padding: "7px 10px", boxSizing: "border-box" },
  badgePreviewSize: {
    small: { minHeight: 20, padding: "2px 8px", fontSize: 11 },
    medium: { minHeight: 24, padding: "3px 10px", fontSize: 12 },
    large: { minHeight: 30, padding: "5px 12px", fontSize: 14 },
  },
  badgePreviewShape: {
    pill: 999,
    rounded: 8,
    square: 2,
  },
  badgePreviewTextCase: {
    uppercase: "uppercase",
    title: "capitalize",
    none: "none",
  },
  badgePreviewBorder: {
    none: "0 solid transparent",
    light: "1px solid rgba(255, 255, 255, 0.65)",
    dark: "1px solid rgba(0, 0, 0, 0.28)",
  },
  badgePreviewShadow: {
    none: "none",
    soft: "0 1px 3px rgba(0, 0, 0, 0.16)",
    bold: "0 4px 10px rgba(0, 0, 0, 0.22)",
  },
  error: { margin: "10px 0 0", color: "#8e1f0b", fontWeight: 650 },
  formFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" },
  presetList: { display: "grid", gap: 10, marginTop: 12 },
  presetRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  success: { border: "1px solid #9fd6aa", borderRadius: 8, background: "#edf9f0", color: "#0b3d18", padding: 12, fontWeight: 650 },
  info: { border: "1px solid #b4c6e7", borderRadius: 8, background: "#eef4ff", color: "#082c5f", padding: 12 },
  warning: { border: "1px solid #e5c56f", borderRadius: 8, background: "#fff5db", color: "#4f3500", padding: 12 },
  alert: { border: "1px solid #e6a3a3", borderRadius: 8, background: "#fff1f1", color: "#5c1111", padding: 12 },
  errorList: { margin: "8px 0 0", paddingLeft: 20 },
  noticeText: { margin: "6px 0 10px", lineHeight: "20px" },
  noticeAction: { marginTop: 10 },
  linkStack: { display: "grid", gap: 8, marginTop: 12 },
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
