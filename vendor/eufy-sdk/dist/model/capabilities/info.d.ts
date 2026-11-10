import type { CapabilityModule } from "./types.js";
/**
 * Per-device identity metadata — the object returned by `dev.info()`. The standard identity fields
 * (manufacturer / model / serial / name / firmware / hardware version); `deviceType` is diagnostic.
 */
export interface DeviceInfo {
    /** Always "eufy" (Anker AIoT) — no per-device manufacturer on the wire. */
    manufacturer: string;
    /** Model / T-code (e.g. "T8410"), when known. */
    model?: string;
    /** Full device serial number, when known. */
    serialNumber?: string;
    /** Display name, when known. */
    name?: string;
    /** eufy numeric DeviceType, when known (diagnostic). */
    deviceType?: number;
    /** Firmware (main software) version (`main_sw_version`), when the device record carries it. */
    firmwareVersion?: string;
    /** Hardware version (`main_hw_version`), when the device record carries it. */
    hardwareVersion?: string;
    /** Secondary/sub firmware version (`sec_sw_version`, app label `firmware_sub_version`), when present. */
    firmwareSubVersion?: string;
    /** Wi-Fi MAC address (`wifi_mac`, app label `mac_address`), when present. */
    macAddress?: string;
    /** Whether the device reports a firmware update is available (`needUpdate`). */
    updateAvailable?: boolean;
}
export declare const INFO: CapabilityModule;
