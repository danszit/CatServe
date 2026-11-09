/** A shower of little paw prints, konbini colours. */

const COLORS = ['#FF7BAC', '#FFE08A', '#8FE3CF', '#9DD3F0', '#FFFDF8'];

const PAW = (fill: string) =>
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="${fill}" stroke="#1B1B1B" stroke-width="1.6" stroke-linejoin="round">` +
  `<ellipse cx="12" cy="15.5" rx="6" ry="5"/><circle cx="5" cy="9" r="2.6"/><circle cx="9.5" cy="5.5" r="2.6"/><circle cx="14.5" cy="5.5" r="2.6"/><circle cx="19" cy="9" r="2.6"/></g></svg>`;

let layer: HTMLDivElement | null = null;

export function confettiPaws(count: number): void {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'confetti';
    document.getElementById('app')?.appendChild(layer);
  }
  const host = layer;
  for (let i = 0; i < count; i++) {
    const paw = document.createElement('div');
    paw.className = 'confetti-paw';
    paw.innerHTML = PAW(COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#fff');
    paw.style.left = `${Math.random() * 100}%`;
    const size = 16 + Math.random() * 18;
    paw.style.width = `${size}px`;
    paw.style.height = `${size}px`;
    paw.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
    paw.style.animationDelay = `${Math.random() * 0.9}s`;
    host.appendChild(paw);
    paw.addEventListener('animationend', () => paw.remove(), { once: true });
  }
}
