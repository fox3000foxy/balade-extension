// Tous les réglages au même endroit, pour les ajuster à l'œil.
(() => {
  window.Balade.Config = {
    // Pas de temps maximal : évite les sauts au retour d'un onglet en arrière-plan.
    dtMax: 0.05,

    population: {
      min: 4,
      max: 8,
      // Toutes les 6 à 14 s, l'effectif voulu change de ±1 : des curseurs arrivent ou repartent.
      changeEvery: [6, 14],
      // Écart moyen entre deux arrivées (s).
      spawnGap: 0.5
    },

    motion: {
      // Loi de Fitts : durée = a + b · log2(1 + distance / largeur de la cible), en s.
      fitts: { a: 0.08, b: 0.085, min: 0.12, max: 0.75 },
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
      ghostWords: [
        "coucou", "miaou", "hmm…", "bonjour !", "on teste", "ok ok", "salut",
        "trop bien", "ça marche ?", "youpi", "hello", "piou piou", "bip boup"
      ]
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

    sound: {
      enabled: true,
      volume: 0.22,
      // Au plus N sons par seconde, toutes sources confondues.
      maxPerSecond: 18,
      // Délai minimal entre deux « boing » d'un même curseur bousculé (s).
      bumpCooldown: 0.7
    },

    palette: [
      "#E5484D", "#F76B15", "#E2A300", "#30A46C", "#12A594",
      "#0090FF", "#3E63DD", "#8E4EC6", "#D6409F", "#AD7F58"
    ],
    names: [
      "Alix", "Bastien", "Chloé", "Diego", "Élise", "Farah", "Gaspard", "Hana",
      "Iris", "Jules", "Kenji", "Léa", "Malo", "Nora", "Oscar", "Paz"
    ]
  };
})();
