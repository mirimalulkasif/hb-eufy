import type { Readable } from 'node:stream';

import type { Logging } from 'homebridge';

import type { EufyKind } from './device-kinds';
import type { EufyMega, MegaDevice } from './mega';

export type LivestreamData = {
  videostream: Readable;
  stop: () => void;
};

export type LivestreamManagerOptions = {
  kind: EufyKind;
  model: string;
  /** How long to keep P2P warm after the last HomeKit viewer leaves. */
  lingerMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStandaloneCallDoorbell(model: string): boolean {
  const m = model.toUpperCase();
  return m.startsWith('T8223') || m.startsWith('T8224');
}

/**
 * Opens a Mega SDK Annex-B video Readable for one camera serial.
 */
export class LivestreamManager {
  private active?: {
    stream: Readable;
    consumers: number;
  };
  private stopTimer?: NodeJS.Timeout;
  private opening?: Promise<Readable>;
  private readonly lingerMs: number;
  private readonly kind: EufyKind;
  private readonly model: string;

  constructor(
    private readonly client: EufyMega,
    private readonly serial: string,
    private readonly log: Logging,
    opts: LivestreamManagerOptions,
  ) {
    this.kind = opts.kind;
    this.model = opts.model;
    this.lingerMs = opts.lingerMs ?? 90_000;
  }

  /** Open (or keep) the station P2P session so the next live view starts faster. */
  async prewarm(): Promise<void> {
    if (this.isDoorbellWithoutWebRtc()) {
      return;
    }
    try {
      await this.client.connectStation(this.serial);
      this.log.info(`Pre-warmed P2P for ${this.serial}`);
    } catch (err) {
      this.log.warn(`Pre-warm failed for ${this.serial}: ${String(err)}`);
    }
  }

  async getStream(): Promise<LivestreamData> {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = undefined;
    }

    if (!this.active) {
      const stream = await this.openWithRetry();
      this.active = { stream, consumers: 0 };
      stream.on('close', () => {
        if (this.active?.stream === stream) {
          this.active = undefined;
        }
      });
      stream.on('error', (err: Error) => {
        this.log.warn(`Livestream error ${this.serial}: ${String(err)}`);
        if (this.active?.stream === stream) {
          this.active = undefined;
        }
      });
    }

    this.active.consumers += 1;
    return {
      videostream: this.active.stream,
      stop: () => this.release(),
    };
  }

  release(): void {
    if (!this.active) {
      return;
    }
    this.active.consumers = Math.max(0, this.active.consumers - 1);
    if (this.active.consumers > 0) {
      return;
    }
    if (this.stopTimer) {
      return;
    }
    this.stopTimer = setTimeout(() => {
      this.stopTimer = undefined;
      void this.forceStop();
    }, this.lingerMs);
  }

  async dispose(): Promise<void> {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = undefined;
    }
    await this.forceStop();
  }

  private isDoorbellWithoutWebRtc(): boolean {
    return (
      this.kind === 'doorbell' &&
      isStandaloneCallDoorbell(this.model) &&
      (process.arch === 'arm' || process.arch === 'ia32')
    );
  }

  private async openWithRetry(): Promise<Readable> {
    if (this.opening) {
      return this.opening;
    }

    // Standalone T8223/T8224 need WebRTC on modern firmware. On 32-bit we have no
    // node-datachannel — fail fast instead of hanging HomeKit for a minute+.
    if (this.isDoorbellWithoutWebRtc()) {
      throw new Error(
        `Live video for ${this.model} needs WebRTC (64-bit Node + node-datachannel). ` +
          'Ring/motion still work on this 32-bit host; open Living Room for P2P live video.',
      );
    }

    const retry = this.kind === 'indoor';
    this.opening = this.openOnce()
      .catch(async (err) => {
        if (!retry) {
          throw err;
        }
        this.log.warn(
          `P2P livestream failed for ${this.serial}: ${String(err)} — retrying once…`,
        );
        await sleep(1_500);
        return this.openOnce();
      })
      .finally(() => {
        this.opening = undefined;
      });
    return this.opening;
  }

  private async openOnce(): Promise<Readable> {
    try {
      await this.client.connectStation(this.serial);
    } catch (err) {
      this.log.debug(
        `connectStation(${this.serial}) before stream: ${String(err)}`,
      );
    }

    const device = await this.client.getDevice(this.serial);
    const openReadable = device.camera?.()?.openReadable;
    if (!openReadable) {
      throw new Error(`Camera ${this.serial} has no openReadable media API`);
    }
    this.log.info(`Opening Mega livestream for ${this.serial}`);
    return openReadable({ preBufferSeconds: 0 });
  }

  private async forceStop(): Promise<void> {
    const current = this.active;
    this.active = undefined;
    if (!current) {
      return;
    }
    try {
      current.stream.destroy();
    } catch {
      // ignore
    }
  }
}

export async function getBoundDevice(
  client: EufyMega,
  serial: string,
): Promise<MegaDevice> {
  return client.getDevice(serial);
}
