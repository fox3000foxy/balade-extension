# Journal des versions

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
