// Suivre un autre curseur quelques secondes, après une rencontre :
// on reste un peu en retrait, derrière lui, en léger décalage sur le côté.
(() => {
  const { Behavior, M } = window.Balade;

  class Follow extends Behavior {
    constructor(engine, leader) {
      super(engine);
      this.leader = leader;
    }

    *run(cursor) {
      const leader = this.leader;
      const side = M.sign() * M.rand(8, 18);
      const back = M.rand(30, 46);
      let t = M.rand(3, 6);
      let hx = 1;
      let hy = 0;

      while (t > 0) {
        const dt = yield;
        t -= dt;
        if (leader.leaving || !this.engine.cursors.includes(leader)) break;

        // Direction du meneur (gardée en mémoire quand il s'arrête).
        const sp = Math.hypot(leader.vx, leader.vy);
        if (sp > 40) {
          hx = leader.vx / sp;
          hy = leader.vy / sp;
        }
        // Position du meneur, convertie dans la vue de ce curseur.
        const lx = leader.pageX - cursor.viewX;
        const ly = leader.pageY - cursor.viewY;
        const tx = lx - hx * back - hy * side;
        const ty = ly - hy * back + hx * side;
        cursor.x = M.damp(cursor.x, tx, 4.5, dt);
        cursor.y = M.damp(cursor.y, ty, 4.5, dt);
      }
    }
  }

  window.Balade.Follow = Follow;
})();
