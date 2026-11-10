/**
 * AUTHORITATIVE param dictionary — the app's own decompiled constant names joined with a live
 * param-sweep of real owned devices.
 *
 * Two namespaces (params are per-transport, NOT globally unique):
 *  - SECURITY_PARAMS — eufy P2P param space (ids 1000+). **Membership is the observation**: an id is
 *    listed only because the sweep saw it on a real owned device, so the id is real/accepted.
 *    `provenance` is the trust of the NAME/meaning; the tiers are defined on `PropertySource` in
 *    `types.ts`.
 *  - CLEAN_PARAMS — RoboVac Tuya DP space (ids 1 and above), names from the cloud
 *    `get_product_data_point` data_point_list, hence provenance `mega`.
 *  - MOWER_PARAMS — robot-mower Tuya DP space, names from the mower's Tuya product schema.
 *
 * Which models reported an id, and the capture that named it, are in the commit that adds the entry.
 */
import type { PropertyValueType, PropertySource, ParamEncoding } from "./types.js";
/** One param definition in the dictionary. */
export interface ParamDef {
    /** Stable camelCase code-facing name. */
    name: string;
    type: PropertyValueType;
    provenance: PropertySource;
    /** How the wire value is encoded, when not a plain scalar (decode on read, encode on write). */
    encoding?: ParamEncoding;
}
/** eufy P2P security param space (ids 1000+). */
export declare const SECURITY_PARAMS: Record<number, ParamDef>;
/** RoboVac Tuya DP space (ids ~150-180), from get_product_data_point. */
export declare const CLEAN_PARAMS: Record<number, ParamDef>;
/**
 * eufy Smart Display (T87Ax) param space — ids 8001-8006.
 *
 * Its own table rather than a corner of {@link SECURITY_PARAMS}: nothing in the 8000s carries a security
 * meaning, so reading these ids there would decode a future security param assigned in this range as
 * whatever it means on a camera.
 *
 * Every id here was reported by a live T87A0 (captured 2026-09-04). That the device SENT an id is what
 * earns it a place in this table; the provenance label beside each one rates something narrower — how far
 * its NAME is trusted. `modelName` and `modelCode` are `mega`, their values matching what the cloud
 * record already carried. `battery` is `verified`: the id is real and the reading consistent, but the
 * name came from the maintainer's own knowledge of the hardware rather than from the cloud data-point
 * list, and `"100"` fits brightness, volume or charge equally.
 *
 * A dictionary entry is what makes a param readable by name off `getProperties()`. `capabilities/display.ts`
 * decides separately which of them reach the typed surface, and only `battery` does.
 *
 * **8002 (`"1"`) and 8004 (a serial-shaped string) are absent, deliberately.** Neither meaning is
 * legible from one value: `1` fits any enum or flag, and a serial could be the display's own or the
 * station's it is bound to. They arrive as `unknown_8002` / `unknown_8004`, which is the measure of this
 * list: it holds what is unknown, not what is unknowable. What would settle them: the vendor app's own
 * display settings screen, one control at a time, params diffed after each.
 */
export declare const DISPLAY_PARAMS: Record<number, ParamDef>;
/**
 * Robot-mower Tuya DP space — names from the E15's Tuya product schema (`schemaInfo.schema`), each id
 * also reported by a live E15. Only the scalar data points the `mower` capability reads are listed.
 */
export declare const MOWER_PARAMS: Record<number, ParamDef>;
