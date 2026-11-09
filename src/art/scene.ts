/**
 * The yin-yang cat scene, hand-built as SVG.
 *
 * Coordinate space: 1200 x 960.
 *  - White cat ("Mochi") arcs over the top-left, head hanging bottom-left, yarn to her left.
 *  - Black cat ("Nori") lounges bottom-right, head upper-right, fish held in both paws.
 *
 * Every animated part has an id so the behaviour modules can grab it.
 *
 * Rendering notes (performance):
 *  - The scene is two stacked SVGs with the same viewBox. `shadowSVG` holds the soft floor
 *    shadow: a static silhouette of both cats run through a blur filter once, on its own
 *    compositor layer. `sceneSVG` holds the live, animated art and uses no filters at all,
 *    so a blink or a tail swish repaints a few vector paths instead of re-running two
 *    full-scene filter passes every frame.
 *  - The black cat's cream "sticker" halo used to be an feMorphology dilate of the whole cat.
 *    It is now a cream stroke twin of each silhouette part drawn under the ink. Twins of
 *    parts that move (tail, body, head, ears, paws) carry the same classes as the live part,
 *    or a `data-twin-of` attribute, so the behaviour code keeps them in step.
 */

const INK = '#1B1B1B';
const PINK = '#FF7BAC';
const PINK_DEEP = '#E8558E';
const BLUSH = '#FFB3C7';
const CREAM = '#FFFDF8';

/** Width of the cream halo around the black cat (the old dilate radius). */
const HALO = 11;

/** Silhouette geometry shared by the live art, its halo twins and the static shadow. */
const D = {
  whiteTail: 'M 690 180 C 830 130, 1030 160, 1112 270 C 1160 335, 1162 400, 1118 440',
  whiteBody: `M 365 575
        C 255 485, 290 290, 430 212
        C 545 150, 695 150, 805 205
        C 880 238, 916 288, 916 334
        C 918 362, 890 370, 870 356
        C 808 412, 720 458, 622 486
        C 552 506, 508 542, 492 602 Z`,
  whitePaw1: 'M 716 306 C 730 280, 776 278, 790 306 C 798 326, 786 350, 752 350 C 720 350, 708 328, 716 306 Z',
  whitePaw2: 'M 846 352 C 856 326, 902 326, 914 354 C 922 376, 906 398, 876 398 C 848 398, 836 374, 846 352 Z',
  whiteEarLeft: 'M 318 712 L 296 772 L 362 740 Z',
  whiteEarRight: 'M 500 712 L 496 778 L 440 742 Z',
  whiteHead: `M 338 586
        C 296 612, 286 690, 322 722
        C 350 750, 385 760, 420 760
        C 456 760, 492 748, 512 712
        C 534 672, 526 616, 494 592
        C 462 566, 378 562, 338 586 Z`,
  whiteWhiskers: ['M 322 652 L 282 640', 'M 320 672 L 278 674', 'M 516 656 L 556 644', 'M 518 676 L 560 678'],
  yarnThread: 'M 146 636 C 110 664, 86 626, 60 652 C 44 668, 46 690, 62 694',

  blackTail: 'M 662 896 C 560 940, 420 905, 300 862 C 232 836, 176 846, 142 884',
  blackHind: 'M 648 936 C 660 910, 708 912, 714 940 C 718 962, 698 978, 676 976 C 650 974, 640 956, 648 936 Z',
  blackBody: `M 866 574
          C 790 598, 700 660, 640 732
          C 582 802, 596 876, 660 910
          C 735 948, 860 936, 926 882
          C 1004 820, 1056 730, 1066 650
          C 1072 606, 1040 580, 1000 580 Z`,
  blackEarLeft: 'M 864 452 L 838 386 L 912 422 Z',
  blackEarRight: 'M 1000 448 L 996 380 L 942 424 Z',
  blackHead: `M 858 520
          C 852 470, 884 430, 930 426
          C 980 422, 1020 456, 1022 506
          C 1024 556, 992 596, 934 598
          C 880 600, 862 568, 858 520 Z`,
  blackWhiskers: ['M 850 534 L 808 526', 'M 852 552 L 810 560', 'M 1010 528 L 1052 518', 'M 1010 546 L 1052 554'],
  blackPawLeft: 'M 838 694 C 842 668, 888 664, 898 690 C 904 710, 888 730, 864 730 C 842 730, 832 714, 838 694 Z',
  blackPawRight: 'M 982 676 C 986 650, 1032 646, 1042 672 C 1048 692, 1032 712, 1008 712 C 986 712, 976 696, 982 676 Z',

  fishTailFin: 'M 48 0 L 86 -30 C 80 -10, 80 10, 86 30 Z',
  fishBody: 'M -78 0 C -62 -30, -10 -36, 30 -22 C 46 -14, 54 -6, 56 0 C 54 6, 46 14, 30 22 C -10 36, -62 30, -78 0 Z',
  fishDorsal: 'M -30 -26 C -18 -44, 6 -44, 18 -28',
} as const;

const paths = (ds: readonly string[], attrs = '') => ds.map((d) => `<path d="${d}" ${attrs}/>`).join('');

/**
 * Cream halo under the black cat. Each piece is the silhouette part with a cream stroke
 * HALO units wider than the part's own outline, so the union matches the old dilate.
 * Moving parts carry the same animation classes as the live parts (CSS keeps them in
 * sync) or a data-twin-of hook (scripted sequences animate both).
 */
const blackHalo = /* html */ `
    <g id="black-halo" class="halo" aria-hidden="true" fill="${CREAM}" stroke="${CREAM}" stroke-width="${HALO * 2}" stroke-linejoin="round" stroke-linecap="round" pointer-events="none">
      <g class="tail tail--black"><path d="${D.blackTail}" fill="none" stroke-width="${50 + HALO * 2}" /></g>
      <path d="${D.blackHind}" />
      <g class="body body--black"><path d="${D.blackBody}" /></g>
      <g id="black-head-halo" class="head" data-twin-of="black-head">
        <path class="ear ear--black" data-twin-of="black-ear-left" d="${D.blackEarLeft}" />
        <path class="ear ear--black" data-twin-of="black-ear-right" d="${D.blackEarRight}" />
        <path d="${D.blackHead}" />
        <g fill="none" stroke-width="${4 + HALO * 2}">${paths(D.blackWhiskers)}</g>
      </g>
      <g id="black-paws-halo" data-twin-of="black-paws" stroke-width="${4 + HALO * 2}">
        <path d="${D.blackPawLeft}" /><path d="${D.blackPawRight}" />
      </g>
    </g>`;

/**
 * Static floor shadow for both cats, rendered once. The silhouettes are the resting pose;
 * the shadow is soft and faint enough (blur 10, 18% ink, 18 units down) that idle motion
 * of the live parts above it is not noticeable.
 */
export const shadowSVG = /* html */ `
<svg class="scene-shadow" viewBox="10 110 1170 880" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <filter id="floor-shadow" x="-15%" y="-15%" width="130%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
      <feOffset dy="18" result="blur" />
      <feComponentTransfer in="blur"><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
    </filter>
  </defs>
  <g filter="url(#floor-shadow)" fill="${INK}" stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">
    <path d="${D.whiteTail}" fill="none" stroke-width="62" />
    <path d="${D.whiteBody}" stroke-width="7" />
    <path d="${D.whitePaw1}" stroke-width="7" /><path d="${D.whitePaw2}" stroke-width="7" />
    <path d="${D.whiteEarLeft}" stroke-width="7" /><path d="${D.whiteEarRight}" stroke-width="7" />
    <path d="${D.whiteHead}" stroke-width="7" />
    <g fill="none" stroke-width="4" opacity="0.85">${paths(D.whiteWhiskers)}</g>
    <circle cx="238" cy="438" r="44" stroke-width="6" /><circle cx="190" cy="588" r="64" stroke-width="6" />
    <path d="${D.yarnThread}" fill="none" stroke-width="6" />
    <circle cx="66" cy="694" r="18" fill="none" stroke-width="3" stroke-dasharray="4 7" />
    <circle cx="66" cy="694" r="8" stroke-width="3" />
    <rect x="-6" y="-20" width="98" height="30" rx="8" stroke-width="3" transform="translate(40 740) rotate(-6)" />
  </g>
  <g filter="url(#floor-shadow)" fill="${INK}" stroke="${INK}" stroke-width="${HALO * 2}" stroke-linejoin="round" stroke-linecap="round">
    <path d="${D.blackTail}" fill="none" stroke-width="${50 + HALO * 2}" />
    <path d="${D.blackHind}" /><path d="${D.blackBody}" />
    <path d="${D.blackEarLeft}" /><path d="${D.blackEarRight}" /><path d="${D.blackHead}" />
    <g fill="none" stroke-width="${4 + HALO * 2}">${paths(D.blackWhiskers)}</g>
    <g stroke-width="${4 + HALO * 2}"><path d="${D.blackPawLeft}" /><path d="${D.blackPawRight}" /></g>
    <g transform="translate(936 672) rotate(-14)" stroke-width="5">
      <path d="${D.fishTailFin}" /><path d="${D.fishBody}" /><path d="${D.fishDorsal}" stroke-width="4" />
    </g>
  </g>
</svg>
`;

export const sceneSVG = /* html */ `
<svg id="scene-svg" class="scene-svg" viewBox="10 110 1170 880" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="A white cat and a black cat curled together like a yin-yang">
  <defs>
    <radialGradient id="fish-sheen" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#F3FAFF" />
      <stop offset="0.55" stop-color="#CFE3EE" />
      <stop offset="1" stop-color="#9DBFCF" />
    </radialGradient>
    <linearGradient id="yarn-shade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF8FBB" />
      <stop offset="1" stop-color="#E8558E" />
    </linearGradient>
    <clipPath id="clip-eye-left-white"><circle cx="383" cy="657" r="19" /></clipPath>
    <clipPath id="clip-eye-right-white"><circle cx="455" cy="662" r="19" /></clipPath>
    <clipPath id="clip-eye-left-black"><circle cx="897" cy="502" r="21" /></clipPath>
    <clipPath id="clip-eye-right-black"><circle cx="958" cy="494" r="21" /></clipPath>
  </defs>

  <!-- ============================ WHITE CAT ============================ -->
  <g id="white-cat" class="cat cat--white">

    <!-- Zzz (she's dozing) -->
    <g id="zzz" class="zzz" font-family="'Mochiy Pop One', 'M PLUS Rounded 1c', sans-serif" fill="${INK}">
      <text class="zzz-1" x="118" y="470" font-size="30" transform="rotate(-12 118 470)">z</text>
      <text class="zzz-2" x="92"  y="432" font-size="38" transform="rotate(-10 92 432)">z</text>
      <text class="zzz-3" x="60"  y="386" font-size="48" transform="rotate(-8 60 386)">Z</text>
    </g>

    <!-- Tail (drawn first so the body overlaps its root) -->
    <g id="white-tail" class="tail tail--white">
      <path d="${D.whiteTail}" fill="none" stroke="${INK}" stroke-width="62" stroke-linecap="round" />
      <path d="${D.whiteTail}" fill="none" stroke="${CREAM}" stroke-width="48" stroke-linecap="round" />
    </g>

    <!-- Body -->
    <g id="white-body" class="body body--white">
      <path id="white-body-shape" d="${D.whiteBody}" fill="${CREAM}" stroke="${INK}" stroke-width="7" stroke-linejoin="round" />
      <!-- fur accents -->
      <path d="M 560 238 C 600 220, 640 222, 668 246" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" />
      <path d="M 490 340 C 520 318, 555 318, 578 338" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.7" />
      <path d="M 548 330 c 10 -16, 26 -20, 38 -10" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.7" />

      <!-- hanging paws -->
      <g id="white-paw-1" class="paw">
        <path d="${D.whitePaw1}" fill="${CREAM}" stroke="${INK}" stroke-width="7" stroke-linejoin="round" />
        <path d="M 740 346 v -14 M 758 348 v -16 M 776 340 v -14" stroke="${INK}" stroke-width="5" stroke-linecap="round" />
      </g>
      <g id="white-paw-2" class="paw">
        <path d="${D.whitePaw2}" fill="${CREAM}" stroke="${INK}" stroke-width="7" stroke-linejoin="round" />
        <path d="M 866 394 v -14 M 884 396 v -16 M 902 388 v -14" stroke="${INK}" stroke-width="5" stroke-linecap="round" />
      </g>
    </g>

    <!-- Head (upside down: ears point to the floor) -->
    <g id="white-head" class="head head--white">
      <g id="white-ears">
        <path id="white-ear-left" class="ear ear--white" d="${D.whiteEarLeft}" fill="${CREAM}" stroke="${INK}" stroke-width="7" stroke-linejoin="round" />
        <path id="white-ear-right" class="ear ear--white" d="${D.whiteEarRight}" fill="${CREAM}" stroke="${INK}" stroke-width="7" stroke-linejoin="round" />
      </g>
      <path id="white-head-shape" d="${D.whiteHead}" fill="${CREAM}" stroke="${INK}" stroke-width="7" stroke-linejoin="round" />
      <!-- inner ears -->
      <path d="M 322 724 L 310 756 L 346 740 Z" fill="${PINK}" />
      <path d="M 496 724 L 494 760 L 460 740 Z" fill="${PINK}" />
      <!-- head curl (like the reference) -->
      <path d="M 400 586 c -8 -14, -26 -14, -30 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" />

      <!-- face -->
      <g id="white-face" class="face">
        <ellipse cx="338" cy="690" rx="16" ry="10" fill="${BLUSH}" opacity="0.9" />
        <ellipse cx="500" cy="694" rx="16" ry="10" fill="${BLUSH}" opacity="0.9" />

        <!-- mouth & nose sit ABOVE the eyes because she's upside down -->
        <path id="white-mouth" d="M 406 612 q 7 -9 14 0 q 7 -9 14 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" />
        <path id="white-nose" d="M 412 624 L 428 624 L 420 613 Z" fill="${PINK}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" />

        <g id="white-eyes" class="eyes">
          <g id="white-eye-left" class="eye" data-cx="383" data-cy="657">
              <circle cx="383" cy="657" r="19" fill="#fff" />
              <g clip-path="url(#clip-eye-left-white)">
                <circle class="pupil" cx="383" cy="657" r="12" fill="${INK}" />
                <circle class="glint" cx="376" cy="650" r="4.5" fill="#fff" />
                <circle class="glint-small" cx="388" cy="663" r="2" fill="#fff" opacity="0.8" />
                <path class="lid" d="M 343 671 a 40 40 0 0 1 80 0 v 80 h -80 z" fill="${CREAM}" />
              </g>
              <circle class="outline" cx="383" cy="657" r="19" fill="none" stroke="${INK}" stroke-width="6" />
              <path class="lid-line" d="M 364 659 q 19 -16 38 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" opacity="0" />
            </g>
          <g id="white-eye-right" class="eye" data-cx="455" data-cy="662">
              <circle cx="455" cy="662" r="19" fill="#fff" />
              <g clip-path="url(#clip-eye-right-white)">
                <circle class="pupil" cx="455" cy="662" r="12" fill="${INK}" />
                <circle class="glint" cx="448" cy="655" r="4.5" fill="#fff" />
                <circle class="glint-small" cx="460" cy="668" r="2" fill="#fff" opacity="0.8" />
                <path class="lid" d="M 415 676 a 40 40 0 0 1 80 0 v 80 h -80 z" fill="${CREAM}" />
              </g>
              <circle class="outline" cx="455" cy="662" r="19" fill="none" stroke="${INK}" stroke-width="6" />
              <path class="lid-line" d="M 436 664 q 19 -16 38 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" opacity="0" />
            </g>
        </g>

        <g id="white-whiskers" class="whiskers" stroke="${INK}" stroke-width="4" stroke-linecap="round" opacity="0.85">
          ${paths(D.whiteWhiskers)}
        </g>
      </g>
    </g>

    <!-- Yarn: two balls + the loose end you can grab -->
    <g id="yarn" class="yarn">
      <g id="yarn-small" class="yarn-ball yarn-ball--small">
        <circle cx="238" cy="438" r="44" fill="url(#yarn-shade)" stroke="${INK}" stroke-width="6" />
        <g fill="none" stroke="${PINK_DEEP}" stroke-width="4.5" stroke-linecap="round" opacity="0.95">
          <path d="M 200 425 Q 238 405 276 428" /><path d="M 198 448 Q 240 430 278 452" />
          <path d="M 206 468 Q 242 452 272 470" />
          <path d="M 222 398 Q 212 440 228 480" /><path d="M 248 396 Q 262 438 248 480" />
        </g>
        <g fill="none" stroke="#FFD1E3" stroke-width="3" stroke-linecap="round" opacity="0.8">
          <path d="M 212 420 Q 240 404 262 418" />
        </g>
      </g>

      <g id="yarn-big" class="yarn-ball yarn-ball--big">
        <circle id="yarn-big-circle" cx="190" cy="588" r="64" fill="url(#yarn-shade)" stroke="${INK}" stroke-width="6" />
        <g fill="none" stroke="${PINK_DEEP}" stroke-width="5" stroke-linecap="round" opacity="0.95">
          <path d="M 132 568 Q 190 540 248 572" /><path d="M 128 596 Q 192 566 252 600" />
          <path d="M 136 624 Q 192 596 246 628" />
          <path d="M 164 530 Q 150 590 170 648" /><path d="M 204 528 Q 232 588 206 650" />
          <path d="M 184 526 Q 176 590 196 650" opacity="0.5" />
        </g>
        <g fill="none" stroke="#FFD1E3" stroke-width="3" stroke-linecap="round" opacity="0.85">
          <path d="M 150 560 Q 190 538 228 556" />
        </g>
      </g>

      <!-- the loose thread, its end is the grab handle -->
      <g id="yarn-thread" class="yarn-thread">
        <path id="yarn-thread-path" d="${D.yarnThread}" fill="none" stroke="${PINK}" stroke-width="6" stroke-linecap="round" />
        <g id="yarn-grab" class="yarn-grab" tabindex="0" role="button" aria-label="Grab the end of the yarn">
          <circle cx="66" cy="694" r="34" fill="transparent" />
          <circle class="yarn-grab-ring" cx="66" cy="694" r="18" fill="none" stroke="${PINK}" stroke-width="3" stroke-dasharray="4 7" />
          <circle class="yarn-grab-knot" cx="66" cy="694" r="8" fill="${PINK_DEEP}" stroke="${INK}" stroke-width="3" />
          <g class="yarn-grab-label" transform="translate(40 740) rotate(-6)">
            <rect x="-6" y="-20" width="98" height="30" rx="8" fill="${CREAM}" stroke="${INK}" stroke-width="3" />
            <text x="43" y="2" text-anchor="middle" font-family="'M PLUS Rounded 1c', sans-serif" font-weight="900" font-size="17" fill="${INK}" letter-spacing="1">PULL ME</text>
          </g>
        </g>
      </g>
    </g>
  </g>

  <!-- ============================ BLACK CAT ============================ -->
  <g id="black-cat" class="cat cat--black">
    ${blackHalo}
    <g id="black-ink">
      <!-- Tail first so the body sits on its root -->
      <g id="black-tail" class="tail tail--black">
        <path d="${D.blackTail}" fill="none" stroke="${INK}" stroke-width="50" stroke-linecap="round" />
        <path d="M 300 862 C 330 866, 352 874, 372 880" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.9" />
      </g>

      <!-- Hind paws (one peeks out below) -->
      <g id="black-hind" class="hind">
        <path d="${D.blackHind}" fill="${INK}" />
        <g class="pad" transform="translate(684 946)">
          <ellipse cx="0" cy="4" rx="9" ry="7.5" fill="${PINK}" />
          <circle cx="-9" cy="-6" r="3.6" fill="${PINK}" /><circle cx="0" cy="-9" r="3.6" fill="${PINK}" /><circle cx="9" cy="-6" r="3.6" fill="${PINK}" />
        </g>
      </g>

      <!-- Body -->
      <g id="black-body" class="body body--black">
        <path id="black-body-shape" d="${D.blackBody}" fill="${INK}" />
        <!-- hind leg crease, belly accents in white (like the reference) -->
        <path d="M 640 790 C 668 770, 706 774, 728 800" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" />
        <path d="M 660 848 C 690 836, 722 840, 742 862" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.8" />
        <path d="M 980 760 c 22 10, 32 32, 20 52" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.8" />
        <!-- second hind paw pad on the rump -->
        <g class="pad" transform="translate(626 876)">
          <ellipse cx="0" cy="4" rx="9" ry="7.5" fill="${PINK}" />
          <circle cx="-9" cy="-6" r="3.6" fill="${PINK}" /><circle cx="0" cy="-9" r="3.6" fill="${PINK}" /><circle cx="9" cy="-6" r="3.6" fill="${PINK}" />
        </g>
      </g>

      <!-- Head -->
      <g id="black-head" class="head head--black">
        <g id="black-ears">
          <path id="black-ear-left"  class="ear ear--black" d="${D.blackEarLeft}" fill="${INK}" />
          <path id="black-ear-right" class="ear ear--black" d="${D.blackEarRight}" fill="${INK}" />
        </g>
        <path id="black-head-shape" d="${D.blackHead}" fill="${INK}" />
        <path d="M 866 448 L 850 405 L 898 428 Z" fill="${PINK}" />
        <path d="M 996 444 L 992 400 L 952 428 Z" fill="${PINK}" />

        <g id="black-face" class="face">
          <g id="black-eyes" class="eyes">
            <g id="black-eye-left" class="eye" data-cx="897" data-cy="502">
              <circle cx="897" cy="502" r="21" fill="#fff" />
              <g clip-path="url(#clip-eye-left-black)">
                <circle class="pupil" cx="897" cy="502" r="12" fill="${INK}" />
                <circle class="glint" cx="890" cy="495" r="4.5" fill="#fff" />
                <circle class="glint-small" cx="902" cy="508" r="2" fill="#fff" opacity="0.8" />
                <path class="lid" d="M 857 488 a 40 40 0 0 0 80 0 v -80 h -80 z" fill="${INK}" />
              </g>
              <path class="lid-line" d="M 878 500 q 19 16 38 0" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" opacity="0" />
            </g>
            <g id="black-eye-right" class="eye" data-cx="958" data-cy="494">
              <circle cx="958" cy="494" r="21" fill="#fff" />
              <g clip-path="url(#clip-eye-right-black)">
                <circle class="pupil" cx="958" cy="494" r="12" fill="${INK}" />
                <circle class="glint" cx="951" cy="487" r="4.5" fill="#fff" />
                <circle class="glint-small" cx="963" cy="500" r="2" fill="#fff" opacity="0.8" />
                <path class="lid" d="M 918 480 a 40 40 0 0 0 80 0 v -80 h -80 z" fill="${INK}" />
              </g>
              <path class="lid-line" d="M 939 492 q 19 16 38 0" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" opacity="0" />
            </g>
          </g>
          <ellipse cx="866" cy="548" rx="14" ry="9" fill="${PINK_DEEP}" opacity="0.55" />
          <ellipse cx="1000" cy="542" rx="14" ry="9" fill="${PINK_DEEP}" opacity="0.55" />
          <path id="black-nose" d="M 919 540 L 937 540 L 928 551 Z" fill="${PINK}" />
          <g id="black-mouth" class="mouth">
            <path id="black-mouth-closed" d="M 914 560 q 7 9 14 0 q 7 9 14 0" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" />
            <g id="black-mouth-open" style="opacity:0">
              <path d="M 910 558 C 918 586, 940 586, 948 558 Z" fill="#B23B66" stroke="#fff" stroke-width="3" stroke-linejoin="round" />
              <path d="M 918 574 c 6 8, 14 8, 20 0 v 8 c -6 6, -14 6, -20 0 z" fill="${PINK}" />
            </g>
          </g>
          <g id="black-whiskers" class="whiskers" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.9">
            ${paths(D.blackWhiskers)}
          </g>
        </g>
      </g>

      <!-- Front paws + fish. Paws drawn as black blobs with white outline strokes for definition -->
      <g id="black-paws" class="paws">
        <g id="black-paw-left" class="paw">
          <path d="${D.blackPawLeft}" fill="${INK}" stroke="#fff" stroke-width="4" />
          <path d="M 854 724 v -12 M 868 726 v -14 M 882 722 v -12" stroke="#fff" stroke-width="4" stroke-linecap="round" />
        </g>
        <g id="black-paw-right" class="paw">
          <path d="${D.blackPawRight}" fill="${INK}" stroke="#fff" stroke-width="4" />
          <path d="M 998 706 v -12 M 1012 708 v -14 M 1026 704 v -12" stroke="#fff" stroke-width="4" stroke-linecap="round" />
        </g>
      </g>
    </g>

    <!-- Fish: outside the halo so it reads as a separate object -->
    <g id="fish" class="fish" tabindex="0" role="button" aria-label="Feed the fish to the black cat">
      <g id="fish-art" transform="translate(936 672) rotate(-14)">
        <!-- tail fin -->
        <path class="fish-tail" d="${D.fishTailFin}" fill="#8FB4C6" stroke="${INK}" stroke-width="5" stroke-linejoin="round" />
        <!-- body -->
        <path class="fish-body" d="${D.fishBody}" fill="url(#fish-sheen)" stroke="${INK}" stroke-width="5" stroke-linejoin="round" />
        <!-- back stripe -->
        <path d="M -60 -12 C -30 -30, 10 -30, 42 -14" fill="none" stroke="#7FA7BC" stroke-width="9" stroke-linecap="round" opacity="0.9" />
        <!-- dorsal fin -->
        <path d="${D.fishDorsal}" fill="#8FB4C6" stroke="${INK}" stroke-width="4" stroke-linejoin="round" />
        <!-- scales -->
        <g fill="none" stroke="#7FA7BC" stroke-width="2.5" opacity="0.8">
          <path d="M -30 -6 a 8 8 0 0 0 16 0" /><path d="M -12 -8 a 8 8 0 0 0 16 0" /><path d="M -22 8 a 8 8 0 0 0 16 0" /><path d="M -4 6 a 8 8 0 0 0 16 0" /><path d="M 14 -4 a 8 8 0 0 0 16 0" />
        </g>
        <!-- gill -->
        <path d="M -48 -14 c 10 8, 10 20, 0 28" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" opacity="0.6" />
        <!-- eye -->
        <circle cx="-60" cy="-4" r="7.5" fill="#fff" stroke="${INK}" stroke-width="3.5" />
        <circle class="fish-pupil" cx="-59" cy="-4" r="3.5" fill="${INK}" />
        <!-- mouth -->
        <path d="M -78 2 q 6 6 12 2" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" />
        <!-- sparkle -->
        <path class="fish-sparkle" d="M 40 -34 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" />
      </g>
      <!-- Fish skeleton revealed after eating -->
      <g id="fish-bones" transform="translate(936 672) rotate(-14)" style="opacity:0">
        <!-- ink outline pass, then cream on top so the skeleton reads on black fur and on peach -->
        <g fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
          <path d="M -70 0 H 50" /><path d="M 50 0 L 86 -26 M 50 0 L 86 26" />
          <path d="M -40 -16 V 16 M -20 -20 V 20 M 0 -20 V 20 M 20 -16 V 16" />
          <path d="M -70 0 C -82 -12, -98 -12, -104 0 C -98 12, -82 12, -70 0 Z" />
        </g>
        <g fill="none" stroke="${CREAM}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M -70 0 H 50" /><path d="M 50 0 L 86 -26 M 50 0 L 86 26" />
          <path d="M -40 -16 V 16 M -20 -20 V 20 M 0 -20 V 20 M 20 -16 V 16" />
          <path d="M -70 0 C -82 -12, -98 -12, -104 0 C -98 12, -82 12, -70 0 Z" fill="${CREAM}" />
        </g>
        <circle cx="-88" cy="-2" r="3.2" fill="${INK}" />
      </g>
      <circle class="fish-hit" cx="936" cy="672" r="92" fill="transparent" />
    </g>

    <!-- NOM! NOM! -->
    <g id="nom" class="nom" font-family="'Mochiy Pop One', 'M PLUS Rounded 1c', sans-serif" fill="${INK}" style="opacity:0">
      <text class="nom-1" x="1080" y="800" font-size="40" transform="rotate(-10 1080 800)">NOM!</text>
      <text class="nom-2" x="1098" y="846" font-size="40" transform="rotate(6 1098 846)">NOM!</text>
    </g>

    <!-- happy sparkle burst (hidden) -->
    <g id="burst" class="burst" style="opacity:0" fill="${PINK}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"></g>
  </g>
</svg>
`;
