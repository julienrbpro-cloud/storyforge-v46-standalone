import { create } from "zustand";
import { toast } from "sonner";
import {
  LS_MEDIA_META,
  LS_META,
  LS_META_LEGACY,
  LS_SEED,
  PAGE_STATUSES,
  CASE_STATUSES,
} from "./constants";
import { clone, emptyMeta, normalizeMeta, normalizeSeed, parseSeed, SEED_OFFICIEL } from "./seed";
import { dbReplace, putCaseImage, putImage } from "./media";
import { parseSession } from "./session";
import { uid } from "./utils";
import { inferPageStatus, pageStatusOf as statusOf } from "./project";
import type {
  Filters,
  GuardianId,
  Meta,
  Overlay,
  OverlayType,
  PageStatus,
  Seed,
} from "./types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface StudioState {
  ready: boolean;
  recoveryRequired: boolean;
  revision: number;
  saveState: SaveState;
  seed: Seed;
  meta: Meta;
  mediaMeta: Record<string, unknown[]>;
  selectedCaseId: string | null;
  visualPageIndex: number;
  readingMode: boolean;
  searchOpen: boolean;
  boot: () => void;
  persistNow: () => void;
  setSearchOpen: (open: boolean) => void;
  setFilter: (key: keyof Filters, value: string) => void;
  setSelectedCase: (id: string | null) => void;
  setVisualPageIndex: (n: number) => void;
  setReadingMode: (on: boolean) => void;
  cyclePageStatus: (id: string) => void;
  cycleCaseStatus: (pid: string, cid: string) => void;
  setPageField: (pid: string, key: string, value: string | null) => void;
  setPageGuardian: (pid: string, gid: GuardianId, key: "present" | "niveau", value: boolean | number) => void;
  setCaseField: (pid: string, cid: string, key: string, value: unknown) => void;
  toggleCasePerson: (pid: string, cid: string, id: string, on: boolean) => void;
  setCaseGuardian: (pid: string, cid: string, gid: GuardianId, value: string) => void;
  setCaseSize: (pid: string, cid: string, key: "width" | "height", value: number) => void;
  setLibraryEntityField: (
    kind: "personnage" | "gardien",
    id: string,
    key: string,
    value: unknown,
  ) => void;
  setEditorialRuleField: (id: string, key: "titre" | "contenu", value: string) => void;
  replaceLibraryImage: (kind: "personnage" | "gardien", id: string, file: File) => Promise<void>;
  setTextField: (pid: string, cid: string, tid: string, key: string, value: unknown) => void;
  addText: (pid: string, cid: string) => void;
  removeText: (pid: string, cid: string, tid: string) => void;
  moveText: (pid: string, cid: string, index: number, dir: number) => void;
  addOverlay: (pid: string, cid: string, type: OverlayType) => void;
  setOverlay: (pid: string, cid: string, oid: string, patch: Partial<Overlay>, bump?: boolean) => void;
  setOverlayTextRef: (pid: string, cid: string, oid: string, ref: string) => void;
  removeOverlay: (pid: string, cid: string, oid: string) => void;
  addCase: (pid: string) => void;
  addPlanche: () => string;
  deletePlanche: (id: string) => void;
  deleteCase: (pid: string, cid: string) => void;
  movePage: (id: string, dir: number) => void;
  dropPage: (fromId: string, toId: string) => void;
  replaceCaseImage: (cid: string, file: File) => Promise<void>;
  removeCaseImage: (pid: string, cid: string) => void;
  setPageNote: (pid: string, note: string) => void;
  resetWorkingSeed: () => void;
  importSeedJson: (data: unknown) => void;
  importSessionJson: (data: unknown) => Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function pageOf(seed: Seed, pid: string) {
  return seed.planches.find((p) => p.id === pid);
}
function caseOf(seed: Seed, pid: string, cid: string) {
  return pageOf(seed, pid)?.cases.find((c) => c.id === cid);
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLocalSnapshot(seed: Seed, meta: Meta, mediaMeta: Record<string, unknown[]>) {
  const values = [[LS_SEED, JSON.stringify(seed)], [LS_META, JSON.stringify(meta)],
    [LS_MEDIA_META, JSON.stringify(mediaMeta)]];
  const previous = values.map(([key]) => [key, localStorage.getItem(key)]);
  try {
    for (const [key, value] of values) localStorage.setItem(key, value);
  } catch (error) {
    try {
      for (const [key] of values) localStorage.removeItem(key);
      for (const [key, value] of previous) if (value != null) localStorage.setItem(key!, value);
    } catch { /* The caller reports storage access failure. */ }
    throw error;
  }
}

function captureRawLocalSnapshot(): Array<[string, string | null]> {
  return [LS_SEED, LS_META, LS_MEDIA_META].map(
    (key) => [key, localStorage.getItem(key)] as [string, string | null],
  );
}

function restoreRawLocalSnapshot(snapshot: Array<[string, string | null]>) {
  for (const [key, value] of snapshot) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
}

export const useStudio = create<StudioState>((set, get) => {
  const schedulePersist = () => {
    set({ saveState: "saving" });
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => get().persistNow(), 450);
  };

  const bump = () => {
    set((s) => ({ revision: s.revision + 1 }));
    schedulePersist();
  };

  return {
    ready: false,
    recoveryRequired: false,
    revision: 0,
    saveState: "idle",
    seed: normalizeSeed(SEED_OFFICIEL),
    meta: emptyMeta(),
    mediaMeta: {},
    selectedCaseId: null,
    visualPageIndex: 0,
    readingMode: false,
    searchOpen: false,

    boot() {
      if (typeof window === "undefined" || get().ready) return;
      const metaStored = readLocal<Partial<Meta> | null>(LS_META, readLocal(LS_META_LEGACY, null));
      const meta = normalizeMeta(metaStored);
      let seed: Seed;
      let recoveryRequired = false;
      try {
        const rawSeed = localStorage.getItem(LS_SEED);
        seed = rawSeed ? parseSeed(JSON.parse(rawSeed)) : normalizeSeed(SEED_OFFICIEL);
      }
      catch {
        seed = normalizeSeed(SEED_OFFICIEL);
        recoveryRequired = true;
        toast.error("Sauvegarde locale illisible. Restaure une sauvegarde ou reviens au manuscrit canonique avant d’enregistrer. Les données locales sont conservées.");
      }
      const mediaMeta = readLocal<Record<string, unknown[]>>(LS_MEDIA_META, {});
      if (!meta.statuts || Object.keys(meta.statuts).length === 0) {
        meta.statuts = {};
        for (const p of seed.planches) {
          meta.statuts[p.id] = inferPageStatus(p);
        }
      }
      set({ seed, meta, mediaMeta, ready: true, recoveryRequired, saveState: recoveryRequired ? "error" : "saved" });
    },

    persistNow() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = null;
      if (get().recoveryRequired) { set({ saveState: "error" }); return; }
      try {
        const { seed, meta, mediaMeta } = get();
        saveLocalSnapshot(seed, meta, mediaMeta);
        set({ saveState: "saved" });
      } catch {
        set({ saveState: "error" });
        toast.error("Sauvegarde locale impossible");
      }
    },

    setSearchOpen(open) {
      set({ searchOpen: open });
    },

    setFilter(key, value) {
      const meta = get().meta;
      meta.filters[key] = value;
      set({ meta, revision: get().revision + 1 });
      schedulePersist();
    },

    setSelectedCase(id) {
      set({ selectedCaseId: id });
    },

    setVisualPageIndex(n) {
      set({ visualPageIndex: n });
    },

    setReadingMode(on) {
      set({ readingMode: on });
    },

    cyclePageStatus(id) {
      const meta = get().meta;
      const i = PAGE_STATUSES.findIndex((x) => x[0] === (meta.statuts[id] || "a_faire"));
      meta.statuts[id] = PAGE_STATUSES[(i + 1 + PAGE_STATUSES.length) % PAGE_STATUSES.length][0];
      set({ meta });
      bump();
    },

    cycleCaseStatus(pid, cid) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      const i = CASE_STATUSES.findIndex((x) => x[0] === c.statut);
      c.statut = CASE_STATUSES[(i + 1 + CASE_STATUSES.length) % CASE_STATUSES.length][0];
      bump();
    },

    setPageField(pid, key, value) {
      const p = pageOf(get().seed, pid);
      if (!p) return;
      (p as unknown as Record<string, unknown>)[key] = key === "titre" ? value || "" : value || null;
      bump();
    },

    setPageGuardian(pid, gid, key, value) {
      const p = pageOf(get().seed, pid);
      if (!p) return;
      p.gardien_etat ||= {
        archiviste: { present: false, niveau: null },
        armurier: { present: false, niveau: null },
      };
      p.gardien_etat[gid] ||= { present: false, niveau: null };
      if (key === "present") {
        p.gardien_etat[gid].present = Boolean(value);
        p.gardien_etat[gid].niveau = value ? (p.gardien_etat[gid].niveau ?? 0) : null;
      } else {
        p.gardien_etat[gid].niveau = value as number;
      }
      bump();
    },

    setCaseField(pid, cid, key, value) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      (c as unknown as Record<string, unknown>)[key] = value;
      bump();
    },

    toggleCasePerson(pid, cid, id, on) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      c.personnages = c.personnages || [];
      c.personnages = on ? [...new Set([...c.personnages, id])] : c.personnages.filter((x) => x !== id);
      bump();
    },

    setCaseGuardian(pid, cid, gid, value) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      c.gardien_override ||= {};
      if (value === "inherit") delete c.gardien_override[gid];
      else if (value === "absent") c.gardien_override[gid] = { present: false, niveau: null };
      else c.gardien_override[gid] = { present: true, niveau: Number(value) };
      bump();
    },

    setCaseSize(pid, cid, key, value) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      const next = {
        width: key === "width" ? value : c.layout_size?.width || 1,
        height: key === "height" ? value : c.layout_size?.height || 1,
      };
      c.layout_size = {
        width: Math.min(3, Math.max(1, next.width)),
        height: Math.min(3, Math.max(1, next.height)),
      };
      bump();
    },

    setLibraryEntityField(kind, id, key, value) {
      const seed = get().seed;
      const target =
        kind === "personnage"
          ? seed.personnages.find((x) => x.id === id)
          : seed.gardiens.find((x) => x.id === id);
      if (!target) return;
      (target as unknown as Record<string, unknown>)[key] = value;
      bump();
    },

    setEditorialRuleField(id, key, value) {
      const rule = get().seed.regles_editoriales.find((x) => x.id === id);
      if (!rule) return;
      rule[key] = value;
      bump();
    },

    async replaceLibraryImage(kind, id, file) {
      const seed = get().seed;
      const target =
        kind === "personnage"
          ? seed.personnages.find((x) => x.id === id)
          : seed.gardiens.find((x) => x.id === id);
      if (!target) return;
      const ref = await putImage(kind, id, file);
      target.image = ref;
      bump();
      toast.success("Image de référence enregistrée");
    },

    setTextField(pid, cid, tid, key, value) {
      const t = caseOf(get().seed, pid, cid)?.textes.find((x) => x.id === tid);
      if (!t || t.preserve_exact) return;
      (t as unknown as Record<string, unknown>)[key] = value;
      bump();
    },

    addText(pid, cid) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      c.textes.push({
        id: uid("texte"),
        type: "dialogue",
        personnage_id: null,
        contenu: "",
        preserve_exact: false,
        source_label: "ajout local",
      });
      bump();
    },

    removeText(pid, cid, tid) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      const text = c.textes.find((x) => x.id === tid);
      if (text?.preserve_exact) return;
      for (const overlay of c.overlays) {
        if (overlay.text_ref === tid) { overlay.content = text?.contenu || ""; delete overlay.text_ref; }
      }
      c.textes = c.textes.filter((x) => x.id !== tid);
      bump();
    },

    moveText(pid, cid, index, dir) {
      const a = caseOf(get().seed, pid, cid)?.textes;
      if (!a) return;
      const j = index + dir;
      if (j < 0 || j >= a.length) return;
      if (a[index]?.preserve_exact || a[j]?.preserve_exact) return;
      [a[index], a[j]] = [a[j], a[index]];
      bump();
    },

    addOverlay(pid, cid, type) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      const used = new Set((c.overlays || []).map((o) => o.text_ref).filter(Boolean));
      const available = (c.textes || []).find((t) => !used.has(t.id));
      c.overlays ||= [];
      c.overlays.push({
        id: uid("ov"),
        type,
        text_ref: available?.id || null,
        ...(available ? {} : { content: "" }),
        x: 0.12,
        y: 0.12,
        width: type === "speech" ? 0.38 : 0.32,
        height: 0.2,
        font_size: 0.045,
        align: "center",
      });
      bump();
    },

    setOverlay(pid, cid, oid, patch, shouldBump = true) {
      const o = (caseOf(get().seed, pid, cid)?.overlays || []).find((x) => x.id === oid);
      if (!o) return;
      Object.assign(o, patch);
      if (shouldBump) bump();
      else set((s) => ({ revision: s.revision + 1 }));
    },

    setOverlayTextRef(pid, cid, oid, ref) {
      const o = (caseOf(get().seed, pid, cid)?.overlays || []).find((x) => x.id === oid);
      if (!o) return;
      if (ref) {
        o.text_ref = ref;
        delete o.content;
      } else {
        o.content = caseOf(get().seed, pid, cid)?.textes.find((t) => t.id === o.text_ref)?.contenu || o.content || "";
        delete o.text_ref;
      }
      bump();
    },

    removeOverlay(pid, cid, oid) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      c.overlays = (c.overlays || []).filter((x) => x.id !== oid);
      bump();
    },

    addCase(pid) {
      const p = pageOf(get().seed, pid);
      if (!p) return;
      const n = p.cases.length + 1;
      const id = uid(p.id + "-case");
      p.cases.push({
        id,
        image: null,
        overlays: [],
        numero: String(n),
        titre: null,
        type_unite: "case",
        source_label: "Case locale",
        description: "",
        textes: [],
        personnages: [],
        notes: null,
        source_verbatim: null,
        statut: "a_valider",
      });
      set({ selectedCaseId: id });
      bump();
    },

    addPlanche() {
      const seed = get().seed;
      const n = seed.planches.length + 1;
      const id = uid("P");
      seed.planches.push({
        id,
        numero: n,
        titre: "Nouvelle planche",
        chapitre: null,
        date_histoire: null,
        gardien_etat: {
          archiviste: { present: false, niveau: null },
          armurier: { present: false, niveau: null },
        },
        instructions_planche: null,
        notes_planche: [],
        cases: [],
      });
      const meta = get().meta;
      meta.statuts[id] = "a_faire";
      seed.projet.nombre_planches = seed.planches.length;
      bump();
      toast.success("Planche ajoutée");
      return id;
    },

    deletePlanche(id) {
      const seed = get().seed;
      seed.planches = seed.planches.filter((p) => p.id !== id);
      seed.projet.nombre_planches = seed.planches.length;
      seed.planches.forEach((p, i) => {
        p.numero = i + 1;
      });
      const meta = get().meta;
      delete meta.statuts[id];
      delete meta.notes[id];
      bump();
      toast.success("Planche supprimée");
    },

    deleteCase(pid, cid) {
      const p = pageOf(get().seed, pid);
      if (!p) return;
      p.cases = p.cases.filter((c) => c.id !== cid);
      p.cases.forEach((c, i) => {
        c.numero = String(i + 1);
      });
      if (get().selectedCaseId === cid) set({ selectedCaseId: p.cases[0]?.id ?? null });
      bump();
    },

    movePage(id, dir) {
      const arr = get().seed.planches;
      const i = arr.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      arr.forEach((p, idx) => {
        p.numero = idx + 1;
      });
      bump();
    },

    dropPage(fromId, toId) {
      if (!fromId || fromId === toId) return;
      const arr = get().seed.planches;
      const from = arr.findIndex((p) => p.id === fromId);
      const to = arr.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0) return;
      const [p] = arr.splice(from, 1);
      arr.splice(to, 0, p);
      arr.forEach((page, idx) => {
        page.numero = idx + 1;
      });
      bump();
    },

    async replaceCaseImage(cid, file) {
      const entry = (() => {
        for (const p of get().seed.planches) {
          const c = p.cases.find((x) => x.id === cid);
          if (c) return { p, c };
        }
        return null;
      })();
      if (!entry) return;
      const ref = await putCaseImage(cid, file);
      entry.c.image = ref;
      bump();
      toast.success("Image enregistrée");
    },

    removeCaseImage(pid, cid) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      c.image = null;
      bump();
      toast.success("Image déréférencée");
    },

    setPageNote(pid, note) {
      const meta = get().meta;
      meta.notes[pid] = note;
      bump();
    },

    resetWorkingSeed() {
      const images = new Map<string, string>();
      for (const p of get().seed.planches) {
        for (const c of p.cases) if (c.image) images.set(c.id, c.image);
      }
      const seed = clone(SEED_OFFICIEL);
      for (const p of seed.planches) {
        for (const c of p.cases) if (images.has(c.id)) c.image = images.get(c.id)!;
      }
      const normalized = normalizeSeed(seed);
      const meta = emptyMeta();
      for (const p of normalized.planches) {
        meta.statuts[p.id] = inferPageStatus(p);
      }
      set({
        seed: normalized,
        meta,
        selectedCaseId: null,
        recoveryRequired: false,
      });
      bump();
      toast.success("Seed canonique restauré · images conservées");
    },

    importSeedJson(data) {
      const seed = parseSeed(data);
      const meta = emptyMeta();
      for (const p of seed.planches) meta.statuts[p.id] = inferPageStatus(p);
      set({ seed, meta, selectedCaseId: null, visualPageIndex: 0, recoveryRequired: false });
      bump();
      toast.success("Seed de travail importé");
    },

    async importSessionJson(data) {
      const restored = parseSession(data);
      // Keep the exact raw bytes: corrupt-but-recoverable local data must survive a failed media restore.
      const previousLocal = captureRawLocalSnapshot();
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = null;
      saveLocalSnapshot(restored.seed, restored.meta, restored.mediaMeta);
      try { await dbReplace(restored.records); }
      catch (error) {
        try {
          restoreRawLocalSnapshot(previousLocal);
        } catch {
          throw new Error("Restauration interrompue et retour aux données locales précédentes impossible");
        }
        throw error;
      }
      set({ seed: restored.seed, meta: restored.meta, mediaMeta: restored.mediaMeta,
        selectedCaseId: null, visualPageIndex: 0, recoveryRequired: false });
      bump();
      get().persistNow();
      if (get().saveState === "saved") toast.success("Sauvegarde restaurée");
    },
  };
});

export function pageStatusOf(meta: Meta, id: string): PageStatus {
  return statusOf(meta, id);
}

export function doneCount(seed: Seed, meta: Meta) {
  return seed.planches.filter((p) => pageStatusOf(meta, p.id) === "termine").length;
}

export function filteredPages(seed: Seed, meta: Meta) {
  const f = meta.filters;
  const q = (f.q || "").trim().toLowerCase();
  return seed.planches.filter((p) => {
    const gs = Object.values(p.gardien_etat || {})
      .filter((x) => x?.present)
      .map((x) => String(x.niveau));
    const hay = [
      p.numero,
      p.titre,
      p.chapitre,
      p.date_histoire,
      p.instructions_planche,
      ...(p.notes_planche || []),
      ...(p.cases || []).flatMap((c) => [
        c.numero,
        c.titre,
        c.description,
        c.source_label,
        c.notes,
        ...(c.personnages || []),
        ...(c.textes || []).flatMap((t) => [t.type, t.contenu, t.personnage_id]),
      ]),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!q || hay.includes(q)) &&
      (!f.chapitre || p.chapitre === f.chapitre) &&
      (!f.personnage || (p.cases || []).some((c) => (c.personnages || []).includes(f.personnage))) &&
      (!f.gardien || gs.includes(f.gardien)) &&
      (!f.statut || pageStatusOf(meta, p.id) === f.statut)
    );
  });
}
