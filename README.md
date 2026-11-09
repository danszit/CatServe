# CatServe

Two cats, two kinds of reward. A small konbini-styled web toy where a white cat and a
black cat curl together like a yin-yang:

- **Instant** — the black cat (Nori) holds a fish. Click it and she eats it on the
  spot: wide eyes, paws lift the fish to her mouth, three shrinking bites with *NOM! NOM!*,
  a lick, a shower of sparkles, and the skeleton tumbles away. Then a cat video plays.
- **Delayed** — the white cat (Mochi) is dozing next to her yarn. Grab the loose
  end (the PULL ME tag) and a paper maze unfolds origami-style beside the cats, who slide over
  to make room. Lead the thread
  through the aisles to the sleepy cat at the far corner. The thread only passes through open
  walls, unwinds when you backtrack, and the big ball of yarn in the scene spins down as you
  pull. Reach her and she wakes up delighted. Then a cat video plays.

Both cats are alive while you wait: they breathe, blink (sometimes twice), swish their tails,
twitch their ears, and their eyes and faces follow your cursor. Hovering wakes the sleepy one.

Videos come from the YouTube playlist in `src/config.ts` (a random entry each time).

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks and writes dist/
npm run preview    # serves the production build
```

