# Journal des versions

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
