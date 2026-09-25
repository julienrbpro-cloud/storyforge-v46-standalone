import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useStudio } from "@/lib/store";
import { peopleOf } from "@/lib/seed";
import { orderedCases } from "@/lib/case-order";
import { computeVisualPages, visualPageForCase } from "@/lib/visual-layout";

export function SearchDialog() {
  const open = useStudio((s) => s.searchOpen);
  const setOpen = useStudio((s) => s.setSearchOpen);
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    // The seed object is edited in place; revision invalidates these search results.
    void revision;
    if (!query) {
      return {
        cases: [] as Array<{ cid: string; numero: string; text: string }>,
        people: peopleOf(seed).slice(0, 6),
      };
    }
    const cases: Array<{ cid: string; numero: string; text: string }> = [];
    for (const c of orderedCases(seed)) {
        const hay = [c.numero, c.titre, c.description, ...(c.textes || []).map((t) => t.contenu)]
          .join(" ")
          .toLowerCase();
        if (hay.includes(query)) {
          cases.push({
            cid: c.id,
            numero: c.numero,
            text: (c.titre || c.description || "").slice(0, 90),
          });
        }
        if (cases.length >= 8) break;
      if (cases.length >= 8) break;
    }
    const people = peopleOf(seed).filter((p) => p.nom.toLowerCase().includes(query));
    return { cases, people };
  }, [query, seed, revision]);

  function goCase(cid: string) {
    setOpen(false);
    setQ("");
    const index = visualPageForCase(computeVisualPages(seed), cid);
    if (index >= 0) {
      void navigate({ to: "/planche/$plancheId", params: { plancheId: String(index + 1) } });
      useStudio.getState().setSelectedCase(cid);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-x-3 top-[12vh] z-50 mx-auto w-[min(92vw,520px)] overflow-hidden rounded-2xl border border-line bg-panel text-cream shadow-[0_24px_80px_rgb(0_0_0/0.55)]">
          <DialogPrimitive.Title className="sr-only">Rechercher dans le manuscrit</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Case, personnage…"
              className="h-12 w-full bg-transparent text-base text-cream outline-none placeholder:text-subtle"
            />
          </div>
          <div className="max-h-[55vh] overflow-auto p-2">
            {!results.cases.length && !results.people.length ? (
              <p className="px-3 py-8 text-center text-sm text-muted">Aucun résultat.</p>
            ) : (
              <>
                {results.cases.length ? (
                  <Group title="Cases">
                    {results.cases.map((c) => (
                      <button
                        key={c.cid}
                        type="button"
                        className="flex w-full flex-col rounded-xl px-3 py-2.5 text-left hover:bg-panel-2"
                        onClick={() => goCase(c.cid)}
                      >
                        <b className="text-sm">
                          Case {c.numero}
                        </b>
                        <span className="line-clamp-2 text-[11px] text-muted">{c.text}</span>
                      </button>
                    ))}
                  </Group>
                ) : null}
                {results.people.length ? (
                  <Group title="Personnages">
                    {results.people.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-panel-2"
                        onClick={() => {
                          setOpen(false);
                          void navigate({ to: "/bibliotheque" });
                        }}
                      >
                        {p.nom}
                      </button>
                    ))}
                  </Group>
                ) : null}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-subtle uppercase">{title}</div>
      {children}
    </div>
  );
}
