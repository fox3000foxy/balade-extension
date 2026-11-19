// Follow another cursor for a few seconds after a greeting:
// stay a little behind, slightly to one side.
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

        // Leader direction (remembered when it stops).
        const sp = Math.hypot(leader.vx, leader.vy);
        if (sp > 40) {
          hx = leader.vx / sp;
          hy = leader.vy / sp;
        }
        // Leader position, converted into this cursor's view.
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
