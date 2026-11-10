import type { Logging, PlatformAccessory, Service } from 'homebridge';

import { BaseCameraAccessory } from './base-camera';
import type { EufyCamerasPlatform } from '../platform';
import type { EufyMega } from '../mega';

export class DoorbellAccessory extends BaseCameraAccessory {
  private doorbellService: Service;

  constructor(
    platform: EufyCamerasPlatform,
    accessory: PlatformAccessory,
    log: Logging,
    client: EufyMega,
    serial: string,
    displayName: string,
    model: string,
  ) {
    super(platform, accessory, log, client, serial, 'doorbell', displayName, model);

    this.doorbellService = this.getOrAddService(
      this.Service.Doorbell,
      accessory.displayName,
    );
    // Event-only: do not register onGet (returning values confuses Home / can stall reads).
  }

  ring(): void {
    this.doorbellService.updateCharacteristic(
      this.Characteristic.ProgrammableSwitchEvent,
      this.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
    );
    this.triggerMotion(true);
    this.log.info(`Doorbell ring: ${this.displayName} (${this.serial})`);
  }
}
