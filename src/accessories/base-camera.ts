import type {
  CameraController,
  Characteristic,
  Logging,
  PlatformAccessory,
  Service,
  WithUUID,
} from 'homebridge';

import type { EufyCamerasPlatform } from '../platform';
import type { EufyKind } from '../device-kinds';
import type { EufyMega } from '../mega';
import { StreamingDelegate } from '../streaming-delegate';

export abstract class BaseCameraAccessory {
  protected readonly Service: typeof Service;
  protected readonly Characteristic: typeof Characteristic;
  protected motionService?: Service;
  protected switchService?: Service;
  protected streaming?: StreamingDelegate;
  protected cameraController?: CameraController;
  private motionTimer?: NodeJS.Timeout;

  constructor(
    protected readonly platform: EufyCamerasPlatform,
    protected readonly accessory: PlatformAccessory,
    protected readonly log: Logging,
    protected readonly client: EufyMega,
    protected readonly serial: string,
    protected readonly kind: EufyKind,
    protected displayName: string,
    protected model: string,
  ) {
    this.Service = platform.Service;
    this.Characteristic = platform.Characteristic;

    const info = this.accessory.getService(this.Service.AccessoryInformation)
      || this.accessory.addService(this.Service.AccessoryInformation);
    info
      .setCharacteristic(this.Characteristic.Manufacturer, 'Eufy')
      .setCharacteristic(this.Characteristic.Model, model || kind)
      .setCharacteristic(this.Characteristic.SerialNumber, serial)
      .setCharacteristic(this.Characteristic.FirmwareRevision, '2.0.0');

    this.setupMotion();
    this.setupEnableSwitch();
    this.setupCameraStreaming();
  }

  protected getOrAddService(
    service: WithUUID<typeof Service>,
    name?: string,
    subtype?: string,
  ): Service {
    const existing = subtype
      ? this.accessory.getServiceById(service, subtype)
      : this.accessory.getService(service);
    if (existing) {
      return existing;
    }
    const created = new service(
      name ?? this.accessory.displayName,
      subtype ?? '',
    );
    return this.accessory.addService(created);
  }

  private setupMotion(): void {
    this.motionService = this.getOrAddService(
      this.Service.MotionSensor,
      `${this.accessory.displayName} Motion`,
    );
    this.motionService.setCharacteristic(
      this.Characteristic.MotionDetected,
      false,
    );
  }

  private setupEnableSwitch(): void {
    this.switchService = this.getOrAddService(
      this.Service.Switch,
      `${this.accessory.displayName} Enabled`,
      'enabled',
    );
    this.switchService
      .getCharacteristic(this.Characteristic.On)
      .onGet(async () => {
        try {
          const device = await this.client.getDevice(this.serial);
          const value = device.getProperty('enabled');
          if (typeof value === 'boolean') {
            return value;
          }
          return true;
        } catch {
          return true;
        }
      })
      .onSet(async (value) => {
        try {
          await this.client.setProperty(this.serial, 'enabled', Boolean(value));
        } catch (err) {
          this.log.error(
            `Failed to set enabled on ${this.serial}: ${String(err)}`,
          );
          throw err;
        }
      });
  }

  private setupCameraStreaming(): void {
    const hap = this.platform.api.hap;
    this.streaming = new StreamingDelegate(
      this.platform,
      this.platform.api,
      this.log,
      this.client,
      this.serial,
      this.displayName,
    );

    this.cameraController = new hap.CameraController({
      cameraStreamCount: 2,
      delegate: this.streaming,
      streamingOptions: {
        supportedCryptoSuites: [hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
        video: {
          resolutions: [
            [320, 180, 30],
            [320, 240, 15],
            [480, 270, 30],
            [640, 360, 30],
            [1280, 720, 30],
            [1920, 1080, 30],
          ],
          codec: {
            profiles: [
              hap.H264Profile.BASELINE,
              hap.H264Profile.MAIN,
              hap.H264Profile.HIGH,
            ],
            levels: [
              hap.H264Level.LEVEL3_1,
              hap.H264Level.LEVEL3_2,
              hap.H264Level.LEVEL4_0,
            ],
          },
        },
        audio: {
          twoWayAudio: false,
          codecs: [
            {
              type: hap.AudioStreamingCodecType.AAC_ELD,
              samplerate: hap.AudioStreamingSamplerate.KHZ_16,
            },
          ],
        },
      },
    });

    this.streaming.setController(this.cameraController);
    this.accessory.configureController(this.cameraController);
    this.log.info(`HomeKit camera enabled for ${this.displayName} (${this.serial})`);
  }

  updateMeta(name: string, model: string): void {
    this.displayName = name;
    this.model = model;
    this.accessory.displayName = name;
  }

  triggerMotion(active = true): void {
    if (!this.motionService) {
      return;
    }
    this.motionService.updateCharacteristic(
      this.Characteristic.MotionDetected,
      active,
    );
    if (this.motionTimer) {
      clearTimeout(this.motionTimer);
    }
    if (active) {
      const hold = this.platform.eventHoldSeconds * 1000;
      this.motionTimer = setTimeout(() => {
        this.motionService?.updateCharacteristic(
          this.Characteristic.MotionDetected,
          false,
        );
      }, hold);
    }
  }
}
