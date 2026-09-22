import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/logo";
import { caseImageCount, idbImageCount, totalCases } from "@/lib/seed";
import { useStudio } from "@/lib/store";
import { downloadJson, exportProjectZip } from "@/lib/export-zip";
import { printStoryboard } from "@/lib/print";
import { pickJson } from "@/lib/files";
import { toast } from "sonner";

export function DataView() {
  const seed = useStudio((s) => s.seed);
  const meta = useStudio((s) => s.meta);
  const revision = useStudio((s) => s.revision);
  const reset = useStudio((s) => s.resetWorkingSeed);
  const importSeed = useStudio((s) => s.importSeedJson);
  const importSession = useStudio((s) => s.importSessionJson);
  void revision;

  async function choose(handler: (data: unknown) => void | Promise<void>) {
    try {
      const data = await pickJson();
      if (data == null) return;
      await handler(data);
    } catch (err) {
      toast.error("Fichier invalide : " + (err as Error).message);
    }
  }

  return (
    <AppShell title={<div className="font-display text-lg">Profil</div>}>
      <div className="view-enter space-y-3 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-4">
          <Mark className="size-14 text-accent" />
          <div>
            <div className="font-display text-xl">
              Story<em className="not-italic text-accent">Forge</em>
            </div>
            <p className="text-xs text-muted">Studio local · {seed.projet.version}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-4">
          <h5 className="mb-1 text-xs font-bold tracking-wide text-accent-2 uppercase">Manuscrit</h5>
          <p className="font-display text-lg">{seed.projet.titre}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-cream-2">
            {seed.planches.length} planches · {totalCases(seed)} cases · {caseImageCount(seed)} image
            {caseImageCount(seed) > 1 ? "s" : ""}
            {idbImageCount(seed) ? ` dont ${idbImageCount(seed)} dans ce navigateur` : ""}.
          </p>
        </div>

        <Row
          title="Export du projet"
          st="ZIP · données + images de session"
          onClick={() => void exportProjectZip(seed, meta, useStudio.getState().mediaMeta)}
        />
        <Row title="Exporter le seed" st="JSON" onClick={() => downloadJson(seed, "storyforge-seed-travail.json")} />
        <Row title="Importer un seed" st="JSON" action="Choisir" onClick={() => void choose((d) => importSeed(d))} />
        <Row
          title="Restaurer une sauvegarde"
          st="JSON session"
          action="Choisir"
          onClick={() => void choose((d) => importSession(d))}
        />
        <Row title="Storyboard complet" st="images incluses" action="Imprimer" onClick={() => void printStoryboard(seed, null)} />

        <div className="rounded-2xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-cream-2">
          <h5 className="mb-1.5 text-xs font-bold tracking-wide text-accent-2 uppercase">Raccourcis</h5>
          <p>J / K — planche suivante / précédente</p>
          <p>/ — rechercher</p>
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (confirm("Annuler toutes les modifications de texte, structure, statuts et notes ? Les images seront conservées."))
              reset();
          }}
        >
          Revenir au manuscrit canonique
        </Button>
      </div>
    </AppShell>
  );
}

function Row({
  title,
  st,
  action = "OK",
  onClick,
}: {
  title: string;
  st: string;
  action?: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-panel px-3.5 py-3 text-xs">
      <div className="min-w-0 flex-1">
        <b className="block text-sm">{title}</b>
        <span className="text-[10.5px] text-muted">{st}</span>
      </div>
      <button
        type="button"
        className="rounded-full border border-line bg-panel-2 px-3.5 py-2 font-bold"
        onClick={onClick}
      >
        {action}
      </button>
    </div>
  );
}