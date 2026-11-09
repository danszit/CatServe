import './style.css';
import { sceneSVG, shadowSVG } from './art/scene';
import { mountShadowLayer } from './art/shadow';
import { LivingCat, toScene } from './cats';
import { BlackCat } from './blackCat';
import { WhiteCat } from './whiteCat';
import { Reward } from './reward';

const $ = <T extends Element>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as unknown as T;
};

function boot(): void {
  const sceneHost = $<HTMLElement>('scene');
  // Static shadow layer underneath, live art on top (see scene.ts).
  sceneHost.innerHTML = shadowSVG + sceneSVG;
  const svg = $<SVGSVGElement>('scene-svg');
  mountShadowLayer(svg);

  const reward = new Reward();

  const mochi = new LivingCat({
    root: $<SVGGElement>('white-cat'),
    eyes: [$<SVGGElement>('white-eye-left'), $<SVGGElement>('white-eye-right')],
    ears: [$<SVGPathElement>('white-ear-left'), $<SVGPathElement>('white-ear-right')],
    restingLid: 0.46, // dozing: lower half of the eye covered
    lidDirection: -1, // upside-down head: lids rise from below
  });

  const nori = new LivingCat({
    root: $<SVGGElement>('black-cat'),
    eyes: [$<SVGGElement>('black-eye-left'), $<SVGGElement>('black-eye-right')],
    ears: [$<SVGPathElement>('black-ear-left'), $<SVGPathElement>('black-ear-right')],
    restingLid: 0.05,
    lidDirection: 1,
  });

  const blackCat = new BlackCat(nori, () => reward.open('instant'));
  const whiteCat = new WhiteCat(mochi, () => reward.open('delayed'));

  // Both cats watch the cursor. Pointer events can arrive far faster than frames, so the
  // listener only records the latest client position; the frame loop converts it once.
  let pointer: { x: number; y: number } | null = null;
  let pendingClient: { x: number; y: number } | null = null;
  window.addEventListener('pointermove', (e) => {
    pendingClient = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerleave', () => {
    pendingClient = null;
    pointer = null;
  });

  // Idle gaze: when the pointer is away the cats glance around lazily
  let idleGaze = { x: 600, y: 480 };
  let idleTimer = 0;

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (pendingClient) {
      pointer = toScene(svg, pendingClient.x, pendingClient.y);
      pendingClient = null;
    }
    if (pointer) {
      mochi.lookAt(pointer.x, pointer.y);
      nori.lookAt(pointer.x, pointer.y);
    } else {
      idleTimer -= dt;
      if (idleTimer <= 0) {
        idleTimer = 2 + Math.random() * 4;
        idleGaze = { x: 200 + Math.random() * 800, y: 200 + Math.random() * 600 };
      }
      mochi.lookAt(idleGaze.x, idleGaze.y);
      nori.lookAt(idleGaze.x, idleGaze.y);
    }

    if (!(window as unknown as { __catserve?: { freeze?: boolean } }).__catserve?.freeze) {
      mochi.update(dt, now);
      nori.update(dt, now);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  installDebugHooks({ blackCat, whiteCat, reward, mochi, nori });
}

/** `?debug=maze|eat|reward|awake` lets us screenshot a given state without a pointer. */
function installDebugHooks(ctx: { blackCat: BlackCat; whiteCat: WhiteCat; reward: Reward; mochi: LivingCat; nori: LivingCat }): void {
  (window as unknown as { __catserve: unknown }).__catserve = {
    solution: () => ctx.whiteCat.solution(),
    feed: () => ctx.blackCat.feed(),
    openMaze: () => ctx.whiteCat.open(),
    freeze: false,
  };
  const mode = new URLSearchParams(window.location.search).get('debug');
  if (!mode) return;
  setTimeout(() => {
    if (mode === 'maze') void ctx.whiteCat.open();
    if (mode === 'eat') void ctx.blackCat.feed();
    if (mode === 'reward') void ctx.reward.open('delayed');
    if (mode === 'awake') {
      ctx.mochi.setLidOverride(0);
      ctx.nori.setLidOverride(0);
    }
    if (mode === 'shut') {
      ctx.mochi.setLidOverride(1);
      ctx.nori.setLidOverride(1);
    }
  }, 300);
}

boot();
