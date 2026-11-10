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
      .setCharacteristic(this.Characteristic.FirmwareRevision, '2.0.9');

    // Drop the old Enabled switch if a previous version added it — its cloud reads
    // could stall HAP on slow P2P hosts and mark the camera "No Response".
    const staleSwitch = this.accessory.getServiceById(
      this.Service.Switch,
      'enabled',
    );
    if (staleSwitch) {
      this.accessory.removeService(staleSwitch);
    }

    this.setupMotion();
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
    this.motionService
      .getCharacteristic(this.Characteristic.MotionDetected)
      .onGet(() => false);
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
      this.kind,
      this.model,
    );

    this.cameraController = new hap.CameraController({
      cameraStreamCount: 1,
      delegate: this.streaming,
      streamingOptions: {
        supportedCryptoSuites: [hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
        video: {
          resolutions: [
            [320, 240, 15],
            [320, 180, 30],
            [480, 270, 30],
            [640, 360, 30],
            [1280, 720, 30],
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
    // Only pull a retained push thumbnail — never open P2P just because Home restored the tile.
    void this.streaming.prefetchSnapshot();
  }

  updateMeta(name: string, model: string): void {
    this.displayName = name;
    this.model = model;
    this.accessory.displayName = name;
  }

  /** Warm P2P so the next HomeKit open is faster (indoor cameras). */
  prewarmStream(): void {
    void this.streaming?.prewarm();
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
      void this.streaming?.refreshStoredSnapshot();
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
