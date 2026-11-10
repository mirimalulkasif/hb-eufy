import type { Logging, PlatformAccessory } from 'homebridge';

import { BaseCameraAccessory } from './base-camera';
import type { EufyCamerasPlatform } from '../platform';
import type { EufyMega } from '../mega';

export class IndoorCameraAccessory extends BaseCameraAccessory {
  constructor(
    platform: EufyCamerasPlatform,
    accessory: PlatformAccessory,
    log: Logging,
    client: EufyMega,
    serial: string,
    displayName: string,
    model: string,
  ) {
    super(platform, accessory, log, client, serial, 'indoor', displayName, model);
  }
}
