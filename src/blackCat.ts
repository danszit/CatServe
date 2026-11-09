/**
 * Nori, the black cat. Instant gratification: click the fish, she eats it, reward.
 */
import { LivingCat, animate, animateWithTwin, twinOf, wait } from './cats';

const FISH_HOME = 'translate(936px, 672px) rotate(-14deg)';

const $ = <T extends Element>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as unknown as T;
};

export class BlackCat {
  private busy = false;
  private readonly fish = $<SVGGElement>('fish');
  private readonly fishArt = $<SVGGElement>('fish-art');
  private readonly fishBones = $<SVGGElement>('fish-bones');
  private readonly paws = $<SVGGElement>('black-paws');
  private readonly head = $<SVGGElement>('black-head');
  private readonly mouthClosed = $<SVGPathElement>('black-mouth-closed');
  private readonly mouthOpen = $<SVGGElement>('black-mouth-open');
  private readonly nom = $<SVGGElement>('nom');
  private readonly burst = $<SVGGElement>('burst');
  private readonly pupils: SVGCircleElement[];

  constructor(
    private readonly cat: LivingCat,
    private readonly onReward: () => Promise<void>,
  ) {
    this.pupils = Array.from(cat.rig.root.querySelectorAll<SVGCircleElement>('.pupil'));
    // CSS transforms on the fish are in px so WAAPI can tween them; set the resting pose.
    this.fishArt.removeAttribute('transform');
    this.fishArt.style.transformBox = 'view-box';
    this.fishArt.style.transform = FISH_HOME;
    this.fishBones.removeAttribute('transform');
    this.fishBones.style.transformBox = 'view-box';
    this.fishBones.style.transform = FISH_HOME;

    this.fish.addEventListener('click', () => void this.feed());
    this.fish.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void this.feed();
      }
    });
    this.fish.addEventListener('pointerenter', () => {
      if (this.busy) return;
      this.cat.twitchEars();
      this.cat.lookAt(936, 672);
      this.dilate(true);
    });
    this.fish.addEventListener('pointerleave', () => {
      if (!this.busy) this.dilate(false);
    });
  }

  get isBusy(): boolean {
    return this.busy;
  }

  /** Big round "food!" pupils. */
  private dilate(on: boolean): void {
    for (const p of this.pupils) {
      p.animate([{ r: p.getAttribute('r') ?? '12' }, { r: on ? '15.5' : '12' }], {
        duration: 220,
        fill: 'forwards',
        easing: 'ease-out',
      });
    }
  }

  async feed(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.fish.setAttribute('aria-disabled', 'true');
    this.fish.style.cursor = 'default';

    // 1. Notice the fish: eyes wide, tail goes nuts
    this.cat.setLidOverride(0);
    this.cat.excite(2600);
    this.dilate(true);
    this.cat.lookAt(936, 672);
    this.fish.classList.add('is-wiggling');
    await wait(420);
    this.fish.classList.remove('is-wiggling');

    // 2. Lift the fish to the mouth, paws come up, head dips
    const lift = animate(
      this.fishArt,
      [
        { transform: FISH_HOME },
        { transform: 'translate(934px, 634px) rotate(-26deg) scale(0.98)', offset: 0.45 },
        { transform: 'translate(930px, 574px) rotate(-8deg) scale(0.9)' },
      ],
      { duration: 620, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1.05)' },
    );
    const pawsUp = animateWithTwin(
      this.paws,
      [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(-6px, -74px)' }],
      { duration: 620, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1.05)' },
    );
    for (const h of [this.head, twinOf(this.head)]) {
      if (!(h instanceof SVGElement)) continue;
      h.style.transformBox = 'view-box';
      h.style.transformOrigin = '930px 560px';
    }
    const headDip = animateWithTwin(
      this.head,
      [{ transform: 'rotate(0deg) translate(0px, 0px)' }, { transform: 'rotate(7deg) translate(0px, 10px)' }],
      { duration: 620, easing: 'ease-in-out' },
    );
    await wait(360);
    this.setMouth('open');
    this.cat.setLidOverride(0.35);
    await Promise.all([lift, pawsUp, headDip]);

    // 3. Chomp chomp chomp, the fish shrinks each bite
    const scales = [0.7, 0.45, 0.18];
    const tilts = [-16, -2, -11];
    const pose = (sc: number, tilt: number) => `translate(930px, 574px) rotate(${tilt}deg) scale(${sc})`;
    for (let i = 0; i < scales.length; i++) {
      await wait(90);
      this.setMouth('closed');
      void animateWithTwin(
        this.head,
        [
          { transform: 'rotate(7deg) translate(0px, 10px)' },
          { transform: 'rotate(9deg) translate(0px, 16px)', offset: 0.4 },
          { transform: 'rotate(7deg) translate(0px, 10px)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
      void animate(
        this.fishArt,
        [{ transform: pose(i === 0 ? 0.9 : (scales[i - 1] as number), i === 0 ? -8 : (tilts[i - 1] as number)) }, { transform: pose(scales[i] as number, tilts[i] as number) }],
        { duration: 160, easing: 'ease-in' },
      );
      this.popNom(i);
      this.sparkle(2);
      await wait(190);
      if (i < scales.length - 1) this.setMouth('open');
    }

    // 4. Gone. Happy squint, lick, bones tumble away
    this.fishArt.style.opacity = '0';
    this.setMouth('closed');
    this.cat.setLidOverride(1); // content "︶ ︶" eyes
    void animateWithTwin(
      this.head,
      [{ transform: 'rotate(7deg) translate(0px, 10px)' }, { transform: 'rotate(-4deg) translate(0px, -6px)' }, { transform: 'rotate(0deg) translate(0px, 0px)' }],
      { duration: 700, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
    void animateWithTwin(this.paws, [{ transform: 'translate(-6px, -74px)' }, { transform: 'translate(0px, 0px)' }], {
      duration: 700,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    });
    this.lick();
    this.sparkle(9);
    void this.tumbleBones();
    await wait(1100);

    await this.onReward();

    // 5. Reset: a new fish pops back into the paws
    await this.respawnFish();
    this.cat.setLidOverride(null);
    this.dilate(false);
    this.busy = false;
    this.fish.removeAttribute('aria-disabled');
    this.fish.style.cursor = '';
  }

  private setMouth(state: 'open' | 'closed'): void {
    this.mouthOpen.style.opacity = state === 'open' ? '1' : '0';
    this.mouthClosed.style.opacity = state === 'open' ? '0' : '1';
  }

  private popNom(i: number): void {
    const texts = this.nom.querySelectorAll<SVGTextElement>('text');
    this.nom.style.opacity = '1';
    const t = texts[i % texts.length];
    if (!t) return;
    t.style.transformBox = 'fill-box';
    t.style.transformOrigin = 'center';
    void animate(
      t,
      [
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1.25)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 360, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
    if (i === 2) {
      setTimeout(() => {
        void animate(this.nom, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 500 }).then(() => {
          for (const tt of texts) tt.style.transform = 'scale(0.2)';
        });
      }, 300);
    }
  }

  private lick(): void {
    const svgNS = 'http://www.w3.org/2000/svg';
    const tongue = document.createElementNS(svgNS, 'path');
    tongue.setAttribute('d', 'M 920 560 c 2 10, 14 10, 16 0 v -2 h -16 z');
    tongue.setAttribute('fill', '#FF7BAC');
    tongue.setAttribute('stroke', '#fff');
    tongue.setAttribute('stroke-width', '2.5');
    tongue.style.transformBox = 'view-box';
    tongue.style.transformOrigin = '928px 558px';
    this.head.appendChild(tongue);
    void animate(
      tongue,
      [
        { transform: 'scaleY(0)' },
        { transform: 'scaleY(1.4) translateX(-5px)', offset: 0.4 },
        { transform: 'scaleY(1.2) translateX(6px)', offset: 0.7 },
        { transform: 'scaleY(0)' },
      ],
      { duration: 650, easing: 'ease-in-out' },
    ).then(() => tongue.remove());
  }

  private async tumbleBones(): Promise<void> {
    this.fishBones.style.opacity = '1';
    await animate(
      this.fishBones,
      [
        { transform: 'translate(930px, 590px) rotate(-8deg) scale(0.6)', opacity: 0 },
        { transform: 'translate(1010px, 700px) rotate(-10deg) scale(0.85)', opacity: 1, offset: 0.35 },
        { transform: 'translate(1070px, 905px) rotate(40deg) scale(0.8)', opacity: 1, offset: 0.85 },
        { transform: 'translate(1080px, 930px) rotate(48deg) scale(0.8)', opacity: 0 },
      ],
      { duration: 1300, easing: 'cubic-bezier(0.4, 0, 0.8, 0.4)' },
    );
    this.fishBones.style.opacity = '0';
    this.fishBones.style.transform = FISH_HOME;
  }

  private sparkle(count: number): void {
    const svgNS = 'http://www.w3.org/2000/svg';
    this.burst.style.opacity = '1';
    const colors = ['#FF7BAC', '#FFE08A', '#8FE3CF', '#fff'];
    for (let i = 0; i < count; i++) {
      const isHeart = Math.random() < 0.45;
      const el = document.createElementNS(svgNS, 'path');
      el.setAttribute(
        'd',
        isHeart
          ? 'M 0 6 C -10 -4, -8 -14, 0 -8 C 8 -14, 10 -4, 0 6 Z'
          : 'M 0 -9 l 2.5 6.5 l 6.5 2.5 l -6.5 2.5 l -2.5 6.5 l -2.5 -6.5 l -6.5 -2.5 l 6.5 -2.5 z',
      );
      el.setAttribute('fill', colors[Math.floor(Math.random() * colors.length)] ?? '#fff');
      const angle = -Math.PI * 0.95 + Math.random() * Math.PI * 0.9;
      const dist = 70 + Math.random() * 110;
      const x0 = 930 + (Math.random() - 0.5) * 60;
      const y0 = 520 + (Math.random() - 0.5) * 40;
      const x1 = x0 + Math.cos(angle) * dist;
      const y1 = y0 + Math.sin(angle) * dist - 30;
      el.style.transformBox = 'view-box';
      this.burst.appendChild(el);
      void animate(
        el,
        [
          { transform: `translate(${x0}px, ${y0}px) scale(0.2) rotate(0deg)`, opacity: 0 },
          { transform: `translate(${(x0 + x1) / 2}px, ${(y0 + y1) / 2 - 20}px) scale(1.2) rotate(90deg)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${x1}px, ${y1 + 30}px) scale(0.6) rotate(200deg)`, opacity: 0 },
        ],
        { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
      ).then(() => el.remove());
    }
  }

  private async respawnFish(): Promise<void> {
    this.fishArt.style.transform = `${FISH_HOME} scale(0)`;
    this.fishArt.style.opacity = '1';
    this.cat.setLidOverride(0);
    this.cat.twitchEars();
    await animate(
      this.fishArt,
      [{ transform: `${FISH_HOME} scale(0)` }, { transform: `${FISH_HOME} scale(1.15)`, offset: 0.7 }, { transform: FISH_HOME }],
      { duration: 520, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
  }
}
