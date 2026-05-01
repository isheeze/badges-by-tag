export const BADGE_STYLE_DEFAULTS = {
  shape: "pill",
  size: "medium",
  textCase: "uppercase",
  border: "none",
  shadow: "soft",
};

export const BADGE_STYLE_OPTIONS = {
  shapes: ["pill", "rounded", "square"],
  sizes: ["small", "medium", "large"],
  textCases: ["uppercase", "title", "none"],
  borders: ["none", "light", "dark"],
  shadows: ["none", "soft", "bold"],
};

export function normalizeBadgeMappings(input) {
  if (!Array.isArray(input)) return [];

  const seen = new Set();
  const mappings = [];

  for (const item of input) {
    const tag = String(item?.tag ?? "").trim().toLowerCase();
    const label = String(item?.label ?? "").trim();
    const bgColor = normalizeHex(item?.bgColor, "#16a34a");
    const textColor = normalizeHex(item?.textColor, contrastColor(bgColor));

    if (!tag || !label || seen.has(tag)) continue;

    seen.add(tag);
    mappings.push({
      tag,
      label,
      bgColor,
      textColor,
      shape: normalizeOption(item?.shape, BADGE_STYLE_OPTIONS.shapes, BADGE_STYLE_DEFAULTS.shape),
      size: normalizeOption(item?.size, BADGE_STYLE_OPTIONS.sizes, BADGE_STYLE_DEFAULTS.size),
      textCase: normalizeOption(item?.textCase, BADGE_STYLE_OPTIONS.textCases, BADGE_STYLE_DEFAULTS.textCase),
      border: normalizeOption(item?.border, BADGE_STYLE_OPTIONS.borders, BADGE_STYLE_DEFAULTS.border),
      shadow: normalizeOption(item?.shadow, BADGE_STYLE_OPTIONS.shadows, BADGE_STYLE_DEFAULTS.shadow),
    });
  }

  return mappings;
}

export function normalizeHex(value, fallback) {
  const hex = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
}

export function contrastColor(hex) {
  const value = normalizeHex(hex, "#16a34a").slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#111827" : "#ffffff";
}

function normalizeOption(value, options, fallback) {
  const normalized = String(value ?? "").trim();
  return options.includes(normalized) ? normalized : fallback;
}