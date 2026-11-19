# CursorSwarm : principes et formules du « vivant »

*English version: [research.en.md](research.en.md)*

> Notes d'étude sur l'extension [CursorSwarm](https://chromewebstore.google.com/detail/danjmhlboapibdckmaonijlhgcmnadpf) (labbrow, v1.0.0), rédigées avant d'écrire Balade. Elles décrivent des idées, des formules et des ordres de grandeur ; aucun code n'en est repris. Balade s'en inspire puis s'en écarte (minimum jerk, arcs enchaînés, ressort amorti… voir le [README](../README.fr.md)).

Aucune animation de CursorSwarm n'est linéaire, constante ou synchronisée : chaque geste combine une courbe, un easing, une durée non proportionnelle et un peu de hasard borné. Ce sont ces quatre ingrédients, appliqués partout, qui donnent l'impression de vie.

Ces notes servent de base à une réécriture « clean room » : on garde les idées, les formules et les ordres de grandeur, jamais le code.

Trois règles reviennent dans toutes les sections :

- **Rien n'est droit** : les trajets sont en arc, les vitesses varient, les orientations se lissent.
- **Rien n'est identique** : chaque curseur a sa personnalité, chaque pause et chaque cible sont tirées dans une plage.
- **Rien n'est isolé** : le tempo, le son et l'image réagissent au même événement au même moment.

## 1. Le déplacement point à point

Tout trajet d'un point A à un point B passe par une seule fonction (`moveTo`), qui empile trois déformations : une durée en racine de la distance, un arc perpendiculaire et un easing cubique.

### Durée : la racine de la distance

La durée grandit avec la racine carrée de la distance d (en pixels), puis elle est bornée et divisée par un multiplicateur de vitesse propre au geste.

**Formule : durée en racine carrée de la distance**, une version simplifiée de la loi de Fitts.

$$T = \frac{\mathrm{clamp}\left(0{,}12 + 0{,}021\,\sqrt{d},\; 0{,}14,\; 0{,}9\right)}{v}$$

Ordres de grandeur pour v = 1 : 100 px prennent 0,33 s, 400 px prennent 0,54 s, 900 px prennent 0,75 s, et le plafond de 0,9 s est atteint vers 1 380 px. Un trajet quatre fois plus long ne dure qu'environ 1,6 fois plus. C'est l'esprit de la loi de Fitts : la main fait un geste balistique rapide, puis ralentit pour viser.

### Trajectoire : un arc en demi-sinus

Le point avance sur le segment AB, et on le décale perpendiculairement de off = sin(π·e) × bend, où e est l'avancement easé (de 0 à 1). Le décalage est nul aux deux bouts et maximal au milieu.

**Formule : interpolation linéaire (lerp) + décalage perpendiculaire en demi-sinus**, sur le vecteur normal au segment.

$$P(e) = A + e\,(B - A) + \sin(\pi e)\; \mathrm{bend}\; \hat{n}$$

$$\hat{n} = \frac{(-\Delta y,\; \Delta x)}{\lVert B - A \rVert} \qquad \mathrm{bend} = \pm\, U(0{,}04,\; 0{,}14) \times \min(d,\; 600)$$

Le signe est tiré à pile ou face à chaque trajet : l'arc part tantôt à gauche, tantôt à droite. La courbure plafonne à 600 px de distance pour que les très longs trajets ne fassent pas de grands détours. Les gestes « appliqués » (glisser pour dessiner un cadre) forcent bend = 0 ; les clics de plume utilisent une courbure minuscule, U(−0,03 ; 0,03).

### Easing : deux cubiques

L'avancement brut k = t / T passe par deux courbes classiques :

**Formules : easeInOutCubic et easeOutCubic**, les fonctions d'easing cubiques de Robert Penner.

$$\mathrm{easeInOut}(k) = \begin{cases} 4k^3 & k < 0{,}5 \\ 1 - \dfrac{(2 - 2k)^3}{2} & k \ge 0{,}5 \end{cases}$$

$$\mathrm{easeOut}(k) = 1 - (1 - k)^3$$

La règle de choix : easeInOut pendant les 15 premiers % du temps (ou pendant tout le geste s'il s'agit d'un glisser), puis easeOut. À k = 0,15 la position saute de 1,35 % à 38,6 % du trajet en une image. Ce « flick » ressemble au coup de poignet qui lance la souris ; à tester dans notre version, avec et sans raccord continu.

### Cible mobile

La cible peut être une fonction plutôt qu'un point fixe : elle est réévaluée à chaque image, ce qui permet de rejoindre un élément pendant que la page défile. Le point de départ A, lui, reste figé.

## 2. Le repos et la population

Au repos, un curseur flâne : il va lentement vers un point au hasard, attend un peu, puis recommence (`idle`). La foule, elle, grossit et maigrit selon le travail disponible.

### La boucle de flânerie

1. Tirer une cible dans la zone centrale de l'écran : x entre 17 % et 83 % de la largeur, y entre 20 % et 80 % de la hauteur.
2. S'y rendre avec `moveTo` à vitesse 0,35, soit environ trois fois plus lentement qu'un geste de travail. Pour 300 px, cela fait environ 1,4 s.
3. Attendre une durée tirée dans U(0,4 ; 1,4) s. L'attente est interrompue si le défilement fait sortir le curseur de l'écran.
4. Recommencer.

La lenteur fait la différence : le même `moveTo` que pendant le travail, mais ralenti, se lit comme de l'hésitation plutôt que comme une action. Les zones de 17 % et 20 % sur les bords évitent qu'un curseur au repos se colle aux bords de l'écran.

### Le nombre de curseurs suit la charge

Le nombre de curseurs voulu dépend de la vitesse de défilement (vel, en px/s) et du nombre de tâches disponibles (n) :

**Formule : régulation d'effectif bornée (clamp)**, une fonction en escalier de la charge et du défilement.

$$N_{\text{voulu}} = \mathrm{clamp}\left(8 + \left\lfloor \frac{\mathrm{vel}}{80} \right\rfloor + \left\lfloor \frac{n}{4} \right\rfloor,\; 8,\; 24\right)$$

- **Arrivées** : un curseur apparaît hors écran, 40 px à gauche ou à droite, entre 20 % et 80 % de la hauteur, si l'équipe est en sous-effectif et qu'il reste plus de tâches que de curseurs libres. Une arrivée au plus toutes les 0,08 s.
- **Départs** : un curseur sans tâche depuis plus de 2,5 s s'en va par le bord le plus proche (60 px hors écran, vitesse 0,8), tant que l'équipe dépasse 8 curseurs.
- **Les résidents** : les 8 premiers curseurs de l'intro sont marqués « home » et ne partent jamais. Il y a donc toujours un noyau stable à l'écran.

L'effet visible : quand on défile vite ou qu'un gros bloc de tâches se libère, des renforts entrent par les côtés ; quand le travail se tarit, ils repartent un par un. On dirait une équipe qui s'organise.

## 3. L'essaim

Avant le début et après la fin de la reconstruction, les curseurs tournent en essaim autour d'une cible (`follow`). C'est un pilotage à la Reynolds : chaque curseur calcule une vitesse désirée, puis s'en approche avec une force limitée.

### La cible

C'est la souris si elle est sur la page. Sinon, c'est un point qui décrit une courbe de Lissajous lente, en fraction de la taille de l'écran :

**Formule : courbe de Lissajous.**

$$O(t) = \left(0{,}5 + 0{,}28\,\sin(0{,}37\,t),\;\; 0{,}5 + 0{,}25\,\sin(0{,}53\,t + 1)\right)$$

Les deux fréquences n'ont pas de rapport simple, donc la figure ne se répète pratiquement jamais. Avant le démarrage, la cible est le centre de l'écran et l'orbite est réduite à 70 % (facteur s = 0,7).

### Une orbite qui respire et se déforme

Pour un curseur à la distance d de la cible et à l'angle θ, avec n̂ le vecteur unitaire qui part de la cible et t̂ = (−n̂y, n̂x) sa perpendiculaire :

**Formules : modulation sinusoïdale du rayon (respiration) et courbe polaire à trois lobes (rosace).**

$$R(t) = 135\,s\,\big(1 + 0{,}18\,\sin(0{,}55\,t)\big)$$

$$r_c = R(t)\,\big(1 + 0{,}3\,\sin(3\theta + 0{,}7\,t)\big) + 0{,}55\,s\,(\mathrm{orbit}_c - 120)$$

- Le rayon de base **respire** de ±18 % avec une période d'environ 11 s.
- Le terme en sin(3θ + 0,7t) donne à l'anneau **trois lobes qui tournent** lentement : la foule n'est jamais un cercle parfait.
- Le décalage `orbit` (tiré entre 70 et 170) place chaque curseur sur **son propre couloir**, de −27 à +27 px autour du rayon moyen. Il n'y a pas de force de séparation explicite : c'est cet étalement qui évite les amas.

### Le tourbillon qui change de sens

**Formule : onde carrée adoucie par tangente hyperbolique** (« soft square wave »).

$$\mathrm{swirl}(t) = \tanh\big(3\cos(0{,}11\,t)\big)$$

Le cosinus seul donnerait une rotation qui ralentit, s'arrête et repart mollement. Le tanh(3·…) l'écrase en signal quasi carré aux transitions douces : l'essaim tourne franchement dans un sens, puis bascule dans l'autre environ toutes les 29 s.

### La vitesse désirée

**Formules : champ de vitesse orbital en coordonnées polaires** (repère tangent/radial), **avec un ressort radial saturé** (loi de Hooke bornée).

$$\mathrm{tang} = 300\,(0{,}7 + 0{,}2\,\mathrm{spin}_c)\,\mathrm{swirl}(t)$$

$$\mathrm{rad} = \mathrm{clamp}\big(4\,(r_c - d),\; -2600,\; 1400\big) \qquad \mathrm{far} = \mathrm{clamp}\left(\frac{d - r_c}{600},\; 0,\; 1\right)$$

$$\vec{W} = (\mathrm{tang} + 400\,\mathrm{curl}_c\,\mathrm{far})\;\hat{t} \;+\; \mathrm{rad}\;\hat{n}$$

- La composante **tangentielle** fait tourner, plus ou moins vite selon le `spin` du curseur.
- La composante **radiale** est un ressort vers l'anneau, plus fort pour rentrer (−2 600) que pour sortir (+1 400).
- Le terme **curl** n'agit que loin de l'anneau : un curseur qui arrive de loin rejoint l'essaim en spirale, à gauche ou à droite selon le signe de `curl` (tiré entre −1 et 1).

### Alignement avec les voisins

Chaque voisin à moins de 90 px compte avec un poids w = 1 − dist / 90. La vitesse désirée est mélangée à 70/30 avec la vitesse moyenne pondérée des voisins :

**Formule : règle d'alignement des boids (Craig Reynolds, 1987)**, une moyenne pondérée par un noyau linéaire décroissant.

$$\vec{F} = 0{,}7\,\vec{W} + 0{,}3\,\frac{\sum_j w_j\,\vec{v}_j}{\sum_j w_j}$$

C'est ce qui crée les petits groupes qui voyagent ensemble.

### Vitesse et force plafonnées

Avec d′ = max(0, d − 180·s), la distance au-delà du cœur de l'essaim :

**Formules : force de pilotage de Reynolds** (« steering behaviors », 1999 : force = vitesse désirée − vitesse actuelle, tronquée), **intégrée par Euler semi-implicite** (vitesse d'abord, position ensuite).

$$v_{\max} = \mathrm{speed}_c\,\big(1{,}3 + \min(3{,}2,\; d'/90)\big)$$

$$\vec{g} = 6\,\big(\vec{F}_{\le v_{\max}} - \vec{v}\big), \qquad \lVert\vec{g}\rVert \le \mathrm{force}_c\,\big(1{,}4 + \min(5,\; d'/50)\big)$$

$$\vec{v} \leftarrow \vec{v} + \vec{g}\,\Delta t, \qquad \vec{p} \leftarrow \vec{p} + \vec{v}\,\Delta t$$

Le plafond de force est ce qui rend les virages organiques : un curseur ne peut pas changer de direction instantanément, il décrit une courbe. Les deux plafonds grandissent avec la distance, donc un curseur perdu revient vite, alors qu'un curseur dans l'essaim reste doux.

### Des personnalités

| Trait | Curseur « rapide » (25 %) | Curseur normal (75 %) |
| --- | --- | --- |
| speed (px/s) | 1 000 à 1 500 | 300 à 750 |
| force | 3 500 à 6 000 | 700 à 1 800 |
| spin | 2,2 à 3,4 | 0,8 à 1,8 |
| curl | −1 à 1 | −1 à 1 |
| orbit | 70 à 170 | 70 à 170 |

Le mélange de quelques curseurs nerveux et d'une majorité tranquille évite l'effet « banc de poissons » trop uniforme.

### La souris comme obstacle

La vitesse de la souris est estimée et lissée (facteur min(1 ; 18·Δt) par image). Un curseur qui entre dans un disque de 48 px autour d'elle est repoussé sur le bord du disque. S'il s'en approchait, on retire 1,6 fois sa vitesse relative normale, ce qui fait un rebond avec une restitution de 0,6. On ajoute enfin une poussée de 260 px/s vers l'extérieur. On peut ainsi « fendre » l'essaim avec la souris.

## 4. Les micro-signaux du curseur

Quatre petits détails, chacun presque invisible, font qu'on lit un curseur comme « tenu par quelqu'un » : il s'enfonce au clic, s'oriente dans le sens de la marche, change d'outil, et garde sa pointe au bon endroit.

### La pression

Un clic met `press` à 1, et il retombe linéairement à 6 unités par seconde (environ 0,17 s). Le dessin du curseur est mis à l'échelle 1 − 0,12 × press : un écrasement de 12 % qui se relâche. Le clic lui-même dure 0,07 s ; un double-clic, c'est deux clics séparés de 0,08 s.

### L'orientation

- **En essaim** : dès que la vitesse dépasse 30 px/s, l'angle visé est la direction de la vitesse plus 128° (le décalage compense l'inclinaison naturelle de la flèche dessinée). L'angle s'en approche par le plus court chemin avec un facteur min(1 ; 8·Δt) par image, soit environ 0,12 s de constante de temps. Les flèches « regardent » où elles vont, comme des oiseaux.
- **Au travail** : l'angle revient vers 0 avec un facteur min(1 ; 10·Δt), puis se cale à 0 sous 0,5°. Au passage de l'essaim au travail, les flèches se redressent en un dixième de seconde, comme quelqu'un qui reprend sa souris en main.

### La forme suit l'outil

| Forme | Quand |
| --- | --- |
| Flèche | déplacements, sélection, repos |
| Réticule | tracer un cadre ou une zone de texte |
| Barre en I | taper du texte |
| Plume, plume avec un « + » | poser les points d'une ligne |
| Double flèche ↔ ou ↕ | tirer un guide depuis la règle |
| Flèche dupliquée | copier un groupe d'éléments en le glissant |

C'est le vocabulaire visuel des outils de design. Le spectateur reconnaît l'outil avant même de voir le résultat.

### Le point chaud (hotspot)

Chaque forme a son point chaud : (5 ; 3,5) pour la pointe de la flèche, (12 ; 12) pour le centre du réticule, (3 ; 3) pour la plume. Le dessin est décalé de ce point, et la rotation et l'échelle sont appliquées autour de lui. Quand la forme change, tourne ou s'écrase, la pointe ne bouge pas d'un pixel. Sans ce détail, chaque changement d'outil ferait un petit saut qui trahirait l'animation.

### Identité

Chaque curseur reçoit une couleur parmi 16 teintes vives et un prénom parmi 40 pionniers de l'informatique (Ada, Grace, Linus…). Le contour blanc de 1,5 px garde la flèche lisible sur n'importe quel fond.

## 5. Le rythme humain

Les actions de travail imitent les petites imperfections d'une vraie personne : une frappe irrégulière, des clics jamais au centre exact, des pauses pour « regarder », des dépassements corrigés.

### La frappe

Chaque caractère coûte un délai tiré au hasard, avec des surcoûts là où un humain ralentit :

| Caractère ou événement | Délai |
| --- | --- |
| Caractère ordinaire | 45 à 75 ms |
| Espace | + 20 à 50 ms |
| Retour à la ligne | + 80 à 160 ms |
| Hésitation (2 % des caractères) | + 80 à 150 ms |

Tout est multiplié par un facteur qui accélère les longs textes, N étant le nombre de caractères :

**Formule : facteur de compression en racine inverse**, borné.

$$k = \mathrm{clamp}\left(\sqrt{35 / N},\; 0{,}45,\; 1\right)$$

Jusqu'à 35 caractères, la frappe est à vitesse humaine. Au-delà d'environ 170, elle est 2,2 fois plus rapide, sinon un paragraphe prendrait une éternité. Techniquement, le temps écoulé alimente un « budget », et on affiche autant de caractères que le budget en paie. La frappe reste donc juste quel que soit le nombre d'images par seconde.

### Viser à peu près

Un clic sur un élément ne vise jamais son centre exact :

- x = gauche + min(50 % de la largeur ; 50 à 70 px) + un écart aléatoire de ±5 à 8 px ;
- y = haut + min(50 % de la hauteur ; 22 à 30 px) + ±4 px.

Le plafond en pixels imite un vrai réflexe : sur un grand bloc, on clique près du début, pas au milieu.

### Se pousser pour laisser voir

Avant de taper, la barre en I s'écarte de U(−30 ; 10) px horizontalement et de U(10 ; 30) px vers le bas, à vitesse 1,5, pour ne pas masquer le texte qui apparaît. Après une ligne, la plume se décale aussi de 14 à 30 px vers la droite et de 10 à 24 px vers le bas.

### Des pauses pour regarder

Après chaque action, le curseur reste un instant sur place : 0,18 à 0,3 s après avoir tracé un cadre, puis 0,35 s (0,5 s pour une image) le temps que le style s'applique, et 0,15 à 0,3 s après une sélection. Ces petits silences donnent l'impression que quelqu'un vérifie son travail.

### Dépasser, puis s'aimanter

Pour aligner un texte sur un guide, le curseur le glisse un peu trop loin : 2 à 5 px au-delà sur l'axe du guide, avec un léger flottement de ±3 à 6 px sur l'autre axe. Sous 9 px d'écart, la position est forcée à 0 : c'est l'aimantation, accompagnée d'un flash du guide et d'un petit « clic » sonore. Le curseur fait ensuite un dernier geste court et rapide (vitesse 2) jusqu'à la position exacte.

Même logique pour les cadres : si le cadre déborde de l'écran, le glisser s'arrête au bord, puis le cadre finit de grandir seul en 0,5 s avec un easeOut. On voit un geste approximatif que l'outil complète.

### Grossir par crans

Un titre ne grossit pas en continu : sa taille passe par 24, 32, 40, 48, 56, 64, 72, 88 et 104 px, un cran toutes les 60 ms, avec un tic sonore 260 Hz plus aigu à chaque cran. C'est l'image de quelqu'un qui appuie plusieurs fois sur un raccourci.

## 6. La mise en scène

Au-dessus des curseurs, un chef d'orchestre règle le tempo, distribue les tâches dans un ordre lisible et ne construit que ce que le spectateur regarde (`Engine.step`).

### Un tempo commun qui réagit au spectateur

La vitesse de défilement brute est lissée par un suiveur de crête, qui monte vite et redescend lentement :

**Formule : suiveur de crête** (« peak follower », enveloppe attaque/relâchement) : moyenne mobile exponentielle à la montée, décroissance exponentielle à la descente.

$$\mathrm{vel} \leftarrow \max\big(\mathrm{vel}\; e^{-1{,}2\,\Delta t},\;\; 0{,}7\,\mathrm{vel} + 0{,}3\,v_{\text{scroll}}\big)$$

Cette valeur et la charge de travail fixent un tempo commun à tous les curseurs :

**Formule : tempo adaptatif**, une combinaison linéaire saturée.

$$\mathrm{tempo} = \mathrm{clamp}\left(1 + \frac{\mathrm{vel}}{1400} + \min\left(0{,}3,\; 0{,}1\,\frac{n_{\text{dispo}}}{n_{\text{curseurs}}}\right),\; 0{,}95,\; 1{,}4\right)$$

Le tempo multiplie le temps de toutes les actions de travail (trajets, attentes, frappe), mais pas les pauses de flânerie. Quand on défile ou qu'il y a beaucoup à faire, toute l'équipe accélère ensemble, jusqu'à 40 %. Le pas de temps est borné à 50 ms pour qu'un onglet en arrière-plan ne provoque pas de saut au retour.

### Quelle tâche prendre

Un curseur libre prend la tâche disponible de plus petit score, avec y la position verticale de la tâche et y_c celle du curseur :

**Formule : fonction de coût pondérée à priorité lexicographique** (les grands coefficients, 10⁶ et 5·10⁵, créent des étages qui ne se mélangent pas).

$$s = 10^6\,u \;+\; 0{,}6\,y' \;+\; 0{,}4\,\lvert y - y_c \rvert \;-\; 5\cdot 10^5\,[\text{guide}]$$

- u vaut 0 si la tâche est à l'écran (de 40 px au-dessus du haut jusqu'à 88 % de la hauteur), 1 si elle est au-dessus, 2 si elle est en dessous. L'écran passe donc toujours en premier.
- y′ est la position verticale (la distance au haut de l'écran pour les tâches au-dessus) : on construit de haut en bas, dans le sens de la lecture.
- Le terme 0,4 × |y − y_c| favorise ce qui est proche du curseur : pas de traversées inutiles de l'écran.
- Les guides passent devant tout, puisque d'autres tâches s'aimantent dessus.

Le mélange 60/40 entre ordre de lecture et proximité donne une construction globalement descendante, mais où chacun travaille dans son coin.

### Un front qui suit le regard

Un « front de construction » n'avance que vers le bas : max(front, haut de l'écran + 88 % de la hauteur), ou l'infini une fois le bas de la page atteint. Les tâches situées sous le front attendent. La page se construit là où l'on regarde, au rythme du défilement.

### Des dépendances

Une tâche ne devient disponible que quand ses dépendances sont faites : le bloc parent avant son contenu, l'original d'un motif répété avant ses copies, la copie avant ses retouches (texte modifié, image remplacée). Un texte qui doit s'aligner sur un guide attend, lui, jusqu'à 1,6 s que le guide soit posé, puis renonce à l'aimantation. L'ordre des opérations reste crédible. Garde-fou : si plus rien n'est disponible et que personne ne travaille, toutes les dépendances restantes sont levées, pour ne jamais rester bloqué.

### Ce qui apparaît et disparaît en douceur

- Les règles en haut et à gauche glissent à l'écran quand un guide est tiré (lissage de facteur 10·Δt), restent 0,7 s après, puis repartent.
- Un guide s'efface (1,2 unité d'opacité par seconde) 1,2 s après la fin de ses tâches, ou au bout de 7 s.
- Les éléments déposés se calent avec une transition de 0,3 s en cubic-bezier(0,2 ; 0,8 ; 0,2 ; 1). C'est un easeOut très marqué qui arrive vite et se pose doucement. Les images se dévoilent de haut en bas en 0,6 s avec la même courbe.
- À la fin, tous les curseurs libres rejoignent l'essaim de la section 3 : la page terminée est « célébrée » par la foule qui tourne.

## 7. Le son lié au geste

Le son n'est pas une musique de fond : chaque bruit naît d'un geste précis, et il est placé dans l'espace et dans le temps de façon à rester musical, quel que soit le nombre de curseurs (classe `Sound`).

### Placer le son à l'endroit du geste

La position horizontale du curseur fixe le panoramique stéréo, avec x en pixels et L la largeur de l'écran :

**Formule : panoramique linéaire**, une application affine bornée de la position vers [−0,8 ; 0,8].

$$\mathrm{pan} = \mathrm{clamp}\left(1{,}6\,\frac{x}{L} - 0{,}8,\; -0{,}8,\; 0{,}8\right)$$

On entend d'où vient chaque clic, sans jamais aller jusqu'aux extrémités (±0,8), qui sonneraient artificielles au casque.

### Des notes qui ne peuvent pas sonner faux

Poser un élément joue une note de piano choisie dans une gamme pentatonique de mi (0, 2, 4, 7, 9 demi-tons). Dans cette gamme, n'importe quelle combinaison de notes reste consonante.

**Formules : quantification sur une gamme pentatonique en notation MIDI**, puis conversion MIDI → fréquence par la gamme tempérée, f = 440 × 2^((midi − 69) / 12).

$$\mathrm{midi} = 40 + 12\,\mathrm{oct} + \mathrm{PENTA}\left[\left\lfloor 5\,\frac{x}{L} \right\rfloor\right]$$

- **La hauteur suit la position** : l'écran est découpé en 5 bandes verticales, une par degré de la gamme. On « joue » la page de gauche à droite.
- **L'octave suit la taille** : plus l'élément occupe de surface à l'écran, plus la note est grave (octave 1 au-dessus de 8 % de l'écran, puis 2, 3, 4 sous 0,2 %). Les guides sont tout en haut (octave 5).
- **La résonance suit l'octave** : 3,6 s pour les graves, 1,6 s pour les aigus.
- **Les images** ajoutent une deuxième note, deux degrés plus haut dans la gamme, 40 ms après : un petit arpège.
- **Hors écran**, le volume tombe à 45 %.

### Quantifier sur une grille

Les notes ne partent pas à l'instant du geste : elles sont calées sur la croche suivante d'un tempo à 104 BPM (environ 0,29 s), et une seule note est autorisée par case de la grille. Vingt curseurs qui posent des éléments en même temps donnent une mélodie rythmée, pas une cacophonie. Les clics et la frappe, eux, ne sont pas quantifiés : ils doivent coller au geste.

### Synthétiser plutôt qu'enregistrer

Tout est fabriqué en Web Audio, sans aucun fichier son :

- **Le piano** : cinq sinusoïdes aux rapports 1, 2, 3, 2,756 et 5,4 de la fondamentale (le 2,756 est volontairement inharmonique, comme une vraie corde frappée), chacune avec sa propre décroissance. On ajoute un désaccord aléatoire de ±0,1 % et un « coup de marteau » : 30 ms de bruit filtré autour de 4 fois la fréquence plus 1 200 Hz.
- **Les touches du clavier** : deux impulsions de bruit filtré à 1 à 5 ms d'écart, une aiguë (3,6 à 5,6 kHz) et une plus sourde (0,85 à 1,5 kHz, ou 380 à 560 Hz pour la barre d'espace). Chaque frappe tire ses fréquences et son volume au hasard.
- **Le clic de souris** : trois impulsions, l'enfoncement à 2,1 à 2,7 kHz et 650 à 850 Hz, puis le relâchement 55 à 75 ms plus tard, à 2,9 à 3,4 kHz.
- **L'ambiance** : quatre oscillateurs (mi, si, mi, sol♯) légèrement désaccordés et répartis en stéréo, derrière un filtre passe-bas à 420 Hz que fait onduler un LFO à 0,12 Hz (±150 Hz). Le fond « respire » sur environ 8 s.
- **Une réverbération** générée par convolution (3,2 s) et un compresseur sur la sortie, qui soudent l'ensemble.

### Des garde-fous

Au plus 28 notes de piano qui résonnent en même temps, 80 touches et 40 clics par seconde, et pas plus d'une touche toutes les 24 ms par curseur. Sans ces plafonds, un essaim de 24 curseurs saturerait le son.

## 8. Architecture

Trois choix techniques rendent tout ce qui précède simple à écrire : un comportement par coroutine, un temps unique piloté par l'image, et un rendu qui ne touche au DOM que quand c'est nécessaire.

### Un comportement = une coroutine

Chaque curseur porte un générateur dans `c.gen`. À chaque image, le moteur l'avance d'un cran avec `c.gen.next(dt)` ; dans le générateur, l'expression `yield` renvoie justement ce dt.

- **Attendre** : additionner `(yield) * tempo` jusqu'à atteindre la durée voulue.
- **Composer** : `yield* moveTo(…)`, puis `yield* click(…)`, puis `yield* type(…)`. Une action complexe se lit comme une recette, de haut en bas.
- **Terminer** : un générateur terminé libère le curseur, qui reprend un comportement de repos. Une erreur dans un générateur est attrapée et traitée comme une fin de tâche : un bug n'arrête pas tout l'essaim.
- **Nettoyer** : un `try … finally` dans le générateur garantit qu'un compteur partagé (par exemple « quelqu'un a besoin des règles ») est remis à jour même si l'action est interrompue.

L'état d'avancement vit dans les variables locales du générateur, pas dans des champs `state` : aucune machine à états à maintenir.

### Un seul temps, une seule boucle

Une boucle `requestAnimationFrame` calcule dt, le borne à 50 ms, avance la simulation, puis dessine. Toutes les animations dépendent de dt et du tempo, jamais de `setTimeout`. Conséquence pratique : on peut ralentir, accélérer ou rejouer la scène image par image.

Les lissages « x += (cible − x) × min(1 ; k·dt) » reviennent partout (orientation, règles, vitesse de la souris). C'est un lissage exponentiel (filtre passe-bas d'ordre 1), à peu près indépendant du nombre d'images par seconde, dont la constante de temps vaut environ 1/k.

### Des données, des systèmes, un rendu

- Les curseurs et les éléments de page sont de simples objets de données.
- La logique est dans le moteur et dans des fonctions d'action qui reçoivent le moteur en paramètre.
- Le rendu réutilise un élément DOM par curseur, ne réécrit son SVG que quand la forme change, et ne fait sinon que mettre à jour un `transform` arrondi au dixième de pixel.
- Les rectangles de sélection et les mesures sont décrits par une petite fonction attachée au curseur (`c.ov`), réévaluée à chaque image : ils suivent automatiquement l'élément en mouvement.
- Tout est dessiné dans un élément hôte isolé du site (`contain: strict`, z-index maximal), pour que les styles de la page ne s'en mêlent pas.

Pour notre version orientée objet, il suffit de transformer les données en classes (`Cursor`, `Item`) et les fonctions d'action en méthodes ou en classes `Action`, en gardant les générateurs tels quels.

## 9. Récapitulatif et priorités pour notre version

Une quinzaine de réglages font l'essentiel de l'effet ; ce sont les premiers à reproduire et à exposer comme paramètres pour les ajuster à l'œil.

| Réglage | Valeur dans CursorSwarm | Effet si on l'enlève |
| --- | --- | --- |
| Durée d'un trajet | 0,12 + 0,021 √d, entre 0,14 et 0,9 s | trajets longs interminables ou courts trop lents |
| Courbure | 4 à 14 % de d (plafond 600 px), côté au hasard | trajets robotiques en ligne droite |
| Easing | easeInOut puis easeOut à 15 % | vitesse constante, aucune intention lisible |
| Flânerie | vitesse 0,35, pauses de 0,4 à 1,4 s | curseurs figés ou agités en permanence |
| Population | 8 à 24 curseurs, départ après 2,5 s sans tâche | foule qui ne suit pas le travail |
| Rayon de l'essaim | 135 px, respiration ±18 % (11 s), 3 lobes ±30 % | anneau parfait, mécanique |
| Tourbillon | tanh(3 cos 0,11t), bascule toutes les 29 s | rotation monotone |
| Alignement | voisins à 90 px, mélange 70/30 | aucun petit groupe |
| Force plafonnée | 700 à 6 000 selon le curseur | virages instantanés |
| Personnalités | 25 % de curseurs rapides | banc de poissons uniforme |
| Pression | écrasement de 12 %, retour en 0,17 s | clics invisibles |
| Orientation | vitesse + 128°, lissage 8·dt | flèches qui glissent sans regarder |
| Frappe | 45 à 75 ms par caractère, hésitations de 2 % | texte qui « coule » comme une animation |
| Tempo | 0,95 à 1,4 selon le défilement et la charge | scène indifférente au spectateur |
| Quantification du son | croches à 104 BPM, une note par case | cacophonie |

### Ordre de reconstruction proposé

1. `moveTo` avec la durée, l'arc et l'easing, plus la pression et le hotspot : un seul curseur qui clique sur des cibles.
2. La flânerie et la population : plusieurs curseurs qui arrivent, attendent et repartent.
3. L'essaim complet, avec la souris comme cible et comme obstacle.
4. Des tâches factices (cadres, textes) avec la frappe et les pauses, puis le choix des tâches et le tempo.
5. Le son, en commençant par le panoramique et la quantification, qui font le plus pour le moins de code.
