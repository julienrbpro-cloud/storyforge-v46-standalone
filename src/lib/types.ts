export type TextType =
  | "dialogue"
  | "narration"
  | "narration_interieure"
  | "lettre"
  | "texto"
  | "caption"
  | "texte_symbolique"
  | "texte_ecran"
  | "repere_temporel";

export type PageStatus = "a_faire" | "brouillon" | "en_cours" | "termine";
export type CaseStatus = "a_valider" | "brouillon" | "en_cours" | "valide";
export type OverlayType = "text" | "speech";
export type GuardianId = "archiviste" | "armurier";

export interface GuardianState {
  present: boolean;
  niveau: number | null;
}

export interface Overlay {
  id: string;
  type: OverlayType;
  text_ref?: string | null;
  content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  align: "left" | "center" | "right";
}

export interface CaseText {
  id: string;
  type: TextType | string;
  personnage_id: string | null;
  contenu: string;
  preserve_exact: boolean;
  source_label?: string;
}

export interface PanelCase {
  id: string;
  image?: string | null;
  overlays: Overlay[];
  numero: string;
  titre: string | null;
  type_unite: string;
  source_label?: string;
  description: string;
  textes: CaseText[];
  personnages: string[];
  notes: string | null;
  source_verbatim: string | null;
  statut: CaseStatus | string;
  layout_size?: { width: number; height: number };
  gardien_override?: Partial<Record<GuardianId, GuardianState>>;
  /** Derived 1-based index. Display only — position is the array order. */
  ordre?: number;
  /** Manuscript planche this case was migrated from. Not a visual page. */
  planche_id?: string;
}

export interface Planche {
  id: string;
  numero: number;
  titre: string;
  chapitre: string | null;
  date_histoire: string | null;
  gardien_etat: Record<GuardianId, GuardianState>;
  instructions_planche: string | null;
  notes_planche: string[] | null;
  cases: PanelCase[];
}

export interface Personnage {
  id: string;
  nom: string;
  role?: string;
  note?: string;
  image?: string | null;
}

export interface Gardien {
  id: GuardianId | string;
  nom?: string;
  personnage_id?: string;
  role?: string;
  objets_permanents?: string[];
  fonction_protectrice?: string;
  evolution?: string;
  image?: string | null;
}

export interface EditorialRule {
  id: string;
  titre: string;
  contenu: string;
}

export interface EditorialChoice {
  id: string;
  planche: number | string;
  case: string;
  type?: string;
  description?: string;
  regle: string;
  bloque_import?: boolean;
  bloque_generation_du_texte?: boolean;
}

export interface Seed {
  _meta?: Record<string, unknown>;
  projet: {
    titre: string;
    version: string;
    sous_titre?: string;
    type?: string;
    nombre_planches?: number;
  };
  personnages: Personnage[];
  gardiens: Gardien[];
  regles_editoriales: EditorialRule[];
  avant_propos?: Record<string, unknown>;
  choix_editoriaux_ouverts: EditorialChoice[];
  /** Persisted narrative order. Visual planches are computed from this list. */
  cases?: PanelCase[];
  planches: Planche[];
}

export interface Filters {
  q: string;
  chapitre: string;
  personnage: string;
  gardien: string;
  statut: string;
}

export interface Meta {
  statuts: Record<string, PageStatus>;
  notes: Record<string, string>;
  filters: Filters;
}

export interface MediaMeta {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
  active?: boolean;
  builtin?: boolean;
}

export interface CoherenceIssue {
  level: "error" | "warn" | "ok";
  title: string;
  text: string;
  pageId?: string;
  pageNumero?: number;
}

export interface VisualItem {
  c: PanelCase;
  row: number;
  col: number;
  width: number;
  height: number;
}

export interface VisualPage {
  items: VisualItem[];
  occupied: boolean[];
}
