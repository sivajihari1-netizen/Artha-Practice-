/** Small hex color utilities — used to derive a light tint of a firm's chosen brand color for PDF rendering (pdfkit has no CSS variables). */

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(hex: string | null | undefined): hex is string {
  return !!hex && HEX_RE.test(hex);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
}

/** Blends a hex color toward white by `amount` (0-1). Used for light tinted backgrounds behind the brand color. */
export function lightenHex(hex: string, amount: number): string {
  if (!isValidHexColor(hex)) hex = "#0F766E";
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => c + (255 - c) * amount;
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** Firm-provided colors are free text from a <input type="color">; validate before ever trusting them (e.g. as a CSS custom property value). */
export function sanitizeBrandColor(hex: string | null | undefined): string {
  return isValidHexColor(hex) ? hex : "#0F766E";
}
