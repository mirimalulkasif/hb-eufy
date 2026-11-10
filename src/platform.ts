import fs from 'node:fs';
import path from 'node:path';

import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { DoorbellAccessory } from './accessories/doorbell';
import { IndoorCameraAccessory } from './accessories/indoor-camera';
import { BaseCameraAccessory } from './accessories/base-camera';
import { classifyDevice } from './device-kinds';
import {
  loginMega,
  type EufyDeviceInfo,
  type EufyMega,
} from './mega';
import {
  DEFAULT_COUNTRY,
  DEFAULT_EVENT_DURATION_SECONDS,
  DEFAULT_POLLING_MINUTES,
  EMPTY_RETRY_SECONDS,
  PLATFORM_NAME,
  PLUGIN_NAME,
} from './settings';

type AccessoryHandler = BaseCameraAccessory;

export class EufyCamerasPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly cached: PlatformAccessory[] = [];
  private readonly handlers = new Map<string, AccessoryHandler>();
  public client?: EufyMega;
  private readonly persistDir: string;
  public readonly eventHoldSeconds: number;
  private readonly pollingMinutes: number;
  private readonly country: string;
  private refreshTimer?: NodeJS.Timeout;
  private discovering = false;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.persistDir = path.join(api.user.storagePath(), 'eufy-cameras');
    this.eventHoldSeconds = Number(
      config.eventDurationSeconds || DEFAULT_EVENT_DURATION_SECONDS,
    );
    this.pollingMinutes = Math.max(
      1,
      Number(config.pollingIntervalMinutes ?? DEFAULT_POLLING_MINUTES),
    );
    this.country = String(config.country || DEFAULT_COUNTRY).toUpperCase();

    if (!fs.existsSync(this.persistDir)) {
      fs.mkdirSync(this.persistDir, { recursive: true });
    }

    api.on('didFinishLaunching', () => {
      void this.start();
    });
    api.on('shutdown', () => {
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
      }
      void this.client?.disconnect();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.cached.push(accessory);
  }

  private async start(): Promise<void> {
    const username = String(this.config.username || '').trim();
    const password = String(this.config.password || '');
    if (!username || !password) {
      this.log.error('Eufy Cameras: username and password are required.');
      return;
    }

    this.log.info(
      `Using Eufy Mega cloud (country=${this.country}), persist=${this.persistDir}`,
    );

    try {
      const { client } = await loginMega(this.log, {
        email: username,
        password,
        countryCode: this.country,
        persistDir: this.persistDir,
        configPath: this.api.user.configPath(),
      });
      this.client = client;
      this.bindClientEvents(client);
      await this.discover();
      this.scheduleRefresh();
    } catch (err) {
      this.log.error(`Eufy Cameras failed to start: ${String(err)}`);
      this.log.warn(
        '2FA/captcha flow: set mfaCode (or mfa-code.txt) / captchaCode, then restart. ' +
          'A restart with a saved challenge reuses your code and does not request a new one unless that code fails.',
      );
    }
  }

  private bindClientEvents(client: EufyMega): void {
    const onMotion = (event: { deviceSn?: string }) => {
      if (event.deviceSn) {
        this.handlers.get(event.deviceSn)?.triggerMotion(true);
      }
    };
    client.on('motion', onMotion);
    client.on('personDetected', onMotion);
    client.on('petDetection', onMotion);
    client.on('soundDetected', onMotion);
    client.on('cryingDetected', onMotion);
    client.on('doorbellPress', (event) => {
      const sn = event.deviceSn;
      const handler = sn ? this.handlers.get(sn) : undefined;
      if (handler instanceof DoorbellAccessory) {
        handler.ring();
      } else {
        handler?.triggerMotion(true);
      }
    });
    client.on('sessionExpired', () => {
      this.log.warn('Eufy session expired — will re-login on next refresh');
    });
    client.on('error', (err) => {
      this.log.warn(`Eufy Mega error: ${String(err)}`);
    });
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    const empty = this.handlers.size === 0;
    const delayMs = empty
      ? EMPTY_RETRY_SECONDS * 1000
      : this.pollingMinutes * 60 * 1000;
    this.log.info(
      empty
        ? `No cameras yet — retrying discovery in ${EMPTY_RETRY_SECONDS}s…`
        : `Next device refresh in ${this.pollingMinutes} minute(s).`,
    );
    this.refreshTimer = setTimeout(() => {
      void this.refreshDevices();
    }, delayMs);
  }

  private async refreshDevices(): Promise<void> {
    if (!this.client) {
      return;
    }
    this.log.info('Refreshing Eufy devices…');
    try {
      await this.discover();
    } catch (err) {
      this.log.warn(`Refresh failed: ${String(err)}`);
    }
    this.scheduleRefresh();
  }

  private async discover(): Promise<void> {
    if (!this.client || this.discovering) {
      return;
    }
    this.discovering = true;
    try {
      this.log.info('Loading devices from Eufy Mega cloud…');
      const devices = await this.client.getDevices();
      this.log.info(`Cloud returned ${devices.length} device(s).`);

      const seen = new Set<string>();
      for (const info of devices) {
        const kind = classifyDevice(info);
        this.log.info(
          `Found "${info.name || info.sn}" sn=${info.sn} model=${info.model} ` +
            `class=${info.deviceClass} category=${info.category} → ${kind ?? 'skipped'}`,
        );
        if (this.upsertDevice(info)) {
          seen.add(info.sn);
        }
      }

      if (devices.length > 0) {
        for (const accessory of [...this.cached]) {
          const serial = String(accessory.context.serial || '');
          if (serial && !seen.has(serial) && !this.handlers.has(serial)) {
            this.log.info(`Removing stale accessory ${accessory.displayName}`);
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
              accessory,
            ]);
          }
        }
      }

      this.log.info(
        `Eufy Cameras ready — ${this.handlers.size} doorbell/indoor device(s).`,
      );
      if (this.handlers.size === 0) {
        this.log.warn(
          'No doorbell/indoor cameras matched. Check the Found lines above. ' +
            'Confirm country matches the Eufy app and that MFA/captcha completed.',
        );
      }
    } finally {
      this.discovering = false;
    }
  }

  private upsertDevice(info: EufyDeviceInfo): boolean {
    const kind = classifyDevice(info);
    if (!kind) {
      return false;
    }

    const serial = info.sn;
    const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${serial}`);
    const name = info.name || serial;
    const model = info.model || kind;
    let accessory = this.cached.find((item) => item.UUID === uuid);
    const isNew = !accessory;
    if (!accessory) {
      accessory = new this.api.platformAccessory(name, uuid);
      accessory.context.serial = serial;
      accessory.context.kind = kind;
    } else {
      accessory.context.serial = serial;
      accessory.context.kind = kind;
      accessory.displayName = name;
    }

    if (!this.client) {
      return false;
    }

    let handler = this.handlers.get(serial);
    if (!handler) {
      handler =
        kind === 'doorbell'
          ? new DoorbellAccessory(
              this,
              accessory,
              this.log,
              this.client,
              serial,
              name,
              model,
            )
          : new IndoorCameraAccessory(
              this,
              accessory,
              this.log,
              this.client,
              serial,
              name,
              model,
            );
      this.handlers.set(serial, handler);
      if (isNew) {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
        this.cached.push(accessory);
        this.log.info(`Added ${kind}: ${name} (${serial})`);
      } else {
        this.log.info(`Restored ${kind}: ${name} (${serial})`);
      }
    } else {
      handler.updateMeta(name, model);
    }
    return true;
  }
}
