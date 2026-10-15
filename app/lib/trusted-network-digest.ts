// Preserve PLAN-R1 canonical bytes, including raw text and ordinary array order.
export function canonicalTrustedValue(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalTrustedValue).join(",") + "]";
  if (value !== null && typeof value === "object") return "{" + Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => JSON.stringify(k) + ":" + canonicalTrustedValue(v)).join(",") + "}";
  return JSON.stringify(value);
}

export async function fingerprintTrustedValue(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalTrustedValue(value)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
