import { PassThrough, type Readable } from 'node:stream';

import type {
  Device,
  EufySecurity,
  Station,
  StreamMetadata,
} from 'eufy-security-client';
import type { Logging } from 'homebridge';

export type LivestreamData = {
  videostream: Readable;
  audiostream: Readable;
  metadata: StreamMetadata;
};

type Pending = {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const START_TIMEOUT_MS = 20_000;
const STOP_GRACE_MS = 5_000;

/**
 * Owns one P2P livestream per camera serial and forks streams for consumers.
 */
export class LivestreamManager {
  private active: {
    videostream: Readable;
    audiostream: Readable;
    metadata: StreamMetadata;
  } | null = null;
  private pending: Pending | null = null;
  private consumers = 0;
  private stopTimer?: NodeJS.Timeout;

  constructor(
    private readonly client: EufySecurity,
    private readonly serial: string,
    private readonly log: Logging,
  ) {
    this.client.on('station livestream start', this.onStart);
    this.client.on('station livestream stop', this.onStop);
  }

  async getStream(): Promise<LivestreamData> {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = undefined;
    }
    if (!this.active) {
      await this.start();
    }
    if (!this.active) {
      throw new Error('Livestream failed to start');
    }
    this.consumers += 1;
    return this.fork(this.active);
  }

  release(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0) {
      return;
    }
    if (this.stopTimer) {
      return;
    }
    this.stopTimer = setTimeout(() => {
      this.stopTimer = undefined;
      if (this.consumers === 0) {
        void this.forceStop();
      }
    }, STOP_GRACE_MS);
  }

  async dispose(): Promise<void> {
    this.client.off('station livestream start', this.onStart);
    this.client.off('station livestream stop', this.onStop);
    await this.forceStop();
  }

  private start(): Promise<void> {
    if (this.pending) {
      return new Promise<void>((resolve, reject) => {
        const prevResolve = this.pending!.resolve;
        const prevReject = this.pending!.reject;
        this.pending!.resolve = () => {
          prevResolve();
          resolve();
        };
        this.pending!.reject = (err) => {
          prevReject(err);
          reject(err);
        };
      });
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`Livestream timeout for ${this.serial}`));
      }, START_TIMEOUT_MS);
      this.pending = { resolve, reject, timer };
      this.log.debug(`Starting P2P livestream for ${this.serial}`);
      this.client.startStationLivestream(this.serial).catch((err) => {
        if (this.pending) {
          clearTimeout(this.pending.timer);
          this.pending = null;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
  }

  private async forceStop(): Promise<void> {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('Livestream cancelled'));
      this.pending = null;
    }
    this.destroyLocal();
    try {
      await this.client.stopStationLivestream(this.serial);
    } catch {
      // ignore
    }
  }

  private destroyLocal(): void {
    if (!this.active) {
      return;
    }
    try {
      this.active.videostream.destroy();
    } catch {
      // ignore
    }
    try {
      this.active.audiostream.destroy();
    } catch {
      // ignore
    }
    this.active = null;
    this.consumers = 0;
  }

  private fork(source: {
    videostream: Readable;
    audiostream: Readable;
    metadata: StreamMetadata;
  }): LivestreamData {
    const videoFork = new PassThrough();
    const audioFork = new PassThrough();
    source.videostream.pipe(videoFork);
    source.audiostream.pipe(audioFork);
    videoFork.on('close', () => source.videostream.unpipe(videoFork));
    audioFork.on('close', () => source.audiostream.unpipe(audioFork));
    return {
      videostream: videoFork,
      audiostream: audioFork,
      metadata: source.metadata,
    };
  }

  private readonly onStart = (
    _station: Station,
    device: Device,
    metadata: StreamMetadata,
    videostream: Readable,
    audiostream: Readable,
  ): void => {
    if (device.getSerial() !== this.serial) {
      return;
    }
    this.log.debug(
      `P2P livestream started for ${this.serial} ` +
        `(${metadata.videoWidth}x${metadata.videoHeight} @ ${metadata.videoFPS}fps)`,
    );
    this.active = { videostream, audiostream, metadata };
    if (this.pending) {
      clearTimeout(this.pending.timer);
      const { resolve } = this.pending;
      this.pending = null;
      resolve();
    }
  };

  private readonly onStop = (_station: Station, device: Device): void => {
    if (device.getSerial() !== this.serial) {
      return;
    }
    this.log.debug(`P2P livestream stopped for ${this.serial}`);
    this.destroyLocal();
  };
}
