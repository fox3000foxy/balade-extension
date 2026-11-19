// Tous les réglages au même endroit, pour les ajuster à l'œil.
(() => {
  // Textes dans la langue du navigateur (_locales).
  const L = (key) => window.Balade.I18n.list(key);

  window.Balade.Config = {
    // Pas de temps maximal : évite les sauts au retour d'un onglet en arrière-plan.
    dtMax: 0.05,

    population: {
      // Effectif visé et bornes de ses variations (réglage « Curseurs » du menu).
      target: 6,
      min: 5,
      max: 7,
      // Toutes les 6 à 14 s, l'effectif voulu change de ±1 : des curseurs arrivent ou repartent.
      changeEvery: [6, 14],
      // Écart moyen entre deux arrivées (s).
      spawnGap: 0.5
    },

    motion: {
      // Loi de Fitts : durée = a + b · log2(1 + distance / largeur de la cible), en s.
      fitts: { a: 0.08, b: 0.085, min: 0.12, max: 0.75 },
      // Multiplicateur global de vitesse (réglage « Allure » du menu).
      speedMul: 1,
      // Largeur de cible supposée quand on vise un simple point (px).
      defaultWidth: 24,
      // Déformation du temps t^q : le pic de vitesse arrive à 0,5^(1/q) du trajet
      // (q = 0,7 → 37 % ; q = 0,85 → 44 %). Tiré à chaque geste.
      peakWarp: [0.68, 0.85],
      // Geste principal imparfait, puis petit geste de correction.
      correction: {
        chance: 0.75,       // proportion des pointages qui en ont besoin
        minDist: 60,        // en dessous, on vise juste du premier coup
        along: [-0.03, 0.07], // trop court (-) ou trop long (+), en fraction de la distance
        across: 0.025,      // écart latéral max, en fraction de la distance
        maxAlong: 34,
        maxAcross: 14,
        pause: [0.02, 0.08], // temps de réaction avant de corriger (s)
        speed: 0.8           // la correction est un peu plus lente
      }
    },

    paths: {
      // Trajets plus courts que ça : un simple arc, presque droit.
      shortTrip: 90,
      // À partir de cette distance, la courbure atteint toute son ampleur.
      fullCurveAt: 420,
      // Probabilités des styles de trajet (au-delà de shortTrip).
      styles: { arc: 0.45, s: 0.25, hook: 0.2, wave: 0.1 },
      // Finesse du tracé (points par trajet).
      samples: 48
    },

    wander: {
      // Marges de l'écran que la flânerie évite (fractions).
      marginX: 0.08,
      marginY: 0.1,
      strollSpeed: 0.45,
      // Part des promenades qui traversent tout l'écran (les autres restent dans le coin).
      longStroll: 0.45,
      nearRadius: 260,
      pause: [0.4, 1.4],
      pauseMul: 1,
      // Chance qu'une pause soit une « réflexion » (pointeur d'attente).
      waitChance: 0.1,
      // Probabilités de base des humeurs (la curiosité du curseur s'y ajoute).
      inspect: 0.35,
      fidget: 0.2,
      // Pendant une inspection : durée du survol, chance de cliquer.
      hover: [0.3, 0.9],
      clickChance: 0.35,
      doubleClickChance: 0.1,
      // Attrait relatif des éléments de la page (les champs de saisie d'abord).
      interest: { field: 3, button: 1.5, link: 1, heading: 1, media: 0.6, other: 0.8 },
      // Chance d'écrire un texte fantôme dans un champ vide.
      ghostTypeChance: 0.75,
      ghostWords: L("ghost_words")
    },

    cursor: {
      // Pression : écrasement au clic, puis retour.
      squash: 0.12,
      pressDecay: 6,
      // Inclinaison selon la vitesse horizontale.
      tiltPerPxPerS: 0.01,
      tiltMax: 10,
      tiltRate: 10,
      // Ressort qui ramène le curseur après une bousculade.
      springK: 70,
      springDamping: 12
    },

    // Votre souris bouscule les curseurs qu'elle approche.
    avoid: {
      radius: 80,
      // px/s² au contact ; écart maximal ≈ strength / springK ≈ 64 px.
      strength: 4500
    },

    // Défilement : chaque curseur vous rattrape après un temps de réaction.
    scroll: {
      reaction: [0.3, 1.5],      // délai habituel (s), multiplié par la patience
      distracted: 0.12,          // chance de traîner ailleurs un moment
      distractedFor: [2.5, 6],   // durée de ce moment (s)
      followUp: [0.08, 0.3],     // délai quand on vient déjà de vous suivre
      duration: [0.3, 1.1]       // durée du défilement lui-même (s)
    },

    // Attention partagée : quand vous vous arrêtez quelque part, les curieux s'approchent.
    attention: {
      enabled: true,
      stillSpeed: 80,      // souris « immobile » en dessous de cette vitesse (px/s)
      stillFor: 1.0,       // durée d'immobilité avant que l'attention se pose (s)
      leaveRadius: 140,    // s'éloigner de plus que ça défait l'attention (px)
      maxAge: 14,          // l'attention s'éteint d'elle-même après ce délai (s)
      share: 0.6,          // au plus cette part des curseurs vient voir
      ring: [70, 130],     // distance polie au point regardé (px)
      stay: [3, 8],        // durée de séjour maximale (s)
      reaction: [0.2, 1.2],
      bubbleChance: 0.25
    },

    // Vie sociale : rencontres, bulles, réactions à vos clics et formulaires.
    social: {
      enabled: true,       // rencontres et bulles
      reactive: true,      // réactions à vos clics et formulaires, essaim à la demande
      meetDistance: 42,    // deux curseurs plus proches que ça se saluent (px)
      pairCooldown: 14,    // une même paire ne se resalue pas avant (s)
      greetCooldown: 1.2,  // pas plus d'un salut par… (s)
      followChance: 0.3,
      sayOnGreet: 0.45,
      sayOnInspect: 0.12,
      clickRadius: 320,    // les curseurs à moins de cette distance réagissent à un clic (px)
      clickLean: 170       // élan vers le clic (px/s) au plus près
    },

    // Essaim à la demande (deux appuis sur Maj, le second maintenu).
    swarm: {
      radius: 90,
      doubleTap: 0.35,     // délai maximal entre les deux appuis (s)
      holdBefore: 0.18     // maintien nécessaire avant de déclencher (s)
    },

    // Anticipation du geste et apprentissage des habitudes.
    predict: {
      enabled: true,
      learn: true,
      cooldown: 1.2,          // entre deux prédictions (s)
      minSpeed: 450,          // vitesse de souris minimale pour tenter une prédiction (px/s)
      brakeAccel: 1500,       // décélération à partir de laquelle on considère que vous freinez (px/s²)
      minShare: 0.5,          // part du score que la meilleure cible doit avoir (en freinage)
      minShareBallistic: 0.85, // … et avant de freiner (bien plus exigeant)
      minDistance: 100        // en dessous, pas le temps d'arriver avant vous (px)
    },

    // Jeu du chat : attrapez les curseurs avec votre souris.
    game: {
      danger: 260,       // distance à laquelle votre souris fait fuir (px)
      wall: 90,          // les bords repoussent en deçà (px)
      catchRadius: 20    // attrapé si votre pointeur passe à moins de… (px)
    },

    // Mode concentration : les curseurs s'en vont, puis reviennent pour la pause.
    focus: { minutes: 25, breakMinutes: 5 },

    bubbles: {
      caught: L("bubbles_caught"),
      breakTime: L("bubbles_break"),
      predict: L("bubbles_predict"),
      right: L("bubbles_right"),
      wrong: L("bubbles_wrong"),
      greet: L("bubbles_greet"),
      curious: L("bubbles_curious"),
      inspect: L("bubbles_inspect"),
      click: L("bubbles_click"),
      cheer: L("bubbles_cheer")
    },

    // Thème et options d'affichage (remplacés par les réglages du menu).
    theme: "classique",
    showNames: true,
    hideFullscreen: true,
    adaptDark: true,
    // Fond sous chaque curseur : luminance relative (0 noir → 1 blanc), avec hystérésis.
    dark: { below: 0.3, above: 0.42, every: 0.35 },

    sound: {
      enabled: true,
      volume: 0.22,
      // Au plus N sons par seconde, toutes sources confondues.
      maxPerSecond: 18,
      // Délai minimal entre deux « boing » d'un même curseur bousculé (s).
      bumpCooldown: 0.7
    },

    names: L("names_list")
  };
})();
