/**
 * Command-specific fields for the `0x0206` DP custom-colour action. The T8L02 frame applies one
 * foreground RGBCW block to every reported segment, carries no background colour, and marks the
 * selection as outside the cloud catalog. Framing, account identity and publication remain in MQTT.
 */
import type { DpField } from "./dp-codec.js";
export interface DpColorSpec {
    red: number;
    green: number;
    blue: number;
    segmentCount: number;
}
/** Serialize a validated semantic RGB intent into the complete confirmed `0xa3`-`0xb0` field run. */
export declare function dpColorFields(spec: DpColorSpec): DpField[];
