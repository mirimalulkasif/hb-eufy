import { isChargingState } from "./battery.js";
import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * Every `keypad` feature, declared once. `rssi` is a verified read and `charging` follows the app's own
 * decode of the keypad's charger state.
 *
 * `batteryLow` is `unexposed`: the app maps its param to the same low-battery field the entry and motion
 * sensors feed, but its value decode is absent from the app's parser, so the polarity is not evidenced.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const KEYPAD_MEMBERS: {
    /**
     * `APP_CMD_KEYPAD_BATTERY_CAP_STATE` (1653). The app's sensor parser maps it to `sensor_is_low_power`,
     * the field `APP_CMD_ENTRY_SENSOR_BAT_STATE` and `APP_CMD_MOTION_SENSOR_BAT_STATE` decode as a boolean,
     * yet gives 1653 itself no decode case. `unexposed` until a device confirms which value means low; in
     * the schema for `getProperty`, absent from the typed surface.
     */
    readonly batteryLow: {
        readonly param: 1653;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly unexposed: true;
        readonly description: string;
    };
    /**
     * `APP_CMD_KEYPAD_BATTERY_CHARGER_STATE` (1655), decoded the way the app's sensor parser decodes it:
     * `charging = value ∉ {0,2}` ({@link isChargingState}).
     */
    readonly charging: {
        readonly param: 1655;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly coerce: typeof isChargingState;
        readonly description: string;
    };
    /**
     * The keypad's link quality in dBm, on the same param 1141 the other sub-1G sensors report signal
     * strength on. Reported as the device measures it: raw dBm, never normalised to a bar count.
     */
    readonly rssi: {
        readonly param: 1141;
        readonly type: "number";
        readonly unit: "dBm";
        readonly kind: "dbm";
        readonly provenance: "verified";
        readonly description: "Keypad signal strength (verified: param 1141 = RSSI).";
    };
};
/** Bound keypad reads — the object returned by `dev.keypad()`. Read-only. */
export type KeypadActions = Surface<typeof KEYPAD_MEMBERS>;
/** `keypad` — security keypad. Charging, battery-low and signal. */
export declare const KEYPAD: CapabilityModule;
