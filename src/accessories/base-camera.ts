import type {
  CameraController,
  Characteristic,
  Logging,
  PlatformAccessory,
  Service,
  WithUUID,
} from 'homebridge';
import type { Device } from 'eufy-security-client';
import { PropertyName } from 'eufy-security-client';

import type { EufyCamerasPlatform } from '../platform';
import type { EufyKind } from '../device-kinds';
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
    protected device: Device,
    protected readonly kind: EufyKind,
  ) {
    this.Service = platform.Service;
    this.Characteristic = platform.Characteristic;

    const info = this.accessory.getService(this.Service.AccessoryInformation)
      || this.accessory.addService(this.Service.AccessoryInformation);
    info
      .setCharacteristic(this.Characteristic.Manufacturer, 'Eufy')
      .setCharacteristic(this.Characteristic.Model, device.getModel() || kind)
      .setCharacteristic(this.Characteristic.SerialNumber, device.getSerial())
      .setCharacteristic(
        this.Characteristic.FirmwareRevision,
        String(device.getSoftwareVersion() || '1.0.0'),
      );

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
    const enabled = Boolean(this.device.getPropertyValue(PropertyName.DeviceEnabled));
    this.switchService
      .getCharacteristic(this.Characteristic.On)
      .onGet(() => Boolean(this.device.getPropertyValue(PropertyName.DeviceEnabled)))
      .onSet(async (value) => {
        try {
          await this.platform.setDeviceEnabled(this.device, Boolean(value));
        } catch (err) {
          this.log.error(
            `Failed to set enabled on ${this.device.getSerial()}: ${String(err)}`,
          );
          throw err;
        }
      });
    this.switchService.updateCharacteristic(this.Characteristic.On, enabled);
  }

  private setupCameraStreaming(): void {
    if (!this.platform.client) {
      this.log.warn(
        `Skipping HomeKit camera for ${this.device.getSerial()} — client not ready`,
      );
      return;
    }

    const hap = this.platform.api.hap;
    this.streaming = new StreamingDelegate(
      this.platform,
      this.platform.api,
      this.log,
      this.device,
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
            {
              type: hap.AudioStreamingCodecType.OPUS,
              samplerate: hap.AudioStreamingSamplerate.KHZ_24,
            },
          ],
        },
      },
    });

    this.streaming.setController(this.cameraController);
    this.accessory.configureController(this.cameraController);
    this.log.info(
      `HomeKit camera enabled for ${this.device.getName()} (${this.device.getSerial()})`,
    );
  }

  updateDevice(device: Device): void {
    this.device = device;
    if (this.switchService) {
      this.switchService.updateCharacteristic(
        this.Characteristic.On,
        Boolean(device.getPropertyValue(PropertyName.DeviceEnabled)),
      );
    }
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

  abstract handlePush(eventType: number): void;
}
