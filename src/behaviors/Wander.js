// Wandering: the cursor alternates three moods, separated by pauses.
//  - strolling   : move toward a random point, nearby or across the screen;
//  - fidgeting   : a few small movements on the spot, like someone thinking;
//  - inspecting  : visit a page element (input fields first), hover,
//                  sometimes click, and in an empty field type a ghost word
//                  then erase it. Nothing is actually clicked or typed.
// The pointer changes shape when entering an element, like the real one:
// hand over links and buttons, I-beam over fields, crosshair over images.
(() => {
  const { Behavior, M } = window.Balade;

  class Wander extends Behavior {
    *run(cursor) {
      const w = this.config.wander;
      for (;;) {
        const r = Math.random();
        const inspectP = w.inspect + cursor.temperament.curiosity;
        if (r < inspectP) {
          yield* this.inspect(cursor);
        } else if (r < inspectP + w.fidget) {
          yield* this.fidget(cursor);
        } else {
          yield* this.stroll(cursor);
        }
        yield* this.pause(cursor);
      }
    }

    /** A pause; occasionally the cursor "thinks" (busy pointer). */
    *pause(cursor) {
      const w = this.config.wander;
      const d = M.rand(w.pause[0], w.pause[1]) * cursor.temperament.patience * (w.pauseMul || 1);
      if (M.chance(w.waitChance)) {
        cursor.shape = "wait";
        yield* this.motion.wait(d + M.rand(0.6, 1.4));
        cursor.shape = "arrow";
      } else {
        yield* this.motion.wait(d);
      }
    }

    // ---------- Moods ----------

    *stroll(cursor) {
      const w = this.config.wander;
      const target = M.chance(w.longStroll)
        ? this.stage.randomPoint(w.marginX, w.marginY)
        : this.stage.nearbyPoint(cursor, w.nearRadius, w.marginX, w.marginY);
      // A stroll has no precise target: no correction gesture.
      yield* this.motion.moveTo(cursor, target, { speed: w.strollSpeed, precise: false, width: 120 });
    }

    *fidget(cursor) {
      const n = Math.floor(M.rand(2, 5));
      for (let i = 0; i < n; i++) {
        const a = M.rand(0, Math.PI * 2);
        const d = M.rand(8, 30);
        const target = this.stage.clampToScreen({
          x: cursor.x + Math.cos(a) * d,
          y: cursor.y + Math.sin(a) * d
        });
        yield* this.motion.moveTo(cursor, target, { speed: 0.9, precise: false, calm: 0.5 });
        yield* this.motion.wait(M.rand(0.05, 0.2));
      }
    }

    *inspect(cursor) {
      const busy = new Set(this.engine.cursors.map((c) => c.focus).filter(Boolean));
      const el = this.stage.pickElement(cursor, this.engine.time, this._last, busy, this.engine.habits);
      if (!el) {
        yield* this.stroll(cursor);
        return;
      }
      this._last = el;

      // Function target: if the page scrolls, the cursor follows the element.
      const aim = this.stage.aimOn(el, cursor);
      const r = el.getBoundingClientRect();
      const hoverShape = this.stage.shapeFor(el);
      yield* this.motion.moveTo(cursor, aim, {
        speed: 0.75,
        width: Math.min(r.width, r.height),
        // The pointer changes shape as soon as it passes over the element.
        onStep: () => {
          cursor.shape = this.stage.contains(el, cursor) ? hoverShape : "arrow";
        }
      });
      if (!this.stage.isInView(el, cursor)) return;
      cursor.shape = hoverShape;
      const social = this.config.social;
      // R&D: satiated cursors may remark on it, but still interact normally.
      // (Skipping the visit entirely made cursors look like they "couldn't"
      // click anymore; pickElement already down-weights visited elements.)
      const vkey = window.Balade.Habits.keyOf(el);
      let satiated = false;
      if (vkey) {
        const sat = this.engine.habits.satiety(vkey, this.engine.time);
        this.engine.habits.visit(vkey, this.engine.time);
        this.engine.habits.markSeen(vkey);
        satiated = sat > 0.6;
      }
      if (satiated) {
        if (social && social.enabled && M.chance(0.3)) {
          cursor.say(M.pick(this.config.bubbles.seen), this.engine.time);
        }
      } else if (social && social.enabled && M.chance(social.sayOnInspect)) {
        cursor.say(M.pick(this.config.bubbles.inspect), this.engine.time);
      }

      if (this.stage.isTextField(el)) {
        yield* this.visitField(cursor, el, aim);
      } else if (this.stage.isToggle(el)) {
        yield* this.visitToggle(cursor, el, aim);
      } else {
        yield* this.visitElement(cursor, el, aim);
      }

      cursor.focus = null;
      yield* this.stepAside(cursor, el, hoverShape);
    }

    // ---------- Visit details ----------

    /**
     * Checkbox or radio: hover, click animation, show a ghost toggle overlay,
     * then remove it. No real click() is fired.
     */
    *visitToggle(cursor, el, aim) {
      cursor.focus = el;
      yield* this.hover(cursor, aim, M.rand(0.2, 0.5));
      yield* this.motion.click(cursor);
      // Show ghost toggle overlay in the cursor's color.
      const renderer = this.engine.renderer;
      const isRadio = (el.getAttribute("type") || "").toLowerCase() === "radio";
      if (renderer) renderer.showGhostToggle(el, cursor, isRadio, M.rand(0.9, 1.8));
      // No need to hide explicitly -- the renderer auto-clears after the lifetime.
    }

    /** Hover + optional click on a link, button, heading, image... */
    *visitElement(cursor, el, aim) {
      const w = this.config.wander;
      cursor.focus = el;
      yield* this.hover(cursor, aim, M.rand(...w.hover));

      // Contrast inspector: flag hard-to-read text (WCAG < 4.5) with a remark.
      // One extra getComputedStyle per visit at most, and only for text kinds.
      const kind = this.stage.kindOf(el);
      if ((kind === "heading" || kind === "link") && M.chance(0.2)) {
        const ratio = this.stage.contrastOf(el);
        if (ratio != null && ratio < 4.5 && this.config.social.enabled) {
          cursor.say(M.pick(this.config.bubbles.curious), this.engine.time);
          yield* this.hover(cursor, aim, M.rand(0.6, 1.0));
        }
      }

      const r = Math.random();
      if (r < w.doubleClickChance) {
        yield* this.motion.doubleClick(cursor);
      } else if (r < w.doubleClickChance + w.clickChance) {
        yield* this.motion.click(cursor);
      }
      yield* this.motion.wait(M.rand(0.15, 0.3));
    }

    /** A text field: click, and sometimes a ghost word. */
    *visitField(cursor, el, aim) {
      const w = this.config.wander;
      cursor.focus = el;
      yield* this.hover(cursor, aim, M.rand(0.15, 0.4));
      yield* this.motion.click(cursor);

      // Only type in fields that are safe: empty, not a search/combobox, not in use.
      // Ghost words only make sense in free-text fields (not email/url/numbers).
      if (!this.stage.isGhostSafe(el) || !M.chance(w.ghostTypeChance)) {
        yield* this.hover(cursor, aim, M.rand(0.3, 0.7));
        return;
      }
      const wordType = (el.getAttribute && (el.getAttribute("type") || "").toLowerCase()) || "";
      const freeText = el.isContentEditable || el.localName === "textarea" ||
        (el.localName === "input" && window.Balade.Stage.GHOST_WORD_TYPES.has(wordType));
      if (!freeText) {
        yield* this.hover(cursor, aim, M.rand(0.3, 0.7));
        return;
      }

      // The pointer moves aside a little so it doesn't cover what it "types".
      const off = { x: M.rand(-20, 10), y: M.rand(12, 24) };
      const aside = () => {
        const p = aim();
        return { x: p.x + off.x, y: p.y + off.y };
      };
      yield* this.motion.moveTo(cursor, aside, { speed: 1.4, precise: false, calm: 0.4 });

      cursor.ghost = { el, text: "" };
      cursor.shape = "ibeam"; // keep the text shape while typing, even aside
      // R&D: sometimes type a word from the page's own heading — it looks
      // like the cursor actually read something. Read locally, stays in the
      // overlay, never touches the field value.
      let word = M.pick(w.ghostWords);
      if (M.chance(0.3)) {
        const h1 = document.querySelector("h1");
        const pageWord = h1 && h1.textContent.trim().split(/\s+/).find((s) => /^[A-Za-zÀ-ÿ]{3,12}$/.test(s));
        if (pageWord) word = pageWord.toLowerCase();
      }
      const ok = yield* this.typeGhost(cursor, el, word, aside);

      if (ok) {
        yield* this.hover(cursor, aside, M.rand(0.5, 1.1)); // admire the result
        if (M.chance(0.6)) {
          yield* this.eraseGhost(cursor, el, aside); // key by key
        } else {
          // Select all: show highlight, pause, sound, hide — ghost stays alive until after.
          yield* this.hover(cursor, aside, M.rand(0.1, 0.2));
          const renderer = this.engine.renderer;
          const view = renderer && renderer.views && renderer.views.get(cursor.id);
          if (view) renderer.showGhostSel(view, cursor);
          yield* this.hover(cursor, aside, M.rand(0.22, 0.35)); // linger on the selection
          if (this.engine.sound) this.engine.sound.erase(cursor);
          cursor.ghost = null; // wipe text first so ghost disappears with the selection
          yield* this.hover(cursor, aside, 0.05); // one frame for render to clear both
          if (view) renderer.hideGhostSel(view);
          yield* this.hover(cursor, aside, M.rand(0.1, 0.2));
          return; // skip the outer cursor.ghost = null below
        }
      }
      cursor.ghost = null;
      yield* this.hover(cursor, aside, M.rand(0.2, 0.4));
    }

    /**
     * Irregular typing, character by character, staying next to the field.
     * @returns {boolean} false if the field left view mid-way.
     */
    *typeGhost(cursor, el, word, anchor) {
      const sound = this.engine.sound;
      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        let d = M.rand(0.07, 0.15);
        if (ch === " ") d += M.rand(0.05, 0.12);
        if (M.chance(0.05)) d += M.rand(0.2, 0.4); // hesitation
        yield* this.hover(cursor, anchor, d);
        if (!this.stage.isInView(el, cursor)) return false;
        cursor.ghost.text += ch;
        if (sound) sound.key(cursor, i);
      }
      return true;
    }

    *eraseGhost(cursor, el, anchor) {
      const sound = this.engine.sound;
      while (cursor.ghost.text.length > 0) {
        yield* this.hover(cursor, anchor, M.rand(0.04, 0.075));
        if (!this.stage.isInView(el, cursor)) return;
        cursor.ghost.text = cursor.ghost.text.slice(0, -1);
        if (sound) sound.backspace(cursor);
      }
    }

    /** Stays anchored to a point (often over an element) for `seconds` seconds. */
    *hover(cursor, anchor, seconds) {
      let t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      while (t > 0) {
        const step = yield;
        t -= Number.isFinite(step) ? step : 0;
        const p = anchor();
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        cursor.x = p.x;
        cursor.y = p.y;
      }
    }

    /** Steps aside a little, to leave what was just watched visible. */
    *stepAside(cursor, el, hoverShape) {
      const target = this.stage.clampToScreen({
        x: cursor.x + M.rand(14, 30) * M.sign(),
        y: cursor.y + M.rand(10, 24)
      });
      yield* this.motion.moveTo(cursor, target, {
        speed: 1.2,
        precise: false,
        calm: 0.5,
        onStep: () => {
          cursor.shape = el.isConnected && this.stage.contains(el, cursor) ? hoverShape : "arrow";
        }
      });
      cursor.shape = "arrow";
    }
  }

  window.Balade.Wander = Wander;
})();
