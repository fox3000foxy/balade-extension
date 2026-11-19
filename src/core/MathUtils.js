// Small shared math helpers.
(() => {
  const M = {
    rand(a, b) {
      return a + Math.random() * (b - a);
    },

    /** True with probability p. */
    chance(p) {
      return Math.random() < p;
    },

    /** -1 or 1, coin flip. */
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

    /** Symmetric cubic easing: smooth start and end. */
    easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
    },

    /** Outgoing cubic easing: sharp start, smooth end. */
    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    },

    /**
     * Frame-rate-independent exponential smoothing.
     * `rate` ~= 1 / time constant (in s^-1).
     */
    damp(current, target, rate, dt) {
      return current + (target - current) * (1 - Math.exp(-rate * dt));
    },

    /** Wraps an angle in degrees to ]-180, 180]. */
    wrapDeg(a) {
      return ((((a + 180) % 360) + 360) % 360) - 180;
    }
  };

  window.Balade.M = M;
})();
