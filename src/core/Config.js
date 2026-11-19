// All settings in one place, easy to tune by eye.
(() => {
  // Texts in the browser language (_locales).
  const L = (key) => window.Balade.I18n.list(key);

  window.Balade.Config = {
    // Max time step: prevents jumps when returning to a background tab.
    dtMax: 0.05,

    population: {
      // Target count and variation range (the "Cursors" menu setting).
      target: 6,
      min: 5,
      max: 7,
      // Every 6 to 14 s the target count shifts by +/-1: cursors arrive or leave.
      changeEvery: [6, 14],
      // Average gap between two arrivals (s).
      spawnGap: 0.5
    },

    motion: {
      // Fitts's law: duration = a + b * log2(1 + distance / target width), in s.
      fitts: { a: 0.08, b: 0.085, min: 0.12, max: 0.75 },
      // Global speed multiplier (the "Pace" menu setting).
      speedMul: 1,
      // Assumed target width when aiming at a plain point (px).
      defaultWidth: 24,
      // Time warp t^q: the speed peak lands at 0.5^(1/q) through the path
      // (q = 0.7 -> 37%; q = 0.85 -> 44%). Drawn fresh each gesture.
      peakWarp: [0.68, 0.85],
      // Imperfect primary gesture, then a small correction.
      correction: {
        chance: 0.75,       // proportion of pointing moves that need correction
        minDist: 60,        // below this, we aim straight on the first try
        along: [-0.03, 0.07], // too short (-) or too long (+), as a fraction of distance
        across: 0.025,      // max lateral offset, as a fraction of distance
        maxAlong: 34,
        maxAcross: 14,
        pause: [0.02, 0.08], // reaction time before correcting (s)
        speed: 0.8           // corrections are slightly slower
      }
    },

    paths: {
      // Paths shorter than this: a simple arc, nearly straight.
      shortTrip: 90,
      // From this distance on, curvature reaches its full amplitude.
      fullCurveAt: 420,
      // Path style probabilities (beyond shortTrip).
      styles: { arc: 0.45, s: 0.25, hook: 0.2, wave: 0.1 },
      // Path resolution (points per path).
      samples: 48
    },

    wander: {
      // Screen margins that wandering avoids (fractions).
      marginX: 0.08,
      marginY: 0.1,
      strollSpeed: 0.45,
      // Share of strolls that cross the full screen (others stay nearby).
      longStroll: 0.45,
      nearRadius: 260,
      pause: [0.4, 1.4],
      pauseMul: 1,
      // Chance a pause is a "thinking" pause (busy pointer).
      waitChance: 0.1,
      // Base mood probabilities (cursor curiosity adds to these).
      inspect: 0.35,
      fidget: 0.2,
      // During an inspection: hover duration, click chance.
      hover: [0.3, 0.9],
      clickChance: 0.35,
      doubleClickChance: 0.1,
      // Relative interest of page elements (input fields first).
      interest: { field: 3, button: 1.5, link: 1, heading: 1, media: 0.6, other: 0.8 },
      // Chance of typing ghost text into an empty field.
      ghostTypeChance: 0.75,
      ghostWords: L("ghost_words")
    },

    cursor: {
      // Pressure: squash on click, then spring back.
      squash: 0.12,
      pressDecay: 6,
      // Tilt based on horizontal speed.
      tiltPerPxPerS: 0.01,
      tiltMax: 10,
      tiltRate: 10,
      // Spring that pulls the cursor back after a nudge.
      springK: 70,
      springDamping: 12
    },

    // Your mouse nudges nearby cursors.
    avoid: {
      radius: 80,
      // px/s^2 at contact; max offset ~= strength / springK ~= 64 px.
      strength: 4500
    },

    // Scrolling: each cursor catches up after a reaction delay.
    scroll: {
      reaction: [0.3, 1.5],      // typical delay (s), scaled by patience
      distracted: 0.12,          // chance of lingering elsewhere for a while
      distractedFor: [2.5, 6],   // duration of that detour (s)
      followUp: [0.08, 0.3],     // delay when already following recently
      duration: [0.3, 1.1]       // scroll catch-up duration (s)
    },

    // Shared attention: when you pause somewhere, curious cursors come to look.
    attention: {
      enabled: true,
      stillSpeed: 80,      // mouse is "still" below this speed (px/s)
      stillFor: 1.0,       // stillness duration before attention is set (s)
      leaveRadius: 140,    // moving further than this clears the attention (px)
      maxAge: 14,          // attention fades on its own after this delay (s)
      share: 0.6,          // at most this fraction of cursors come to look
      ring: [70, 130],     // polite distance to the watched point (px)
      stay: [3, 8],        // max stay duration (s)
      reaction: [0.2, 1.2],
      bubbleChance: 0.25
    },

    // Social life: greetings, bubbles, reactions to your clicks and forms.
    social: {
      enabled: true,       // greetings and bubbles
      reactive: true,      // reactions to clicks/forms, on-demand swarm
      meetDistance: 42,    // cursors closer than this greet each other (px)
      pairCooldown: 14,    // same pair won't greet again before (s)
      greetCooldown: 1.2,  // at most one greeting every (s)
      followChance: 0.3,
      sayOnGreet: 0.45,
      sayOnInspect: 0.12,
      clickRadius: 320,    // cursors within this distance react to a click (px)
      clickLean: 170       // lean toward click (px/s) at closest
    },

    // On-demand swarm (double Shift press, hold the second).
    swarm: {
      radius: 90,
      doubleTap: 0.35,     // max delay between the two presses (s)
      holdBefore: 0.18     // hold time needed before triggering (s)
    },

    // Gesture anticipation and habit learning.
    predict: {
      enabled: true,
      learn: true,
      cooldown: 1.2,          // between two predictions (s)
      minSpeed: 450,          // minimum mouse speed to attempt a prediction (px/s)
      brakeAccel: 1500,       // deceleration threshold that counts as braking (px/s^2)
      minShare: 0.5,          // score share the best target must hold (while braking)
      minShareBallistic: 0.85, // ... and before braking (much stricter)
      minDistance: 100        // below this, no time to arrive before you (px)
    },

    // Tag game: catch the cursors with your mouse.
    game: {
      danger: 260,       // distance at which your mouse triggers fleeing (px)
      wall: 90,          // edges repel within this margin (px)
      catchRadius: 20    // caught if your pointer comes within this radius (px)
    },

    // Focus mode: cursors leave, then come back for the break.
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

    // Theme and display options (overridden by menu settings).
    theme: "classique",
    showNames: true,
    hideFullscreen: true,
    adaptDark: true,
    // Background under each cursor: relative luminance (0 black -> 1 white), with hysteresis.
    dark: { below: 0.3, above: 0.42, every: 0.35 },

    sound: {
      enabled: true,
      volume: 0.22,
      // At most N sounds per second, all sources combined.
      maxPerSecond: 18,
      // Minimum delay between two "boing" sounds from the same nudged cursor (s).
      bumpCooldown: 0.7
    },

    names: L("names_list")
  };
})();
