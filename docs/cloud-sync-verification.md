# Connexion et synchronisation cloud — vérification

Validation finale du 12 octobre 2026 pour intégrer `feat/supabase-sync` dans `main`.
Base vérifiée : `main` à `538350e`, branche cloud à `28127af`, avec 19 commits d’avance et aucun commit de retard. Les autres branches n’apportent aucune fonctionnalité supplémentaire ; `ux-case-reorder-controls` a le même contenu que `main` malgré une histoire distincte. StoryForge V5/Sites est hors périmètre.

## Défauts corrigés

- La connexion proposée dépendait de courriels, alors que le changement de mot de passe exigeait déjà une connexion. L’interface utilise maintenant uniquement le courriel et le mot de passe StoryForge, avec un message explicite pour distinguer ce compte de Google/ChatGPT. Elle n’envoie aucun lien ni code.
- La synchronisation envoyait des données sans récupérer automatiquement les versions plus récentes. Elle compare maintenant la révision distante et une empreinte locale, puis envoie ou récupère selon les modifications. Les projets sans lien cloud restent locaux jusqu’à leur première sauvegarde explicite.
- La restauration pouvait remplacer la collection locale. L’ouverture d’un projet cloud conserve les autres projets et leurs images. Une version locale modifiée est conservée comme copie avant une ouverture volontaire de la version cloud.
- Les chemins d’images réutilisés permettaient à un navigateur en retard d’écraser les fichiers d’une autre révision. Les nouvelles images utilisent des chemins contenant leur empreinte SHA-256. Les anciens chemins restent lisibles.
- Les références intégrées dépendaient de l’identifiant local `original`. Leur affichage reconnaît maintenant aussi l’identifiant canonique du manuscrit, afin de conserver les cinq portraits après restauration.
- Un clic manuel pendant une synchronisation pouvait être absorbé par la promesse déjà en cours. Les actions manuelles attendent désormais cette opération, puis exécutent réellement l’action demandée.
- Une création cloud validée dont la réponse réseau était perdue pouvait être dupliquée au prochain essai. L’identifiant est maintenant conservé localement avant l’envoi, puis le snapshot distant est vérifié lors de la reprise.
- Une mise à jour validée dont la réponse était perdue pouvait produire un faux conflit. L’empreinte de l’envoi permet d’accuser réception et de sauvegarder les modifications faites entre-temps sans créer une nouvelle copie.
- Après la perte des métadonnées de lien, une restauration pouvait écraser un projet local modifié. L’ouverture compare désormais les données normalisées ; elle conserve une copie locale si elles diffèrent et évite les copies identiques.

La synchronisation automatique garde la case et la planche ouvertes. Une modification pendant un téléchargement empêche le remplacement du travail en cours. Une panne réseau conserve la session et les modifications locales. Les conflits conservent les deux versions ; ils ne sont pas fusionnés automatiquement.

## Résultats observés

| Vérification | Résultat |
| --- | --- |
| `npm test` | 296 tests réussis ; 4 tests de documentation du template déjà ignorés |
| Tests du studio | 50 réussis, dont les courses entre sauvegarde manuelle, téléchargement, modifications locales et envois interrompus |
| TypeScript, compilation, ESLint des fichiers modifiés | Réussis |
| Régression interactive du studio en développement | 30 scénarios réussis, mobile et ordinateur |
| Régression interactive du studio compilé | 30 scénarios réussis, mobile et ordinateur |
| Supabase réel, deux processus Chromium indépendants | 8 scénarios complets réussis |
| Exports ZIP mobile/ordinateur, développement/compilé | 4 archives valides ; CRC, session portable et toutes les images référencées vérifiés |

Le test réel `tests/cloud-browser.test.mjs` vérifie une erreur de mot de passe, la connexion, l’envoi du manuscrit et de trois images importées (case, personnage, gardien), leur récupération dans un second navigateur, les modifications dans les deux sens, la persistance après rechargement, le changement de mot de passe, la déconnexion/reconnexion, une modification hors ligne, la reprise automatique et l’ouverture de plusieurs projets sans supprimer leurs médias. Il vérifie également l’absence d’appels OTP/récupération par courriel et d’erreurs JavaScript non interceptées.

Les tests d’écriture utilisent uniquement un nouveau compte temporaire distinct. Les deux projets existants sont relevés par identifiant, révision et empreinte du snapshot avant/après ; les quatre objets de stockage existants sont également comparés. Aucun mot de passe du compte réel, schéma, politique ou configuration OAuth n’est modifié. L’authentification du compte réel n’est pas répétée : le parcours est testé avec le compte QA.

## Reproduire le test cloud

Créer séparément un compte QA confirmé dont l’adresse est `storyforge-qa-<uuid>@example.test`. Fournir un fichier privé contenant `id`, `email` et `password`, en dehors du dépôt :

```sh
STORYFORGE_CLOUD_QA_ACCOUNT=/chemin/prive/qa.json \
STORYFORGE_TEST_URL=http://127.0.0.1:8080 \
node tests/cloud-browser.test.mjs
```

Le test change le mot de passe de ce compte et met à jour ce fichier. Il attend le chargement des références avant leur vérification et le chargement de la bibliothèque avant de couper le réseau. Il crée des données de test ; supprimer ensuite uniquement les fichiers, projets et compte QA. Aucun mot de passe ni jeton ne figure dans le dépôt.

## Limites du dispositif de test

Les sockets externes du Chromium de cet environnement sont limitées. Le test a utilisé `STORYFORGE_CLOUD_HTTP_RELAY=1`, limité au domaine du projet Supabase : le navigateur transmet ses requêtes à Node, qui contacte les véritables services Auth, REST et Storage. Les réponses et données cloud ne sont pas simulées. Le mode hors ligne bloque aussi ce relais. Les deux navigateurs sont deux processus Chromium séparés ; ces résultats ne constituent pas un test Firefox ou Safari. Les tests de rendu local bloquent les scripts externes et vérifient le contenu après hydratation.

L’accès protégé aux déploiements Vercel est refusé par la connexion disponible (403). Leur état et leur SHA sont consultables ; les parcours directs sur le domaine hébergé ne sont donc pas présentés comme validés. La version compilée est testée localement.

Les politiques RLS de la table et du bucket privé ont été examinées : accès limité au propriétaire authentifié. Aucun changement de schéma, de politique ou de configuration OAuth n’a été effectué.
