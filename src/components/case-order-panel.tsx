import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { orderedCases } from "@/lib/case-order";
import { useStudio } from "@/lib/store";

export function CaseOrderPanel() {
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const move = useStudio((s) => s.moveCase);
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [side, setSide] = useState<"before" | "after">("before");
  void revision;
  const cases = orderedCases(seed);
  const chosen = cases.find((c) => c.id === source);
  return <section className="mt-5 rounded-xl border border-paper-line bg-paper p-3">
    <details>
      <summary className="min-h-10 cursor-pointer font-semibold">Ordre du récit · {cases.length} cases</summary>
      <p className="mb-3 text-xs text-paper-muted">Déplace une case avant ou après n’importe quelle autre case. Les planches actuelles s’ajustent automatiquement.</p>
      <ol className="max-h-[60vh] space-y-1 overflow-y-auto">
        {cases.map((c) => <li key={c.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-paper-line px-2 py-1.5 text-xs">
          <span className="w-16 shrink-0 font-bold">Case {c.numero}</span>
          <span className="min-w-0 flex-1 truncate">{c.titre || c.description || c.id}</span>
          <button type="button" className="min-h-10 rounded-md border border-paper-line px-2 font-semibold" aria-label={`Déplacer case ${c.numero}`} onClick={() => { setSource(c.id); setTarget(cases[0]?.id === c.id ? cases[1]?.id || "" : cases[0]?.id || ""); setSide("before"); }}>Déplacer</button>
        </li>)}
      </ol>
    </details>
    <Dialog open={Boolean(chosen)} onOpenChange={(open) => { if (!open) setSource(null); }}>
      <DialogContent title={`Déplacer Case ${chosen?.numero || ""}`}>
        <div className="space-y-3">
          <label className="block text-sm font-semibold">Position
            <select aria-label="Position" className="mt-1 h-11 w-full rounded-md border border-paper-line bg-paper px-2" value={side} onChange={(e) => setSide(e.target.value as "before" | "after")}>
              <option value="before">Avant</option><option value="after">Après</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">Case de référence
            <select aria-label="Case de référence" className="mt-1 h-11 w-full rounded-md border border-paper-line bg-paper px-2" value={target} onChange={(e) => setTarget(e.target.value)}>
              {cases.filter((c) => c.id !== source).map((c) => <option key={c.id} value={c.id}>Case {c.numero} · {c.titre || c.description || c.id}</option>)}
            </select>
          </label>
          <Button className="w-full" disabled={!target} onClick={() => { if (source && move(source, target, side)) setSource(null); }}>Déplacer la case</Button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}
