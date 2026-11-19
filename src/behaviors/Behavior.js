// Base class for behaviors. A behavior is a script written as
// a generator: `run(cursor)` describes what the cursor does, start to finish.
// This is where task-prediction behaviors will be added in the future.
(() => {
  class Behavior {
    /** @param {Balade.Engine} engine */
    constructor(engine) {
      this.engine = engine;
      this.motion = engine.motion;
      this.stage = engine.stage;
      this.config = engine.config;
    }

    /** Human-readable name, useful for debugging. */
    get name() {
      return this.constructor.name;
    }

    /**
     * The behavior script. Override in subclasses.
     * @param {Balade.Cursor} cursor
     */
    *run(cursor) { // eslint-disable-line require-yield
    }
  }

  window.Balade.Behavior = Behavior;
})();
