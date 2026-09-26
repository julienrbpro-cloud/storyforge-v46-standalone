# Architecture hybride StoryForge

## Références examinées

- Base de travail `ux-hybrid-final` : `def00c099ae0fc81444df9f8cdb295d58c824e91`.
- Grok, `ux-sequence-globale` : `b2968103a00d3d6d744a405e72c09b7a7be1525f`.
- Sol, `ux-global-cases` : `fd653d020f400b3987e39fa8a31a849a741a7ed2`.
- `main`, inchangée : `64706f2d72f548d14694f60bfdbc63612c27646e`.

## Retenu de Grok

`seed.cases` est la séquence globale. Les identifiants restent stables ; `ordre`
est un index dérivé pour l'affichage. `numero` et `planche_id` sont des repères
manuscrits, sans effet sur le placement. Les planches visuelles sont calculées
par un seul reflow 3×4. Les gardiens sont déclarés sur chaque case et l'absence
de déclaration reste distincte d'une absence explicite.

Les vues Projets → Projet → grille → éditeur, les portraits complets, les
commandes de déplacement, la recherche globale, le retour à la grille courante,
le lettrage, les images, les exports et les protections de textes sont conservés.

## Retenu et adapté de Sol

- Édition des choix éditoriaux ouverts et de la description distincte des gardiens.
- Contrôles de cohérence accessibles dans Personnages & règles, désormais reliés
  à la case concernée plutôt qu'à une ancienne position de planche.
- Validation du projet archivé avant son ouverture.
- Autorité d'un tableau racine explicitement vide : il ne peut pas ressusciter
  des cases d'une ancienne copie imbriquée.
- Consommation des anciens champs de provenance et d'ordre à la migration,
  puis suppression de leurs représentations concurrentes.

## Décisions nouvelles

- Migration des seeds canoniques imbriqués, de `ordre_cases`, du format Grok et
  du format Sol (`source_planche_id`, `numero_source`) vers le même modèle.
- Les choix éditoriaux sont liés par `case_id`. Leur règle reste éditable à un
  seul endroit. Le prompt reprend tous les choix attachés à la case, y compris
  ceux des projets non canoniques.
- Instructions, date et notes éditoriales d'origine sont copiées une fois sur
  les cases. Les anciennes notes de production sont également reprises à
  l'ouverture/restauration. Des indicateurs de migration empêchent leur retour
  après modification ou effacement volontaire.
- Les nouvelles cases restent sans planche ni numéro manuscrit d'origine.
- La progression est calculée à partir des statuts des cases. Le nombre de
  planches du projet provient du reflow ; le nombre manuscrit reste une archive.
- Suppression de l'ancienne vue Planche inutilisée et des mutations de création,
  suppression ou déplacement des planches manuscrites. Les anciens liens sont
  redirigés vers le projet ; l'éditeur et le lettrage ne requièrent plus de fausse
  planche pour fonctionner.
- Conservation du balayage vers l'avant des deux solutions : une petite case ne
  revient pas remplir un trou situé avant la précédente dans l'ordre de lecture.
- Les références manuscrites restent archivées, jamais reconstruites comme une
  seconde collection active de cases.

## Vérification

`tests/hybrid.test.ts` couvre la migration des deux formats, la séquence vide,
l'ancien ordre global, la provenance des nouvelles cases, les choix éditoriaux,
le contexte, les notes de production, la progression et les indices invalides.
Les tests existants de reflow, médias, sessions et textes verrouillés restent
actifs. Le parcours navigateur vérifie aussi l'édition d'un choix, son maintien
après rechargement et son prompt après déplacement de la case.

Aucune branche source ni configuration de déploiement n'est modifiée. La CI
complète s'exécute séparément sur `ux-hybrid-final`.

### Résultats locaux

- TypeScript et compilation : réussis.
- Tests métier : 42 réussis, aucun échec.
- Navigateur : 28 scénarios réussis en développement et 28 sur la compilation,
  avec fenêtres de 390 et 1280 px ; aucune exception JavaScript applicative.
- Quatre ZIP vérifiés : intégrité, médias embarqués et références portables.
- Captures desktop/mobile inspectées. Le smoke compilé ne diverge pas de celui
  du développement. Son statut n'est toutefois pas entièrement vert : les
  requêtes vers Google Fonts et l'extension Grok échouent dans cet environnement
  isolé, et il signale la carte de partage personnalisée déjà absente. Ces
  éléments externes/préexistants ne sont pas modifiés par cette branche.
- La migration ne peut pas reconstituer une provenance déjà perdue dans un
  ancien export ; elle n'en fabrique pas une pour les cases locales de Sol.
