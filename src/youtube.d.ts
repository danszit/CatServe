/** Minimal typings for the YouTube IFrame Player API (only what we use). */
declare namespace YT {
  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    playsinline?: 0 | 1;
    modestbranding?: 0 | 1;
    listType?: 'playlist';
    list?: string;
    index?: number;
    origin?: string;
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent extends PlayerEvent {
    data: number;
  }

  interface OnErrorEvent extends PlayerEvent {
    data: number;
  }

  interface PlayerOptions {
    width?: string | number;
    height?: string | number;
    videoId?: string;
    host?: string;
    playerVars?: PlayerVars;
    events?: {
      onReady?(e: PlayerEvent): void;
      onStateChange?(e: OnStateChangeEvent): void;
      onError?(e: OnErrorEvent): void;
    };
  }

  class Player {
    constructor(el: HTMLElement | string, options: PlayerOptions);
    getPlaylist(): string[] | null;
    getPlaylistIndex(): number;
    playVideoAt(index: number): void;
    nextVideo(): void;
    playVideo(): void;
    stopVideo(): void;
    destroy(): void;
    getIframe(): HTMLIFrameElement;
  }

  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
