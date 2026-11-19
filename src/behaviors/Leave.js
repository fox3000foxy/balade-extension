// Sortie de scène : le curseur repart par le bord le plus proche.
(() => {
  const { Behavior } = window.Balade;

  class Leave extends Behavior {
    *run(cursor) {
      const side = cursor.x < this.stage.width / 2 ? -1 : 1;
      const y = cursor.y;
      // Cible-fonction : si la fenêtre change de taille, la sortie suit.
      yield* this.motion.moveTo(cursor, () => this.stage.offscreenPoint(side, y), { speed: 0.8 });
    }
  }

  window.Balade.Leave = Leave;
})();
