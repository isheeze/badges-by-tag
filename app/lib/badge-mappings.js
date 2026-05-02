const MAX_REMOTE_IMAGE_URL_LENGTH = 2000;
const MAX_DATA_IMAGE_URL_LENGTH = 120000;

export const BADGE_STYLE_DEFAULTS = {
  templateType: "text",
  shape: "pill",
  size: "medium",
  textCase: "uppercase",
  border: "none",
  shadow: "soft",
  fontFamily: "system",
  fontWeight: "bold",
  imageUrl: "",
  imageFit: "cover",
  badgeWidth: 120,
  badgeHeight: 36,
  textX: 50,
  textY: 50,
  textAlign: "center",
  textShadow: "soft",
  rotation: 0,
  opacity: 100,
};

export const BADGE_STYLE_OPTIONS = {
  templateTypes: ["text", "ribbon", "sticker", "corner", "burst", "image"],
  shapes: ["pill", "rounded", "square"],
  sizes: ["small", "medium", "large"],
  textCases: ["uppercase", "title", "none"],
  borders: ["none", "light", "dark"],
  shadows: ["none", "soft", "bold"],
  fontFamilies: ["system", "serif", "mono", "display"],
  fontWeights: ["regular", "bold", "heavy"],
  imageFits: ["cover", "contain", "stretch"],
  textAligns: ["left", "center", "right"],
  textShadows: ["none", "soft", "bold"],
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
      templateType: normalizeOption(item?.templateType, BADGE_STYLE_OPTIONS.templateTypes, BADGE_STYLE_DEFAULTS.templateType),
      bgColor,
      textColor,
      shape: normalizeOption(item?.shape, BADGE_STYLE_OPTIONS.shapes, BADGE_STYLE_DEFAULTS.shape),
      size: normalizeOption(item?.size, BADGE_STYLE_OPTIONS.sizes, BADGE_STYLE_DEFAULTS.size),
      textCase: normalizeOption(item?.textCase, BADGE_STYLE_OPTIONS.textCases, BADGE_STYLE_DEFAULTS.textCase),
      border: normalizeOption(item?.border, BADGE_STYLE_OPTIONS.borders, BADGE_STYLE_DEFAULTS.border),
      shadow: normalizeOption(item?.shadow, BADGE_STYLE_OPTIONS.shadows, BADGE_STYLE_DEFAULTS.shadow),
      fontFamily: normalizeOption(item?.fontFamily, BADGE_STYLE_OPTIONS.fontFamilies, BADGE_STYLE_DEFAULTS.fontFamily),
      fontWeight: normalizeOption(item?.fontWeight, BADGE_STYLE_OPTIONS.fontWeights, BADGE_STYLE_DEFAULTS.fontWeight),
      imageUrl: normalizeUrl(item?.imageUrl),
      imageFit: normalizeOption(item?.imageFit, BADGE_STYLE_OPTIONS.imageFits, BADGE_STYLE_DEFAULTS.imageFit),
      badgeWidth: normalizeNumber(item?.badgeWidth, 64, 260, BADGE_STYLE_DEFAULTS.badgeWidth),
      badgeHeight: normalizeNumber(item?.badgeHeight, 24, 140, BADGE_STYLE_DEFAULTS.badgeHeight),
      textX: normalizeNumber(item?.textX, 0, 100, BADGE_STYLE_DEFAULTS.textX),
      textY: normalizeNumber(item?.textY, 0, 100, BADGE_STYLE_DEFAULTS.textY),
      textAlign: normalizeOption(item?.textAlign, BADGE_STYLE_OPTIONS.textAligns, BADGE_STYLE_DEFAULTS.textAlign),
      textShadow: normalizeOption(item?.textShadow, BADGE_STYLE_OPTIONS.textShadows, BADGE_STYLE_DEFAULTS.textShadow),
      rotation: normalizeNumber(item?.rotation, -25, 25, BADGE_STYLE_DEFAULTS.rotation),
      opacity: normalizeNumber(item?.opacity, 20, 100, BADGE_STYLE_DEFAULTS.opacity),
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

function normalizeNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (url.startsWith("data:image/")) {
    return url.length <= MAX_DATA_IMAGE_URL_LENGTH ? url : "";
  }
  if (url.startsWith("//")) {
    return `https:${url}`.slice(0, MAX_REMOTE_IMAGE_URL_LENGTH);
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url.slice(0, MAX_REMOTE_IMAGE_URL_LENGTH);
  }
  return "";
}
