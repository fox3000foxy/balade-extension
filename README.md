# Balade

Des curseurs qui se baladent sur n'importe quelle page, comme une équipe connectée.
JavaScript pur, orienté objet, sans bundler ni dépendance.

## Essayer

- **Sans installer** : ouvrir `demo.html` dans Chrome.
- **En extension** : `chrome://extensions` → activer le mode développeur → « Charger l'extension non empaquetée » → choisir ce dossier.
  Puis cliquer sur l'icône, ou `Alt+Shift+B`. `Échap` ou un second clic les fait repartir ;
  un clic pendant leur sortie relance une nouvelle balade.

Les sons démarrent après votre premier clic ou première touche sur la page (règle des navigateurs).
En plein écran (vidéo, présentation, F11), les curseurs se cachent et se taisent.

Depuis la console de la page : `Balade.engine` donne accès au moteur, et `Balade.Config` aux réglages
(à modifier avant de relancer). `Balade.engine.sound.setMuted(true)` coupe le son.

## Organisation

Tous les fichiers déclarent leurs classes dans `window.Balade`. Sans bundler, ils sont injectés
dans l'ordre de `FILES` (background.js), qui est aussi celui des `<script>` de demo.html.

| Fichier | Rôle |
| --- | --- |
| `core/namespace.js` | crée l'espace de noms |
| `core/MathUtils.js` | aléatoire, clamp, easings, lissage exponentiel |
| `core/Config.js` | tous les réglages |
| `entities/Cursor.js` | position, tempérament, voix, forme, pression, inclinaison, ressort de bousculade |
| `motion/Path.js` | trajets en arcs de cercle enchaînés (arc, S, crochet, vague) |
| `motion/Motion.js` | gestes : `moveTo` (loi de Fitts, minimum jerk, visée + correction), `wait`, `click` |
| `world/Stage.js` | écran, éléments intéressants de la page (pondérés), où viser, plein écran |
| `behaviors/Behavior.js` | classe de base d'un comportement |
| `behaviors/Arrive.js`, `Leave.js` | entrée et sortie de scène |
| `behaviors/Wander.js` | flânerie : se promener, gigoter, inspecter, écrire un mot fantôme |
| `render/Renderer.js` | overlay en Shadow DOM : curseurs, surbrillances, texte fantôme |
| `audio/Sound.js` | petits sons synthétisés (Web Audio), gamme pentatonique, voix par curseur |
| `engine/Engine.js` | boucle, population, souris, plein écran, choix du comportement suivant |
| `main.js` | `Balade.toggle()` |

## Ajouter un comportement

1. Créer `src/behaviors/MonComportement.js` : une classe qui étend `Behavior` et implémente `*run(cursor)`.
2. L'ajouter à `FILES` (background.js) et aux `<script>` de demo.html, avant `Engine.js`.
3. Le choisir dans `Engine.chooseBehavior(cursor)`.

C'est là que viendra la prédiction de tâche.

## Ce qui n'est jamais touché

Les clics sont simulés (le curseur s'enfonce, un son), aucun événement n'est envoyé à la page.
Le texte fantôme est dessiné par-dessus le champ : la valeur du champ ne change pas.
Les champs mot de passe, désactivés, en lecture seule, déjà remplis ou en cours d'utilisation sont ignorés pour l'écriture.
