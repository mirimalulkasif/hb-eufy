import { Device } from 'eufy-security-client';

export type EufyKind = 'doorbell' | 'indoor';

/** Keep only doorbell + indoor camera products for this plugin. */
export function classifyDevice(device: Device): EufyKind | null {
  const type = device.getDeviceType();
  if (Device.isDoorbell(type)) {
    return 'doorbell';
  }
  if (Device.isIndoorCamera(type)) {
    return 'indoor';
  }
  return null;
}
