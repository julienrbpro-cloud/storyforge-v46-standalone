import type { CaseStatus, PageStatus, TextType } from "./types";

export const APP_VERSION = "4.0";
export const APP_NAME = "StoryForge";

export const TEXT_TYPES: Array<[TextType, string, string]> = [
  ["dialogue", "Dialogue", "t-dialogue"],
  ["narration", "Narration", "t-narration"],
  ["narration_interieure", "Narration intérieure", "t-narration"],
  ["lettre", "Lettre", "t-lettre"],
  ["texto", "Texto", "t-texto"],
  ["caption", "Carton / caption", "t-caption"],
  ["texte_symbolique", "Texte symbolique", "t-symbolique"],
  ["texte_ecran", "Texte d’écran", "t-ecran"],
  ["repere_temporel", "Repère temporel", "t-repere"],
];

export const PAGE_STATUSES: Array<[PageStatus, string, string]> = [
  ["a_faire", "À faire", "status-todo"],
  ["brouillon", "Brouillon", "status-draft"],
  ["en_cours", "En cours", "status-wip"],
  ["termine", "Terminé", "status-done"],
];

export const CASE_STATUSES: Array<[CaseStatus, string, string]> = [
  ["a_valider", "À valider", "status-todo"],
  ["brouillon", "Brouillon", "status-draft"],
  ["en_cours", "En cours", "status-wip"],
  ["valide", "Validée", "status-done"],
];

export const GUARDIANS: Array<["archiviste" | "armurier", string]> = [
  ["archiviste", "Archiviste"],
  ["armurier", "Armurier"],
];

export const OFFICIAL_REFS = [
  {
    id: "ref-sunny",
    entityId: "sunny",
    name: "Sunny — référence officielle",
    kind: "personnage",
    data: "/assets/refs/sunny.jpg",
  },
  {
    id: "ref-julien",
    entityId: "julien",
    name: "Julien — référence officielle",
    kind: "personnage",
    data: "/assets/refs/julien.jpg",
  },
  {
    id: "ref-armurier",
    entityId: "armurier",
    name: "Armurier — gardien de Sunny",
    kind: "gardien",
    data: "/assets/refs/armurier.jpg",
  },
  {
    id: "ref-arlo",
    entityId: "arlo",
    name: "Arlo — témoin",
    kind: "personnage",
    data: "/assets/refs/arlo.jpg",
  },
  {
    id: "ref-archiviste",
    entityId: "archiviste",
    name: "Archiviste — gardien de Julien",
    kind: "gardien",
    data: "/assets/refs/archiviste.jpg",
  },
] as const;

export const LS_SEED = "sf46-seed";
export const LS_META = "sf46-meta-v3";
export const LS_META_LEGACY = "sf46-meta";
export const LS_MEDIA_META = "sf46-media-meta";
export const LS_SEEN = "sf46-seen-splash";