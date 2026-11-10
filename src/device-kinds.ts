import { Device } from 'eufy-security-client';

export type EufyKind = 'doorbell' | 'indoor';

/** Indoor PT C220 V3 — present in types but missing from Device.isIndoorCamera in 3.8.0. */
const EXTRA_INDOOR_TYPES = new Set<number>([
  10011, // INDOOR_PT_CAMERA_C220_V3
]);

/** Keep only doorbell + indoor camera products for this plugin. */
export function classifyDevice(device: Device): EufyKind | null {
  try {
    if (typeof device.isDoorbell === 'function' && device.isDoorbell()) {
      return 'doorbell';
    }
    if (typeof device.isIndoorCamera === 'function' && device.isIndoorCamera()) {
      return 'indoor';
    }
  } catch {
    // fall through to type checks
  }

  const type = device.getDeviceType();
  if (Device.isDoorbell(type)) {
    return 'doorbell';
  }
  if (Device.isIndoorCamera(type) || EXTRA_INDOOR_TYPES.has(type)) {
    return 'indoor';
  }
  return null;
}
