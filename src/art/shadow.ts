/**
 * The cats' floor shadow, rendered once from a static silhouette.
 *
 * The live scene used to carry `filter="url(#floor-shadow)"` on both cat groups.
 * An SVG filter re-runs over its whole region whenever anything inside changes,
 * and the cats change every frame (pupils, lids, breathing, tails), so two
 * ~3-megapixel blurs ran 60 times a second on the GPU. Here the same blur is
 * applied to a copy of the silhouettes in a separate <svg> that never changes,
 * so the browser rasterises it once and composites the texture for free.
 *
 * The copy does not breathe or sway; at 18% alpha and 10 units of blur the
 * difference is not visible.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Elements whose outline makes up each cat's silhouette (ids in scene.ts). */
const WHITE_PARTS = [
  'white-tail',
  'white-body-shape',
  'white-paw-1',
  'white-paw-2',
  'white-ear-left',
  'white-ear-right',
  'white-head-shape',
  'yarn-small',
  'yarn-big-circle',
];

const BLACK_PARTS = [
  'black-tail',
  'black-hind',
  'black-body-shape',
  'black-ear-left',
  'black-ear-right',
  'black-head-shape',
  'black-paw-left',
  'black-paw-right',
];

/** The sticker halo dilates the black cat by this much; the shadow follows the halo. */
const HALO_RADIUS = 11;

function flatten(node: Element, haloStroke: number): void {
  node.removeAttribute('id');
  node.removeAttribute('class');
  node.removeAttribute('style');
  node.removeAttribute('filter');
  node.removeAttribute('opacity');
  if (node.tagName === 'g') {
    for (const child of Array.from(node.children)) flatten(child, haloStroke);
    return;
  }
  // Only alpha matters to the filter. Solid black everywhere the source painted.
  const fill = node.getAttribute('fill');
  if (fill !== 'none') node.setAttribute('fill', '#000');
  const hasStroke = node.hasAttribute('stroke');
  if (hasStroke || haloStroke) {
    node.setAttribute('stroke', '#000');
    node.setAttribute('stroke-linejoin', 'round');
    node.setAttribute('stroke-linecap', 'round');
    const base = Number(node.getAttribute('stroke-width') ?? 0);
    node.setAttribute('stroke-width', String(base + haloStroke));
  }
}

function cloneParts(ids: string[], haloStroke: number): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  for (const id of ids) {
    const src = document.getElementById(id);
    if (!src) continue;
    const copy = src.cloneNode(true) as Element;
    flatten(copy, haloStroke);
    g.appendChild(copy);
  }
  return g;
}

/**
 * Build the shadow layer from the live scene and insert it behind the scene SVG.
 * Must run after the scene SVG is in the document.
 */
export function mountShadowLayer(scene: SVGSVGElement): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'scene-shadow');
  svg.setAttribute('viewBox', scene.getAttribute('viewBox') ?? '0 0 1200 960');
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = `
    <filter id="floor-shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
      <feOffset dy="18" />
      <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
    </filter>`;
  svg.appendChild(defs);

  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('filter', 'url(#floor-shadow)');
  layer.appendChild(cloneParts(WHITE_PARTS, 0));
  layer.appendChild(cloneParts(BLACK_PARTS, HALO_RADIUS * 2));
  svg.appendChild(layer);

  scene.parentElement?.insertBefore(svg, scene);
  return svg;
}
