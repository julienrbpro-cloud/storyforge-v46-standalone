import { create } from "zustand";
import { toast } from "sonner";
import {
  LS_MEDIA_META,
  LS_META,
  LS_META_LEGACY,
  LS_PROJECTS,
  LS_SEED,
  PAGE_STATUSES,
  CASE_STATUSES,
} from "./constants";
import { clone, emptyMeta, normalizeMeta, normalizeSeed, parseSeed, SEED_OFFICIEL } from "./seed";
import { dbAll, dbReplace, otherProjectMediaIds, putCaseImage, putImage } from "./media";
import { parseSession } from "./session";
import { uid } from "./utils";
import { migrateProductionNotes, moveCaseBy, moveCaseRelative, moveCaseToIndex, storyCases, syncStoryOrder } from "./sequence";
import { caseSize, computeVisualPages, visualPageIndexOf } from "./visual-layout";
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

type SavedProject = { id: string; seed: Seed; meta: Meta; mediaMeta: Record<string, unknown[]> };
type ProjectArchive = { activeId: string; projects: SavedProject[] };

type SaveState = "idle" | "saving" | "saved" | "error";

interface StudioState {
  ready: boolean;
  recoveryRequired: boolean;
  revision: number;
  saveState: SaveState;
  seed: Seed;
  meta: Meta;
  mediaMeta: Record<string, unknown[]>;
  projects: Array<{ id: string; title: string }>;
  activeProjectId: string;
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
  setEditorialChoiceField: (id: string, key: "regle" | "description", value: string) => void;
  setEditorialRuleField: (id: string, key: "titre" | "contenu", value: string) => void;
  addLibraryPerson: () => void;
  addLibraryGuardian: () => void;
  addEditorialRule: () => void;
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
  moveCase: (caseId: string, anchorId: string, place: "before" | "after") => void;
  moveCaseStep: (caseId: string, dir: -1 | 1) => void;
  moveCaseTo: (caseId: string, index: number) => void;
  addProject: (title: string) => boolean;
  openProject: (id: string) => void;
  deleteCase: (pid: string, cid: string) => void;
  replaceCaseImage: (cid: string, file: File) => Promise<void>;
  removeCaseImage: (pid: string, cid: string) => void;
  setPageNote: (pid: string, note: string) => void;
  resetWorkingSeed: () => void;
  importSeedJson: (data: unknown) => void;
  importSessionJson: (data: unknown) => Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function caseOf(seed: Seed, _pid: string, cid: string) {
  return storyCases(seed).find((c) => c.id === cid);
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
    get().seed.projet.nombre_planches = computeVisualPages(get().seed).length;
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
    projects: [],
    activeProjectId: "original",
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
      migrateProductionNotes(seed, meta);
      const mediaMeta = readLocal<Record<string, unknown[]>>(LS_MEDIA_META, {});
      if (!meta.statuts || Object.keys(meta.statuts).length === 0) {
        meta.statuts = {};
        for (const p of seed.planches) {
          meta.statuts[p.id] = inferPageStatus(p, seed);
        }
      }
      const archive = readLocal<ProjectArchive | null>(LS_PROJECTS, null);
      const projects = archive?.projects?.length ? archive.projects : [{ id: "original", seed, meta, mediaMeta }];
      const active = projects.find((x) => x.id === archive?.activeId);
      // The existing local snapshot is authoritative for the currently open project.
      const activeId = active?.id || projects[0].id;
      set({ seed, meta, mediaMeta, projects: projects.map((x) => ({ id: x.id, title: x.id === activeId ? seed.projet.titre : x.seed.projet.titre })), activeProjectId: activeId, ready: true, recoveryRequired, saveState: recoveryRequired ? "error" : "saved" });
    },

    persistNow() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = null;
      if (get().recoveryRequired) { set({ saveState: "error" }); return; }
      try {
        const { seed, meta, mediaMeta } = get();
        saveLocalSnapshot(seed, meta, mediaMeta);
        const archive = readLocal<ProjectArchive | null>(LS_PROJECTS, null);
        const projects = archive?.projects?.length ? archive.projects : [];
        const activeId = get().activeProjectId;
        const record = { id: activeId, seed, meta, mediaMeta };
        const index = projects.findIndex((p) => p.id === activeId);
        if (index >= 0) projects[index] = record;
        else projects.push(record);
        localStorage.setItem(LS_PROJECTS, JSON.stringify({ activeId, projects }));
        set({ projects: projects.map((x) => ({ id: x.id, title: x.seed.projet.titre })) });
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
      else if (/^[0-5]$/.test(value)) c.gardien_override[gid] = { present: true, niveau: Number(value) };
      else return;
      bump();
    },

    setCaseSize(pid, cid, key, value) {
      const c = caseOf(get().seed, pid, cid);
      if (!c) return;
      const next = {
        width: key === "width" ? value : c.layout_size?.width || 1,
        height: key === "height" ? value : c.layout_size?.height || 1,
      };
      if (!Number.isInteger(value)) return;
      c.layout_size = caseSize({ ...c, layout_size: next });
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

    setEditorialChoiceField(id, key, value) {
      const choice = get().seed.choix_editoriaux_ouverts.find((x) => x.id === id);
      if (!choice) return;
      choice[key] = value;
      bump();
    },

    addLibraryPerson() {
      get().seed.personnages.push({ id: uid("person"), nom: "Nouveau personnage", role: "", note: "" });
      bump();
    },

    addLibraryGuardian() {
      const id = (["archiviste", "armurier"] as const).find((candidate) => !get().seed.gardiens.some((guardian) => guardian.id === candidate));
      if (!id) return;
      get().seed.gardiens.push({ id, nom: "Nouveau gardien", role: "", fonction_protectrice: "", evolution: "" });
      bump();
    },

    addEditorialRule() {
      get().seed.regles_editoriales.push({ id: uid("rule"), titre: "Nouvelle règle", contenu: "" });
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

    addCase(_pid) {
      const seed = get().seed;
      seed.cases ||= [];
      const id = uid("case");
      const created = {
        id,
        image: null,
        overlays: [],
        numero: "",
        titre: null,
        type_unite: "case",
        source_label: "Case locale",
        description: "",
        textes: [],
        personnages: [],
        notes: null,
        source_verbatim: null,
        statut: "a_valider" as const,
        ordre: 0,
      };
      seed.cases.push(created);
      syncStoryOrder(seed);
      set({ selectedCaseId: id, visualPageIndex: visualPageIndexOf(seed.cases, id) });
      bump();
    },

    addProject(title) {
      if (!title.trim() || get().recoveryRequired) return false;
      get().persistNow();
      if (get().saveState === "error") return false;
      const archive = readLocal<ProjectArchive | null>(LS_PROJECTS, null);
      if (!archive) return false;
      const id = uid("project");
      const seed = normalizeSeed({ ...clone(SEED_OFFICIEL), _meta: { format_version: "1.0", statut_canonique: "local" }, avant_propos: {}, projet: { titre: title.trim(), version: "V1", sous_titre: "" }, planches: [], personnages: [], gardiens: [], regles_editoriales: [], choix_editoriaux_ouverts: [] });
      const meta = emptyMeta();
      const mediaMeta = {};
      const snapshot = captureRawLocalSnapshot();
      try {
        saveLocalSnapshot(seed, meta, mediaMeta);
        localStorage.setItem(LS_PROJECTS, JSON.stringify({ activeId: id, projects: [...archive.projects, { id, seed, meta, mediaMeta }] }));
      } catch {
        try { restoreRawLocalSnapshot(snapshot); } catch { /* Original snapshot remains in the archive. */ }
        toast.error("Impossible d’enregistrer le nouveau projet");
        return false;
      }
      set({ seed, meta, mediaMeta, activeProjectId: id, projects: [...get().projects, { id, title: title.trim() }], selectedCaseId: null, revision: get().revision + 1 });
      toast.success("Projet créé");
      return true;
    },

    openProject(id) {
      if (id === get().activeProjectId || get().recoveryRequired) return;
      get().persistNow();
      if (get().saveState === "error") return;
      const archive = readLocal<ProjectArchive | null>(LS_PROJECTS, null);
      const project = archive?.projects.find((p) => p.id === id);
      if (!archive || !project) return;
      let seed: Seed;
      try { seed = parseSeed(project.seed); }
      catch { toast.error("Projet invalide : les données actuelles sont conservées"); return; }
      const meta = normalizeMeta(project.meta);
      migrateProductionNotes(seed, meta);
      const snapshot = captureRawLocalSnapshot();
      try {
        saveLocalSnapshot(seed, meta, project.mediaMeta);
        localStorage.setItem(LS_PROJECTS, JSON.stringify({ ...archive, activeId: id }));
      } catch {
        try { restoreRawLocalSnapshot(snapshot); } catch { /* Original snapshot remains in the archive. */ }
        toast.error("Impossible d’ouvrir ce projet");
        return;
      }
      set({ seed, meta, mediaMeta: project.mediaMeta, activeProjectId: id, selectedCaseId: null, visualPageIndex: 0, revision: get().revision + 1 });
    },

    deleteCase(_pid, cid) {
      const seed = get().seed;
      const cases = seed.cases || [];
      const index = cases.findIndex((c) => c.id === cid);
      if (index < 0) return;
      cases.splice(index, 1);
      seed.choix_editoriaux_ouverts = (seed.choix_editoriaux_ouverts || []).filter(
        (choice) => choice.case_id !== cid,
      );
      syncStoryOrder(seed);
      const next = cases[Math.min(index, cases.length - 1)] || null;
      set({
        selectedCaseId: get().selectedCaseId === cid ? null : get().selectedCaseId,
        visualPageIndex: next ? visualPageIndexOf(cases, next.id) : 0,
      });
      bump();
    },

    moveCase(caseId, anchorId, place) {
      if (!moveCaseRelative(get().seed, caseId, anchorId, place)) return;
      bump();
    },

    moveCaseStep(caseId, dir) {
      if (!moveCaseBy(get().seed, caseId, dir)) return;
      bump();
    },

    moveCaseTo(caseId, index) {
      if (!moveCaseToIndex(get().seed, caseId, index)) return;
      bump();
    },

    async replaceCaseImage(cid, file) {
      const panel = storyCases(get().seed).find((c) => c.id === cid);
      if (!panel) return;
      const ref = await putCaseImage(cid, file);
      panel.image = ref;
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
      const current = get().seed;
      const images = new Map<string, string>();
      const personImages = new Map<string, string>();
      const guardianImages = new Map<string, string>();
      for (const c of storyCases(current)) if (c.image) images.set(c.id, c.image);
      for (const person of current.personnages || []) {
        if (person.image) personImages.set(person.id, person.image);
      }
      for (const guardian of current.gardiens || []) {
        if (guardian.image) guardianImages.set(guardian.id, guardian.image);
      }
      const seed = clone(SEED_OFFICIEL);
      for (const p of seed.planches) {
        for (const c of p.cases) if (images.has(c.id)) c.image = images.get(c.id)!;
      }
      for (const person of seed.personnages || []) {
        if (personImages.has(person.id)) person.image = personImages.get(person.id)!;
      }
      for (const guardian of seed.gardiens || []) {
        if (guardianImages.has(guardian.id)) guardian.image = guardianImages.get(guardian.id)!;
      }
      const normalized = normalizeSeed(seed);
      const meta = emptyMeta();
      for (const p of normalized.planches) {
        meta.statuts[p.id] = inferPageStatus(p, normalized);
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
      for (const p of seed.planches) meta.statuts[p.id] = inferPageStatus(p, seed);
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
      try {
        const otherIds = otherProjectMediaIds();
        const preserved = (await dbAll()).filter((record) => otherIds.has(record.id));
        await dbReplace([...preserved, ...restored.records]);
      }
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
    const cases = storyCases(seed).filter((c) => c.planche_id === p.id);
    const pageCases = cases.length ? cases : p.cases || [];
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
      ...pageCases.flatMap((c) => [
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
      (!f.personnage || pageCases.some((c) => (c.personnages || []).includes(f.personnage))) &&
      (!f.gardien || gs.includes(f.gardien)) &&
      (!f.statut || pageStatusOf(meta, p.id) === f.statut)
    );
  });
}
