// Un curseur : sa position, son tempérament, ses micro-signaux (pression, inclinaison,
// bousculade) et le comportement qu'il exécute. Il ne décide de rien lui-même :
// ce sont les comportements (src/behaviors) qui le déplacent.
(() => {
  const { M } = window.Balade;

  class Cursor {
    /**
     * @param {object} o
     * @param {number} o.id
     * @param {number} o.x  position de départ (px, repère de l'écran)
     * @param {number} o.y
     * @param {string} o.color
     * @param {string} o.name
     */
    constructor({ id, x, y, color, name }) {
      this.id = id;
      this.color = color;
      this.name = name;

      // Position « voulue », écrite par les comportements.
      this.x = x;
      this.y = y;

      // Décalage dû aux bousculades, ramené à 0 par un ressort amorti.
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetVX = 0;
      this.offsetVY = 0;

      // Vitesse estimée à partir des positions successives (px/s).
      this.vx = 0;
      this.vy = 0;
      this._prevX = x;
      this._prevY = y;

      this.pressure = 0; // 1 au moment du clic, retombe à 0
      this.angle = 0;    // inclinaison en degrés

      // Élément que le curseur « regarde » (affiché en surbrillance), ou null.
      this.focus = null;

      // Forme affichée : "arrow" ou "ibeam" (au-dessus d'un champ de texte).
      this.shape = "arrow";

      // Texte fantôme en cours de frappe : { el, text } ou null. Purement visuel :
      // le vrai champ de la page n'est jamais modifié.
      this.ghost = null;

      // Hauteur de « voix » propre à ce curseur (en degrés de gamme) pour les sons.
      this.voice = Math.floor(M.rand(0, 5));
      this.lastBumpSound = -Infinity;

      // Tempérament : chaque curseur a sa façon de bouger.
      this.temperament = {
        pace: M.rand(0.8, 1.25),     // multiplicateur de vitesse
        patience: M.rand(0.6, 1.6),  // multiplicateur des pauses
        curiosity: M.rand(0, 0.3)    // envie en plus d'inspecter la page
      };

      this.behavior = null; // instance de Behavior
      this.routine = null;  // générateur en cours (behavior.run(this))
      this.leaving = false;
    }

    /** Position affichée = position voulue + décalage de bousculade. */
    get screenX() {
      return this.x + this.offsetX;
    }

    get screenY() {
      return this.y + this.offsetY;
    }

    press() {
      this.pressure = 1;
    }

    /** Ajoute une impulsion (px/s) au décalage : le curseur est bousculé. */
    push(ix, iy) {
      this.offsetVX += ix;
      this.offsetVY += iy;
    }

    /** Démarre un nouveau comportement. */
    setBehavior(behavior) {
      this.behavior = behavior;
      this.routine = behavior.run(this);
      this._resetPose();
    }

    /** Remet le curseur « au repos » : flèche, rien en surbrillance, pas de texte fantôme. */
    _resetPose() {
      this.focus = null;
      this.ghost = null;
      this.shape = "arrow";
    }

    /**
     * Fait avancer le comportement d'un pas de temps.
     * @returns {boolean} true si le comportement vient de se terminer.
     */
    advance(dt) {
      if (!this.routine) return true;
      let res;
      try {
        res = this.routine.next(dt);
      } catch (err) {
        console.warn("[Balade] Erreur dans un comportement :", err);
        res = { done: true };
      }
      if (res.done) {
        this.routine = null;
        this._resetPose();
        return true;
      }
      return false;
    }

    /** Met à jour les micro-signaux après le déplacement de l'image. */
    updateSignals(dt, cfg) {
      // Vitesse estimée, légèrement lissée.
      const ivx = (this.x - this._prevX) / dt;
      const ivy = (this.y - this._prevY) / dt;
      this.vx = M.damp(this.vx, ivx, 25, dt);
      this.vy = M.damp(this.vy, ivy, 25, dt);
      this._prevX = this.x;
      this._prevY = this.y;

      // Ressort amorti : a = -k·x - c·v (Euler semi-implicite).
      const ax = -cfg.springK * this.offsetX - cfg.springDamping * this.offsetVX;
      const ay = -cfg.springK * this.offsetY - cfg.springDamping * this.offsetVY;
      this.offsetVX += ax * dt;
      this.offsetVY += ay * dt;
      this.offsetX += this.offsetVX * dt;
      this.offsetY += this.offsetVY * dt;

      // Pression qui retombe.
      this.pressure = Math.max(0, this.pressure - cfg.pressDecay * dt);

      // Inclinaison : le curseur penche dans le sens où il va, puis se redresse.
      const tiltTarget = M.clamp(
        (this.vx + this.offsetVX) * cfg.tiltPerPxPerS,
        -cfg.tiltMax,
        cfg.tiltMax
      );
      this.angle = M.damp(this.angle, tiltTarget, cfg.tiltRate, dt);
    }
  }

  window.Balade.Cursor = Cursor;
})();
