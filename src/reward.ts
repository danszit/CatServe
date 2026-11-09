/**
 * The reward: a konbini-style overlay that plays a random video from the playlist.
 */
import { PLAYLIST_ID, PLAYLIST_URL } from './config';
import { wait } from './cats';
import { confettiPaws } from './confetti';

const $ = <T extends Element>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as unknown as T;
};

let apiPromise: Promise<typeof YT> | null = null;

function loadApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<typeof YT>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube API timed out')), 8000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      if (window.YT) resolve(window.YT);
      else reject(new Error('YouTube API missing'));
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('YouTube API blocked'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

export type RewardKind = 'instant' | 'delayed';

export class Reward {
  private readonly root = $<HTMLElement>('reward');
  private readonly playerHost = $<HTMLElement>('reward-player');
  private readonly fallback = $<HTMLElement>('reward-fallback');
  private readonly fallbackLink = $<HTMLAnchorElement>('reward-fallback-link');
  private readonly closeBtn = $<HTMLButtonElement>('reward-close');
  private player: YT.Player | null = null;
  private resolveClose: (() => void) | null = null;

  constructor() {
    this.fallbackLink.href = PLAYLIST_URL;
    this.closeBtn.addEventListener('click', () => this.close());
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.root.classList.contains('is-open')) this.close();
    });
  }

  /** Opens the overlay and resolves once the user closes it. */
  async open(kind: RewardKind): Promise<void> {
    this.fallback.hidden = true;
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    confettiPaws(kind === 'instant' ? 26 : 40);

    void this.mountPlayer();

    await new Promise<void>((resolve) => {
      this.resolveClose = resolve;
    });
  }

  close(): void {
    if (!this.root.classList.contains('is-open')) return;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.destroyPlayer();
    this.resolveClose?.();
    this.resolveClose = null;
  }

  private async mountPlayer(): Promise<void> {
    this.destroyPlayer();
    const mount = document.createElement('div');
    this.playerHost.appendChild(mount);

    let api: typeof YT;
    try {
      api = await loadApi();
    } catch {
      this.showFallback();
      return;
    }
    if (!this.root.classList.contains('is-open')) return;

    let randomised = false;
    let gotPlaylist = false;

    const randomise = (p: YT.Player) => {
      if (randomised) return;
      const list = p.getPlaylist();
      if (!list || !list.length) return;
      gotPlaylist = true;
      randomised = true;
      const idx = Math.floor(Math.random() * list.length);
      p.playVideoAt(idx);
    };

    this.player = new api.Player(mount, {
      width: '100%',
      height: '100%',
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        listType: 'playlist',
        list: PLAYLIST_ID,
        autoplay: 1,
        rel: 0,
        playsinline: 1,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (e) => {
          randomise(e.target);
        },
        onStateChange: (e) => {
          if (e.data === api.PlayerState.CUED || e.data === api.PlayerState.PLAYING || e.data === api.PlayerState.BUFFERING) {
            gotPlaylist = gotPlaylist || Boolean(e.target.getPlaylist()?.length);
            randomise(e.target);
          }
          if (e.data === api.PlayerState.PLAYING) this.fallback.hidden = true;
        },
        onError: (e) => {
          // 100/101/150: this particular video can't be embedded, skip it. 2: bad id (probably the playlist).
          const list = e.target.getPlaylist();
          if (list && list.length > 1) e.target.nextVideo();
          else this.showFallback();
        },
      },
    });

    // If the playlist never materialises, the id is probably wrong/truncated.
    await wait(6000);
    if (this.player && !gotPlaylist && this.root.classList.contains('is-open')) {
      const list = this.player.getPlaylist();
      if (!list || !list.length) this.showFallback();
    }
  }

  private showFallback(): void {
    this.fallback.hidden = false;
  }

  private destroyPlayer(): void {
    try {
      this.player?.stopVideo();
      this.player?.destroy();
    } catch {
      /* already gone */
    }
    this.player = null;
    this.playerHost.replaceChildren();
  }
}
