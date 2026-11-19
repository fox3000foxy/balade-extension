# Changelog

## Unreleased — Six ambient features, memory and performance

### New ambient features (all visual only, nothing sent to the page)
- **Reading ambiance**: element interest adapts to page kind — headings on articles, fields on forms (`Stage.pageKind`).
- **Scroll hint**: past 85% of a long page, a free cursor drifts up and points toward the top.
- **First-visit tour**: on unknown sites (fewer than 5 recorded clicks), the first cursor becomes a guide visiting nav, search, main content and headings (`Guide` behavior, `Habits.isNew`).
- **Focus companion**: starting focus mode keeps one cursor that "works" beside you in a corner, and cheers when break starts (`Companion` behavior).
- **Contrast inspector**: 20% of heading/link visits linger with a remark when WCAG contrast is below 4.5 (`Stage.contrastOf`).
- **Site weather**: cursor arrival pace follows felt load time — fanfare under 800 ms (with a cheer), lazy above 2.5 s (`arrivalMood` from navigation timing).

### Memory leaks plugged
- `Renderer.unmount`: restores `data-balade-typing` placeholders, drops `hud`, cancellable fade-out timer (no double overlay on fast toggle).
- `Habits.load`: disposes previous watcher first (no stacked listeners).
- `Sound`: cancellable deferred context close; `clearTimeout` on restart.
- `Engine.destroy`: invalidates element cache, drops prediction element, clears closures.

### Performance
- Background sampling: max 2 cursors per frame round-robin, interval 0.35 s → 1 s.
- `visibleElements`: O(1) host-tag check instead of `closest()` per element.
- Arc tracing: iterative heading rotation, ~4x faster than `Math.cos/sin` per step, bit-exact.
- Gesture timing: per-gesture 64-entry progress curve, no `Math.pow` per frame (error < 5e-4).
- Swarm: triple-angle `sin(3θ+φ)` without `atan2` (~3x), shared per-frame oscillations, squared neighbor distances (~2x).
- Prediction: cosine pre-filter benchmarked and rejected (slower); plain `acos` kept.
- Path resolution 48 → 24 points (invisible at 60 fps, half the allocs).

## 1.1.0 — Bug fixes, cross-site persistence

### Bug fixes
- `Engine._learnClick` no longer poisons the element cache (passed `this.time + 2`).
- Renderer reuses a single `getBoundingClientRect` for ghost text + selection (was 2x per frame).
- `inject.ensureLoaded` shares one pending promise per tab (fixes double-injection race).
- Engine timers are capped and guarded so one bad timer can't break a frame.
- `Engine.destroy` clears timers, pair history and click history.
- Popup toggle button is restored on error; status poll is 2s and cleared on unload.

### Performance
- `_meetings` throttled to 4 Hz and capped at 30 cursors (was O(n^2) every frame).
- Element cache invalidated on scroll/resize; search-hint regex hoisted.

### Cross-site persistence
- Pages notify the service worker when Balade starts/stops; navigation re-injects
  even across sites (the old `onCommitted` scripting ran on a detached document).
- Snapshots saved periodically (2s) + on hide/unload, kept 30s, clamped to 0-1.
- Stale per-tab flags are dropped on tab close; re-armed when already running.

### Internationalization
- Menu, options page, game HUD, bubble phrases and SVG import errors now follow
  the browser language (English or French) via `chrome.i18n` / `src/core/I18n.js`.
- Two name lists: computing pioneers in English (Ada, Grace, Alan, Linus...),
  the original French names in French (Alix, Bastien, Chloe...).
- `_locales/en/messages.json` and `_locales/fr/messages.json` (145 keys each).

### Field compatibility
- Ghost typing now skips search bars, comboboxes and autocomplete fields
  (`role=combobox/searchbox`, `type=search`, `aria-autocomplete`, `aria-haspopup`,
  and name/id/placeholder heuristics). Cursors still visit and inspect those fields.

### Documentation
- `README.md` in English; French version at `README.fr.md`.
- Theme screenshots in `docs/images/`.
- Study notes on CursorSwarm (formulas, principles): `docs/research.en.md` and
  `docs/research.fr.md`.
- `demo.html` in English.

### Code quality
- All source comments translated to English.
- Non-AZERTY characters (em-dashes, arrows, ellipsis, guillemets) removed from comments.

## 0.8.0 — Jeu du chat, concentration, enregistrement vidéo

- **Jouer au chat** (menu, « Jeux et outils ») : tous les curseurs fuient votre souris
  (pilotage à force plafonnée, bords et voisins qui repoussent, quelques rapides) ; on en
  attrape un en passant dessus. Compteur et chrono en haut de l'écran, meilleur temps gardé
  dans le stockage de l'extension (jamais dans celui du site). Échap arrête la partie.
- **Concentration · 25 min** : les curseurs s'en vont, un discret minuteur reste dans le coin ;
  à la fin, ils reviennent pour 5 minutes de pause (« pause ! », petit arpège).
- **Enregistrer une vidéo de l'onglet** : capture de l'onglet (chrome.tabCapture), enregistrée
  en WebM dans un document hors écran, téléchargée automatiquement à l'arrêt (2 minutes au
  plus). Badge « REC » sur l'icône pendant l'enregistrement ; le son de l'onglet reste audible.
- Nouvelles autorisations : `tabCapture`, `offscreen`, `downloads` (pour l'enregistrement).
- Correctif : les éléments masqués du menu (`hidden`) l'étaient vraiment.

## 0.7.0 — Personnalisation

- **Page « Personnalisation »** (lien dans le menu, ou clic droit sur l'icône → Options) :
  - **Prénoms** : votre liste (40 au plus), appliquée aux curseurs qui arrivent.
  - **Mon thème** : un cinquième thème « Perso » qui reprend l'habillage d'un thème de départ,
    avec vos couleurs (jusqu'à 10) et, si vous voulez, votre propre flèche.
  - **Pointeur importé** : un fichier SVG, nettoyé à l'import (liste blanche de formes et
    d'attributs ; scripts, liens, styles, images et `url()` retirés) puis re-nettoyé avant
    d'entrer dans une page. `currentColor` reprend la couleur de chaque curseur. On place la
    pointe d'un clic sur le dessin (ou aux flèches du clavier).
  - **Aperçu** des curseurs, dessiné exactement comme dans les pages.
- Le texte des étiquettes du thème perso s'adapte à vos couleurs pour rester lisible.
- Le menu affiche le thème « Perso » quand il est activé, avec l'habillage de son thème de départ.

## 0.6.0 — Anticipation du geste, apprentissage des habitudes

- **Deviner mes gestes** : pendant que vous déplacez la souris, Balade cherche l'élément
  cliquable visé (cône autour de la direction, distance restante estimée par v² / 2|a| quand
  vous freinez, habitudes du site). Si une cible l'emporte nettement, le curseur libre le plus
  proche y file et l'entoure ; « je le savais ! » s'il a vu juste. Sur nos gestes de test :
  5 bonnes réponses sur 6, aucune mauvaise.
- **Apprendre mes habitudes** : chaîne de Markov locale des clics, site par site
  (« après A, vous cliquez souvent B »). Après un clic, si la suite habituelle est assez sûre
  (au moins 3 observations, 40 % ou plus), un curseur va vous attendre sur l'élément suivant.
- **Confidentialité** : tout reste sur l'ordinateur (`chrome.storage.local`). Seule l'identité
  des éléments cliqués est retenue (balise, libellé, chemin du lien), jamais ce que vous tapez.
  Section « Ce site » du menu : nombre de clics appris et bouton « Oublier ».
- `Balade.engine.predictor.lastGuess` dans la console pour voir le raisonnement de la dernière prédiction.

## 0.5.0 — Réglages par site, pages sombres

- **Ce site** (dans le menu) : « Ne jamais lancer ici » et « Lancer automatiquement ici »,
  avec la liste des sites exclus et automatiques (retrait en un clic).
- **Exclusion** : sur un site exclu, Alt+B et le bouton du menu ne font rien ; si la balade
  tourne au moment de l'exclusion, les curseurs s'en vont d'eux-mêmes.
- **Lancement automatique** : Chrome demande l'accès au site au moment où on l'active
  (autorisation facultative, site par site) ; un script de contenu est alors enregistré
  pour ces seuls sites.
- **Pages sombres** : chaque curseur regarde le fond sous lui (luminance WCAG, avec hystérésis).
  Sur fond sombre, le Classique s'inverse, le Carnet passe en « tableau noir », le Zine et
  les Galets gagnent un halo. Le texte fantôme prend la couleur du champ s'il est sombre.
  Interrupteur « Adapter aux pages sombres ».
- Démo : une zone sombre pour essayer.

## 0.4.0 — Attention partagée, vie sociale, essaim à la demande

- **Attention partagée** : quand votre souris reste immobile environ une seconde, ou quand vous
  tapez dans un champ, les curseurs les plus curieux viennent se placer autour, à distance polie,
  chacun à sa place. Ils repartent quand vous vous éloignez (ou au bout de quelques secondes).
- **Rencontres** : deux curseurs qui se croisent se saluent d'un tortillement et d'un petit son ;
  parfois l'un suit l'autre quelques secondes.
- **Bulles** : « salut ! », « hmm ? », « joli »… dans le style de chaque thème, qui changent de
  côté près des bords de l'écran.
- **Réactions à vos gestes** : un clic donne un petit élan aux curseurs proches ; un formulaire
  envoyé déclenche un hourra collectif (sauts, bulles, arpège).
- **Essaim à la demande** : Maj, puis Maj maintenu. Tous les curseurs tournent autour de votre
  pointeur, la flèche dans le sens du vol, puis se dispersent quand vous relâchez. La saisie de
  majuscules ne le déclenche pas.
- **Menu** : deux interrupteurs, « Bavarder entre eux » et « Réagir à ce que je fais ».
- Nouveaux comportements : `Gather`, `Follow`, `Swarm`.
- Un comportement interrompu se termine proprement (ses blocs `finally` s'exécutent).

## 0.3.0 — Menu, thèmes, Alt+B, défilement

- Menu de l'extension (clic sur l'icône) aux quatre habillages, réglages enregistrés et appliqués en direct.
- Quatre thèmes : Classique (par défaut), Zine, Galets, Carnet ; polices embarquées (OFL).
- Raccourci Alt+B pour lancer ou ranger les curseurs.
- Nouveaux pointeurs : main (liens, boutons), viseur (images), attente (pauses de réflexion).
- Les curseurs vivent sur la page et rattrapent votre défilement après un temps de réaction ;
  repères au bord de l'écran pour ceux qui sont hors de vue.

## 0.2.0 — Mouvement humain, champs, sons, plein écran

- Pointage en deux temps : geste principal imparfait puis correction ; loi de Fitts ; profil
  de vitesse à secousse minimale avec pic avancé.
- Trajets en arcs de cercle enchaînés (arc, S, crochet, vague).
- Intérêt pour les champs de saisie, avec mots fantômes (jamais écrits dans la page).
- Petits sons synthétisés, une voix par curseur.
- Curseurs cachés et muets en plein écran.

## 0.1.0 — Première balade

- Curseurs qui flânent, gigotent et inspectent les éléments de la page.
- Population variable, arrivées et départs par les bords.
- Pression au clic, inclinaison, bousculade par la souris avec ressort amorti.
- JavaScript pur, orienté objet, sans bundler.
