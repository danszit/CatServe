/**
 * Mochi, the white cat. Delayed gratification: grab the yarn, solve the maze, reward.
 */
import { LivingCat, animate, wait } from './cats';
import { MAZE_COLS, MAZE_ROWS } from './config';
import { YarnMaze } from './maze';
import { OrigamiFold } from './fold';

const $ = <T extends Element>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as unknown as T;
};

export class WhiteCat {
  private busy = false;
  private readonly panel = $<HTMLElement>('maze-panel');
  private readonly card = $<HTMLElement>('maze-card');
  private readonly fold = new OrigamiFold(this.card, $<HTMLElement>('maze-fold'));
  private readonly body = $<HTMLElement>('maze-body');
  private readonly closeBtn = $<HTMLButtonElement>('maze-close');
  private readonly grab = $<SVGGElement>('yarn-grab');
  private readonly yarnBig = $<SVGGElement>('yarn-big');
  private readonly yarnSmall = $<SVGGElement>('yarn-small');
  private readonly thread = $<SVGPathElement>('yarn-thread-path');
  private readonly head = $<SVGGElement>('white-head');
  private readonly scene = $<HTMLElement>('scene');
  private readonly maze: YarnMaze;
  private resolveClose: (() => void) | null = null;

  constructor(
    private readonly cat: LivingCat,
    private readonly onReward: () => Promise<void>,
  ) {
    this.maze = new YarnMaze(MAZE_COLS, MAZE_ROWS, {
      onProgress: (n, total) => this.onProgress(n, total),
      onSolved: () => void this.onSolved(),
      onBump: () => this.onBump(),
    });
    this.body.appendChild(this.maze.svg);

    this.grab.addEventListener('click', () => void this.open());
    this.grab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void this.open();
      }
    });
    this.closeBtn.addEventListener('click', () => this.letGo());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panel.classList.contains('is-open')) this.letGo();
    });

    // the yarn end wiggles when the cat is hovered, inviting a tug
    this.cat.rig.root.addEventListener('pointerenter', () => {
      if (!this.busy) this.wiggleThread();
    });
  }

  get isBusy(): boolean {
    return this.busy;
  }

  /** Client-space points from the string head to the goal (debug/testing). */
  solution(): Array<{ x: number; y: number }> {
    return this.maze.solutionClientPoints();
  }

  async open(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.maze.reset();
    this.cat.twitchEars(0);
    this.wiggleThread();

    // The panel takes its width at once; the cats glide over as one composited layer
    // while the paper fans open beside them.
    this.flipScene(() => this.panel.classList.add('is-folding'));
    await this.fold.unfold();
    this.panel.classList.add('is-open');
    this.panel.classList.remove('is-folding');
    this.panel.setAttribute('aria-hidden', 'false');
    this.maze.setActive(true);

    await new Promise<void>((resolve) => {
      this.resolveClose = resolve;
    });
  }

  /** Cancel: the thread snaps back and the paper folds up. */
  letGo(): void {
    if (!this.panel.classList.contains('is-open')) return;
    this.maze.setActive(false);
    this.unwind(0);
    void this.foldAway().then(() => {
      this.busy = false;
      this.resolveClose?.();
      this.resolveClose = null;
    });
  }

  /** Swap the live card for its folding paper twin and close it into the crease. */
  private async foldAway(): Promise<void> {
    this.panel.classList.add('is-folding');
    this.panel.classList.remove('is-open');
    this.panel.setAttribute('aria-hidden', 'true');
    await this.fold.fold();
    this.flipScene(() => this.panel.classList.remove('is-folding'));
  }

  /**
   * Apply a layout change, then animate the scene from where it was to where it is
   * with a transform only (First, Last, Invert, Play). The scene is a uniformly
   * scaled drawing centred in its box, so a translate + scale of the whole box
   * reproduces the width transition exactly at rest and costs the compositor
   * one raster per frame instead of a relayout and a full repaint.
   */
  private flipScene(change: () => void): void {
    const before = this.scene.getBoundingClientRect();
    change();
    const after = this.scene.getBoundingClientRect();
    if (!before.width || !after.width || !before.height || !after.height) return;
    const svg = this.scene.querySelector<SVGSVGElement>('#scene-svg');
    const vb = svg?.viewBox.baseVal;
    const vw = vb?.width || 1170;
    const vh = vb?.height || 880;
    const s0 = Math.min(before.width / vw, before.height / vh);
    const s1 = Math.min(after.width / vw, after.height / vh);
    const dx = before.left + before.width / 2 - (after.left + after.width / 2);
    const dy = before.top + before.height / 2 - (after.top + after.height / 2);
    void animate(
      this.scene,
      [{ transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${(s0 / s1).toFixed(4)})` }, { transform: 'none' }],
      { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }

  private onProgress(n: number, total: number): void {
    const frac = Math.min(1, n / (total * 0.45));
    this.unwind(frac);
    if (n % 7 === 0) this.cat.twitchEars();
  }

  private onBump(): void {
    this.body.classList.remove('is-stuck');
    void this.body.offsetWidth;
    this.body.classList.add('is-stuck');
  }

  /** The big ball in the scene turns and shrinks as the thread is pulled through the maze. */
  private unwind(frac: number): void {
    const scale = 1 - frac * 0.3;
    const rot = frac * 540;
    this.yarnBig.style.transform = `rotate(${rot}deg) scale(${scale})`;
    this.yarnBig.style.transition = 'transform 0.25s ease-out';
  }

  private wiggleThread(): void {
    void animate(
      this.thread,
      [
        { transform: 'translate(0px, 0px)' },
        { transform: 'translate(-6px, 3px)', offset: 0.3 },
        { transform: 'translate(4px, -2px)', offset: 0.65 },
        { transform: 'translate(0px, 0px)' },
      ],
      { duration: 500, easing: 'ease-in-out' },
    );
  }

  private async onSolved(): Promise<void> {
    this.maze.setActive(false);
    this.maze.wakeGoal();
    await wait(450);

    // Paper folds away; Mochi wakes up delighted
    const folded = this.foldAway();

    this.cat.setLidOverride(0);
    this.cat.rig.root.classList.add('is-awake', 'is-happy');
    this.cat.excite(2200);
    this.cat.twitchEars(0);
    setTimeout(() => this.cat.twitchEars(1), 120);

    this.head.style.transformBox = 'view-box';
    this.head.style.transformOrigin = '430px 600px';
    void animate(
      this.head,
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-9deg)', offset: 0.25 },
        { transform: 'rotate(8deg)', offset: 0.55 },
        { transform: 'rotate(-4deg)', offset: 0.8 },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 900, easing: 'ease-in-out' },
    );
    // the yarn balls bounce for joy
    for (const [ball, delay] of [
      [this.yarnBig, 0],
      [this.yarnSmall, 120],
    ] as const) {
      void animate(
        ball,
        [
          { transform: ball.style.transform || 'translateY(0px)' },
          { transform: `translateY(-26px) rotate(${ball === this.yarnBig ? 560 : 20}deg) scale(0.9)`, offset: 0.45 },
          { transform: 'translateY(0px) rotate(0deg) scale(1)' },
        ],
        { duration: 700, delay, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
      );
    }
    // happy "!" pupils: a second quick blink
    setTimeout(() => this.cat.blink(true), 500);
    await wait(1200);

    await this.onReward();

    // settle back to dozing
    this.cat.rig.root.classList.remove('is-awake', 'is-happy');
    this.cat.setLidOverride(null);
    this.yarnBig.style.transform = '';
    await folded;
    this.busy = false;
    this.resolveClose?.();
    this.resolveClose = null;
  }
}
