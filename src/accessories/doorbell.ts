import type { Logging, PlatformAccessory, Service } from 'homebridge';
import type { Device } from 'eufy-security-client';

import { BaseCameraAccessory } from './base-camera';
import type { EufyCamerasPlatform } from '../platform';

/** Eufy push / P2P event codes commonly used for doorbell products. */
const PRESS_DOORBELL = 3103;
const MOTION_DETECTION = 3101;

export class DoorbellAccessory extends BaseCameraAccessory {
  private doorbellService: Service;

  constructor(
    platform: EufyCamerasPlatform,
    accessory: PlatformAccessory,
    log: Logging,
    device: Device,
  ) {
    super(platform, accessory, log, device, 'doorbell');

    this.doorbellService = this.getOrAddService(
      this.Service.Doorbell,
      accessory.displayName,
    );
    this.doorbellService
      .getCharacteristic(this.Characteristic.ProgrammableSwitchEvent)
      .onGet(() => this.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
  }

  ring(): void {
    this.doorbellService.updateCharacteristic(
      this.Characteristic.ProgrammableSwitchEvent,
      this.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
    );
    this.triggerMotion(true);
    this.log.info(`Doorbell ring: ${this.device.getName()} (${this.device.getSerial()})`);
  }

  handlePush(eventType: number): void {
    if (eventType === PRESS_DOORBELL) {
      this.ring();
      return;
    }
    if (eventType === MOTION_DETECTION) {
      this.triggerMotion(true);
    }
  }
}
