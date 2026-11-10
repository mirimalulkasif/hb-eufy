import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * Robot-mower Tuya **DP ids** — the E15's Tuya product schema (`thing.m.device.ref.info.list` v5.4,
 * `schemaInfo.schema`, product `bvxrcjxom787vnit`), each id also reported by a live E15. The product
 * is built on Tuya's robot-vacuum template, so ids below 101 carry that template's codes; the mower's
 * own data points are 101-146.
 *
 * Only scalar data points are named here. The Raw ones (`robot_status` 107, `battery_status` 108,
 * `map_info` 113, the `*_control` commands 103-106, …) are protobuf messages whose field layout no
 * source in hand states, and 102 (`device_infomation`) and 142 (`gps_info`) carry the device's network
 * identity and position.
 * @internal
 */
export declare const MOWER_DP: {
    readonly BATTERY: 8;
    readonly VOLUME: 26;
    readonly CHILD_LOCK: 47;
    readonly RAIN_AUTO_RETURN: 101;
    readonly WIFI_SIGNAL: 109;
    readonly MOW_HEIGHT: 110;
    readonly SAVE_MAP_PROGRESS: 118;
    readonly STATION_USED_TIME: 125;
    readonly BLADE_USED_TIME: 126;
    readonly EDGE_TRIM: 128;
    readonly WORK_ANGLE_ENABLED: 130;
    readonly WORK_ANGLE: 131;
    readonly SMART_NO_GO_ZONES: 132;
    readonly BIRD_VIEW_CAPTURE: 133;
    readonly NETWORK: 134;
    readonly CELLULAR_ENABLED: 137;
    readonly EDGE_DISTANCE: 139;
    readonly GPS_ANTI_THEFT: 140;
    readonly SPARSE_LAWN_OPTIMIZATION: 141;
};
/** The `net_media_type` (DP 134) range, as the schema lists it. */
declare const MOWER_NETWORKS: readonly ["None", "Wifi", "Cellular"];
/** The mower's network link (DP 134). */
type MowerNetwork = (typeof MOWER_NETWORKS)[number];
/**
 * Every `mower` read, declared once.
 *
 * All read-only. Several of these data points are `rw` in the schema, but no write has been captured
 * against a mower, and the vendor app drives the mower through named pass-through commands rather than
 * by publishing these DPs, so no setter is installed.
 *
 * Exported but NOT published: each entry states its wire id, which the reference site does not carry.
 * @internal
 */
export declare const MOWER_MEMBERS: {
    /** Charge percentage (DP 8, `battery_percentage`). */
    readonly battery: {
        readonly param: 8;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly description: "Battery level 0-100 (DP 8, battery_percentage). Read-only.";
    };
    /** Speaker volume (DP 26, `volume_set`). */
    readonly volume: {
        readonly param: 26;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly description: "Speaker volume 0-100 (DP 26, volume_set). Read-only.";
    };
    /** Whether the child lock is on (DP 47, `child_lock`). */
    readonly childLock: {
        readonly param: 47;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Child lock on (DP 47, child_lock). Read-only.";
    };
    /** Whether the mower returns to its station when it detects rain (DP 101, `rain_auto_return`). */
    readonly rainAutoReturn: {
        readonly param: 101;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Return to the station when rain is detected (DP 101, rain_auto_return). Read-only.";
    };
    /** Wi-Fi signal strength as a percentage (DP 109, `wifi_signal_strength`), not a dBm reading. */
    readonly wifiSignal: {
        readonly param: 109;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly description: "Wi-Fi signal strength 0-100 % (DP 109, wifi_signal_strength). Read-only.";
    };
    /** Cutting height in millimetres (DP 110, `mow_height`), 25-75. */
    readonly cutHeight: {
        readonly param: 110;
        readonly type: "number";
        readonly unit: "mm";
        readonly kind: "millimetres";
        readonly min: 25;
        readonly max: 75;
        readonly provenance: "mega";
        readonly description: "Cutting height 25-75 mm (DP 110, mow_height). Read-only.";
    };
    /** Progress of saving the map (DP 118, `save_map_process`). */
    readonly mapSaveProgress: {
        readonly param: 118;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly description: "Map-save progress 0-100 % (DP 118, save_map_process). Read-only.";
    };
    /** Total base-station use in minutes (DP 125, `base_station_used_time`). */
    readonly stationUsedTime: {
        readonly param: 125;
        readonly type: "number";
        readonly unit: "min";
        readonly kind: "minutes";
        readonly provenance: "mega";
        readonly description: "Base-station use in minutes (DP 125, base_station_used_time). Read-only.";
    };
    /** Total cutting-blade use in minutes (DP 126, `mow_blade_used_time`). */
    readonly bladeUsedTime: {
        readonly param: 126;
        readonly type: "number";
        readonly unit: "min";
        readonly kind: "minutes";
        readonly provenance: "mega";
        readonly description: "Cutting-blade use in minutes (DP 126, mow_blade_used_time). Read-only.";
    };
    /** Whether edge trimming is on (DP 128, `edge_trim`). */
    readonly edgeTrim: {
        readonly param: 128;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Edge trimming on (DP 128, edge_trim). Read-only.";
    };
    /** Whether a fixed mowing angle is in use (DP 130, `enable_work_angle`); the angle is `workAngle`. */
    readonly workAngleEnabled: {
        readonly param: 130;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Fixed mowing angle in use (DP 130, enable_work_angle). Read-only.";
    };
    /** The mowing angle in degrees, -90 to 90 (DP 131, `work_angle`). */
    readonly workAngle: {
        readonly param: 131;
        readonly type: "number";
        readonly unit: "°";
        readonly kind: "degrees";
        readonly min: -90;
        readonly max: 90;
        readonly provenance: "mega";
        readonly description: "Mowing angle -90 to 90 degrees (DP 131, work_angle). Read-only.";
    };
    /** Whether smart no-go zones are on (DP 132, `enable_smart_forbid_zone`). */
    readonly smartNoGoZones: {
        readonly param: 132;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Smart no-go zones on (DP 132, enable_smart_forbid_zone). Read-only.";
    };
    /** Whether bird's-eye-view capture is on (DP 133, `enable_bird_view_capture`). */
    readonly birdViewCapture: {
        readonly param: 133;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Bird's-eye-view capture on (DP 133, enable_bird_view_capture). Read-only.";
    };
    /**
     * The network link in use (DP 134, `net_media_type`). Answers `undefined` for a value outside the
     * schema's range.
     */
    readonly network: {
        readonly param: 134;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown) => MowerNetwork | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly ["None", "Wifi", "Cellular"];
        readonly description: "Network link: None, Wifi or Cellular (DP 134, net_media_type). Read-only.";
    };
    /** Whether the cellular link is enabled (DP 137, `enable_cellular`). */
    readonly cellularEnabled: {
        readonly param: 137;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Cellular link enabled (DP 137, enable_cellular). Read-only.";
    };
    /** Edge-following distance in millimetres (DP 139, `follow_edge_distance`), signed. */
    readonly edgeDistance: {
        readonly param: 139;
        readonly type: "number";
        readonly unit: "mm";
        readonly kind: "millimetres";
        readonly min: -10000;
        readonly max: 10000;
        readonly provenance: "mega";
        readonly description: "Edge-following distance in mm, signed (DP 139, follow_edge_distance). Read-only.";
    };
    /** Whether GPS anti-theft is on (DP 140, `gps_location_check`). */
    readonly gpsAntiTheft: {
        readonly param: 140;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "GPS anti-theft on (DP 140, gps_location_check). Read-only.";
    };
    /** Whether sparse-lawn optimisation is on (DP 141, `sparse_lawn_optimization`). */
    readonly sparseLawnOptimization: {
        readonly param: 141;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Sparse-lawn optimisation on (DP 141, sparse_lawn_optimization). Read-only.";
    };
};
/**
 * Bound mower reads — the object returned by `dev.mower()`. Each getter is present only once the
 * mower has reported its data point.
 */
export type MowerActions = Surface<typeof MOWER_MEMBERS>;
/** `mower` — robot-mower state from its Tuya data points. */
export declare const MOWER: CapabilityModule;
export {};
