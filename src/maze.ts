/**
 * The yarn maze. A recursive-backtracker grid; the player drags the loose end of
 * the yarn from the start cell to the sleepy cat at the goal. The string can only
 * pass through open walls and unwinds when you backtrack.
 */

export interface Cell {
  c: number;
  r: number;
  walls: [boolean, boolean, boolean, boolean]; // N E S W
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const CELL = 64;
const PAD = 40;

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function generate(cols: number, rows: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ c, r, walls: [true, true, true, true] as Cell['walls'] })),
  );
  const visited = new Set<string>();
  const key = (c: number, r: number) => `${c},${r}`;
  const stack: Cell[] = [];
  const start = grid[rows - 1]?.[0];
  if (!start) return grid;
  stack.push(start);
  visited.add(key(start.c, start.r));

  while (stack.length) {
    const cur = stack[stack.length - 1] as Cell;
    const options: Array<[number, Cell]> = [];
    DIRS.forEach(([dx, dy], i) => {
      const nc = cur.c + dx;
      const nr = cur.r + dy;
      const n = grid[nr]?.[nc];
      if (n && !visited.has(key(nc, nr))) options.push([i, n]);
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [dir, next] = options[Math.floor(Math.random() * options.length)] as [number, Cell];
    cur.walls[dir] = false;
    next.walls[(dir + 2) % 4] = false;
    visited.add(key(next.c, next.r));
    stack.push(next);
  }
  return grid;
}

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

export interface MazeCallbacks {
  onProgress(cellsVisited: number, total: number): void;
  onSolved(): void;
  onBump(): void;
}

export class YarnMaze {
  readonly svg: SVGSVGElement;
  private grid: Cell[][];
  private path: Cell[] = [];
  private tip = { x: 0, y: 0 };
  private lastPointer: { x: number; y: number } | null = null;
  private solved = false;
  private active = false;
  /** Screen -> maze-space matrix, refreshed on activation and resize instead of per pointer event. */
  private toLocal: DOMMatrix | null = null;
  private redrawQueued = false;

  private readonly stringOutline = el('path', { class: 'maze-string maze-string--outline' });
  private readonly stringMain = el('path', { class: 'maze-string' });
  private readonly stringSheen = el('path', { class: 'maze-string maze-string--sheen' });
  private readonly stringEndPos = el('g');
  private readonly stringEnd = el('g', { class: 'maze-string-end' });
  private readonly startBall = el('g', { class: 'maze-start' });
  private startBallInner: SVGGElement | null = null;
  private readonly goalPos = el('g');
  private readonly goalCat = el('g', { class: 'maze-goal' });
  private bumpCooldown = 0;

  constructor(
    private readonly cols: number,
    private readonly rows: number,
    private readonly cb: MazeCallbacks,
  ) {
    this.grid = generate(cols, rows);
    const w = cols * CELL + PAD * 2;
    const h = rows * CELL + PAD * 2;
    this.svg = el('svg', { class: 'maze-svg', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet' });
    this.build();
    this.reset();

    this.svg.addEventListener('pointermove', (e) => this.onPointer(e));
    this.svg.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.svg.addEventListener('pointerleave', () => {
      this.lastPointer = null;
    });
    window.addEventListener('resize', () => {
      this.toLocal = null;
    });
  }

  get start(): Cell {
    return this.grid[this.rows - 1]?.[0] as Cell;
  }

  get goal(): Cell {
    return this.grid[0]?.[this.cols - 1] as Cell;
  }

  setActive(on: boolean): void {
    this.active = on;
    this.toLocal = null;
    if (!on) this.lastPointer = null;
  }

  /** Redraw the thread at most once per animation frame, however many pointer events arrive. */
  private queueRedraw(): void {
    if (this.redrawQueued) return;
    this.redrawQueued = true;
    requestAnimationFrame(() => {
      this.redrawQueued = false;
      this.drawString();
    });
  }

  /** New layout, string rewound. */
  reset(): void {
    this.grid = generate(this.cols, this.rows);
    this.solved = false;
    this.path = [this.start];
    const s = this.center(this.start);
    this.tip = { x: s.x, y: s.y };
    this.drawWalls();
    this.placeMarkers();
    this.drawString();
  }

  private center(cell: Cell): { x: number; y: number } {
    return { x: PAD + cell.c * CELL + CELL / 2, y: PAD + cell.r * CELL + CELL / 2 };
  }

  private cellAt(x: number, y: number): Cell | null {
    const c = Math.floor((x - PAD) / CELL);
    const r = Math.floor((y - PAD) / CELL);
    return this.grid[r]?.[c] ?? null;
  }

  private wallsLayer = el('g', { class: 'maze-walls' });
  private floorLayer = el('g', { class: 'maze-floor' });

  private build(): void {
    // floor: soft cream squares with a faint checker so corridors read as "aisles"
    this.svg.appendChild(this.floorLayer);
    this.svg.appendChild(this.wallsLayer);
    this.svg.appendChild(this.startBall);
    this.goalPos.appendChild(this.goalCat);
    this.svg.appendChild(this.goalPos);
    this.svg.appendChild(this.stringOutline);
    this.svg.appendChild(this.stringMain);
    this.svg.appendChild(this.stringSheen);
    this.stringEndPos.appendChild(this.stringEnd);
    this.svg.appendChild(this.stringEndPos);

    // knot at the tip of the string
    this.stringEnd.appendChild(el('circle', { r: 11, fill: '#E8558E', stroke: '#1B1B1B', 'stroke-width': 3 }));
    this.stringEnd.appendChild(el('circle', { r: 4, cx: -3, cy: -3, fill: '#FFD1E3' }));
  }

  private drawWalls(): void {
    this.wallsLayer.replaceChildren();
    this.floorLayer.replaceChildren();

    const w = this.cols * CELL;
    const h = this.rows * CELL;
    this.floorLayer.appendChild(el('rect', { x: PAD, y: PAD, width: w, height: h, rx: 14, fill: '#FFF3E4' }));
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if ((r + c) % 2 === 0) continue;
        this.floorLayer.appendChild(
          el('rect', { x: PAD + c * CELL + 6, y: PAD + r * CELL + 6, width: CELL - 12, height: CELL - 12, rx: 10, fill: '#FFE9D2', opacity: 0.7 }),
        );
      }
    }

    const segs: string[] = [];
    for (const row of this.grid) {
      for (const cell of row) {
        const x = PAD + cell.c * CELL;
        const y = PAD + cell.r * CELL;
        if (cell.walls[0]) segs.push(`M ${x} ${y} h ${CELL}`);
        if (cell.walls[3]) segs.push(`M ${x} ${y} v ${CELL}`);
        if (cell.c === this.cols - 1 && cell.walls[1]) segs.push(`M ${x + CELL} ${y} v ${CELL}`);
        if (cell.r === this.rows - 1 && cell.walls[2]) segs.push(`M ${x} ${y + CELL} h ${CELL}`);
      }
    }
    const d = segs.join(' ');
    this.wallsLayer.appendChild(el('path', { class: 'maze-wall maze-wall--shadow', d, transform: 'translate(3 4)' }));
    this.wallsLayer.appendChild(el('path', { class: 'maze-wall', d }));
  }

  private placeMarkers(): void {
    const s = this.center(this.start);
    const g = this.center(this.goal);

    // --- start: a small pink yarn ball ---
    this.startBall.replaceChildren();
    this.startBall.setAttribute('transform', `translate(${s.x} ${s.y})`);
    const ball = el('g', { class: 'maze-start-ball' });
    this.startBallInner = ball;
    ball.appendChild(el('circle', { r: 22, fill: '#FF7BAC', stroke: '#1B1B1B', 'stroke-width': 4 }));
    const wraps = el('g', { fill: 'none', stroke: '#E8558E', 'stroke-width': 3, 'stroke-linecap': 'round' });
    for (const d of ['M -18 -6 Q 0 -16 18 -5', 'M -19 4 Q 0 -6 19 5', 'M -14 13 Q 0 4 14 13', 'M -8 -20 Q -12 0 -6 20', 'M 8 -20 Q 14 0 6 20']) {
      wraps.appendChild(el('path', { d }));
    }
    ball.appendChild(wraps);
    ball.appendChild(el('path', { d: 'M -12 -12 Q 0 -18 10 -12', fill: 'none', stroke: '#FFD1E3', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    this.startBall.appendChild(ball);

    // --- goal: sleepy white cat face ---
    this.goalCat.replaceChildren();
    this.goalPos.setAttribute('transform', `translate(${g.x} ${g.y})`);
    const face = el('g');
    face.appendChild(el('path', { d: 'M -20 -10 L -24 -30 L -6 -20 Z', fill: '#FFFDF8', stroke: '#1B1B1B', 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    face.appendChild(el('path', { d: 'M 20 -10 L 24 -30 L 6 -20 Z', fill: '#FFFDF8', stroke: '#1B1B1B', 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    face.appendChild(el('ellipse', { rx: 24, ry: 20, cy: -2, fill: '#FFFDF8', stroke: '#1B1B1B', 'stroke-width': 4 }));
    face.appendChild(el('path', { d: 'M -19 -13 L -20 -23 L -11 -17 Z', fill: '#FF7BAC' }));
    face.appendChild(el('path', { d: 'M 19 -13 L 20 -23 L 11 -17 Z', fill: '#FF7BAC' }));
    const eyes = el('g', { class: 'maze-goal-eyes', fill: 'none', stroke: '#1B1B1B', 'stroke-width': 3.2, 'stroke-linecap': 'round' });
    eyes.appendChild(el('path', { d: 'M -15 -2 q 5 5 10 0' }));
    eyes.appendChild(el('path', { d: 'M 5 -2 q 5 5 10 0' }));
    face.appendChild(eyes);
    face.appendChild(el('path', { d: 'M -3 5 L 3 5 L 0 8 Z', fill: '#FF7BAC' }));
    face.appendChild(el('ellipse', { cx: -15, cy: 6, rx: 5, ry: 3, fill: '#FFB3C7' }));
    face.appendChild(el('ellipse', { cx: 15, cy: 6, rx: 5, ry: 3, fill: '#FFB3C7' }));
    this.goalCat.appendChild(face);
    const z = el('text', { x: 22, y: -30, 'font-size': 16, 'font-family': "'Mochiy Pop One', sans-serif", fill: '#1B1B1B', transform: 'rotate(-10 22 -30)' });
    z.textContent = 'z';
    this.goalCat.appendChild(z);
  }

  private onPointer(e: PointerEvent): void {
    if (!this.active || this.solved) return;
    if (!this.toLocal) {
      const ctm = this.svg.getScreenCTM();
      if (!ctm) return;
      this.toLocal = ctm.inverse();
    }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(this.toLocal);

    // Walk from the last pointer position to this one in small steps so quick
    // moves still follow the corridors instead of teleporting.
    const from = this.lastPointer ?? { x: p.x, y: p.y };
    const dist = Math.hypot(p.x - from.x, p.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / (CELL / 4)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.stepTo(from.x + (p.x - from.x) * t, from.y + (p.y - from.y) * t);
      if (this.solved) break;
    }
    this.lastPointer = { x: p.x, y: p.y };
    this.queueRedraw();
  }

  private stepTo(x: number, y: number): void {
    const head = this.path[this.path.length - 1] as Cell;
    const cell = this.cellAt(x, y);
    const now = performance.now();

    if (!cell) {
      // pointer outside the grid: tip stays clamped in the head cell
      this.clampTip(head, x, y);
      return;
    }

    if (cell === head) {
      this.clampTip(head, x, y);
      return;
    }

    const prev = this.path[this.path.length - 2];
    if (prev && cell === prev) {
      this.path.pop();
      this.clampTip(cell, x, y);
      this.cb.onProgress(this.path.length, this.cols * this.rows);
      return;
    }

    const dx = cell.c - head.c;
    const dy = cell.r - head.r;
    const adjacent = Math.abs(dx) + Math.abs(dy) === 1;
    if (adjacent) {
      const dir = DIRS.findIndex(([ddx, ddy]) => ddx === dx && ddy === dy);
      if (dir >= 0 && !head.walls[dir]) {
        // avoid crossing our own string: if the cell is already on the path, rewind to it
        const existing = this.path.indexOf(cell);
        if (existing >= 0) this.path.length = existing + 1;
        else this.path.push(cell);
        this.clampTip(cell, x, y);
        this.cb.onProgress(this.path.length, this.cols * this.rows);
        if (cell === this.goal) {
          this.solved = true;
          this.cb.onSolved();
        }
        return;
      }
    }

    // blocked by a wall (or too far away): tip presses against the wall
    this.clampTip(head, x, y);
    if (now > this.bumpCooldown) {
      this.bumpCooldown = now + 350;
      this.cb.onBump();
    }
  }

  private clampTip(cell: Cell, x: number, y: number): void {
    const c = this.center(cell);
    const half = CELL / 2 - 12;
    this.tip = {
      x: Math.max(c.x - half, Math.min(c.x + half, x)),
      y: Math.max(c.y - half, Math.min(c.y + half, y)),
    };
  }

  private drawString(): void {
    const pts = this.path.map((cell) => this.center(cell));
    pts.push(this.tip);

    // smooth the polyline a little so it reads like a soft thread
    let d = '';
    if (pts.length === 1) {
      const p0 = pts[0] as { x: number; y: number };
      d = `M ${p0.x} ${p0.y}`;
    } else {
      const p0 = pts[0] as { x: number; y: number };
      d = `M ${p0.x} ${p0.y}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i] as { x: number; y: number };
        const n = pts[i + 1] as { x: number; y: number };
        const mx = (p.x + n.x) / 2;
        const my = (p.y + n.y) / 2;
        d += ` Q ${p.x} ${p.y} ${mx} ${my}`;
      }
      const last = pts[pts.length - 1] as { x: number; y: number };
      d += ` L ${last.x} ${last.y}`;
    }
    this.stringOutline.setAttribute('d', d);
    this.stringMain.setAttribute('d', d);
    this.stringSheen.setAttribute('d', d);
    this.stringEndPos.setAttribute('transform', `translate(${this.tip.x} ${this.tip.y})`);

    // the start ball shrinks as the thread unwinds
    const used = Math.min(1, this.path.length / (this.cols * this.rows * 0.45));
    const ball = this.startBallInner;
    if (ball) ball.setAttribute('transform', `scale(${(1 - used * 0.45).toFixed(3)}) rotate(${(this.path.length * 23) % 360})`);
  }

  /** Shortest path from the current string head to the goal, as client-space points (for tests/demos). */
  solutionClientPoints(): Array<{ x: number; y: number }> {
    const head = this.path[this.path.length - 1] as Cell;
    const prev = new Map<Cell, Cell | null>([[head, null]]);
    const queue: Cell[] = [head];
    while (queue.length) {
      const cur = queue.shift() as Cell;
      if (cur === this.goal) break;
      DIRS.forEach(([dx, dy], i) => {
        if (cur.walls[i]) return;
        const n = this.grid[cur.r + dy]?.[cur.c + dx];
        if (n && !prev.has(n)) {
          prev.set(n, cur);
          queue.push(n);
        }
      });
    }
    const cells: Cell[] = [];
    for (let c: Cell | null | undefined = this.goal; c; c = prev.get(c)) cells.unshift(c);
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return [];
    return cells.map((cell) => {
      const { x, y } = this.center(cell);
      const pt = this.svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const p = pt.matrixTransform(ctm);
      return { x: p.x, y: p.y };
    });
  }

  /** Happy wake-up on the goal face. */
  wakeGoal(): void {
    const eyes = this.goalCat.querySelector<SVGGElement>('.maze-goal-eyes');
    if (!eyes) return;
    eyes.replaceChildren();
    eyes.appendChild(el('circle', { cx: -10, cy: -3, r: 4.5, fill: '#1B1B1B', stroke: 'none' }));
    eyes.appendChild(el('circle', { cx: 10, cy: -3, r: 4.5, fill: '#1B1B1B', stroke: 'none' }));
    eyes.appendChild(el('circle', { cx: -11.5, cy: -4.5, r: 1.6, fill: '#fff', stroke: 'none' }));
    eyes.appendChild(el('circle', { cx: 8.5, cy: -4.5, r: 1.6, fill: '#fff', stroke: 'none' }));
    this.goalCat.querySelector('text')?.remove();
  }
}
