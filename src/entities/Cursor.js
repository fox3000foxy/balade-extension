// Un curseur : sa position, son tempérament, ses micro-signaux (pression, inclinaison,
// bousculade), sa « vue » de la page, et le comportement qu'il exécute.
// Il ne décide de rien lui-même : ce sont les comportements (src/behaviors) qui le déplacent.
//
// Trois repères de coordonnées :
//  - vue du curseur : (x, y), ce qu'écrivent les comportements, comme sur SON écran ;
//  - page           : vue + (viewX, viewY), son propre défilement ;
//  - écran de l'utilisateur : page − défilement de l'utilisateur (screenX, screenY).
// Quand vous faites défiler, le curseur reste accroché à la page ; il « défile » ensuite
// lui-même pour vous rattraper (voir Engine._followScroll).
(() => {
  const { M } = window.Balade;

  class Cursor {
    /**
     * @param {object} o
     * @param {number} o.id
     * @param {number} o.x  position de départ, dans sa vue
     * @param {number} o.y
     * @param {number} o.viewX  défilement initial de sa vue (celui de l'utilisateur)
     * @param {number} o.viewY
     * @param {number} o.colorIndex  rang de sa couleur dans la palette du thème
     * @param {string} o.name
     */
    constructor({ id, x, y, viewX, viewY, colorIndex, name }) {
      this.id = id;
      this.colorIndex = colorIndex;
      this.name = name;

      this.x = x;
      this.y = y;
      this.viewX = viewX;
      this.viewY = viewY;

      // Position affichée sur l'écran de l'utilisateur (calculée à chaque image).
      this.screenX = x;
      this.screenY = y;

      // Rattrapage du défilement : { phase, wait, from, to, t, dur, q }.
      this.scroll = { phase: "idle", wait: 0, recentUntil: -Infinity };

      // Décalage dû aux bousculades, ramené à 0 par un ressort amorti.
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetVX = 0;
      this.offsetVY = 0;

      // Vitesse estimée à partir des positions successives sur l'écran (px/s).
      this.vx = 0;
      this.vy = 0;
      this._prevX = null;
      this._prevY = null;

      this.pressure = 0; // 1 au moment du clic, retombe à 0
      this.angle = 0;    // inclinaison en degrés

      this.focus = null;   // élément regardé (surbrillance)
      this.shape = "arrow"; // arrow | hand | ibeam | crosshair | wait
      this.ghost = null;   // texte fantôme { el, text } — purement visuel
      this.bubble = null;  // bulle { text, until } (en temps du moteur)
      this.heading = null; // orientation imposée en degrés (vol en essaim), sinon null
      this.wiggleAt = -Infinity; // début du dernier tortillement (salut)
      this.gatherAngle = null;   // place prise autour d'un point d'attention
      this.onDark = false;       // le fond sous le curseur est sombre
      this.predicting = null;    // élément deviné, pendant une anticipation
      this.caught = false;       // attrapé pendant le jeu du chat
      this.nextBgSample = 0;

      // Hauteur de « voix » propre à ce curseur (en degrés de gamme) pour les sons.
      this.voice = Math.floor(M.rand(0, 5));
      this.lastBumpSound = -Infinity;

      // Tempérament : chaque curseur a sa façon de bouger.
      this.temperament = {
        pace: M.rand(0.8, 1.25),     // multiplicateur de vitesse
        patience: M.rand(0.6, 1.6),  // multiplicateur des pauses et du temps de réaction
        curiosity: M.rand(0, 0.3)    // envie en plus d'inspecter la page
      };

      this.behavior = null;
      this.routine = null;
      this.leaving = false;
    }

    /** Position dans la page (coordonnées du document). */
    get pageX() {
      return this.x + this.viewX;
    }

    get pageY() {
      return this.y + this.viewY;
    }

    press() {
      this.pressure = 1;
    }

    /** Affiche une petite bulle de texte pendant `duration` secondes. */
    say(text, now, duration = 1.6) {
      this.bubble = { text, until: now + duration };
    }

    /** Petit tortillement (pour saluer). */
    wiggle(now) {
      this.wiggleAt = now;
    }

    /** Ajoute une impulsion (px/s) au décalage : le curseur est bousculé. */
    push(ix, iy) {
      this.offsetVX += ix;
      this.offsetVY += iy;
    }

    setBehavior(behavior) {
      // Termine proprement le comportement en cours (ses blocs finally s'exécutent).
      if (this.routine) {
        try {
          this.routine.return();
        } catch (err) { /* déjà terminé */ }
      }
      this.behavior = behavior;
      this.routine = behavior.run(this);
      this._resetPose();
    }

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

    /** Calcule la position sur l'écran de l'utilisateur. */
    updateScreen(scrollX, scrollY) {
      this.screenX = this.x + this.viewX - scrollX + this.offsetX;
      this.screenY = this.y + this.viewY - scrollY + this.offsetY;
    }

    /** Met à jour les micro-signaux après le déplacement de l'image. */
    updateSignals(dt, cfg, now = 0) {
      // Vitesse estimée dans SA vue (le défilement ne fait pas pencher le curseur).
      if (this._prevX == null) {
        this._prevX = this.x;
        this._prevY = this.y;
      }
      this.vx = M.damp(this.vx, (this.x - this._prevX) / dt, 25, dt);
      this.vy = M.damp(this.vy, (this.y - this._prevY) / dt, 25, dt);
      this._prevX = this.x;
      this._prevY = this.y;

      // Ressort amorti : a = -k·x - c·v (Euler semi-implicite).
      const ax = -cfg.springK * this.offsetX - cfg.springDamping * this.offsetVX;
      const ay = -cfg.springK * this.offsetY - cfg.springDamping * this.offsetVY;
      this.offsetVX += ax * dt;
      this.offsetVY += ay * dt;
      this.offsetX += this.offsetVX * dt;
      this.offsetY += this.offsetVY * dt;

      this.pressure = Math.max(0, this.pressure - cfg.pressDecay * dt);

      // Orientation : en vol, la flèche regarde où elle va ; sinon elle penche
      // légèrement dans le sens du mouvement, puis se redresse.
      let target;
      if (this.heading != null) {
        target = this.angle + M.wrapDeg(this.heading - this.angle);
      } else {
        target = M.clamp((this.vx + this.offsetVX) * cfg.tiltPerPxPerS, -cfg.tiltMax, cfg.tiltMax);
        if (Math.abs(this.angle) > 180) this.angle = M.wrapDeg(this.angle);
      }
      this.angle = M.damp(this.angle, target, this.heading != null ? 9 : cfg.tiltRate, dt);

      // Tortillement : une oscillation rapide qui s'amortit en un demi-seconde.
      const w = now - this.wiggleAt;
      this.wiggle_ = w >= 0 && w < 0.5 ? Math.sin(w * 30) * 14 * (1 - w / 0.5) : 0;

      if (this.bubble && now > this.bubble.until) this.bubble = null;
    }
  }

  window.Balade.Cursor = Cursor;
})();
