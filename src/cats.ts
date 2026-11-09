/**
 * Shared "aliveness" for both cats: blinking, pupils following the cursor,
 * ear twitches and a small greeting when hovered.
 */

export interface CatRig {
  root: SVGGElement;
  eyes: SVGGElement[];
  ears: SVGPathElement[];
  /** 0 = wide open, 1 = fully shut. Resting lid position. */
  restingLid: number;
  /** +1 lids slide down from above (upright head), -1 lids rise from below (upside-down head). */
  lidDirection: 1 | -1;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Lid travel from fully clear of the eye (apex at cy+21) to fully covering it (apex at cy-26). */
const LID_TRAVEL = 47;

/** The parts of one eye the frame loop drives, looked up once instead of every frame. */
interface EyeParts {
  lid: SVGPathElement | null;
  line: SVGPathElement | null;
  outline: SVGCircleElement | null;
  pupil: SVGCircleElement | null;
  glint: SVGCircleElement | null;
  glintSmall: SVGCircleElement | null;
}

/**
 * Halo twin of an element (see scene.ts): an element elsewhere in the scene that must
 * carry the same class toggles and scripted animations as the live part.
 */
export function twinOf(el: Element): Element | null {
  return el.id ? document.querySelector(`[data-twin-of="${el.id}"]`) : null;
}

export class LivingCat {
  readonly rig: CatRig;
  private lid: number;
  private blinkTimer = 0;
  private blinkPhase = 0;
  private blinkClosing = false;
  private hovered = false;
  private pupilOffset = { x: 0, y: 0 };
  private pupilTarget = { x: 0, y: 0 };
  private lockedLid: number | null = null;
  private excitementUntil = 0;
  private earTwitchTimer = rand(3, 8);
  private readonly face: SVGGElement | null;
  private faceOffset = { x: 0, y: 0 };
  private readonly eyeParts: EyeParts[];
  private readonly earTwins: Array<Element | null>;
  /** Attribute strings written last frame; identical values are not written again. */
  private readonly written = { face: '', lid: '', shut: '', pupil: '', glint: '' };

  constructor(rig: CatRig) {
    this.rig = rig;
    this.lid = rig.restingLid;
    this.face = rig.root.querySelector<SVGGElement>('.face');
    this.eyeParts = rig.eyes.map((eye) => ({
      lid: eye.querySelector<SVGPathElement>('.lid'),
      line: eye.querySelector<SVGPathElement>('.lid-line'),
      outline: eye.querySelector<SVGCircleElement>('.outline'),
      pupil: eye.querySelector<SVGCircleElement>('.pupil'),
      glint: eye.querySelector<SVGCircleElement>('.glint'),
      glintSmall: eye.querySelector<SVGCircleElement>('.glint-small'),
    }));
    this.earTwins = rig.ears.map((ear) => twinOf(ear));
    this.scheduleBlink();

    rig.root.addEventListener('pointerenter', () => this.onEnter());
    rig.root.addEventListener('pointerleave', () => this.onLeave());
  }

  /** Called from the global pointer listener in scene-space coordinates. */
  lookAt(sx: number, sy: number): void {
    const [first] = this.rig.eyes;
    if (!first) return;
    const cx = Number(first.dataset.cx);
    const cy = Number(first.dataset.cy);
    const dx = sx - cx;
    const dy = sy - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, dist / 380);
    const max = 6.5;
    this.pupilTarget.x = (dx / dist) * max * reach;
    this.pupilTarget.y = (dy / dist) * max * reach;
  }

  /** Force the lids to a position (e.g. squint while chewing). null releases. */
  setLidOverride(v: number | null): void {
    this.lockedLid = v;
  }

  /** Temporarily make the cat "excited": faster blinking, CSS class for wagging. */
  excite(ms: number): void {
    this.excitementUntil = performance.now() + ms;
    this.rig.root.classList.add('is-excited');
  }

  get isHovered(): boolean {
    return this.hovered;
  }

  twitchEars(which?: number): void {
    const index = which ?? Math.floor(Math.random() * this.rig.ears.length);
    const ear = this.rig.ears[index];
    if (!ear) return;
    const targets = [ear, this.earTwins[index]].filter((e): e is Element => Boolean(e));
    for (const t of targets) t.classList.remove('twitch');
    void ear.getBoundingClientRect(); // restart the CSS animation
    for (const t of targets) {
      t.classList.add('twitch');
      t.addEventListener('animationend', () => t.classList.remove('twitch'), { once: true });
    }
  }

  blink(double = false): void {
    if (this.blinkPhase === 0) this.blinkPhase = double ? 2 : 1;
  }

  update(dt: number, now: number): void {
    if (this.excitementUntil && now > this.excitementUntil) {
      this.excitementUntil = 0;
      this.rig.root.classList.remove('is-excited');
    }

    // random ear twitches while idle
    this.earTwitchTimer -= dt;
    if (this.earTwitchTimer <= 0) {
      this.twitchEars();
      this.earTwitchTimer = rand(4, 11);
    }

    // --- lids ---
    let desired = this.hovered ? 0 : this.rig.restingLid;
    if (this.lockedLid !== null) desired = this.lockedLid;

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = Math.random() < 0.2 ? 2 : 1;
      this.scheduleBlink();
    }

    if (this.blinkPhase > 0) {
      const speed = dt * 13;
      if (!this.blinkClosing) {
        this.lid = Math.min(1, this.lid + speed);
        if (this.lid >= 1) this.blinkClosing = true;
      } else {
        this.lid = Math.max(desired, this.lid - speed * 0.75);
        if (this.lid <= desired + 0.01) {
          this.blinkClosing = false;
          this.blinkPhase -= 1;
        }
      }
    } else {
      this.lid += (desired - this.lid) * Math.min(1, dt * 7);
    }

    // --- pupils ---
    this.pupilOffset.x += (this.pupilTarget.x - this.pupilOffset.x) * Math.min(1, dt * 8);
    this.pupilOffset.y += (this.pupilTarget.y - this.pupilOffset.y) * Math.min(1, dt * 8);

    // the whole face leans a few px toward the cursor, like a small head turn
    if (this.face) {
      const lean = this.hovered ? 0.55 : 0.25;
      const tx = this.pupilOffset.x * lean;
      const ty = this.pupilOffset.y * lean;
      this.faceOffset.x += (tx - this.faceOffset.x) * Math.min(1, dt * 6);
      this.faceOffset.y += (ty - this.faceOffset.y) * Math.min(1, dt * 6);
      const faceT = `translate(${this.faceOffset.x.toFixed(2)} ${this.faceOffset.y.toFixed(2)})`;
      if (faceT !== this.written.face) {
        this.written.face = faceT;
        this.face.setAttribute('transform', faceT);
      }
    }

    // heavy lids drag the pupil toward the lid a touch
    const droop = this.lid * 3 * this.rig.lidDirection;
    const travel = LID_TRAVEL * (1 - this.lid) * -this.rig.lidDirection;
    const shutness = clamp01((this.lid - 0.72) / 0.28);

    // Both eyes share the same values, so build each attribute string once and only touch
    // the DOM when it actually changed: an idle cat then costs no style invalidation at all.
    const lidT = `translate(0 ${travel.toFixed(2)})`;
    const shut = shutness.toFixed(3);
    const px = this.pupilOffset.x.toFixed(2);
    const py = (this.pupilOffset.y + droop).toFixed(2);
    const pupilT = `translate(${px} ${py})`;
    const gx = (this.pupilOffset.x * 0.55).toFixed(2);
    const gy = (this.pupilOffset.y * 0.55 + droop).toFixed(2);
    const glintT = `translate(${gx} ${gy})`;

    const lidChanged = lidT !== this.written.lid;
    const shutChanged = shut !== this.written.shut;
    const pupilChanged = pupilT !== this.written.pupil;
    const glintChanged = glintT !== this.written.glint;
    if (!lidChanged && !shutChanged && !pupilChanged && !glintChanged) return;
    this.written.lid = lidT;
    this.written.shut = shut;
    this.written.pupil = pupilT;
    this.written.glint = glintT;
    const open = (1 - shutness).toFixed(3);

    for (const eye of this.eyeParts) {
      if (lidChanged) eye.lid?.setAttribute('transform', lidT);
      if (shutChanged) {
        eye.line?.setAttribute('opacity', shut);
        eye.outline?.setAttribute('opacity', open);
      }
      if (pupilChanged) {
        eye.pupil?.setAttribute('transform', pupilT);
        eye.glintSmall?.setAttribute('transform', pupilT);
      }
      if (glintChanged) eye.glint?.setAttribute('transform', glintT);
    }
  }

  private scheduleBlink(): void {
    const excited = this.excitementUntil > performance.now();
    this.blinkTimer = excited ? rand(0.5, 1.3) : rand(2.4, 6.5);
  }

  private onEnter(): void {
    this.hovered = true;
    this.twitchEars();
    if (Math.random() < 0.7) this.blink(true);
    this.rig.root.classList.add('is-hovered');
  }

  private onLeave(): void {
    this.hovered = false;
    this.rig.root.classList.remove('is-hovered');
  }
}

/** Convert a client pointer position into scene (viewBox) coordinates. */
export function toScene(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/**
 * Global time scale for scripted sequences (`?slow=4` makes every choreographed
 * animation 4x slower, handy for tuning and frame-by-frame review).
 */
export const TIME_SCALE: number = (() => {
  const v = Number(new URLSearchParams(window.location.search).get('slow'));
  return Number.isFinite(v) && v > 0 ? v : 1;
})();

/** Promise-flavoured helper around the Web Animations API. */
export function animate(
  el: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
): Promise<void> {
  const scaled: KeyframeAnimationOptions = {
    ...options,
    duration: typeof options.duration === 'number' ? options.duration * TIME_SCALE : options.duration,
    delay: typeof options.delay === 'number' ? options.delay * TIME_SCALE : options.delay,
  };
  const a = el.animate(keyframes, { fill: 'forwards', ...scaled });
  return a.finished
    .then(() => {
      // Bake the end state into inline style so later style writes aren't shadowed by the fill.
      try {
        a.commitStyles();
      } catch {
        /* element not rendered; nothing to commit */
      }
      a.cancel();
    })
    .catch(() => undefined);
}

/** Run the same animation on a part and its halo twin (if any) so they stay in step. */
export function animateWithTwin(
  el: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
): Promise<void> {
  const twin = twinOf(el);
  return twin ? Promise.all([animate(el, keyframes, options), animate(twin, keyframes, options)]).then(() => undefined) : animate(el, keyframes, options);
}

export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms * TIME_SCALE));
