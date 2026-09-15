// Autenticação Service Account → access token (JWT RS256) e helpers da Sheets API v4.
// Roda SÓ em Edge Functions (Deno). Secrets: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SPREADSHEET_ID.
const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export interface GoogleConfig { clientEmail: string; privateKey: string; spreadsheetId: string; }

export function loadConfig(): GoogleConfig | { missing: string[] } {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const spreadsheetId = Deno.env.get("GOOGLE_SPREADSHEET_ID");
  const missing: string[] = [];
  if (!raw) missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!spreadsheetId) missing.push("GOOGLE_SPREADSHEET_ID");
  if (missing.length) return { missing };
  const sa = JSON.parse(raw!);
  return { clientEmail: sa.client_email, privateKey: sa.private_key, spreadsheetId: spreadsheetId! };
}

async function importKey(pem: string) {
  const der = Uint8Array.from(atob(pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, "")), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function accessToken(cfg: GoogleConfig, scope = "https://www.googleapis.com/auth/spreadsheets"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: cfg.clientEmail, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importKey(cfg.privateKey), new TextEncoder().encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

export async function sheetsGet<T>(cfg: GoogleConfig, token: string, path: string): Promise<T> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sheetsValuesBatchUpdate(cfg: GoogleConfig, token: string, data: { range: string; values: string[][] }[]): Promise<void> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
}

export async function sheetsBatchUpdate(cfg: GoogleConfig, token: string, requests: unknown[]): Promise<{ replies?: unknown[] }> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
