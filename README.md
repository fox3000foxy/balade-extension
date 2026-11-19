# Balade

Des curseurs qui se baladent sur n'importe quelle page, comme une équipe connectée.
JavaScript pur, orienté objet, sans bundler ni dépendance.

## Essayer

- **Sans installer** : ouvrir `demo.html` dans Chrome.
- **En extension** : `chrome://extensions` → activer le mode développeur → « Charger l'extension non empaquetée » → choisir ce dossier.
  Puis cliquer sur l'icône, ou `Alt+Shift+B`. `Échap` ou un second clic les fait repartir.

Depuis la console de la page : `Balade.engine` donne accès au moteur, et `Balade.Config` aux réglages
(à modifier avant de relancer).

## Organisation

Tous les fichiers déclarent leurs classes dans `window.Balade`. Sans bundler, ils sont injectés
dans l'ordre de `FILES` (background.js), qui est aussi celui des `<script>` de demo.html.

| Fichier | Rôle |
| --- | --- |
| `core/namespace.js` | crée l'espace de noms |
| `core/MathUtils.js` | aléatoire, clamp, easings, lissage exponentiel |
| `core/Config.js` | tous les réglages |
| `entities/Cursor.js` | position, tempérament, pression, inclinaison, ressort de bousculade |
| `motion/Motion.js` | gestes de base (générateurs) : `moveTo`, `wait`, `click` |
| `world/Stage.js` | taille de l'écran, éléments intéressants de la page, où viser |
| `behaviors/Behavior.js` | classe de base d'un comportement |
| `behaviors/Arrive.js`, `Leave.js` | entrée et sortie de scène |
| `behaviors/Wander.js` | flânerie : se promener, gigoter, inspecter |
| `render/Renderer.js` | overlay en Shadow DOM, dessin des curseurs et des surbrillances |
| `engine/Engine.js` | boucle, population, souris, choix du comportement suivant |
| `main.js` | `Balade.toggle()` |

## Ajouter un comportement

1. Créer `src/behaviors/MonComportement.js` : une classe qui étend `Behavior` et implémente `*run(cursor)`.
2. L'ajouter à `FILES` (background.js) et aux `<script>` de demo.html, avant `Engine.js`.
3. Le choisir dans `Engine.chooseBehavior(cursor)`.

C'est là que viendra la prédiction de tâche.
