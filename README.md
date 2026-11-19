# Balade

Des curseurs qui se baladent sur n'importe quelle page, comme une équipe connectée.
JavaScript pur, orienté objet, sans bundler ni dépendance.

## Installer

`chrome://extensions` → activer le mode développeur → « Charger l'extension non empaquetée » → choisir ce dossier.

- **Alt+B** lance ou range les curseurs sur la page active (modifiable dans `chrome://extensions/shortcuts`).
- **Clic sur l'icône** : le menu, avec le bouton Lancer/Ranger, le thème et les réglages.
  Les réglages sont enregistrés (`chrome.storage.sync`) et s'appliquent en direct sur la page.
- **Échap** fait repartir les curseurs.

Les sons démarrent après votre premier clic ou première touche sur la page (règle des navigateurs).
L'extension ne fonctionne pas sur les pages protégées de Chrome (`chrome://`, Chrome Web Store).

## Essayer sans installer

`demo.html` charge les mêmes scripts et affiche le menu à côté de la page. Pour que le menu pilote
la page, servez le dossier en local (par exemple `python3 -m http.server`) et ouvrez
`http://localhost:8000/demo.html` ; en ouvrant le fichier directement, les curseurs marchent mais
le menu reste décoratif.

## Thèmes

| Thème | Esprit |
| --- | --- |
| Classique (par défaut) | pointeurs aux proportions d'un système : corps blanc, contour noir |
| Zine | deux encres risographiées, légèrement décalées |
| Galets | formes dodues et mates, couleurs d'argile |
| Carnet | trait d'encre, spécimens numérotés, crayon rouge |

Chaque thème dessine cinq pointeurs (flèche, main, texte, viseur, attente), tous en SVG.
Le pointeur change comme dans un vrai navigateur : main sur les liens et boutons,
barre en I sur les champs, viseur sur les images, attente pendant certaines pauses.

## Réglages par site

Dans le menu, la section « Ce site » permet de ne jamais lancer Balade sur un site (utile pour
les outils internes ou les pages qui affichent des données sensibles), ou de l'y lancer
automatiquement. Le lancement automatique demande l'accès au site concerné, et à lui seul.

## Pages sombres

Chaque curseur regarde le fond sous lui et adapte son pointeur s'il est sombre
(interrupteur « Adapter aux pages sombres »).

## Vie sociale et réactions

- **Attention partagée** : souris immobile environ une seconde, ou saisie dans un champ, et les
  curieux viennent voir ; ils repartent quand vous vous éloignez.
- **Rencontres** : salut, petit son, parfois l'un suit l'autre.
- **Réactions** : élan vers vos clics, hourra quand vous envoyez un formulaire.
- **Essaim à la demande** : Maj, puis Maj maintenu.

Deux interrupteurs du menu les règlent : « Bavarder entre eux » et « Réagir à ce que je fais ».

## Défilement

Les curseurs vivent sur la page, pas sur l'écran. Quand vous faites défiler, ils partent avec le
contenu, puis chacun vous rattrape après un temps de réaction (0,3 à 1,5 s selon sa patience ;
parfois plus longtemps s'il est « occupé »). Un curseur hors de vue apparaît comme un repère
avec son prénom en haut ou en bas de l'écran.

## Organisation

Tous les fichiers déclarent leurs classes dans `window.Balade`. Sans bundler, ils sont injectés
dans l'ordre de `FILES` (`lib/inject.js`), qui est aussi celui des `<script>` de `demo.html`.

| Fichier | Rôle |
| --- | --- |
| `background.js` | raccourci Alt+B |
| `lib/inject.js` | injection des scripts, lancer/ranger, état de l'onglet |
| `popup/` | le menu (HTML, CSS aux quatre habillages, JS) |
| `core/Config.js` | réglages internes du mouvement |
| `core/Settings.js` | réglages de l'utilisateur : stockage et traduction en paramètres |
| `entities/Cursor.js` | position, vue de la page, tempérament, micro-signaux |
| `motion/Path.js` | trajets en arcs de cercle enchaînés |
| `motion/Motion.js` | gestes : loi de Fitts, minimum jerk, visée + correction, clic |
| `world/Stage.js` | écran, éléments de la page, où viser, plein écran |
| `behaviors/*.js` | arrivée, départ, flânerie, attention (`Gather`), suivre (`Follow`), essaim (`Swarm`) |
| `render/Themes.js` | les quatre thèmes et leurs pointeurs |
| `render/FontLoader.js` | polices embarquées pour l'overlay |
| `render/Renderer.js` | overlay en Shadow DOM, étiquettes, repères de bord, texte fantôme |
| `audio/Sound.js` | petits sons synthétisés (Web Audio) |
| `engine/Engine.js` | boucle, population, défilement, souris, plein écran |
| `main.js` | `Balade.toggle()` et suivi des réglages |
| `autostart.js` | lancement automatique sur les sites choisis |

## Ajouter un comportement

1. Créer `src/behaviors/MonComportement.js` : une classe qui étend `Behavior` et implémente `*run(cursor)`.
2. L'ajouter à `FILES` (`lib/inject.js`) et aux `<script>` de `demo.html`, avant `Engine.js`.
3. Le choisir dans `Engine.chooseBehavior(cursor)`.

## Ce qui n'est jamais touché

Les clics sont simulés (le curseur s'enfonce, un son), aucun événement n'est envoyé à la page.
Le texte fantôme est dessiné par-dessus le champ : la valeur du champ ne change pas.
Les champs mot de passe, désactivés, en lecture seule, déjà remplis ou en cours d'utilisation sont ignorés.

## Polices

Bricolage Grotesque, Chivo Mono, Fredoka, Figtree, Young Serif et Spline Sans Mono, sous licence
SIL Open Font License 1.1 (voir `fonts/licences/`).
