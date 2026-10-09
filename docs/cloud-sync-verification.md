# Connexion et synchronisation cloud — vérification

Branche : `feat/supabase-sync`, à partir de `00df8c5`.
La branche `main`, les déploiements de production et StoryForge V5 sont hors périmètre.

## Défauts corrigés

- La connexion proposée dépendait de courriels, alors que le changement de mot de passe exigeait déjà une connexion. L’interface utilise maintenant uniquement le courriel et le mot de passe StoryForge, avec un message explicite pour distinguer ce compte de Google/ChatGPT. Elle n’envoie aucun lien ni code.
- La synchronisation envoyait des données sans récupérer automatiquement les versions plus récentes. Elle compare maintenant la révision distante et une empreinte locale, puis envoie ou récupère selon les modifications. Les projets sans lien cloud restent locaux jusqu’à leur première sauvegarde explicite.
- La restauration pouvait remplacer la collection locale. L’ouverture d’un projet cloud conserve les autres projets et leurs images. Une version locale modifiée est conservée comme copie avant une ouverture volontaire de la version cloud.
- Les chemins d’images réutilisés permettaient à un navigateur en retard d’écraser les fichiers d’une autre révision. Les nouvelles images utilisent des chemins contenant leur empreinte SHA-256. Les anciens chemins restent lisibles.
- Les références intégrées dépendaient de l’identifiant local `original`. Leur affichage reconnaît maintenant aussi l’identifiant canonique du manuscrit, afin de conserver les cinq portraits après restauration.
- Un clic manuel pendant une synchronisation pouvait être absorbé par la promesse déjà en cours. Les actions manuelles attendent désormais cette opération, puis exécutent réellement l’action demandée.

La synchronisation automatique garde la case et la planche ouvertes. Une modification pendant un téléchargement empêche le remplacement du travail en cours. Une panne réseau conserve la session et les modifications locales. Les conflits conservent les deux versions ; ils ne sont pas fusionnés automatiquement.

## Résultats observés

| Vérification | Résultat |
| --- | --- |
| `npm test` | 292 tests réussis ; 4 tests de documentation du template déjà ignorés |
| Dernière vérification des tests du studio | 46 réussis, dont les courses entre sauvegarde manuelle, téléchargement et modifications locales |
| TypeScript, compilation, ESLint des fichiers modifiés | Réussis |
| Régression interactive du studio en développement | 30 scénarios réussis, mobile et ordinateur |
| Régression interactive du studio compilé | 30 scénarios réussis, mobile et ordinateur |
| Supabase réel, deux processus Chromium indépendants | 8 scénarios complets réussis |
| Compte existant, navigateur vierge, lecture seule | Connexion, ouverture du manuscrit, décodage de l’image privée et des cinq portraits intégrés réussis |

Le test réel `tests/cloud-browser.test.mjs` vérifie une erreur de mot de passe, la connexion, l’envoi du manuscrit et de trois images importées (case, personnage, gardien), leur récupération dans un second navigateur, les modifications dans les deux sens, la persistance après rechargement, le changement de mot de passe, la déconnexion/reconnexion, une modification hors ligne, la reprise automatique et l’ouverture de plusieurs projets sans supprimer leurs médias. Il vérifie également l’absence d’appels OTP/récupération par courriel et d’erreurs JavaScript non interceptées.

Pour le compte existant, toute écriture de projet ou de fichier a été bloquée pendant la vérification. La sauvegarde originale reste à la révision 13, avec la même empreinte de snapshot `d5b4270a01d76c3c6ec956e18db4ec52` et les deux objets de stockage existants. Les tests d’écriture utilisent uniquement un compte temporaire distinct.

## Reproduire le test cloud

Créer séparément un compte QA confirmé dont l’adresse est `storyforge-qa-<uuid>@example.test`. Fournir un fichier privé contenant `id`, `email` et `password`, en dehors du dépôt :

```sh
STORYFORGE_CLOUD_QA_ACCOUNT=/chemin/prive/qa.json \
STORYFORGE_TEST_URL=http://127.0.0.1:8080 \
node tests/cloud-browser.test.mjs
```

Le test change le mot de passe de ce compte et met à jour ce fichier. Il crée des données de test ; supprimer ensuite uniquement les fichiers, projets et compte QA. Aucun mot de passe ni jeton ne figure dans le dépôt.

## Limites du dispositif de test

Les sockets externes du Chromium de cet environnement étaient bloquées. Le test local a donc utilisé `STORYFORGE_CLOUD_HTTP_RELAY=1` : le navigateur transmet ses requêtes à Node, qui contacte les véritables services Supabase Auth, REST et Storage. Les réponses et données cloud ne sont pas simulées. Le mode hors ligne bloque aussi ce relais. Les deux navigateurs sont deux processus Chromium séparés ; ces résultats ne constituent pas un test Firefox ou Safari.

Les politiques RLS de la table et du bucket privé ont été examinées : accès limité au propriétaire authentifié. Aucun changement de schéma, de politique ou de configuration OAuth n’a été effectué.
