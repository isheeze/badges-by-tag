/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { data, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { BADGE_STYLE_DEFAULTS, BADGE_STYLE_OPTIONS, contrastColor, normalizeBadgeMappings } from "../lib/badge-mappings.js";
const DESIGN_PRESETS = [
  { name: "Clean pill", templateType: "text", bgColor: "#16a34a", textColor: "#ffffff", shape: "pill", size: "medium", textCase: "uppercase", border: "none", shadow: "soft" },
  { name: "Sale ribbon", templateType: "ribbon", bgColor: "#dc2626", textColor: "#ffffff", shape: "rounded", size: "large", textCase: "uppercase", border: "dark", shadow: "bold", badgeWidth: 150, badgeHeight: 38, rotation: -4 },
  { name: "Premium tag", templateType: "sticker", bgColor: "#111827", textColor: "#facc15", shape: "rounded", size: "medium", textCase: "title", border: "light", shadow: "bold", badgeWidth: 118, badgeHeight: 40 },
  { name: "Corner flag", templateType: "corner", bgColor: "#2563eb", textColor: "#ffffff", shape: "square", size: "small", textCase: "uppercase", border: "none", shadow: "soft", badgeWidth: 104, badgeHeight: 34, rotation: -8 },
  { name: "Burst", templateType: "burst", bgColor: "#f97316", textColor: "#ffffff", shape: "pill", size: "medium", textCase: "uppercase", border: "light", shadow: "bold", badgeWidth: 92, badgeHeight: 92 },
  { name: "Image label", templateType: "image", bgColor: "#7c3aed", textColor: "#ffffff", shape: "rounded", size: "medium", textCase: "uppercase", border: "none", shadow: "bold", badgeWidth: 150, badgeHeight: 54 },
];

const PRESETS = [
  { tag: "new", label: "New Arrival", category: "Product status", ...stylePreset("Clean pill") },
  { tag: "bestseller", label: "Bestseller", category: "Sales", ...stylePreset("Premium tag") },
  { tag: "sale", label: "On Sale", category: "Sales", ...stylePreset("Sale ribbon") },
  { tag: "clearance", label: "Clearance", category: "Sales", ...stylePreset("Corner flag"), bgColor: "#b91c1c" },
  { tag: "limited", label: "Limited", category: "Urgency", ...stylePreset("Burst"), bgColor: "#7c3aed" },
  { tag: "low-stock", label: "Low Stock", category: "Urgency", ...stylePreset("Corner flag"), bgColor: "#ea580c" },
  { tag: "back-in-stock", label: "Back In Stock", category: "Product status", ...stylePreset("Clean pill"), bgColor: "#0284c7" },
  { tag: "preorder", label: "Preorder", category: "Product status", ...stylePreset("Premium tag"), bgColor: "#312e81", textColor: "#ffffff" },
  { tag: "free-shipping", label: "Free Shipping", category: "Trust", ...stylePreset("Clean pill"), bgColor: "#0f766e" },
  { tag: "organic", label: "Organic", category: "Trust", ...stylePreset("Clean pill"), bgColor: "#15803d", textCase: "title" },
  { tag: "handmade", label: "Handmade", category: "Trust", ...stylePreset("Premium tag"), bgColor: "#78350f", textColor: "#fde68a" },
  { tag: "premium", label: "Premium", category: "Premium", ...stylePreset("Premium tag") },
  { tag: "bundle", label: "Bundle Deal", category: "Sales", ...stylePreset("Sale ribbon"), bgColor: "#0369a1" },
  { tag: "holiday", label: "Holiday Pick", category: "Seasonal", ...stylePreset("Burst"), bgColor: "#be123c" },
  { tag: "bfcm", label: "BFCM Deal", category: "Seasonal", ...stylePreset("Sale ribbon"), bgColor: "#111827", textColor: "#ffffff" },
];

const PRESET_CATEGORIES = ["All", ...Array.from(new Set(PRESETS.map((preset) => preset.category)))];

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
    templateType: preset.templateType,
    bgColor: preset.bgColor,
    textColor: preset.textColor,
    shape: preset.shape,
    size: preset.size,
    textCase: preset.textCase,
    border: preset.border,
    shadow: preset.shadow,
    badgeWidth: preset.badgeWidth ?? BADGE_STYLE_DEFAULTS.badgeWidth,
    badgeHeight: preset.badgeHeight ?? BADGE_STYLE_DEFAULTS.badgeHeight,
    rotation: preset.rotation ?? BADGE_STYLE_DEFAULTS.rotation,
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


function BadgePreview({
  label,
  templateType,
  bgColor,
  textColor,
  shape,
  size,
  textCase,
  border,
  shadow,
  fontFamily,
  fontWeight,
  imageUrl,
  imageFit,
  badgeWidth,
  badgeHeight,
  textX,
  textY,
  textAlign,
  textShadow,
  rotation,
  opacity,
}) {
  const resolvedTemplate = templateType || BADGE_STYLE_DEFAULTS.templateType;
  const resolvedShape = shape || BADGE_STYLE_DEFAULTS.shape;
  const resolvedSize = size || BADGE_STYLE_DEFAULTS.size;
  const resolvedTextCase = textCase || BADGE_STYLE_DEFAULTS.textCase;
  const resolvedBorder = border || BADGE_STYLE_DEFAULTS.border;
  const resolvedShadow = shadow || BADGE_STYLE_DEFAULTS.shadow;
  const resolvedWidth = Number(badgeWidth || BADGE_STYLE_DEFAULTS.badgeWidth);
  const resolvedHeight = Number(badgeHeight || BADGE_STYLE_DEFAULTS.badgeHeight);
  const resolvedTextX = Number(textX ?? BADGE_STYLE_DEFAULTS.textX);
  const resolvedTextY = Number(textY ?? BADGE_STYLE_DEFAULTS.textY);
  const hasImage = resolvedTemplate === "image" && imageUrl;
  const transform = `rotate(${Number(rotation || 0)}deg)`;

  return (
    <span
      data-template={resolvedTemplate}
      style={{
        ...styles.badgePreviewSize[resolvedSize],
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        width: resolvedTemplate === "text" ? "auto" : resolvedWidth,
        minWidth: resolvedTemplate === "text" ? undefined : resolvedWidth,
        height: resolvedTemplate === "text" ? undefined : resolvedHeight,
        maxWidth: "100%",
        borderRadius: styles.badgePreviewShape[resolvedShape],
        background: bgColor,
        backgroundImage: hasImage ? `url("${imageUrl}")` : styles.templateBackground[resolvedTemplate],
        backgroundSize: hasImage ? styles.imageFit[imageFit || BADGE_STYLE_DEFAULTS.imageFit] : "cover",
        backgroundPosition: "center",
        color: textColor,
        fontFamily: styles.fontFamily[fontFamily || BADGE_STYLE_DEFAULTS.fontFamily],
        fontWeight: styles.fontWeight[fontWeight || BADGE_STYLE_DEFAULTS.fontWeight],
        lineHeight: "16px",
        textTransform: styles.badgePreviewTextCase[resolvedTextCase],
        border: styles.badgePreviewBorder[resolvedBorder],
        boxShadow: styles.badgePreviewShadow[resolvedShadow],
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        opacity: Number(opacity || BADGE_STYLE_DEFAULTS.opacity) / 100,
        transform,
        clipPath: styles.templateClipPath[resolvedTemplate],
      }}
    >
      <span
        style={{
          position: resolvedTemplate === "text" ? "static" : "absolute",
          left: resolvedTemplate === "text" ? undefined : `${resolvedTextX}%`,
          top: resolvedTemplate === "text" ? undefined : `${resolvedTextY}%`,
          transform: resolvedTemplate === "text" ? undefined : "translate(-50%, -50%)",
          width: resolvedTemplate === "text" ? undefined : "86%",
          textAlign: textAlign || BADGE_STYLE_DEFAULTS.textAlign,
          textShadow: styles.textShadow[textShadow || BADGE_STYLE_DEFAULTS.textShadow],
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label || "Badge"}
      </span>
    </span>
  );
}

function BadgeForm({ form, error, onChange, onCancel, onSave, submitLabel }) {
  const previewTextColor = form.textColor || contrastColor(form.bgColor);

  function applyDesignPreset(preset) {
    onChange({
      ...form,
      templateType: preset.templateType,
      bgColor: preset.bgColor,
      textColor: preset.textColor,
      shape: preset.shape,
      size: preset.size,
      textCase: preset.textCase,
      border: preset.border,
      shadow: preset.shadow,
      badgeWidth: preset.badgeWidth ?? form.badgeWidth,
      badgeHeight: preset.badgeHeight ?? form.badgeHeight,
      rotation: preset.rotation ?? form.rotation,
    });
  }

  return (
    <div style={styles.formPanel}>
      <div style={styles.studioHero}>
        <div style={styles.studioHeroCopy}>
          <span style={styles.eyebrow}>Badge studio</span>
          <h3 style={styles.studioTitle}>{form.label || "Design a badge"}</h3>
          <p style={styles.studioText}>Choose a template, shape the badge, then fine tune text placement for the storefront.</p>
        </div>
        <div style={styles.studioPreviewStage}>
          <div style={styles.productPreview}>
            <div style={styles.productImagePreview}>
              <BadgePreview {...form} textColor={previewTextColor} />
            </div>
            <div style={styles.previewLines}>
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>

      <div style={styles.templateShelf}>
        <div style={styles.sectionHeader}>
          <div>
            <h3 style={styles.smallHeading}>Template styles</h3>
            <p style={styles.microCopy}>Start with a polished style and adjust it below.</p>
          </div>
        </div>
        <div style={styles.templateGrid}>
          {DESIGN_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyDesignPreset(preset)}
              style={form.templateType === preset.templateType ? styles.templateCardActive : styles.templateCard}
            >
              <BadgePreview
                label={preset.name}
                {...preset}
              />
              <span style={styles.templateName}>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.controlSurface}>
        <FieldGroup title="Content">
          <div style={styles.primaryFormGrid}>
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
            <SelectField label="Template" value={form.templateType} options={BADGE_STYLE_OPTIONS.templateTypes} onChange={(value) => onChange({ ...form, templateType: value })} />
          </div>
        </FieldGroup>

        <div style={styles.controlGrid}>
          <FieldGroup title="Typography">
            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Text color</span>
                <input
                  type="color"
                  value={form.textColor || contrastColor(form.bgColor)}
                  onChange={(event) => onChange({ ...form, textColor: event.target.value })}
                  style={{ ...styles.input, padding: 4 }}
                />
              </label>
              <SelectField label="Font" value={form.fontFamily} options={BADGE_STYLE_OPTIONS.fontFamilies} onChange={(value) => onChange({ ...form, fontFamily: value })} />
              <SelectField label="Weight" value={form.fontWeight} options={BADGE_STYLE_OPTIONS.fontWeights} onChange={(value) => onChange({ ...form, fontWeight: value })} />
              <SelectField label="Text case" value={form.textCase} options={BADGE_STYLE_OPTIONS.textCases} onChange={(value) => onChange({ ...form, textCase: value })} />
              <SelectField label="Text align" value={form.textAlign} options={BADGE_STYLE_OPTIONS.textAligns} onChange={(value) => onChange({ ...form, textAlign: value })} />
              <SelectField label="Text shadow" value={form.textShadow} options={BADGE_STYLE_OPTIONS.textShadows} onChange={(value) => onChange({ ...form, textShadow: value })} />
            </div>
          </FieldGroup>

          <FieldGroup title="Badge style">
            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Background color</span>
                <input
                  type="color"
                  value={form.bgColor}
                  onChange={(event) => onChange({ ...form, bgColor: event.target.value })}
                  style={{ ...styles.input, padding: 4 }}
                />
              </label>
              <SelectField label="Shape" value={form.shape} options={BADGE_STYLE_OPTIONS.shapes} onChange={(value) => onChange({ ...form, shape: value })} />
              <SelectField label="Size" value={form.size} options={BADGE_STYLE_OPTIONS.sizes} onChange={(value) => onChange({ ...form, size: value })} />
              <SelectField label="Border" value={form.border} options={BADGE_STYLE_OPTIONS.borders} onChange={(value) => onChange({ ...form, border: value })} />
              <SelectField label="Shadow" value={form.shadow} options={BADGE_STYLE_OPTIONS.shadows} onChange={(value) => onChange({ ...form, shadow: value })} />
              <RangeField label="Opacity" value={form.opacity} min={20} max={100} unit="%" onChange={(value) => onChange({ ...form, opacity: value })} />
            </div>
          </FieldGroup>

          <FieldGroup title="Canvas and image">
            <div style={styles.formGrid}>
              <RangeField label="Width" value={form.badgeWidth} min={64} max={260} unit="px" onChange={(value) => onChange({ ...form, badgeWidth: value })} />
              <RangeField label="Height" value={form.badgeHeight} min={24} max={140} unit="px" onChange={(value) => onChange({ ...form, badgeHeight: value })} />
              <RangeField label="Text X" value={form.textX} min={0} max={100} unit="%" onChange={(value) => onChange({ ...form, textX: value })} />
              <RangeField label="Text Y" value={form.textY} min={0} max={100} unit="%" onChange={(value) => onChange({ ...form, textY: value })} />
              <RangeField label="Rotation" value={form.rotation} min={-25} max={25} unit="deg" onChange={(value) => onChange({ ...form, rotation: value })} />
              <SelectField label="Image fit" value={form.imageFit} options={BADGE_STYLE_OPTIONS.imageFits} onChange={(value) => onChange({ ...form, imageFit: value })} />
              <label style={styles.fieldWide}>
                <span style={styles.label}>Image background URL</span>
                <input
                  value={form.imageUrl}
                  onChange={(event) => onChange({ ...form, imageUrl: event.target.value, templateType: event.target.value ? "image" : form.templateType })}
                  placeholder="https://cdn.shopify.com/..."
                  style={styles.input}
                />
              </label>
            </div>
          </FieldGroup>
        </div>
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
      <div style={styles.formFooter}>
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

function RangeField({ label, value, min, max, unit, onChange }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}: {value}{unit}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={styles.range}
      />
    </label>
  );
}

function FieldGroup({ title, children }) {
  return (
    <div style={styles.fieldGroup}>
      <h3 style={styles.smallHeading}>{title}</h3>
      {children}
    </div>
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
  const [presetCategory, setPresetCategory] = useState("All");

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
  const filteredPresets = useMemo(
    () => PRESETS.filter((preset) => presetCategory === "All" || preset.category === presetCategory),
    [presetCategory],
  );
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
      templateType: form.templateType,
      bgColor: form.bgColor,
      textColor: form.textColor || contrastColor(form.bgColor),
      shape: form.shape,
      size: form.size,
      textCase: form.textCase,
      border: form.border,
      shadow: form.shadow,
      fontFamily: form.fontFamily,
      fontWeight: form.fontWeight,
      imageUrl: form.imageUrl,
      imageFit: form.imageFit,
      badgeWidth: form.badgeWidth,
      badgeHeight: form.badgeHeight,
      textX: form.textX,
      textY: form.textY,
      textAlign: form.textAlign,
      textShadow: form.textShadow,
      rotation: form.rotation,
      opacity: form.opacity,
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
        <div style={styles.pageStack}>
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

          <div style={styles.heroPanel}>
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
          </div>

          <div style={styles.presetPanel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.heading}>Quick presets</h2>
                <p style={styles.subdued}>Add ready-made campaign badges, then customize the design in Badge Studio.</p>
              </div>
            </div>
            <div style={styles.categoryTabs}>
              {PRESET_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setPresetCategory(category)}
                  style={presetCategory === category ? styles.categoryTabActive : styles.categoryTab}
                >
                  {category}
                </button>
              ))}
            </div>
            <div style={styles.presetList}>
              {filteredPresets.map((preset) => {
                const added = existingTags.has(preset.tag);
                return (
                  <div key={preset.tag} style={styles.presetCard}>
                    <BadgePreview {...preset} />
                    <div style={styles.presetMeta}>
                      <strong>{preset.label}</strong>
                      <code style={styles.tag}>tag: {preset.tag}</code>
                    </div>
                    <s-button disabled={added} onClick={() => addPreset(preset)}>{added ? "Added" : "Add"}</s-button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.heading}>Saved mappings</h2>
                <p style={styles.subdued}>Draft changes stay here until you save mappings to Shopify.</p>
              </div>
            </div>
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
                        {...mapping}
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

          <div style={styles.supportGrid}>
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
  pageStack: { display: "grid", gap: 16, minWidth: 0 },
  panel: {
    border: "1px solid #dcdfe4",
    borderRadius: 8,
    background: "#ffffff",
    padding: 16,
  },
  heroPanel: {
    border: "1px solid #cfd6dd",
    borderRadius: 8,
    background: "#ffffff",
    padding: 16,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  },
  presetPanel: {
    border: "1px solid #dcdfe4",
    borderRadius: 8,
    background: "#ffffff",
    padding: 16,
  },
  supportGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 },
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
  formPanel: { border: "1px solid #cfd6dd", borderRadius: 8, padding: 0, marginBottom: 14, background: "#ffffff", overflow: "hidden", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)" },
  studioHero: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20, alignItems: "stretch", padding: 20, background: "linear-gradient(135deg, #f8fafc, #eef4ff)" },
  studioHeroCopy: { display: "grid", alignContent: "center", gap: 8, minWidth: 0 },
  eyebrow: { color: "#0b5cab", fontSize: 12, lineHeight: "16px", fontWeight: 800, textTransform: "uppercase" },
  studioTitle: { margin: 0, color: "#111827", fontSize: 24, lineHeight: "30px", fontWeight: 800 },
  studioText: { margin: 0, color: "#4b5563", lineHeight: "21px", maxWidth: 420 },
  studioPreviewStage: { minWidth: 0 },
  productPreview: { border: "1px solid #d8dee8", borderRadius: 8, padding: 14, background: "#ffffff", boxShadow: "0 10px 28px rgba(15, 23, 42, 0.10)" },
  productImagePreview: { position: "relative", minHeight: 250, borderRadius: 8, background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 46%, #dbeafe 100%)", display: "grid", placeItems: "start", padding: 18, overflow: "hidden" },
  previewLines: { display: "grid", gap: 8, marginTop: 12 },
  templateShelf: { padding: "18px 20px", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", background: "#ffffff" },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 },
  templateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 },
  templateCard: { minHeight: 96, border: "1px solid #d7dde5", borderRadius: 8, background: "#ffffff", padding: 10, display: "grid", gap: 9, justifyItems: "center", alignContent: "center", cursor: "pointer" },
  templateCardActive: { minHeight: 96, border: "2px solid #008060", borderRadius: 8, background: "#f0fdf4", padding: 9, display: "grid", gap: 9, justifyItems: "center", alignContent: "center", cursor: "pointer" },
  templateName: { color: "#374151", fontSize: 12, fontWeight: 750 },
  controlSurface: { display: "grid", gap: 18, padding: 20, background: "#f9fafb" },
  controlGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, alignItems: "start" },
  primaryFormGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 },
  fieldGroup: { display: "grid", gap: 12, border: "1px solid #e1e7ef", borderRadius: 8, background: "#ffffff", padding: 14 },
  range: { width: "100%" },
  fieldWide: { display: "grid", gap: 6, fontSize: 13, fontWeight: 650, color: "#202223", gridColumn: "1 / -1" },
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
  templateBackground: {
    text: undefined,
    ribbon: "linear-gradient(90deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 30%, rgba(0,0,0,0.16))",
    sticker: "radial-gradient(circle at 18% 16%, rgba(255,255,255,0.28), transparent 30%)",
    corner: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 42%)",
    burst: "radial-gradient(circle, rgba(255,255,255,0.25), rgba(255,255,255,0) 55%)",
    image: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(0,0,0,0.18))",
  },
  templateClipPath: {
    text: undefined,
    ribbon: "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%, 6% 50%)",
    sticker: undefined,
    corner: "polygon(0 0, 100% 0, 86% 100%, 0 100%)",
    burst: "polygon(50% 0%, 59% 14%, 75% 7%, 78% 24%, 95% 25%, 86% 41%, 100% 50%, 86% 59%, 95% 75%, 78% 76%, 75% 93%, 59% 86%, 50% 100%, 41% 86%, 25% 93%, 22% 76%, 5% 75%, 14% 59%, 0% 50%, 14% 41%, 5% 25%, 22% 24%, 25% 7%, 41% 14%)",
    image: undefined,
  },
  imageFit: {
    cover: "cover",
    contain: "contain",
    stretch: "100% 100%",
  },
  fontFamily: {
    system: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'SFMono-Regular', Consolas, monospace",
    display: "'Arial Black', Impact, sans-serif",
  },
  fontWeight: {
    regular: 500,
    bold: 750,
    heavy: 900,
  },
  textShadow: {
    none: "none",
    soft: "0 1px 2px rgba(0, 0, 0, 0.24)",
    bold: "0 2px 6px rgba(0, 0, 0, 0.38)",
  },
  error: { margin: "10px 0 0", color: "#8e1f0b", fontWeight: 650 },
  formFooter: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, padding: "0 20px 20px", flexWrap: "wrap", background: "#f9fafb" },
  presetList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 },
  presetCard: { border: "1px solid #e1e7ef", borderRadius: 8, background: "#f9fafb", padding: 12, display: "grid", gap: 10, alignContent: "space-between", minHeight: 142 },
  presetMeta: { display: "grid", gap: 4, color: "#202223" },
  categoryTabs: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },
  categoryTab: { border: "1px solid #c9cccf", borderRadius: 999, background: "#ffffff", color: "#202223", padding: "5px 9px", cursor: "pointer", fontSize: 12 },
  categoryTabActive: { border: "1px solid #008060", borderRadius: 999, background: "#edf9f0", color: "#0b3d18", padding: "5px 9px", cursor: "pointer", fontSize: 12, fontWeight: 700 },
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
