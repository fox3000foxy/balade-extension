// Guide: a first-visit tour. On an unknown site, one cursor visits the most
// interesting landmarks (nav, search, main content) with a small speech
// bubble at each stop. Visual only: hover, never click.
(() => {
  const { Behavior, M } = window.Balade;

  class Guide extends Behavior {
    *run(cursor) {
      const engine = this.engine;
      const bubbles = this.config.bubbles;
      const list = this.stage.visibleElements(engine.time);
      if (!list.length) return;

      // Prefer landmarks: nav, search, headings, main content.
      const score = (el) => {
        if (el.localName === "nav") return 5;
        if (el.getAttribute("role") === "search") return 5;
        if (/search/i.test([el.getAttribute("name"), el.getAttribute("id"), el.getAttribute("placeholder")].join(" "))) return 4;
        if (el.localName === "main") return 4;
        if (/^h[123]$/.test(el.localName)) return 3;
        return 1;
      };
      const ranked = [...list].sort((a, b) => score(b) - score(a)).slice(0, 4);

      for (const el of ranked) {
        if (!el.isConnected) continue;
        const aim = this.stage.aimOn(el, cursor);
        yield* this.motion.moveTo(cursor, aim, { speed: 0.7, precise: false, width: 60 });
        if (!this.stage.isInView(el, cursor)) continue;
        cursor.focus = el;
        cursor.shape = this.stage.shapeFor(el);
        if (this.config.social.enabled && M.chance(0.6)) cursor.say(M.pick(bubbles.inspect), engine.time, 2.0);
        let t = M.rand(1.2, 2.0);
        while (t > 0) {
          t -= yield;
          const p = aim();
          cursor.x = p.x;
          cursor.y = p.y;
        }
        cursor.focus = null;
        cursor.shape = "arrow";
      }
    }
  }

  window.Balade.Guide = Guide;
})();
