// Petites fonctions mathématiques partagées.
(() => {
  const M = {
    rand(a, b) {
      return a + Math.random() * (b - a);
    },

    /** Vrai avec une probabilité p. */
    chance(p) {
      return Math.random() < p;
    },

    /** -1 ou 1, à pile ou face. */
    sign() {
      return Math.random() < 0.5 ? -1 : 1;
    },

    pick(list) {
      return list[Math.floor(Math.random() * list.length)];
    },

    clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    /** Easing cubique symétrique : départ et arrivée en douceur. */
    easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
    },

    /** Easing cubique sortant : départ vif, arrivée en douceur. */
    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    },

    /**
     * Lissage exponentiel indépendant du nombre d'images par seconde.
     * `rate` ≈ 1 / constante de temps (en s⁻¹).
     */
    damp(current, target, rate, dt) {
      return current + (target - current) * (1 - Math.exp(-rate * dt));
    },

    /** Ramène un angle en degrés dans ]-180 ; 180]. */
    wrapDeg(a) {
      return ((((a + 180) % 360) + 360) % 360) - 180;
    }
  };

  window.Balade.M = M;
})();
