// Leave: the cursor says goodbye and exits through the nearest edge.
(() => {
  const { Behavior } = window.Balade;

  class Leave extends Behavior {
    *run(cursor) {
      const side = cursor.x < this.stage.width / 2 ? -1 : 1;
      const y = cursor.y;
      if (this.engine.sound) this.engine.sound.bye(cursor);
      // Function target: if the window resizes, the exit point follows.
      yield* this.motion.moveTo(cursor, () => this.stage.offscreenPoint(side, y), {
        speed: 0.8,
        precise: false,
        width: 120
      });
    }
  }

  window.Balade.Leave = Leave;
})();
