import type {
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

export abstract class BaseCameraAccessory {
  protected readonly Service: typeof Service;
  protected readonly Characteristic: typeof Characteristic;
  protected motionService?: Service;
  protected switchService?: Service;
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
