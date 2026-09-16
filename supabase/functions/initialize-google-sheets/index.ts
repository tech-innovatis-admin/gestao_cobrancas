// FASE 3 — initialize-google-sheets
// Contrato: ver src/integrations/receivables-source/types.ts e docs/fase-3-google-sheets.md.
// Garante, para cada aba mensal ativa (sheet_competence_map.active = true), que exista uma coluna
// "ID_COBRANCA" (detectada pelo cabeçalho, nunca por índice fixo) e que cada par de linhas
// previsto/recebido tenha o MESMO uuid preenchido nas duas linhas — gerando quando ausente.
// Não apaga nem sobrescreve UUIDs já presentes e iguais nas duas linhas do par.
import { requireMasterAdmin } from "../_shared/auth.ts";
import { accessToken, json, loadConfig, sheetsBatchUpdate, sheetsGet, sheetsValuesBatchUpdate } from "../_shared/google.ts";
import { cell, parseSheetRows, type RangeSheet } from "../_shared/sheetParser.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ID_HEADER = "ID_COBRANCA";
const ID_SEARCH_COLS = 30; // "primeiras ~30 colunas" (A..AD, índices 0..29)
const ID_FREE_FROM = 17;   // coluna R (0-indexed) em diante, se precisar criar o header
// audit_logs.entity_id é NOT NULL; esta rotina não referencia uma linha específica de
// sheet_competence_map (processa todas de uma vez), então usamos o uuid nulo canônico.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function colLetter(idx0: number): string {
  let n = idx0 + 1, s = "";
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

Deno.serve(async (req) => {
  let userId: string | null = null;
  try {
    const { user } = await requireMasterAdmin(req);
    userId = user.id;
  } catch (e) { return json({ error: (e as Error).message }, 401); }

  const cfg = loadConfig();
  if ("missing" in cfg) return json({ error: `Configuração pendente: secrets ausentes (${cfg.missing.join(", ")})` }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sheetsMap, error: mapErr } = await admin
    .from("sheet_competence_map").select("sheet_name").eq("active", true);
  if (mapErr) return json({ error: mapErr.message }, 500);
  if (!sheetsMap?.length) return json({ error: "Nenhuma aba ativa em sheet_competence_map." }, 503);

  const { data: runRow, error: runErr } = await admin
    .from("sync_runs").insert({ type: "initialize", status: "running", started_by: userId }).select("id").single();
  if (runErr || !runRow) return json({ error: runErr?.message ?? "Falha ao criar sync_run." }, 500);
  const runId = runRow.id as string;

  const issues: string[] = [];
  let sheetsProcessed = 0;
  let idsCreated = 0;
  let idsAlreadyPresent = 0;
  let recordsRead = 0;
  const valueWrites: { range: string; values: string[][] }[] = [];
  const structuralRequests: unknown[] = [];

  try {
    // Escopo padrão de accessToken já cobre leitura e escrita (spreadsheets), então um único
    // token serve para os sheetsGet e para os batchUpdate finais.
    const token = await accessToken(cfg);

    const meta = await sheetsGet<{ sheets?: { properties: { sheetId: number; title: string } }[] }>(
      cfg, token, `?fields=${encodeURIComponent("sheets(properties(sheetId,title))")}`,
    );
    const sheetIdByName = new Map<string, number>();
    for (const s of meta.sheets ?? []) sheetIdByName.set(s.properties.title, s.properties.sheetId);

    for (const sm of sheetsMap) {
      const sheetName = sm.sheet_name as string;
      try {
        const range = `?ranges=${encodeURIComponent(`'${sheetName}'!A1:AD3000`)}&fields=${encodeURIComponent("sheets(data.rowData.values(formattedValue))")}&includeGridData=true`;
        const res = await sheetsGet<{ sheets?: RangeSheet[] }>(cfg, token, range);
        const rows = res.sheets?.[0]?.data?.[0]?.rowData ?? [];
        if (!rows.length) { issues.push(`Aba "${sheetName}": vazia ou não encontrada.`); continue; }

        const header = rows[0];
        let idColIdx = -1;
        for (let c = 0; c < Math.min(ID_SEARCH_COLS, header.values?.length ?? 0); c++) {
          if (cell(header, c).toUpperCase() === ID_HEADER) { idColIdx = c; break; }
        }

        if (idColIdx === -1) {
          // Procura a primeira coluna TOTALMENTE livre (nenhuma linha lida tem valor nela),
          // a partir do índice 17 (coluna R), para não colidir com dados existentes.
          for (let c = ID_FREE_FROM; c < ID_SEARCH_COLS; c++) {
            if (rows.every((r) => cell(r, c) === "")) { idColIdx = c; break; }
          }
          if (idColIdx === -1) {
            issues.push(`Aba "${sheetName}": nenhuma coluna livre encontrada entre os índices ${ID_FREE_FROM} e ${ID_SEARCH_COLS - 1} para criar "${ID_HEADER}" — aba ignorada.`);
            continue;
          }
          const letter = colLetter(idColIdx);
          valueWrites.push({ range: `'${sheetName}'!${letter}1`, values: [[ID_HEADER]] });
          const sheetId = sheetIdByName.get(sheetName);
          if (sheetId !== undefined) {
            structuralRequests.push({
              updateDimensionProperties: {
                range: { sheetId, dimension: "COLUMNS", startIndex: idColIdx, endIndex: idColIdx + 1 },
                properties: { hiddenByUser: true },
                fields: "hiddenByUser",
              },
            });
          } else {
            issues.push(`Aba "${sheetName}": sheetId não encontrado nos metadados; coluna "${ID_HEADER}" criada mas não pôde ser ocultada.`);
          }
        }
        const letter = colLetter(idColIdx);

        // Mesma lógica de pareamento de preview-google-sheets-import (ver sheetParser.ts): linha com
        // Tipo = previsto, linha imediatamente seguinte sem Tipo (e não "TOTAL") = recebido.
        const { projects } = parseSheetRows(rows);
        for (const p of projects) {
          const prevRowIndex = p.rowIndex;
          const recRowIndex = p.receivedRowIndex;
          recordsRead++;

          const idPrevisto = cell(rows[prevRowIndex], idColIdx);
          const idRecebido = recRowIndex !== null ? cell(rows[recRowIndex], idColIdx) : idPrevisto;
          const bothPresentAndEqual = !!idPrevisto && !!idRecebido && idPrevisto === idRecebido;

          if (bothPresentAndEqual) {
            idsAlreadyPresent++;
          } else {
            idsCreated++;
            const uuid = crypto.randomUUID();
            valueWrites.push({ range: `'${sheetName}'!${letter}${prevRowIndex + 1}`, values: [[uuid]] });
            if (recRowIndex !== null) valueWrites.push({ range: `'${sheetName}'!${letter}${recRowIndex + 1}`, values: [[uuid]] });
          }
        }
        sheetsProcessed++;
      } catch (e) {
        issues.push(`Aba "${sheetName}": falha ao processar (${(e as Error).message}).`);
      }
    }

    // Todas as escritas de valores (headers novos + uuids novos), de todas as abas, num único batch.
    if (valueWrites.length) await sheetsValuesBatchUpdate(cfg, token, valueWrites);
    // Ocultar coluna é estrutural — batchUpdate separado, só para as abas onde o header foi criado agora.
    if (structuralRequests.length) await sheetsBatchUpdate(cfg, token, structuralRequests);

    await admin.from("audit_logs").insert({
      entity_type: "sheet_competence_map",
      entity_id: NIL_UUID,
      action_type: "google_sheets_initialize",
      source: "google_sheets",
      actor_user_id: userId,
      metadata: { sheetsProcessed, idsCreated, idsAlreadyPresent, issues },
    });

    await admin.from("sync_runs").update({
      finished_at: new Date().toISOString(),
      status: "success",
      records_read: recordsRead,
      records_created: idsCreated,
      records_ignored: idsAlreadyPresent,
      details: { issues },
    }).eq("id", runId);

    return json({ runId, sheetsProcessed, idsCreated, idsAlreadyPresent });
  } catch (e) {
    const message = (e as Error).message;
    await admin.from("sync_runs").update({
      finished_at: new Date().toISOString(),
      status: "error",
      records_read: recordsRead,
      records_created: idsCreated,
      records_ignored: idsAlreadyPresent,
      error_message: message,
      details: { issues },
    }).eq("id", runId);

    await admin.from("audit_logs").insert({
      entity_type: "sheet_competence_map",
      entity_id: NIL_UUID,
      action_type: "google_sheets_initialize",
      source: "google_sheets",
      actor_user_id: userId,
      error_message: message,
      metadata: { sheetsProcessed, idsCreated, idsAlreadyPresent, issues },
    });

    return json({ error: message, runId, sheetsProcessed, idsCreated, idsAlreadyPresent }, 500);
  }
});
