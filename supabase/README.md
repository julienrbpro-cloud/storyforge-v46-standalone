# Schéma cloud Supabase

`migrations/20261008033507_storyforge_cloud_schema_v1.sql` est la copie exacte
du SQL enregistré dans l’historique du projet StoryForge sous la version
`20261008033507`, nom `storyforge_cloud_schema_v1`. Cette migration crée
`public.storyforge_projects`, son index, ses politiques RLS et les politiques
d’accès aux images dans `storage.objects`.

La version et le SQL d’origine sont conservés. Un projet où cette version est
déjà appliquée la conserve dans son historique : elle ne doit pas être rejouée
manuellement ni dupliquée sous un nouveau numéro.

## Droits explicites

La migration accorde `SELECT`, `INSERT`, `UPDATE` et `DELETE` à
`authenticated`, avec des politiques limitées au propriétaire connecté et
excluant les connexions anonymes. Elle retire les droits de `PUBLIC` et `anon`.
Elle ne dépend donc pas des droits automatiques retirés par Supabase le
30 octobre 2026.

Chaque future table utilisée par la Data API doit déclarer ses propres droits
et politiques RLS dans sa migration de création. Accorder uniquement les
opérations et les rôles nécessaires ; ne pas rétablir des droits automatiques
sur toutes les tables de `public`.

## Recréation et vérification

Ces fichiers sont destinés aux migrations Supabase. Le script
`npm run db:migrate` utilise séparément les fichiers racine de `../migrations/`
pour Neon/PGlite et n’applique pas le schéma Supabase.

Avec la CLI Supabase et Docker disponibles, initialiser la configuration locale
si elle est absente (`supabase init`), puis utiliser `supabase start` et
`supabase db reset --local` dans une instance locale dédiée. Les schémas
Supabase `auth` et `storage` doivent exister avant cette migration.

La création et la configuration du bucket privé `StoryForge-Image` restent
distinctes : le SQL historique crée ses politiques, pas le bucket lui-même.

`node --test scripts/supabase-migration.test.mjs` rejoue le fichier dans un
Postgres embarqué PGlite avec les interfaces SQL nécessaires de `auth` et
`storage`, sans droits automatiques sur les nouvelles tables. Il vérifie les
droits effectifs et l’isolation des propriétaires. Il est également inclus
dans `npm test`. Ce test ne remplace pas un test complet Auth/REST/Storage
sur une instance Supabase.
