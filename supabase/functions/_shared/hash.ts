// Hash estável dos campos "fonte" de um recebível, usado para detectar alteração externa
// (aba do Google Sheets) sem depender de comparar campo a campo. Determinístico: mesma entrada,
// mesmo hash, independente da ordem das chaves do objeto.
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function computeSourceHash(fields: Record<string, unknown>): Promise<string> {
  const data = new TextEncoder().encode(stableStringify(fields));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
