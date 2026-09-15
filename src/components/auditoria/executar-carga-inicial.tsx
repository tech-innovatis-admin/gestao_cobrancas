"use client";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Erro } from "@/components/ui/basicos";
import { previewCargaInicial, executarCargaInicial } from "@/services/syncActions";
import type { ImportPreview, ImportResult } from "@/integrations/receivables-source/types";

type Passo = "fechado" | "preview" | "resultado";

export const ExecutarCargaInicial = () => {
  const [passo, setPasso] = useState<Passo>("fechado");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const abrir = () => {
    setErro(null);
    setResultado(null);
    start(async () => {
      try {
        const p = await previewCargaInicial();
        setPreview(p);
        setPasso("preview");
      } catch (e) {
        setErro((e as Error).message);
        setPasso("preview");
      }
    });
  };

  const confirmar = () => {
    setErro(null);
    start(async () => {
      try {
        const r = await executarCargaInicial();
        setResultado(r);
        setPasso("resultado");
      } catch (e) {
        setErro((e as Error).message);
        setPasso("resultado");
      }
    });
  };

  const fechar = () => { setPasso("fechado"); setPreview(null); setResultado(null); setErro(null); };

  return (
    <>
      <Button size="sm" onClick={abrir} disabled={pending}>{pending && passo === "fechado" ? "Carregando…" : "Executar carga inicial"}</Button>

      <Dialog open={passo === "preview"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Carga inicial da base</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-2 gap-2 rounded border border-line bg-canvas p-2">
                <div>Abas lidas<div className="num font-semibold">{preview.sheets.length}</div></div>
                <div>Recebíveis encontrados<div className="num font-semibold">{preview.receivables}</div></div>
                <div>IDs já presentes<div className="num font-semibold">{preview.idsPresent}</div></div>
                <div>IDs ausentes<div className="num font-semibold">{preview.idsMissing}</div></div>
                <div>Duplicados<div className="num font-semibold">{preview.duplicates}</div></div>
              </div>
              {preview.issues.length > 0 && (
                <div>
                  <p className="mb-1 font-semibold text-ink-muted">Alertas ({preview.issues.length})</p>
                  <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto rounded border border-line bg-canvas p-2 pl-6 text-[12px] text-ink-muted">
                    {preview.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                </div>
              )}
              <Erro msg={erro} />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={fechar} disabled={pending}>Cancelar</Button>
                <Button onClick={confirmar} disabled={pending}>{pending ? "Importando…" : "Confirmar e importar"}</Button>
              </div>
            </div>
          )}
          {!preview && <Erro msg={erro} />}
        </DialogContent>
      </Dialog>

      <Dialog open={passo === "resultado"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{erro ? "Falha na carga inicial" : "Carga inicial concluída"}</DialogTitle></DialogHeader>
          {resultado && !erro && (
            <div className="grid grid-cols-3 gap-2 rounded border border-line bg-canvas p-2 text-[13px]">
              <div>Criados<div className="num font-semibold text-ok">{resultado.created}</div></div>
              <div>Ignorados<div className="num font-semibold">{resultado.ignored}</div></div>
              <div>Erros<div className="num font-semibold text-danger">{resultado.errors}</div></div>
            </div>
          )}
          <Erro msg={erro} />
          <div className="mt-4 flex justify-end"><Button onClick={fechar}>Fechar</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
};
