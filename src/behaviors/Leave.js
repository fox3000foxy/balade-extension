// Sortie de scène : le curseur dit au revoir et repart par le bord le plus proche.
(() => {
  const { Behavior } = window.Balade;

  class Leave extends Behavior {
    *run(cursor) {
      const side = cursor.x < this.stage.width / 2 ? -1 : 1;
      const y = cursor.y;
      if (this.engine.sound) this.engine.sound.bye(cursor);
      // Cible-fonction : si la fenêtre change de taille, la sortie suit.
      yield* this.motion.moveTo(cursor, () => this.stage.offscreenPoint(side, y), {
        speed: 0.8,
        precise: false,
        width: 120
      });
    }
  }

  window.Balade.Leave = Leave;
})();
