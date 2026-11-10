import type { Readable } from 'node:stream';

import type { Logging } from 'homebridge';

import type { EufyMega, MegaDevice } from './mega';

export type LivestreamData = {
  videostream: Readable;
  stop: () => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  constructor(
    private readonly client: EufyMega,
    private readonly serial: string,
    private readonly log: Logging,
  ) {}

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
    }, 5_000);
  }

  async dispose(): Promise<void> {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = undefined;
    }
    await this.forceStop();
  }

  private async openWithRetry(): Promise<Readable> {
    if (this.opening) {
      return this.opening;
    }
    this.opening = this.openOnce()
      .catch(async (err) => {
        this.log.warn(
          `P2P livestream failed for ${this.serial}: ${String(err)} — retrying once…`,
        );
        await sleep(2_000);
        return this.openOnce();
      })
      .finally(() => {
        this.opening = undefined;
      });
    return this.opening;
  }

  private async openOnce(): Promise<Readable> {
    // Warm the station session first so openReadable does not race a cold connect.
    try {
      await this.client.connectStation(this.serial);
    } catch (err) {
      this.log.debug(
        `connectStation(${this.serial}) before stream: ${String(err)}`,
      );
      // openReadable will connect itself; continue.
    }

    const device = await this.client.getDevice(this.serial);
    const openReadable = device.camera?.()?.openReadable;
    if (!openReadable) {
      throw new Error(`Camera ${this.serial} has no openReadable media API`);
    }
    this.log.info(`Opening Mega livestream for ${this.serial}`);
    return openReadable();
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
