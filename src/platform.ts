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
import {
  Device,
  EufySecurity,
  type EufySecurityConfig,
  PropertyName,
} from 'eufy-security-client';

import { DoorbellAccessory } from './accessories/doorbell';
import { IndoorCameraAccessory } from './accessories/indoor-camera';
import { BaseCameraAccessory } from './accessories/base-camera';
import { classifyDevice } from './device-kinds';
import {
  DEFAULT_COUNTRY,
  DEFAULT_EVENT_DURATION_SECONDS,
  DEFAULT_P2P_SETUP,
  DEFAULT_POLLING_MINUTES,
  PLATFORM_NAME,
  PLUGIN_NAME,
} from './settings';

type AccessoryHandler = BaseCameraAccessory;

export class EufyCamerasPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly cached: PlatformAccessory[] = [];
  private readonly handlers = new Map<string, AccessoryHandler>();
  public client?: EufySecurity;
  private readonly persistDir: string;
  public readonly eventHoldSeconds: number;

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

    if (!fs.existsSync(this.persistDir)) {
      fs.mkdirSync(this.persistDir, { recursive: true });
    }

    api.on('didFinishLaunching', () => {
      void this.start();
    });
    api.on('shutdown', () => {
      try {
        this.client?.close();
      } catch {
        // ignore
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.cached.push(accessory);
  }

  async getStationForDevice(device: Device) {
    if (!this.client) {
      return undefined;
    }
    try {
      return await this.client.getStation(device.getStationSerial());
    } catch {
      return undefined;
    }
  }

  private async start(): Promise<void> {
    const username = String(this.config.username || '').trim();
    const password = String(this.config.password || '');
    if (!username || !password) {
      this.log.error('Eufy Cameras: username and password are required.');
      return;
    }

    const eufyConfig: EufySecurityConfig = {
      username,
      password,
      country: String(this.config.country || DEFAULT_COUNTRY),
      trustedDeviceName: String(this.config.trustedDeviceName || 'Homebridge'),
      persistentDir: this.persistDir,
      p2pConnectionSetup: Number(this.config.p2pConnectionSetup ?? DEFAULT_P2P_SETUP),
      pollingIntervalMinutes: Number(
        this.config.pollingIntervalMinutes ?? DEFAULT_POLLING_MINUTES,
      ),
      eventDurationSeconds: this.eventHoldSeconds,
      acceptInvitations: Boolean(this.config.acceptInvitations),
      enableEmbeddedPKCS1Support: true,
    };

    try {
      this.client = await EufySecurity.initialize(eufyConfig);
      this.bindClientEvents(this.client);

      if (this.config.captchaId && this.config.captchaCode) {
        await this.client.connect({
          force: false,
          captcha: {
            captchaId: String(this.config.captchaId),
            captchaCode: String(this.config.captchaCode),
          },
        });
      } else if (this.config.mfaCode) {
        await this.client.connect({
          force: false,
          verifyCode: String(this.config.mfaCode),
        });
      } else {
        await this.client.connect({ force: false });
      }

      this.log.info('Connected to Eufy cloud.');
      await this.discover();
    } catch (err) {
      this.log.error(`Eufy Cameras failed to start: ${String(err)}`);
      this.log.warn(
        'If the cloud asks for MFA/captcha, set mfaCode or captchaId/captchaCode in the plugin config and restart.',
      );
    }
  }

  private async loadDevices(timeoutMs: number): Promise<Device[]> {
    if (!this.client) {
      return [];
    }
    try {
      return await Promise.race([
        this.client.getDevices(),
        new Promise<Device[]>((_, reject) => {
          setTimeout(
            () => reject(new Error(`getDevices timed out after ${timeoutMs / 1000}s`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (err) {
      this.log.warn(String(err));
      return [];
    }
  }

  private bindClientEvents(client: EufySecurity): void {
    client.on('device added', (device) => {
      void this.upsertDevice(device);
    });
    client.on('device removed', (device) => {
      this.removeDevice(device.getSerial());
    });
    client.on('device property changed', (device, name) => {
      const handler = this.handlers.get(device.getSerial());
      if (handler && name === PropertyName.DeviceEnabled) {
        handler.updateDevice(device);
      }
    });
    client.on('device motion detected', (device, state) => {
      if (state) this.handlers.get(device.getSerial())?.triggerMotion(true);
    });
    client.on('device person detected', (device, state) => {
      if (state) this.handlers.get(device.getSerial())?.triggerMotion(true);
    });
    client.on('device pet detected', (device, state) => {
      if (state) this.handlers.get(device.getSerial())?.triggerMotion(true);
    });
    client.on('device sound detected', (device, state) => {
      if (state) this.handlers.get(device.getSerial())?.triggerMotion(true);
    });
    client.on('device crying detected', (device, state) => {
      if (state) this.handlers.get(device.getSerial())?.triggerMotion(true);
    });
    client.on('device rings', (device, state) => {
      if (!state) return;
      const handler = this.handlers.get(device.getSerial());
      if (handler instanceof DoorbellAccessory) {
        handler.ring();
      } else {
        handler?.triggerMotion(true);
      }
    });
    client.on('push message', (message) => {
      this.onPushMessage(message as unknown as Record<string, unknown>);
    });
    client.on('captcha request', (id) => {
      this.log.warn(
        `Eufy captcha required (id=${id}). Set captchaId/captchaCode in config and restart.`,
      );
    });
    client.on('tfa request', () => {
      this.log.warn(
        'Eufy MFA/2FA code required. Set mfaCode in config and restart Homebridge.',
      );
    });
  }

  private async discover(): Promise<void> {
    if (!this.client) {
      return;
    }

    this.log.info('Loading devices from Eufy cloud…');
    try {
      await this.client.refreshCloudData();
    } catch (err) {
      this.log.warn(`Cloud refresh warning: ${String(err)}`);
    }

    // First attempt — eufy-security-client can hang forever on devicesLoaded.
    let devices = await this.loadDevices(45_000);
    if (devices.length === 0) {
      this.log.warn(
        'No devices yet (or load timed out). Waiting 15s for device events…',
      );
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      devices = await this.loadDevices(10_000);
    }

    this.log.info(`Cloud returned ${devices.length} device(s).`);
    const seen = new Set<string>();
    for (const device of devices) {
      const type = device.getDeviceType();
      const kind = classifyDevice(device);
      this.log.info(
        `Found "${device.getName()}" sn=${device.getSerial()} ` +
          `type=${type} model=${device.getModel() || '?'} → ${kind ?? 'skipped'}`,
      );
      const serial = device.getSerial();
      if (this.upsertDevice(device)) {
        seen.add(serial);
      }
    }

    for (const accessory of [...this.cached]) {
      const serial = String(accessory.context.serial || '');
      if (serial && !seen.has(serial) && !this.handlers.has(serial)) {
        this.log.info(`Removing stale accessory ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }

    this.log.info(
      `Eufy Cameras ready — ${this.handlers.size} doorbell/indoor device(s).`,
    );
    if (this.handlers.size === 0) {
      this.log.warn(
        'No doorbell/indoor cameras matched. Check the "Found … → skipped" lines above for device types, ' +
          'confirm the Eufy account owns those cameras, and try acceptInvitations / MFA if needed.',
      );
    }
  }

  private upsertDevice(device: Device): boolean {
    const kind = classifyDevice(device);
    if (!kind) {
      this.log.debug(
        `Skipping non doorbell/indoor device ${device.getName()} type=${device.getDeviceType()}`,
      );
      return false;
    }

    const serial = device.getSerial();
    const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${serial}`);
    const name = device.getName() || serial;
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

    let handler = this.handlers.get(serial);
    if (!handler) {
      handler =
        kind === 'doorbell'
          ? new DoorbellAccessory(this, accessory, this.log, device)
          : new IndoorCameraAccessory(this, accessory, this.log, device);
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
      handler.updateDevice(device);
    }
    return true;
  }

  private removeDevice(serial: string): void {
    const handler = this.handlers.get(serial);
    if (!handler) {
      return;
    }
    this.handlers.delete(serial);
    const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${serial}`);
    const accessory = this.cached.find((item) => item.UUID === uuid);
    if (accessory) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory,
      ]);
      const idx = this.cached.indexOf(accessory);
      if (idx >= 0) {
        this.cached.splice(idx, 1);
      }
    }
  }

  private onPushMessage(message: Record<string, unknown>): void {
    const serial = String(message.device_sn || message.station_sn || '');
    const payload = (message.payload || {}) as Record<string, unknown>;
    const eventType = Number(
      payload.event_type ?? payload.a ?? payload.type ?? message.type ?? 0,
    );
    if (!serial || !eventType) {
      return;
    }
    const handler = this.handlers.get(serial);
    if (!handler) {
      return;
    }
    handler.handlePush(eventType);
  }

  /** Used by accessories to toggle enable via the cloud/P2P client. */
  async setDeviceEnabled(device: Device, enabled: boolean): Promise<void> {
    if (!this.client) {
      throw new Error('Eufy client not connected');
    }
    await this.client.setDeviceProperty(
      device.getSerial(),
      PropertyName.DeviceEnabled,
      enabled,
    );
  }
}
