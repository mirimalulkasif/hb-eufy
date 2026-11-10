/** The evidence a family decision needs — a structural subset of `CommandContext`. */
export interface FamilyContext {
    /** eufy vendor DeviceType, when known (undefined ⇒ unknown ⇒ don't guess). */
    deviceType?: number;
    /** Model / T-code, when known. */
    model?: string;
    /**
     * API category string — e.g. `"eufy_home"`, `"eufy_home_tuya"`, `"eufy_security"`. Supplied by
     * the mega `get_devs_list` response; absent in unit-test contexts that build a minimal context
     * without a real API record. Used as the PRIMARY transport discriminator for the clean line:
     * `"eufy_home_tuya"` devices are on the ThingClips/Tuya Cloud platform, not Anker AIoT MQTT.
     */
    category?: string;
    /**
     * Full device serial, when known. The one family split that no type number expresses: the vendor
     * reuses one DeviceType across generations of a product and distinguishes them by serial.
     */
    serial?: string;
}
/** Indoor cams, incl. indoor pan/tilt + S350/E30/C-series + mini. */
export declare const INDOOR_CAMERA_TYPES: ReadonlySet<number>;
/** Indoor pan/tilt S350 family. */
export declare const INDOOR_PT_S350_TYPES: ReadonlySet<number>;
/** Outdoor pan/tilt + solo-PT. */
export declare const OUTDOOR_PT_TYPES: ReadonlySet<number>;
/** Floodlight cams. */
export declare const FLOODLIGHT_TYPES: ReadonlySet<number>;
/** Wall-light cams. */
export declare const WALL_LIGHT_TYPES: ReadonlySet<number>;
/**
 * HomeBase-family hubs — the station-class devices with a built-in **speaker + alarm siren**, so
 * they own the hub-audio surface (alarm / voice-prompt volume). A deliberate SUBSET of the `station`
 * codec that EXCLUDES the NVRs (S4 Max, PoE NVR): those resolve to `station` for arming/storage but
 * have no speaker, so they must NOT expose the hub-audio controls (they'd fire at nothing). The
 * alarm/prompt wire is verified on HomeBase 3 (HB3); the other hubs, T9000 (`STATION_9000`) included,
 * share the hub hardware.
 */
export declare const HOMEBASE_TYPES: ReadonlySet<number>;
/** Indoor camera (any indoor variant). */
export declare const isIndoorCamera: (ctx: FamilyContext) => boolean;
/** Indoor cost-down "mini" cam. */
export declare const isIndoorCamMini: (ctx: FamilyContext) => boolean;
/** Indoor pan/tilt S350 family. */
export declare const isIndoorPanTiltS350: (ctx: FamilyContext) => boolean;
/** Outdoor pan/tilt (+ solo-PT) family. */
export declare const isOutdoorPanTilt: (ctx: FamilyContext) => boolean;
/** Floodlight cam family. */
export declare const isFloodLight: (ctx: FamilyContext) => boolean;
/** HomeBase-family hub (has a speaker/alarm) — a station EXCLUDING the NVRs, per `HOMEBASE_TYPES`. */
export declare const isHomeBase: (ctx: FamilyContext) => boolean;
/** HomeBase S1 Pro (`STATION_9000`), the station the app drives over its WebRTC control channel. */
export declare const isStation9000: (ctx: FamilyContext) => boolean;
/** T8N00 NVR, identified by its reported model. */
export declare const isNvrT8N00: (ctx: FamilyContext) => boolean;
/** PoE cameras whose media is served by their NVR's portal call. */
export declare const isNvrMediaCamera: (ctx: FamilyContext) => boolean;
/** PoE S4 camera with independently streamed fixed and movable optical views. */
export declare const isNvrDualLensCamera: (ctx: FamilyContext) => boolean;
/** Video Doorbell C31 (T8223) or C30 (T8224), streamed by the app over the portal `call` route. */
export declare const isCallDoorbell: (ctx: FamilyContext) => boolean;
/** Wired doorbell (DeviceType.DOORBELL). */
export declare const isWiredDoorbell: (ctx: FamilyContext) => boolean;
/**
 * Whether a vacuum uses the **Anker AIoT MQTT** transport (modern DP 150–180 protobuf scheme).
 *
 * A **negative exclusion**: returns `false` only for the one confirmed non-AIoT platform
 * (`"eufy_home_tuya"` — ThingClips/Tuya Cloud). Any absent, unknown, or unrecognised category
 * defaults to `true`, matching the polarity of `routeCommand` which sends `aiot-dp` to MQTT
 * unless `category === "eufy_home_tuya"`. The two gates agree: an unknown-category AIoT
 * vacuum both routes to MQTT *and* has its setters installed.
 *
 * | `category`          | platform                           | returns |
 * | ------------------- | ---------------------------------- | ------- |
 * | `"eufy_home"`       | Anker AIoT MQTT ✅ confirmed       | `true`  |
 * | `"eufy_home_tuya"`  | ThingClips/Tuya Cloud ✅ confirmed  | `false` |
 * | absent / any other  | unknown — default to AIoT          | `true`  |
 *
 * Live-confirmed categories sourced from `get_devs_list` dumps: `"eufy_home_tuya"` from a T2266
 * X8 Pro (2026-08-04). Additional category strings are added here as devices are captured.
 */
export declare const isAiotVacuum: (ctx: FamilyContext) => boolean;
/**
 * Whether a vacuum is on the **ThingClips/Tuya Cloud** platform (`"eufy_home_tuya"` category).
 *
 * The positive complement of the negative-exclusion {@link isAiotVacuum}: returns `true` only for
 * the one confirmed non-AIoT platform. Used to extend capability `available` guards so Tuya
 * vacuums receive the same write actions as AIoT ones, routed by the facade's `routeCommand`.
 */
export declare const isTuyaVacuum: (ctx: FamilyContext) => boolean;
/** Video Smart Lock S330, identified by its distinct cloud device type. */
export declare const isVideoSmartLock: (ctx: FamilyContext) => boolean;
/**
 * The classic Wi-Fi smart lock — the unit whose actuation rides a per-command ECDH-wrapped key rather than
 * the shared `ff09` frame: DeviceType 51 with a serial in the `T8520` range whose seventh character is `2`,
 * the one range driven on hardware. The DeviceType alone does not identify it, since later units share the
 * number and take the `ff09` frame, and a device whose serial is unknown is not guessed either way.
 */
export declare const isClassicWifiLock: (ctx: FamilyContext) => boolean;
