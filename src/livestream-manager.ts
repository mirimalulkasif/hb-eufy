import type { Readable } from 'node:stream';

import type { Logging } from 'homebridge';

import type { EufyMega, MegaDevice } from './mega';

export type LivestreamData = {
  videostream: Readable;
  stop: () => void;
};

/**
 * Opens a Mega SDK Annex-B video Readable for one camera serial.
 */
export class LivestreamManager {
  private active?: {
    stream: Readable;
    consumers: number;
  };
  private stopTimer?: NodeJS.Timeout;

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
      const device = await this.client.getDevice(this.serial);
      const openReadable = device.camera?.()?.openReadable;
      if (!openReadable) {
        throw new Error(`Camera ${this.serial} has no openReadable media API`);
      }
      this.log.debug(`Opening Mega livestream for ${this.serial}`);
      const stream = await openReadable();
      this.active = { stream, consumers: 0 };
      stream.on('close', () => {
        if (this.active?.stream === stream) {
          this.active = undefined;
        }
      });
      stream.on('error', (err: Error) => {
        this.log.debug(`Livestream error ${this.serial}: ${String(err)}`);
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
