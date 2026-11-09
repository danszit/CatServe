/**
 * Origami unfold for the maze card. The card is sliced into vertical strips that
 * are nested like an accordion fold: each strip hangs off the right edge of the
 * one inside it, so rotating the hinges fans the whole stack out from the crease
 * between the panel and the scene. The strips show a static clone of the card;
 * the real card is swapped in the moment the paper lies flat.
 */
import { animate } from './cats';

const FLAPS = 4;
const DURATION = 950;
const STAGGER = 70;
/** Hinge angles in the folded state, outermost first. Alternating signs make the zigzag. */
const FOLDED = [88, -176, 176, -176];

export class OrigamiFold {
  private running: Promise<void> | null = null;

  constructor(
    private readonly card: HTMLElement,
    private readonly host: HTMLElement,
  ) {}

  /** Paper fans open; resolves when it lies flat. */
  unfold(): Promise<void> {
    return this.run(false);
  }

  /** Paper folds back up into the crease. */
  fold(): Promise<void> {
    return this.run(true);
  }

  private async run(reverse: boolean): Promise<void> {
    if (this.running) await this.running;
    const job = this.play(reverse);
    this.running = job;
    try {
      await job;
    } finally {
      if (this.running === job) this.running = null;
      this.host.replaceChildren();
    }
  }

  private async play(reverse: boolean): Promise<void> {
    const w = this.card.offsetWidth;
    const h = this.card.offsetHeight;
    if (!w || !h) return;
    this.host.style.top = `${this.card.offsetTop}px`;
    this.host.style.width = `${w}px`;
    this.host.style.height = `${h}px`;

    const strip = w / FLAPS;
    const ghost = this.card.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    ghost.style.width = `${w}px`;
    ghost.style.height = `${h}px`;

    const flaps: HTMLElement[] = [];
    const shades: HTMLElement[] = [];
    let parent: HTMLElement = this.host;
    for (let k = FLAPS - 1; k >= 0; k--) {
      const flap = document.createElement('div');
      flap.className = 'maze-flap';
      flap.style.width = `${strip + 0.5}px`;
      flap.style.left = k === FLAPS - 1 ? `${w - strip}px` : `${-strip}px`;

      const face = document.createElement('div');
      face.className = 'maze-flap-face';
      const slice = ghost.cloneNode(true) as HTMLElement;
      slice.style.left = `${-k * strip}px`;
      face.appendChild(slice);
      const shade = document.createElement('div');
      shade.className = 'maze-flap-shade';
      face.appendChild(shade);

      const back = document.createElement('div');
      back.className = 'maze-flap-back';

      flap.append(face, back);
      parent.appendChild(flap);
      parent = flap;
      flaps.push(flap);
      shades.push(shade);
    }

    const runs = flaps.map((flap, i) => {
      const folded = FOLDED[i] ?? 0;
      const frames = [{ transform: `rotateY(${folded}deg)` }, { transform: 'rotateY(0deg)' }];
      const delay = (reverse ? FLAPS - 1 - i : i) * STAGGER;
      const shade = shades[i] as HTMLElement;
      void animate(shade, [{ opacity: 1 }, { opacity: 0 }], {
        duration: DURATION,
        delay,
        fill: 'both',
        direction: reverse ? 'reverse' : 'normal',
        easing: 'ease-out',
      });
      return animate(flap, frames, {
        duration: DURATION,
        delay,
        fill: 'both',
        direction: reverse ? 'reverse' : 'normal',
        easing: reverse ? 'cubic-bezier(0.55, 0, 0.8, 0.4)' : 'cubic-bezier(0.3, 1.25, 0.5, 1)',
      });
    });
    await Promise.all(runs);
  }
}
