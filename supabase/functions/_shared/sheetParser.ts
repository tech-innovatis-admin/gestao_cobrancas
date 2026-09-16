// FASE 3 — parser compartilhado das abas do Google Sheets.
// Extraído de preview-google-sheets-import / initialize-google-sheets / import-google-sheets:
// as três functions liam o mesmo layout de colunas e a mesma lógica de pareamento
// linha "prevista" (Tipo preenchido) + linha "recebida" opcional logo abaixo. Qualquer mudança
// aqui afeta as três — e o hash de synchronize (buildHashFields), então mexa com cuidado.
export interface CellRow { values?: { formattedValue?: string }[] }
export interface RangeSheet { data?: { rowData?: CellRow[] }[] }

export const COL = { tipo: 0, hub: 1, min: 2, inst: 3, fund: 4, nome: 5, plProjeto: 6, plInnovatis: 7,
  status: 8, motivo: 9, acao: 10, responsavel: 11, prazo: 12, arProjeto: 13, arInnovatis: 14, flag: 15, statusCalc: 16, idCobranca: 17 } as const;
export const FASES = new Set(["A", "B", "C", "D"]);

export function cell(row: CellRow | undefined, idx: number): string {
  return row?.values?.[idx]?.formattedValue?.trim() ?? "";
}
export function isBlankRow(row: CellRow | undefined): boolean {
  return !row?.values?.some((v) => v.formattedValue?.trim());
}
export function parseBRL(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
// "Prazo" chega da planilha tipicamente como DD/MM/AAAA (formatação de data do Sheets). Qualquer
// coisa fora desse padrão vira null em vez de derrubar a linha inteira.
export function parseDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d), month = Number(mo), year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
// Equivalente TS de public.normalize_text(): minúsculas, sem acentos, espaços colapsados.
export function normalizeText(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface ParsedProjectRow {
  rowIndex: number;              // índice 0-based da linha "prevista" dentro de `rows`
  receivedRowIndex: number | null;
  tipo: string; hub: string; min: string; inst: string; fund: string; nome: string;
  plProjeto: number | null; plInnovatis: number | null;
  recProjeto: number; recInnovatis: number;
  statusLabel: string; motivo: string; acao: string; responsavel: string; prazo: string; flag: string;
  arProjetoPlanilha: number | null; arInnovatisPlanilha: number | null;
  idCobranca: string;
}

// Linha 0 é o cabeçalho. Cada projeto ocupa 1 linha "prevista" (Tipo preenchido) + opcionalmente
// 1 linha "recebida" logo abaixo (sem Tipo; pode vir em branco quando nada foi recebido ainda).
// O bloco de totais no fim da aba (coluna Fundação = "TOTAL A/B/C") encerra a leitura da aba.
// Linha sem Tipo fora de um par esperado é órfã (reportada pelo chamador, que conhece o nome da aba).
export function parseSheetRows(rows: CellRow[]): { projects: ParsedProjectRow[]; orphanRows: number[] } {
  const projects: ParsedProjectRow[] = [];
  const orphanRows: number[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) continue;
    const tipo = cell(row, COL.tipo);
    if (!tipo) {
      if (cell(row, COL.fund).toUpperCase().startsWith("TOTAL")) break;
      orphanRows.push(i);
      continue;
    }

    const rowIndex = i;
    let receivedRowIndex: number | null = null;
    const next = rows[i + 1];
    if (next && !isBlankRow(next) && !cell(next, COL.tipo) && !cell(next, COL.fund).toUpperCase().startsWith("TOTAL")) {
      receivedRowIndex = i + 1;
      i++; // consome a linha de recebido
    }

    const receivedRow = receivedRowIndex !== null ? rows[receivedRowIndex] : undefined;
    projects.push({
      rowIndex, receivedRowIndex,
      tipo, hub: cell(row, COL.hub), min: cell(row, COL.min), inst: cell(row, COL.inst), fund: cell(row, COL.fund),
      nome: cell(row, COL.nome),
      plProjeto: parseBRL(cell(row, COL.plProjeto)), plInnovatis: parseBRL(cell(row, COL.plInnovatis)),
      recProjeto: receivedRow ? (parseBRL(cell(receivedRow, COL.plProjeto)) ?? 0) : 0,
      recInnovatis: receivedRow ? (parseBRL(cell(receivedRow, COL.plInnovatis)) ?? 0) : 0,
      statusLabel: cell(row, COL.status), motivo: cell(row, COL.motivo), acao: cell(row, COL.acao),
      responsavel: cell(row, COL.responsavel), prazo: cell(row, COL.prazo), flag: cell(row, COL.flag),
      arProjetoPlanilha: parseBRL(cell(row, COL.arProjeto)), arInnovatisPlanilha: parseBRL(cell(row, COL.arInnovatis)),
      idCobranca: cell(row, COL.idCobranca),
    });
  }

  return { projects, orphanRows };
}

/** Campos usados por computeSourceHash — DEVE bater EXATAMENTE com o que import-google-sheets já usa hoje
 * (import-google-sheets/index.ts, função computeSourceHash({ idCobranca, hub, nome, tipo, competence,
 * plProjeto, plInnovatis, recProjeto, recInnovatis, statusTexto, reason, action, responsavelTexto,
 * operationalDeadline, flag })), senão os hashes de recebíveis JÁ IMPORTADOS no banco de dev deixam de bater
 * e o synchronize (que outro dev está implementando agora, consumindo esta função) vai achar que TODOS
 * mudaram na primeira execução. Note que plProjeto/plInnovatis aqui usam o mesmo default (?? 0) que
 * import-google-sheets já aplicava antes de calcular o hash.
 */
export function buildHashFields(p: ParsedProjectRow, competence: string): Record<string, unknown> {
  return {
    idCobranca: p.idCobranca, hub: p.hub, nome: p.nome, tipo: p.tipo, competence,
    plProjeto: p.plProjeto ?? 0, plInnovatis: p.plInnovatis ?? 0, recProjeto: p.recProjeto, recInnovatis: p.recInnovatis,
    statusTexto: p.statusLabel, reason: p.motivo || null, action: p.acao || null, responsavelTexto: p.responsavel,
    operationalDeadline: parseDate(p.prazo), flag: p.flag || null,
  };
}
