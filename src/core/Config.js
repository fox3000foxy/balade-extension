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
      // Écart minimal entre deux arrivées (s).
      spawnGap: 0.5
    },

    motion: {
      // Durée = clamp(base + sqrtK × √distance, min, max) / vitesse
      base: 0.12,
      sqrtK: 0.021,
      minDur: 0.14,
      maxDur: 0.9,
      // Courbure de l'arc, en fraction de la distance (plafonnée).
      bendMin: 0.04,
      bendMax: 0.14,
      bendCap: 600,
      // true : easeInOut puis bascule en easeOut (« coup de poignet »).
      // false : easeInOut continu sur tout le trajet.
      flick: true,
      flickAt: 0.15
    },

    wander: {
      // Marges de l'écran que la flânerie évite (fractions).
      marginX: 0.12,
      marginY: 0.15,
      strollSpeed: 0.35,
      pause: [0.4, 1.4],
      // Probabilités de base des humeurs (la curiosité du curseur s'y ajoute).
      inspect: 0.3,
      fidget: 0.25,
      // Pendant une inspection : durée du survol, chance de cliquer.
      hover: [0.3, 0.9],
      clickChance: 0.35,
      doubleClickChance: 0.1
    },

    cursor: {
      // Pression : écrasement au clic, puis retour.
      squash: 0.12,
      pressDecay: 6,
      // Inclinaison selon la vitesse horizontale.
      tiltPerPxPerS: 0.012,
      tiltMax: 12,
      tiltRate: 10,
      // Ressort qui ramène le curseur après une bousculade.
      springK: 70,
      springDamping: 12
    },

    // Votre souris bouscule les curseurs qu'elle approche.
    avoid: {
      radius: 80,
      // px/s² au contact ; écart maximal ≈ strength / springK ≈ 65 px.
      strength: 4500
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
