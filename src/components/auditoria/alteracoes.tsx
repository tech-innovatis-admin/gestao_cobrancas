"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { BuscaFiltro, LimparFiltros, SelectFiltro } from "@/components/filtros/campos";
import { useUrlFiltros } from "@/components/filtros/use-url-filtros";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/basicos";
import { BadgeSync } from "@/components/ui/badges-dominio";
import { fmtCompetencia, fmtDataHora } from "@/lib/format";
import { ACTION_LABEL, FIELD_LABEL, SYNC_LABEL } from "@/types/domain";
import type { AuditLogEnriched } from "@/services/auditService";

const val = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const InputData = ({ chave, rotulo }: { chave: string; rotulo: string }) => { const { get, set } = useUrlFiltros(); return <label className="lbl">{rotulo}<input type="date" className="field mt-0.5 w-[140px]" defaultValue={get(chave)} onBlur={(e) => set({ [chave]: e.target.value })} /></label>; };

export const Alteracoes = ({ rows, total, page }: { rows: AuditLogEnriched[]; total: number; page: number }) => {
  const [aberto, setAberto] = useState<AuditLogEnriched | null>(null); const { set } = useUrlFiltros();
  const exportar = () => { const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({ "Data/Hora": fmtDataHora(r.occurred_at), Usuário: r.actor_name ?? "", "E-mail": r.actor_email ?? "", Projeto: r.project_name ?? "", Competência: r.competence ? fmtCompetencia(r.competence) : "", Ação: ACTION_LABEL[r.action_type] ?? r.action_type, Campos: r.changed_fields.map((c) => FIELD_LABEL[c] ?? c).join(", "), Origem: r.source, Sincronização: r.sync_status ? SYNC_LABEL[r.sync_status] : "", Antes: JSON.stringify(r.before_data ?? {}), Depois: JSON.stringify(r.after_data ?? {}) }))); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Auditoria"); XLSX.writeFile(wb, `auditoria-${new Date().toISOString().slice(0, 10)}.csv`, { bookType: "csv" }); };
  return (<>
    <div className="panel flex flex-wrap items-end gap-2.5 px-4 py-3">
      <InputData chave="de" rotulo="De" /><InputData chave="ate" rotulo="Até" />
      <BuscaFiltro chave="usuario" rotulo="Usuário" placeholder="nome ou e-mail" w="w-[160px]" /><BuscaFiltro chave="projeto" rotulo="Projeto" w="w-[180px]" />
      <SelectFiltro chave="campo" rotulo="Campo" opcoes={Object.entries(FIELD_LABEL).map(([v, l]) => ({ v, l }))} w="w-[150px]" />
      <SelectFiltro chave="acao" rotulo="Ação" todos="Todas" opcoes={Object.entries(ACTION_LABEL).map(([v, l]) => ({ v, l }))} w="w-[170px]" />
      <SelectFiltro chave="origem" rotulo="Origem" todos="Todas" opcoes={[{ v: "platform", l: "Plataforma" }, { v: "google_sheets", l: "Google Sheets" }, { v: "import", l: "Importação" }, { v: "system", l: "Sistema" }]} w="w-[120px]" />
      <SelectFiltro chave="sync" rotulo="Sincronização" todos="Todas" opcoes={Object.entries(SYNC_LABEL).map(([v, l]) => ({ v, l }))} w="w-[130px]" />
      <LimparFiltros /><Button variant="outline" size="sm" className="ml-auto self-end" onClick={exportar}><Download size={13} /> Exportar CSV</Button>
    </div>
    <div className="panel">
      <div className="panel-head"><span className="panel-title">Alterações <span className="num font-normal text-ink-faint">({total})</span></span><div className="flex items-center gap-2 text-[12px]"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Anterior</Button><span className="num">{page}</span><Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => set({ page: String(page + 1) })}>Próxima</Button></div></div>
      {rows.length === 0 ? <EmptyState msg="Nenhum registro para os filtros." /> : <div className="max-h-[calc(100vh-320px)] overflow-auto"><Table><TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>Usuário</TableHead><TableHead>E-mail</TableHead><TableHead>Projeto</TableHead><TableHead>Competência</TableHead><TableHead>Ação</TableHead><TableHead>Campos alterados</TableHead><TableHead>Origem</TableHead><TableHead>Sincronização</TableHead></TableRow></TableHeader><TableBody>
        {rows.map((r) => <TableRow key={r.id} className="clicavel" onClick={() => setAberto(r)}><TableCell className="num">{fmtDataHora(r.occurred_at)}</TableCell><TableCell>{r.actor_name ?? (r.source === "google_sheets" ? "Alteração externa" : "sistema")}</TableCell><TableCell className="text-ink-muted">{r.actor_email ?? "—"}</TableCell><TableCell className="max-w-[220px] truncate" title={r.project_name ?? ""}>{r.project_name ?? <span className="text-ink-faint">{r.entity_type}</span>}</TableCell><TableCell>{r.competence ? fmtCompetencia(r.competence) : "—"}</TableCell><TableCell>{ACTION_LABEL[r.action_type] ?? r.action_type}</TableCell><TableCell className="max-w-[260px] truncate">{r.changed_fields.map((c) => FIELD_LABEL[c] ?? c).join(", ") || "—"}</TableCell><TableCell>{r.source}</TableCell><TableCell>{r.sync_status ? <BadgeSync s={r.sync_status} /> : "—"}</TableCell></TableRow>)}
      </TableBody></Table></div>}
    </div>
    <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Antes × Depois</DialogTitle></DialogHeader>
        {aberto && (<div className="space-y-2 text-[12px]">
          <p><b>{ACTION_LABEL[aberto.action_type] ?? aberto.action_type}</b> · {aberto.entity_type} · {fmtDataHora(aberto.occurred_at)} · {aberto.actor_name ?? "—"} ({aberto.actor_email ?? aberto.source})</p>
          {aberto.source === "google_sheets" && <p className="rounded border border-warn/40 bg-warn-soft p-2 text-warn">Alteração identificada diretamente na planilha. O usuário responsável não pôde ser identificado pela plataforma.</p>}
          {aberto.metadata && <p className="text-ink-muted">Metadados: {JSON.stringify(aberto.metadata)}</p>}
          <div className="max-h-[50vh] overflow-auto"><Table><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Antes</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader><TableBody>
            {(aberto.changed_fields.length ? aberto.changed_fields : Object.keys(aberto.after_data ?? aberto.before_data ?? {})).map((c) => <TableRow key={c}><TableCell>{FIELD_LABEL[c] ?? c}</TableCell><TableCell className="whitespace-normal text-ink-muted">{val(aberto.before_data?.[c])}</TableCell><TableCell className="whitespace-normal font-medium">{val(aberto.after_data?.[c])}</TableCell></TableRow>)}
          </TableBody></Table></div>
        </div>)}
      </DialogContent>
    </Dialog>
  </>);
};
