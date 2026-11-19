# CursorSwarm: the principles and formulas behind "alive"

*Version française : [research.fr.md](research.fr.md)*

> Study notes on the [CursorSwarm](https://chromewebstore.google.com/detail/danjmhlboapibdckmaonijlhgcmnadpf) extension (labbrow, v1.0.0), written before building Balade. They describe ideas, formulas and orders of magnitude; no code is taken from it. Balade starts from these ideas and then departs from them (minimum jerk, chained arcs, damped spring… see the [README](../README.md)).

No animation in CursorSwarm is linear, constant or synchronized: every gesture combines a curve, an easing, a duration that is not proportional to distance, and a little bounded randomness. Those four ingredients, applied everywhere, are what make it feel alive.

These notes are the basis for a clean-room rewrite: we keep the ideas, the formulas and the orders of magnitude, never the code.

Three rules come back in every section:

- **Nothing is straight**: paths are arcs, speeds vary, orientations are smoothed.
- **Nothing is identical**: every cursor has its own personality, every pause and every target is drawn from a range.
- **Nothing is isolated**: tempo, sound and image all react to the same event at the same moment.

## 1. Point-to-point movement

Every path from a point A to a point B goes through a single function (`moveTo`), which stacks three distortions: a duration that grows with the square root of the distance, a perpendicular arc, and a cubic easing.

### Duration: the square root of the distance

The duration grows with the square root of the distance d (in pixels), is then clamped, and is divided by a speed multiplier specific to the gesture.

**Formula: square-root duration**, a simplified version of Fitts's law.

$$T = \frac{\mathrm{clamp}\left(0.12 + 0.021\,\sqrt{d},\; 0.14,\; 0.9\right)}{v}$$

Orders of magnitude for v = 1: 100 px takes 0.33 s, 400 px takes 0.54 s, 900 px takes 0.75 s, and the 0.9 s ceiling is reached around 1,380 px. A path four times longer only takes about 1.6 times as long. That is the spirit of Fitts's law: the hand makes a fast ballistic gesture, then slows down to aim.

### Trajectory: a half-sine arc

The point moves along segment AB and is offset perpendicularly by off = sin(π·e) × bend, where e is the eased progress (0 to 1). The offset is zero at both ends and largest in the middle.

**Formula: linear interpolation (lerp) + half-sine perpendicular offset**, along the segment's normal vector.

$$P(e) = A + e\,(B - A) + \sin(\pi e)\; \mathrm{bend}\; \hat{n}$$

$$\hat{n} = \frac{(-\Delta y,\; \Delta x)}{\lVert B - A \rVert} \qquad \mathrm{bend} = \pm\, U(0.04,\; 0.14) \times \min(d,\; 600)$$

The sign is a coin toss on every path: the arc bulges left one time, right the next. Curvature is capped at 600 px of distance so very long paths don't make huge detours. "Careful" gestures (dragging to draw a frame) force bend = 0; pen clicks use a tiny curvature, U(−0.03, 0.03).

### Easing: two cubics

Raw progress k = t / T goes through two classic curves:

**Formulas: easeInOutCubic and easeOutCubic**, Robert Penner's cubic easing functions.

$$\mathrm{easeInOut}(k) = \begin{cases} 4k^3 & k < 0.5 \\ 1 - \dfrac{(2 - 2k)^3}{2} & k \ge 0.5 \end{cases}$$

$$\mathrm{easeOut}(k) = 1 - (1 - k)^3$$

The selection rule: easeInOut during the first 15 % of the time (or for the whole gesture when dragging), then easeOut. At k = 0.15 the position jumps from 1.35 % to 38.6 % of the path in a single frame. This "flick" looks like the wrist snap that launches a mouse; worth testing in our version, with and without a continuous join.

### Moving target

The target can be a function rather than a fixed point: it is re-evaluated every frame, which lets a cursor reach an element while the page scrolls. The starting point A stays fixed.

## 2. Rest and population

At rest, a cursor wanders: it moves slowly to a random point, waits a little, then starts again (`idle`). The crowd itself grows and shrinks with the amount of available work.

### The wandering loop

1. Pick a target in the central area of the screen: x between 17 % and 83 % of the width, y between 20 % and 80 % of the height.
2. Go there with `moveTo` at speed 0.35, about three times slower than a work gesture. For 300 px that is roughly 1.4 s.
3. Wait for a duration drawn from U(0.4, 1.4) s. The wait is cut short if scrolling pushes the cursor off screen.
4. Start again.

Slowness is what makes the difference: the same `moveTo` as during work, only slowed down, reads as hesitation rather than action. The 17 % and 20 % margins keep resting cursors from sticking to the screen edges.

### The number of cursors follows the workload

The target number of cursors depends on scroll speed (vel, in px/s) and on the number of available tasks (n):

**Formula: clamped headcount regulation**, a step function of workload and scrolling.

$$N_{\text{target}} = \mathrm{clamp}\left(8 + \left\lfloor \frac{\mathrm{vel}}{80} \right\rfloor + \left\lfloor \frac{n}{4} \right\rfloor,\; 8,\; 24\right)$$

- **Arrivals**: a cursor appears off screen, 40 px to the left or right, between 20 % and 80 % of the height, when the team is understaffed and there are more tasks than free cursors. At most one arrival every 0.08 s.
- **Departures**: a cursor with no task for more than 2.5 s leaves through the nearest edge (60 px off screen, speed 0.8), as long as the team has more than 8 cursors.
- **Residents**: the first 8 cursors from the intro are marked "home" and never leave. There is always a stable core on screen.

The visible effect: when you scroll fast or a big batch of tasks frees up, reinforcements come in from the sides; when the work dries up, they leave one by one. It looks like a team organizing itself.

## 3. The swarm

Before the rebuild starts and after it ends, the cursors swirl as a swarm around a target (`follow`). It is Reynolds-style steering: each cursor computes a desired velocity, then moves toward it with a limited force.

### The target

The mouse, if it is on the page. Otherwise, a point tracing a slow Lissajous curve, as a fraction of the screen size:

**Formula: Lissajous curve.**

$$O(t) = \left(0.5 + 0.28\,\sin(0.37\,t),\;\; 0.5 + 0.25\,\sin(0.53\,t + 1)\right)$$

The two frequencies have no simple ratio, so the figure practically never repeats. Before the start, the target is the center of the screen and the orbit is shrunk to 70 % (factor s = 0.7).

### An orbit that breathes and warps

For a cursor at distance d from the target and at angle θ, with n̂ the unit vector pointing away from the target and t̂ = (−n̂y, n̂x) its perpendicular:

**Formulas: sinusoidal radius modulation (breathing) and a three-lobed polar curve (rose).**

$$R(t) = 135\,s\,\big(1 + 0.18\,\sin(0.55\,t)\big)$$

$$r_c = R(t)\,\big(1 + 0.3\,\sin(3\theta + 0.7\,t)\big) + 0.55\,s\,(\mathrm{orbit}_c - 120)$$

- The base radius **breathes** by ±18 % with a period of about 11 s.
- The sin(3θ + 0.7t) term gives the ring **three slowly rotating lobes**: the crowd is never a perfect circle.
- The `orbit` offset (drawn between 70 and 170) puts each cursor in **its own lane**, from −27 to +27 px around the mean radius. There is no explicit separation force: this spread is what prevents clumps.

### A swirl that changes direction

**Formula: a square wave softened by the hyperbolic tangent** ("soft square wave").

$$\mathrm{swirl}(t) = \tanh\big(3\cos(0.11\,t)\big)$$

A plain cosine would give a rotation that slows down, stops and limply starts again. The tanh(3·…) squashes it into a near-square signal with soft transitions: the swarm turns decisively one way, then flips to the other about every 29 s.

### The desired velocity

**Formulas: an orbital velocity field in polar coordinates** (tangent/radial frame), **with a saturated radial spring** (clamped Hooke's law).

$$\mathrm{tang} = 300\,(0.7 + 0.2\,\mathrm{spin}_c)\,\mathrm{swirl}(t)$$

$$\mathrm{rad} = \mathrm{clamp}\big(4\,(r_c - d),\; -2600,\; 1400\big) \qquad \mathrm{far} = \mathrm{clamp}\left(\frac{d - r_c}{600},\; 0,\; 1\right)$$

$$\vec{W} = (\mathrm{tang} + 400\,\mathrm{curl}_c\,\mathrm{far})\;\hat{t} \;+\; \mathrm{rad}\;\hat{n}$$

- The **tangential** component makes it turn, faster or slower depending on the cursor's `spin`.
- The **radial** component is a spring toward the ring, stronger going in (−2,600) than going out (+1,400).
- The **curl** term only acts far from the ring: a cursor coming from afar joins the swarm in a spiral, to the left or the right depending on the sign of `curl` (drawn between −1 and 1).

### Alignment with neighbors

Every neighbor closer than 90 px counts with a weight w = 1 − dist / 90. The desired velocity is blended 70/30 with the neighbors' weighted mean velocity:

**Formula: the boids alignment rule (Craig Reynolds, 1987)**, a weighted mean with a linearly decreasing kernel.

$$\vec{F} = 0.7\,\vec{W} + 0.3\,\frac{\sum_j w_j\,\vec{v}_j}{\sum_j w_j}$$

This is what creates the little groups that travel together.

### Capped speed and force

With d′ = max(0, d − 180·s), the distance beyond the core of the swarm:

**Formulas: Reynolds steering force** ("steering behaviors", 1999: force = desired velocity − current velocity, truncated), **integrated with semi-implicit Euler** (velocity first, then position).

$$v_{\max} = \mathrm{speed}_c\,\big(1.3 + \min(3.2,\; d'/90)\big)$$

$$\vec{g} = 6\,\big(\vec{F}_{\le v_{\max}} - \vec{v}\big), \qquad \lVert\vec{g}\rVert \le \mathrm{force}_c\,\big(1.4 + \min(5,\; d'/50)\big)$$

$$\vec{v} \leftarrow \vec{v} + \vec{g}\,\Delta t, \qquad \vec{p} \leftarrow \vec{p} + \vec{v}\,\Delta t$$

The force cap is what makes turns organic: a cursor cannot change direction instantly, it traces a curve. Both caps grow with distance, so a lost cursor comes back quickly while a cursor inside the swarm stays gentle.

### Personalities

| Trait | "Fast" cursor (25 %) | Normal cursor (75 %) |
| --- | --- | --- |
| speed (px/s) | 1,000 to 1,500 | 300 to 750 |
| force | 3,500 to 6,000 | 700 to 1,800 |
| spin | 2.2 to 3.4 | 0.8 to 1.8 |
| curl | −1 to 1 | −1 to 1 |
| orbit | 70 to 170 | 70 to 170 |

Mixing a few nervous cursors with a calm majority avoids an overly uniform "school of fish" look.

### The mouse as an obstacle

Mouse velocity is estimated and smoothed (factor min(1, 18·Δt) per frame). A cursor that enters a 48 px disc around it is pushed back to the edge of the disc. If it was moving toward the mouse, 1.6 times its normal relative velocity is removed, which gives a bounce with a restitution of 0.6. Finally, an outward push of 260 px/s is added. You can "part" the swarm with the mouse.

## 4. Cursor micro-signals

Four small details, each almost invisible, make a cursor read as "held by someone": it presses down on click, faces where it is going, changes tool, and keeps its tip in the right place.

### Pressure

A click sets `press` to 1, and it falls back linearly at 6 units per second (about 0.17 s). The cursor drawing is scaled by 1 − 0.12 × press: a 12 % squash that releases. The click itself lasts 0.07 s; a double click is two clicks 0.08 s apart.

### Orientation

- **In the swarm**: once speed exceeds 30 px/s, the target angle is the direction of travel plus 128° (the offset compensates for the drawn arrow's natural tilt). The angle approaches it along the shortest path with a factor of min(1, 8·Δt) per frame, a time constant of about 0.12 s. The arrows "look" where they are going, like birds.
- **At work**: the angle returns toward 0 with a factor of min(1, 10·Δt), then snaps to 0 below 0.5°. When going from swarm to work, the arrows straighten up in a tenth of a second, like someone taking hold of their mouse again.

### The shape follows the tool

| Shape | When |
| --- | --- |
| Arrow | moving, selecting, resting |
| Crosshair | drawing a frame or a text box |
| I-beam | typing text |
| Pen, pen with a "+" | placing the points of a line |
| Double arrow ↔ or ↕ | pulling a guide from the ruler |
| Duplicate arrow | copying a group of elements by dragging |

This is the visual vocabulary of design tools. The viewer recognizes the tool before even seeing the result.

### The hotspot

Each shape has its hotspot: (5, 3.5) for the arrow tip, (12, 12) for the center of the crosshair, (3, 3) for the pen. The drawing is offset by that point, and rotation and scale are applied around it. When the shape changes, turns or squashes, the tip does not move a single pixel. Without this detail, every tool change would make a small jump that would give the animation away.

### Identity

Each cursor gets one of 16 bright colors and one of 40 first names of computing pioneers (Ada, Grace, Linus…). A 1.5 px white outline keeps the arrow readable on any background.

## 5. Human rhythm

Work actions imitate the small imperfections of a real person: irregular typing, clicks never exactly in the center, pauses to "look", overshoots that get corrected.

### Typing

Each character costs a random delay, with extra cost where a human slows down:

| Character or event | Delay |
| --- | --- |
| Ordinary character | 45 to 75 ms |
| Space | + 20 to 50 ms |
| Line break | + 80 to 160 ms |
| Hesitation (2 % of characters) | + 80 to 150 ms |

Everything is multiplied by a factor that speeds up long texts, N being the number of characters:

**Formula: inverse square-root compression factor**, clamped.

$$k = \mathrm{clamp}\left(\sqrt{35 / N},\; 0.45,\; 1\right)$$

Up to 35 characters, typing runs at human speed. Beyond about 170, it is 2.2 times faster; otherwise a paragraph would take forever. Technically, elapsed time feeds a "budget", and as many characters are shown as the budget pays for. Typing therefore stays accurate whatever the frame rate.

### Aiming roughly

A click on an element never targets its exact center:

- x = left + min(50 % of the width, 50 to 70 px) + a random offset of ±5 to 8 px;
- y = top + min(50 % of the height, 22 to 30 px) + ±4 px.

The pixel cap imitates a real reflex: on a large block, you click near the start, not in the middle.

### Moving aside to let you see

Before typing, the I-beam moves aside by U(−30, 10) px horizontally and U(10, 30) px downward, at speed 1.5, so it doesn't hide the text as it appears. After a line, the pen also shifts 14 to 30 px to the right and 10 to 24 px down.

### Pauses to look

After each action, the cursor stays in place for a moment: 0.18 to 0.3 s after drawing a frame, then 0.35 s (0.5 s for an image) while the style is applied, and 0.15 to 0.3 s after a selection. These small silences give the impression that someone is checking their work.

### Overshoot, then snap

To align a text with a guide, the cursor drags it slightly too far: 2 to 5 px past it along the guide's axis, with a slight wobble of ±3 to 6 px on the other axis. Below a 9 px gap the position is forced to 0: that is the snap, with a flash of the guide and a small sound "click". The cursor then makes one last short, fast gesture (speed 2) to the exact position.

Same logic for frames: if the frame overflows the screen, the drag stops at the edge, then the frame finishes growing on its own in 0.5 s with an easeOut. You see an approximate gesture that the tool completes.

### Growing in steps

A heading doesn't grow continuously: its size goes through 24, 32, 40, 48, 56, 64, 72, 88 and 104 px, one step every 60 ms, with a tick sound 260 Hz higher at each step. It looks like someone pressing a shortcut several times.

## 6. Staging

Above the cursors, a conductor sets the tempo, hands out tasks in a readable order and only builds what the viewer is looking at (`Engine.step`).

### A shared tempo that reacts to the viewer

Raw scroll speed is smoothed by a peak follower, which rises fast and falls slowly:

**Formula: peak follower** (attack/release envelope): exponential moving average on the way up, exponential decay on the way down.

$$\mathrm{vel} \leftarrow \max\big(\mathrm{vel}\; e^{-1.2\,\Delta t},\;\; 0.7\,\mathrm{vel} + 0.3\,v_{\text{scroll}}\big)$$

That value and the workload set a tempo shared by all cursors:

**Formula: adaptive tempo**, a saturated linear combination.

$$\mathrm{tempo} = \mathrm{clamp}\left(1 + \frac{\mathrm{vel}}{1400} + \min\left(0.3,\; 0.1\,\frac{n_{\text{available}}}{n_{\text{cursors}}}\right),\; 0.95,\; 1.4\right)$$

The tempo multiplies the time of every work action (paths, waits, typing), but not wandering pauses. When you scroll or there is a lot to do, the whole team speeds up together, by up to 40 %. The time step is capped at 50 ms so a background tab doesn't cause a jump when you come back.

### Which task to take

A free cursor takes the available task with the lowest score, with y the vertical position of the task and y_c that of the cursor:

**Formula: weighted cost function with lexicographic priority** (the large coefficients, 10⁶ and 5·10⁵, create tiers that never mix).

$$s = 10^6\,u \;+\; 0.6\,y' \;+\; 0.4\,\lvert y - y_c \rvert \;-\; 5\cdot 10^5\,[\text{guide}]$$

- u is 0 if the task is on screen (from 40 px above the top to 88 % of the height), 1 if it is above, 2 if it is below. The screen always comes first.
- y′ is the vertical position (the distance to the top of the screen for tasks above): building goes top to bottom, in reading order.
- The 0.4 × |y − y_c| term favors what is close to the cursor: no pointless trips across the screen.
- Guides come before everything, since other tasks snap to them.

The 60/40 mix of reading order and proximity gives a build that goes broadly downward, but where everyone works in their own corner.

### A front that follows the gaze

A "build front" only moves down: max(front, top of the screen + 88 % of the height), or infinity once the bottom of the page is reached. Tasks below the front wait. The page builds itself where you are looking, at the pace of your scrolling.

### Dependencies

A task only becomes available once its dependencies are done: the parent block before its content, the original of a repeated pattern before its copies, the copy before its edits (changed text, replaced image). A text that must align with a guide waits up to 1.6 s for the guide to be placed, then gives up on snapping. The order of operations stays believable. Safety net: if nothing is available and nobody is working, all remaining dependencies are lifted, so it never gets stuck.

### What fades in and out

- The top and left rulers slide on screen when a guide is pulled (smoothing factor 10·Δt), stay 0.7 s afterward, then leave.
- A guide fades out (1.2 opacity units per second) 1.2 s after its tasks are done, or after 7 s.
- Dropped elements settle with a 0.3 s transition in cubic-bezier(0.2, 0.8, 0.2, 1). It is a very pronounced easeOut that arrives fast and lands softly. Images reveal top to bottom in 0.6 s with the same curve.
- At the end, all free cursors join the swarm from section 3: the finished page is "celebrated" by the swirling crowd.

## 7. Sound tied to gesture

Sound is not background music: every noise comes from a specific gesture, and it is placed in space and time so that it stays musical, whatever the number of cursors (`Sound` class).

### Placing the sound where the gesture is

The cursor's horizontal position sets the stereo pan, with x in pixels and L the screen width:

**Formula: linear panning**, a clamped affine map from position to [−0.8, 0.8].

$$\mathrm{pan} = \mathrm{clamp}\left(1.6\,\frac{x}{L} - 0.8,\; -0.8,\; 0.8\right)$$

You can hear where each click comes from, without ever going to the extremes (±0.8), which would sound artificial on headphones.

### Notes that can't sound wrong

Dropping an element plays a piano note picked from an E pentatonic scale (0, 2, 4, 7, 9 semitones). In this scale, any combination of notes stays consonant.

**Formulas: quantization to a pentatonic scale in MIDI notation**, then MIDI → frequency conversion with equal temperament, f = 440 × 2^((midi − 69) / 12).

$$\mathrm{midi} = 40 + 12\,\mathrm{oct} + \mathrm{PENTA}\left[\left\lfloor 5\,\frac{x}{L} \right\rfloor\right]$$

- **Pitch follows position**: the screen is cut into 5 vertical bands, one per scale degree. You "play" the page from left to right.
- **Octave follows size**: the more screen area the element takes, the lower the note (octave 1 above 8 % of the screen, then 2, 3, 4 below 0.2 %). Guides are at the very top (octave 5).
- **Sustain follows octave**: 3.6 s for low notes, 1.6 s for high ones.
- **Images** add a second note, two scale degrees higher, 40 ms later: a little arpeggio.
- **Off screen**, volume drops to 45 %.

### Quantizing to a grid

Notes don't fire at the moment of the gesture: they are snapped to the next eighth note at 104 BPM (about 0.29 s), and only one note is allowed per grid slot. Twenty cursors dropping elements at the same time produce a rhythmic melody, not a cacophony. Clicks and typing are not quantized: they must stick to the gesture.

### Synthesizing rather than recording

Everything is made with Web Audio, without a single sound file:

- **The piano**: five sine waves at ratios 1, 2, 3, 2.756 and 5.4 of the fundamental (the 2.756 is deliberately inharmonic, like a real struck string), each with its own decay. A random detune of ±0.1 % is added, plus a "hammer strike": 30 ms of noise filtered around 4 times the frequency plus 1,200 Hz.
- **Keyboard keys**: two filtered noise bursts 1 to 5 ms apart, one bright (3.6 to 5.6 kHz) and one duller (0.85 to 1.5 kHz, or 380 to 560 Hz for the space bar). Each keystroke draws its frequencies and volume at random.
- **The mouse click**: three bursts, the press at 2.1 to 2.7 kHz and 650 to 850 Hz, then the release 55 to 75 ms later at 2.9 to 3.4 kHz.
- **The ambience**: four slightly detuned oscillators (E, B, E, G♯) spread across the stereo field, behind a 420 Hz low-pass filter swept by a 0.12 Hz LFO (±150 Hz). The background "breathes" over about 8 s.
- **A reverb** generated by convolution (3.2 s) and a compressor on the output, which glue everything together.

### Safeguards

At most 28 piano notes ringing at once, 80 keystrokes and 40 clicks per second, and no more than one keystroke every 24 ms per cursor. Without these caps, a swarm of 24 cursors would saturate the sound.

## 8. Architecture

Three technical choices make everything above easy to write: one behavior per coroutine, a single frame-driven clock, and a renderer that only touches the DOM when it has to.

### One behavior = one coroutine

Each cursor holds a generator in `c.gen`. Every frame, the engine advances it one step with `c.gen.next(dt)`; inside the generator, the `yield` expression returns exactly that dt.

- **Waiting**: add up `(yield) * tempo` until the desired duration is reached.
- **Composing**: `yield* moveTo(…)`, then `yield* click(…)`, then `yield* type(…)`. A complex action reads like a recipe, top to bottom.
- **Finishing**: a finished generator frees the cursor, which goes back to a resting behavior. An error in a generator is caught and treated as the end of the task: one bug doesn't stop the whole swarm.
- **Cleaning up**: a `try … finally` in the generator guarantees that a shared counter (for example "someone needs the rulers") is updated even if the action is interrupted.

Progress lives in the generator's local variables, not in `state` fields: there is no state machine to maintain.

### One clock, one loop

A `requestAnimationFrame` loop computes dt, caps it at 50 ms, advances the simulation, then draws. Every animation depends on dt and the tempo, never on `setTimeout`. A practical consequence: the scene can be slowed down, sped up or replayed frame by frame.

Smoothing of the form "x += (target − x) × min(1, k·dt)" shows up everywhere (orientation, rulers, mouse velocity). It is exponential smoothing (a first-order low-pass filter), roughly independent of frame rate, with a time constant of about 1/k.

### Data, systems, one renderer

- Cursors and page elements are plain data objects.
- Logic lives in the engine and in action functions that receive the engine as a parameter.
- The renderer reuses one DOM element per cursor, only rewrites its SVG when the shape changes, and otherwise just updates a `transform` rounded to a tenth of a pixel.
- Selection rectangles and measurements are described by a small function attached to the cursor (`c.ov`), re-evaluated every frame: they automatically follow the moving element.
- Everything is drawn inside a host element isolated from the site (`contain: strict`, maximum z-index), so the page's styles can't interfere.

For our object-oriented version, it is enough to turn the data into classes (`Cursor`, `Item`) and the action functions into methods or `Action` classes, keeping the generators as they are.

## 9. Summary and priorities for our version

About fifteen settings make most of the effect; they are the first to reproduce and to expose as parameters to tune by eye.

| Setting | Value in CursorSwarm | Effect if removed |
| --- | --- | --- |
| Path duration | 0.12 + 0.021 √d, between 0.14 and 0.9 s | endless long paths or sluggish short ones |
| Curvature | 4 to 14 % of d (600 px cap), random side | robotic straight-line paths |
| Easing | easeInOut then easeOut at 15 % | constant speed, no readable intent |
| Wandering | speed 0.35, pauses of 0.4 to 1.4 s | cursors frozen or constantly restless |
| Population | 8 to 24 cursors, leave after 2.5 s without a task | a crowd that ignores the work |
| Swarm radius | 135 px, breathing ±18 % (11 s), 3 lobes ±30 % | a perfect, mechanical ring |
| Swirl | tanh(3 cos 0.11t), flips every 29 s | monotonous rotation |
| Alignment | neighbors within 90 px, 70/30 blend | no little groups |
| Capped force | 700 to 6,000 depending on the cursor | instant turns |
| Personalities | 25 % fast cursors | a uniform school of fish |
| Pressure | 12 % squash, recovers in 0.17 s | invisible clicks |
| Orientation | velocity + 128°, 8·dt smoothing | arrows that slide without looking |
| Typing | 45 to 75 ms per character, 2 % hesitations | text that "flows" like an animation |
| Tempo | 0.95 to 1.4 depending on scrolling and workload | a scene indifferent to the viewer |
| Sound quantization | eighth notes at 104 BPM, one note per slot | cacophony |

### Proposed rebuild order

1. `moveTo` with duration, arc and easing, plus pressure and hotspot: a single cursor clicking on targets.
2. Wandering and population: several cursors arriving, waiting and leaving.
3. The full swarm, with the mouse as both target and obstacle.
4. Dummy tasks (frames, texts) with typing and pauses, then task selection and tempo.
5. Sound, starting with panning and quantization, which do the most for the least code.
