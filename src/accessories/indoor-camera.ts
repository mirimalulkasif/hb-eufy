import type { Logging, PlatformAccessory } from 'homebridge';
import type { Device } from 'eufy-security-client';

import { BaseCameraAccessory } from './base-camera';
import type { EufyCamerasPlatform } from '../platform';

const MOTION_DETECTION = 3101;
const PERSON_DETECTION = 3102;
const PET_DETECTION = 3106;
const SOUND_DETECTION = 3108;
const CRYING_DETECTION = 3109;

export class IndoorCameraAccessory extends BaseCameraAccessory {
  constructor(
    platform: EufyCamerasPlatform,
    accessory: PlatformAccessory,
    log: Logging,
    device: Device,
  ) {
    super(platform, accessory, log, device, 'indoor');
  }

  handlePush(eventType: number): void {
    if (
      eventType === MOTION_DETECTION ||
      eventType === PERSON_DETECTION ||
      eventType === PET_DETECTION ||
      eventType === SOUND_DETECTION ||
      eventType === CRYING_DETECTION
    ) {
      this.triggerMotion(true);
      this.log.debug(
        `Indoor camera event ${eventType} on ${this.device.getSerial()}`,
      );
    }
  }
}
