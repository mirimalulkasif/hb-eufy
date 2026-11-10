import type { EufyKind } from './device-kinds';

export type StreamMode = 'live' | 'stills';

/** Doorbells use push thumbnails as a picture stream; indoor cams use P2P live. */
export function streamModeFor(kind: EufyKind, _model: string): StreamMode {
  return kind === 'doorbell' ? 'stills' : 'live';
}
