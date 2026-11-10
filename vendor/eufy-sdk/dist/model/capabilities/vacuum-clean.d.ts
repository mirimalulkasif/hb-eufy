import type { RawDpCodec } from "../../core/contracts.js";
import type { ParamValue } from "../types.js";
import type { AvailabilityContext, CapabilityModule } from "./types.js";
import { isTuyaVacuum } from "../device-family.js";
import { type Surface } from "./members.js";
import { type VacuumScene } from "../vacuum-scenes.js";
import { type VacuumSchedule } from "../vacuum-schedules.js";
/**
 * RoboVac Tuya **DP ids** this capability reads — the "clean" namespace (ids ~150-180, from the cloud
 * `get_product_data_point` schema). Named here so each DP is referenced by meaning rather than a magic
 * number, the same way the P2P capabilities name their feature-command ids (`CAMERA_CMD`, `LIGHT_CMD`).
 * Values confirmed against a live T2351 DP dump.
 */
/**
 * Which protobuf message each Raw DP carries, in each direction — the product catalogue's own
 * `下发`(downlink) / `上报`(uplink) note per data point, transcribed.
 *
 * The single most useful thing the catalogue gives that a DP number alone does not: a DP is Raw, and
 * knowing WHICH message it frames is what makes it decodable. Recorded here rather than rediscovered,
 * and deliberately as data rather than as code — nothing dispatches on it.
 *
 * Two entries are the vendor's own dead ends: DP 150 is marked "预留。不使用。" — reserved, NOT used —
 * and 165/175 are reserved with no message at all. Do not build on them.
 */
export declare const VACUUM_DP_MESSAGE: Readonly<Record<number, {
    readonly send?: string;
    readonly report?: string;
}>>;
export declare const VACUUM_DP: {
    /** Power on/off (DP 151 power switch, Bool). */
    readonly POWER: 151;
    /** WorkStatus (DP 153 work status, Raw protobuf) — carries the activity in field #2 (see {@link decodeVacuumActivity}). */
    readonly WORK_STATUS: 153;
    /** ModeCtrlRequest (DP 152, Raw protobuf) — carries the mode-control command (start/pause/dock). */
    readonly MODE_CTRL: 152;
    /** CleanParam (DP 154 clean params, Raw protobuf) — carries the cleaning type (see {@link decodeCleanType}). */
    readonly CLEAN_PARAM: 154;
    /** Speaker volume 0-100 (DP 161, Value). */
    readonly VOLUME: 161;
    /**
     * LanguageResponse (DP 162, Raw protobuf) — the VOICE PACK, not a locale (see {@link decodeLanguageField}).
     * Named for the vendor's own `language` code, which is what the catalogue calls it.
     */
    readonly LANGUAGE: 162;
    /** Battery level 0-100 (DP 163, Value) — a clean-namespace DP, NOT the security param 1101. */
    readonly BATTERY: 163;
    /** UndisturbedResponse (DP 157, Raw protobuf) — the do-not-disturb window (see {@link decodeDoNotDisturb}). */
    readonly DO_NOT_DISTURB: 157;
    /** CleanStatistics (DP 167, Raw protobuf) — session and lifetime totals (see {@link decodeCleanStat}). */
    readonly CLEAN_STATS: 167;
    /** Remote-control direction (DP 155, Enum: Brake/Forward/Back/Left/Right). Steering, not a ModeCtrl verb. */
    readonly REMOTE_CTRL: 155;
    /** `pause_job` (DP 156, Bool) — resume an interrupted job after charging. The vendor's 断点续扫. */
    readonly RESUME_CLEAN: 156;
    /** `timing` (DP 164, Raw) — TimerRequest/TimerResponse. THIS is where schedules live. */
    readonly TIMING: 164;
    /** SceneResponse (DP 180, Raw protobuf) — the saved cleaning scenes, and a source of real map ids. */
    readonly SCENES: 180;
    /** ConsumableRuntime (DP 168, Raw protobuf) — hours used per replaceable part (see {@link decodeConsumableHours}). */
    readonly CONSUMABLES: 168;
    /** UnisettingResponse (DP 176, Raw protobuf) — the device-wide setting toggles (see {@link decodeUnisetting}). */
    readonly SETTINGS: 176;
    /** ErrorCode (DP 177 fault alert, Raw protobuf) — the robot's faults and warnings (see {@link decodeVacuumFault}). */
    readonly FAULT_ALERT: 177;
};
/**
 * Tuya DP ids for the `eufy_home_tuya` vacuum category (X8 Pro, X-series, and future Tuya clean-line models).
 *
 * Full schema sourced from `thing.m.device.ref.info.list` v5.4 for product `wahqax6ifjgs1c4n`
 * (schemaInfo.schema, 39 DPs). Only the DPs with confirmed read-side values from a live
 * `thing.m.device.dp.get` call are included here. Write direction for all DPs is unverified —
 * no live publishDps capture has been made yet.
 *
 * **The one table for this line.** Every id the Tuya clean line uses is spelled here and nowhere else,
 * including DP 103, which the `locate` capability reads and writes. One line spelled twice is how two
 * tables come to disagree while each stays individually plausible.
 *
 * **Checked against `jeppesens/eufy-clean`'s `LEGACY_DPS_MAP`** and nothing came back to port. Its nine
 * ids — 2, 3, 5, 15, 101, 102, 103, 104, 106 — are all here, all live-confirmed on a real X8 Pro, and
 * all carry their enum value sets, which that map does not. Its `SCALAR_DPS` table is a different
 * matter and deliberately untouched: that is a separate device class reusing these numbers for
 * unrelated things (153 is a brush-detangle trigger there and the work status here), so it must be told
 * apart by value SHAPE, never by DP number.
 * @internal
 */
export declare const TUYA_VACUUM_DP: {
    /** Power on/off (DP 1, Bool). */
    readonly POWER: 1;
    /** Play/pause toggle (DP 2, Bool rw) — true = start, false = pause. */
    readonly PLAY_PAUSE: 2;
    /** Manual direction jog (DP 3, Enum: "forward"|"back"|"left"|"right"). */
    readonly DIRECTION: 3;
    /** Cleaning mode (DP 5, Enum: "auto"|"room"|"zone"|"spot"|"fast_mapping"). Live-confirmed "auto". */
    readonly MODE: 5;
    /** Work status (DP 15, Enum string) — the high-level activity. Live-confirmed "Sleeping". */
    readonly WORK_STATUS: 15;
    /** Return to dock (DP 101, Bool rw). */
    readonly GO_HOME: 101;
    /** Suction/cleaning strength (DP 102, Enum: "Off"|"Quiet"|"Standard"|"Turbo"|"Max"). Live-confirmed "Off". */
    readonly CLEANING_STRENGTH: 102;
    /**
     * Find-robot beep (DP 103, `look_for_sweeper`, Bool). Live-confirmed.
     *
     * Read and written by the `locate` capability, which owns the feature across both clean lines —
     * named here so this table is the one place the Tuya line's ids are spelled.
     */
    readonly LOOK_FOR_SWEEPER: 103;
    /** Battery level 0-100 (DP 104, Value ro). */
    readonly BATTERY_LEVEL: 104;
    /** Mop water flow (DP 105, Enum: "Dry"|"Low"|"Mid"|"High"). Live-confirmed "Mid". */
    readonly MOP_WATER: 105;
    /** Fault code, 0 = ok (DP 106, Value ro). */
    readonly FAULT_REPORT: 106;
    /** Do-not-disturb / forbid mode (DP 107, Bool). Live-confirmed false. */
    readonly FORBID_MODE: 107;
    /** Session cleaning time in seconds (DP 109, Value). Live-confirmed 4200 (= 70 min). */
    readonly CLEAR_TIME: 109;
    /** Session cleaned area in m² (DP 110, Value). Live-confirmed 54. */
    readonly CLEAR_AREA: 110;
    /** Speaker loudness 0-100 (DP 111, Value). Live-confirmed 38. */
    readonly LOUDNESS: 111;
    /** Configured cleaning type (DP 113, Enum: "Sweep"|"SweepMop"|"Mop"). Live-confirmed "Sweep". */
    readonly CLEAN_TYPE: 113;
    /** Total lifetime cleaning time in seconds (DP 119, Value). */
    readonly CLEAR_TOTAL_TIME: 119;
    /** Total lifetime cleaned area in m² (DP 120, Value). */
    readonly CLEAR_TOTAL_AREA: 120;
    /** Water tank attached (DP 127, Bool ro). */
    readonly WATER_TANK_STATUS: 127;
    /** Mop pad attached (DP 129, Bool ro). */
    readonly MOP_STATUS: 129;
    /** WiFi RSSI in dBm (DP 134, Value). */
    readonly RSSI: 134;
};
/**
 * `thing.m.device.ref.info.list` v5.4 `schemaInfo.schema` confirmed values for DP 15 (status).
 *
 * Exported but not published — `VacuumActivity` is the
 * union that matters externally.
 * @internal
 */
export declare const TUYA_WORK_STATUS_VALUES: readonly ["standby", "Running", "Sleeping", "Recharge", "Charging", "completed", "Goto", "Locating", "Collecting", "RollAutoCleaning", "CC_Recharge", "CC_Charging"];
/**
 * Confirmed values for DP 5 (mode) from schemaInfo.schema.
 * @internal
 */
export declare const TUYA_WORK_MODES: readonly ["auto", "room", "zone", "spot", "fast_mapping"];
/** @internal */
export type TuyaWorkMode = (typeof TUYA_WORK_MODES)[number];
/**
 * Confirmed values for DP 102 (cleaning_strength) from schemaInfo.schema. Live-confirmed "Off".
 * @internal
 */
export declare const TUYA_CLEANING_STRENGTHS: readonly ["Off", "Quiet", "Standard", "Turbo", "Max"];
/** @internal */
export type TuyaCleaningStrength = (typeof TUYA_CLEANING_STRENGTHS)[number];
/**
 * Confirmed values for DP 105 (MopWater) from schemaInfo.schema. Live-confirmed "Mid".
 * @internal
 */
export declare const TUYA_MOP_WATER_LEVELS: readonly ["Dry", "Low", "Mid", "High"];
/** @internal */
export type TuyaMopWaterLevel = (typeof TUYA_MOP_WATER_LEVELS)[number];
/**
 * Confirmed values for DP 113 (CleanType) from schemaInfo.schema. Live-confirmed "Sweep".
 * @internal
 */
export declare const TUYA_CLEAN_TYPES: readonly ["Sweep", "SweepMop", "Mop"];
/** @internal */
export type TuyaCleanType = (typeof TUYA_CLEAN_TYPES)[number];
/**
 * `ModeCtrlRequest.method` values for DP 152. Live-verified on T2351: START_GOHOME → 6,
 * PAUSE_TASK → 13. An auto clean is `START_AUTO_CLEAN` (0) with a payload — see
 * {@link ModeCtrlParamMethod}.
 */
export declare const ModeCtrlMethod: {
    /** Live-verified on a T2351. */
    readonly START_GOHOME: 6;
    /** Live-verified on a T2351. */
    readonly PAUSE_TASK: 13;
    readonly START_SPOT_CLEAN: 3;
    readonly START_RC_CLEAN: 5;
    readonly START_FAST_MAPPING: 9;
    readonly START_GOWASH: 10;
    readonly STOP_TASK: 12;
    /** Live-verified on a T2351: the app's Resume sends method 14, seq continuing the shared counter. */
    readonly RESUME_TASK: 14;
    readonly STOP_GOHOME: 15;
    readonly STOP_RC_CLEAN: 16;
    readonly STOP_GOWASH: 17;
    readonly STOP_SMART_FOLLOW: 18;
    readonly START_GLOBAL_CRUISE: 20;
};
/**
 * The area-selecting `ModeCtrlRequest` methods, and the `Param` field each one's payload rides in.
 *
 * Kept apart from {@link ModeCtrlMethod} because these are a different kind of thing: a parameterless
 * verb is complete on its own, whereas each of these is meaningless without an argument the caller has
 * to supply. Sending one with an empty payload is a well-formed frame that means something nobody
 * intended, which is exactly why the numbers do not sit beside the others. Each verb built on one takes
 * its argument in the signature: {@link VACUUM_CLEAN_MEMBERS.startScene},
 * {@link VACUUM_CLEAN_MEMBERS.cleanRooms} and {@link VACUUM_CLEAN_MEMBERS.cleanZones}.
 *
 * The outer frame these ride in is byte-verified on a live T2351, and `AUTO`, `SCENE`, `SELECT_ROOMS`
 * and `SELECT_ZONES` have each since been RUN on a T2351 and did what they name — so their numbers rest
 * on observed behaviour rather than on the vendor's definition alone. `AUTO` is RUN with its payload:
 * the vendor's definition calls `AutoClean.clean_times` valid only when non-zero, and the T2351 did
 * not start on method 0 sent without it.
 *
 * That distinction is the whole point of checking, and this is the one place it is argued: an AIoT
 * data-point write is fire-and-forget, so a wrong number would be a different command arriving and
 * looking exactly like success, which no frame check could catch. Watching the number is the only thing
 * that rules it out.
 *
 * `GOTO` carries no encoder because a goto point is a coordinate no read on this SDK supplies, where a
 * scene id and a map id both arrive on DP 180.
 */
export declare const ModeCtrlParamMethod: {
    /** `START_AUTO_CLEAN` with an `AutoClean` payload — clean the whole floor. */
    readonly AUTO: {
        readonly method: 0;
        readonly param: 3;
    };
    /** `START_SELECT_ROOMS_CLEAN` — clean the named rooms of a named map. */
    readonly SELECT_ROOMS: {
        readonly method: 1;
        readonly param: 4;
    };
    /** `START_SELECT_ZONES_CLEAN` — clean the given rectangles of a named map. */
    readonly SELECT_ZONES: {
        readonly method: 2;
        readonly param: 5;
    };
    /** `START_GOTO_CLEAN` — drive to a point and clean around it. */
    readonly GOTO: {
        readonly method: 4;
        readonly param: 7;
    };
    /** `START_SCENE_CLEAN` — run a saved scene by its id. */
    readonly SCENE: {
        readonly method: 24;
        readonly param: 14;
    };
};
/** One room to clean, and where it falls in the running order. */
export interface VacuumRoomTarget {
    /** The room's id, as the device's own map data names it. */
    readonly id: number;
    /** Where this room falls in the run. Omitted rooms are visited in the order given. */
    readonly order?: number;
}
/** One rectangular zone to clean, as four corners in centimetres. */
export interface VacuumZoneTarget {
    /** The four corners, in centimetres, in the device's own map frame. Exactly four points. */
    readonly corners: readonly {
        readonly x: number;
        readonly y: number;
    }[];
    /** How many passes to make over this zone. */
    readonly cleanTimes?: number;
}
/**
 * Build a room-select clean for a named map.
 *
 * `mapId` is required and has no default, deliberately. The obvious shortcut is to assume the map a
 * single-floor home would have; on a two-floor home that silently sends the robot's ids against the
 * wrong floor's map. A caller that cannot name the map cannot safely make this call, and saying so is
 * better than picking for them. {@link VACUUM_CLEAN_MEMBERS.cleanRooms} dispatches this.
 * @internal
 */
export declare function encodeSelectRoomsClean(mapId: number, rooms: readonly VacuumRoomTarget[], cleanTimes?: number): string;
/**
 * Build a zone-select clean for a named map. Same `mapId` reasoning as {@link encodeSelectRoomsClean}.
 * @internal
 */
export declare function encodeSelectZonesClean(mapId: number, zones: readonly VacuumZoneTarget[]): string;
/**
 * Build a scene clean, which needs only the scene's own id — `VacuumScene.id`, as DP 180 reports it.
 * {@link VACUUM_CLEAN_MEMBERS.startScene} dispatches this.
 * @internal
 */
export declare function encodeSceneClean(sceneId: number): string;
/**
 * Build a whole-floor auto clean carrying an `AutoClean` payload of one pass.
 * @internal
 */
export declare function encodeAutoClean(): string;
/**
 * Encode a `ModeCtrlRequest` protobuf (DP 152) as a DP value: `varint(bodyLen) ++ {method:1, seq:2}`.
 *
 * Built on {@link RawDpWriter} rather than hand-rolled bytes. The frame is unchanged and the existing
 * byte-level test is what proves it — that test was written against a live T2351 capture, so it holds
 * the writer to the wire rather than to this function's own idea of the wire.
 * @internal
 */
export declare function encodeModeCtrl(method: number, seq: number): string;
/**
 * Every value {@link VacuumActivity} can take, as data — the read's declared domain, so the schema a
 * caller reads and the type it compiles against are the same list rather than two that can drift.
 *
 * Exported but not published — `VacuumActivity` is the union a
 * reader of the reference needs, and it states the same members.
 * @internal
 */
export declare const VACUUM_ACTIVITIES: readonly ["idle", "error", "docked", "cleaning", "returning", "paused", "unknown"];
/**
 * The robot's high-level activity — what `dev.vacuumClean()?.activity` reports. `"unknown"` covers a
 * status the SDK can't classify yet. `"cleaning"` is the widest member: it also covers mapping,
 * cruising and manual remote driving, which the wire distinguishes and this union does not.
 */
export type VacuumActivity = (typeof VACUUM_ACTIVITIES)[number];
/**
 * Decode a DP 15 string to a {@link VacuumActivity} for the X8 Pro. Returns `"unknown"` for any
 * value absent from the confirmed schema set, so every valid raw string from the device yields
 * a typed result rather than `undefined`.
 * @internal
 */
export declare function decodeTuyaWorkStatus(raw: ParamValue | undefined): VacuumActivity;
/**
 * `WorkStatus.Charging.state` — whether a charge is running, finished, or faulted.
 *
 * `DOING` is the enum's zero and so is absent from the wire, which is why the CONTAINER's presence is
 * the signal that the robot is on contacts at all: an absent `charging` message means it is not
 * charging, and a present-but-empty one means it is charging normally.
 */
export declare const CHARGE_STATES: readonly ["charging", "charged", "fault"];
export type ChargeState = (typeof CHARGE_STATES)[number];
/**
 * `WorkStatus.Trigger.Source` — who or what caused the state the robot is now in.
 *
 * Worth surfacing rather than inferring: an automation that reacts to "returning to dock" behaves
 * differently when the robot did it because a schedule fired, because someone pressed the button on
 * its lid, or because it ran low on battery. `"unknown"` is the vendor's own zero and is what a robot
 * reports just after boot, so it is a real answer rather than a decode failure.
 */
export declare const TRIGGER_SOURCES: readonly ["unknown", "app", "button", "schedule", "robot", "remote"];
export type TriggerSource = (typeof TRIGGER_SOURCES)[number];
/**
 * Decode the charge state out of a `WorkStatus` (DP 153).
 *
 * `undefined` means the robot is NOT charging — the vendor omits the whole message rather than sending
 * a "not charging" value, so absence is the answer and not a gap. A present message with no `state`
 * reads as `"charging"`, the enum's zero.
 * @internal
 */
export declare function decodeChargeState(raw: ParamValue | undefined, codec: RawDpCodec | undefined): ChargeState | undefined;
/**
 * Decode what triggered the current state out of a `WorkStatus` (DP 153).
 * @internal
 */
export declare function decodeTriggerSource(raw: ParamValue | undefined, codec: RawDpCodec | undefined): TriggerSource | undefined;
/**
 * Every value {@link VacuumCleanType} can take — the read's declared domain, see `VACUUM_ACTIVITIES`.
 *
 * Exported but not published, like `VACUUM_ACTIVITIES`.
 * @internal
 */
export declare const VACUUM_CLEAN_TYPES: readonly ["sweep", "mop", "sweepAndMop", "sweepThenMop"];
/**
 * What the robot is **set** to do with a surface — `dev.vacuumClean()?.cleanType`. This is the setting,
 * not what a job in progress is doing; the two disagree while a change is being applied.
 *
 * `mop` and `sweepAndMop` are verified on a real robot. `sweepThenMop` comes from the vendor's own
 * enumeration and has not been observed on a device yet. `"sweep"` also covers **"no type stated"** —
 * a robot that states none is indistinguishable from one set to sweep-only, and this read cannot tell
 * them apart.
 */
export type VacuumCleanType = (typeof VACUUM_CLEAN_TYPES)[number];
/**
 * `mop_mode.level` — how much water the mop lays down.
 *
 * Confirmed on a live T2351: setting the app's water level to High reported `mop_mode { level: 2 }`.
 */
export declare const MOP_LEVELS: readonly ["low", "middle", "high"];
export type MopLevel = (typeof MOP_LEVELS)[number];
/** `clean_carpet.strategy` — what the robot does when it meets a carpet. */
export declare const CARPET_STRATEGIES: readonly ["autoRaise", "avoid", "ignore"];
export type CarpetStrategy = (typeof CARPET_STRATEGIES)[number];
/**
 * `clean_extent.value` — how far past the mapped edge a job reaches.
 *
 * **Not the app's display order.** The app lists these differently, so the raw index and the app's own
 * position for it disagree; the names here follow the wire, which is the only order this SDK can vouch
 * for.
 */
export declare const CLEAN_EXTENTS: readonly ["normal", "narrow", "quick"];
export type CleanExtent = (typeof CLEAN_EXTENTS)[number];
/**
 * Build a `CleanParamRequest` (DP 154) stating the three cleaning settings a run uses.
 *
 * The message is `{ clean_param: CleanParam }` — field 1 of the request, carrying the same `CleanParam`
 * this module decodes out of field 1 of the reports it receives, so the shape a write sends is the
 * shape a read has already been proven against on live hardware.
 *
 * All three settings are stated together because one message carries all three: a write naming fewer
 * would be a `CleanParam` with the rest silent, and what a robot does with a half-stated one is not
 * something this SDK has observed. `clean_times`(7) is never written — the vendor's own field comment
 * makes zero mean "not stated", so omitting it leaves the robot's configured pass count alone — and
 * neither is `fan`(6), which belongs to the suction capability's own data point.
 *
 * {@link VACUUM_CLEAN_MEMBERS.setCleanParam} dispatches this.
 * @internal
 */
export declare function encodeCleanParam(cleanType: VacuumCleanType, cleanExtent: CleanExtent, mopLevel: MopLevel): string;
/**
 * Read one setting out of the CONFIGURED `CleanParam` (DP 154), by its field number.
 *
 * The generalisation of {@link decodeCleanType}, and it reads the same container for the same reason:
 * a report taken mid-change carries a different value in `clean_param`(1) and `running_clean_param`(4),
 * and the SETTING is the stable answer.
 *
 * **How the inner value is found, and why it is not a second field number.** The vendor wraps each
 * setting in its own single-field message — `CleanType{value}`, `CleanCarpet{strategy}`,
 * `CleanExtent{value}` — where the wrapper's name and its field's name differ per setting but the
 * shape does not. Rather than assert a number for each inner field, this takes the FIRST varint the
 * wrapper carries. The 1→1→1 nesting is live-proven for `clean_type`; taking the first scalar is what
 * extends that to its siblings without claiming a number for any of them.
 *
 * The cost is stated rather than hidden: a wrapper that ever carries more than one scalar would read
 * its first, so this is only used for the settings documented as single-valued. `mop_mode`(4) carries
 * both a level and a corner-clean flag and is deliberately NOT read here for that reason.
 *
 * A present-but-empty wrapper answers `0` — proto3 omits a zero, so the enum's zero member and "the
 * wrapper said nothing" are the same bytes. An absent wrapper is `undefined`: the device did not state
 * this setting at all.
 * @internal
 */
export declare function decodeCleanParamValue(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number, inner?: number): number | undefined;
/**
 * Decode the cleaning type out of a `CleanParam` (DP 154) Raw-DP value.
 *
 * Reads the CONFIGURED container, not the running one: a report mid-change carries a different type in
 * each, and the setting is the stable answer. Every level is presence-checked rather than defaulted —
 * the vendor wraps each enum in its own single-field message precisely so that a wrapper's presence
 * says "this was stated", and an absent wrapper yields `undefined` rather than a fabricated `"sweep"`.
 *
 * **Known ambiguity, unresolvable on the wire.** The protocol omits zero-valued fields, so an empty
 * `CleanType{}` and an explicit `SWEEP_ONLY` are the same bytes. Both read as `"sweep"`. A robot that
 * states no type therefore looks like a sweeping robot, and nothing in the payload can distinguish
 * them — resolving it needs a capture of one device with a known-non-sweep setting at rest.
 * @internal
 */
export declare function decodeCleanType(raw: ParamValue | undefined, codec: RawDpCodec | undefined): VacuumCleanType | TuyaCleanType | undefined;
/**
 * Decode the robot's current fault code from either clean line.
 *
 * The two lines carry the same meaning on different wires, so this discriminates on the value's SHAPE
 * the way {@link decodeCleanType} does: the legacy Tuya line reports DP 106 as a plain integer, the
 * AIoT line reports DP 177 as an `ErrorCode` protobuf.
 *
 * `error` is preferred over `warn`: a fault that stops the robot is the more urgent answer when both
 * are listed. Only the FIRST code of the winning list is answered — the property is one number, and a
 * caller needing the whole set needs a shape this schema cannot express (see the module's members).
 *
 * `0` means the device stated no fault. `undefined` means it did not state one at all — an unbound
 * device, or a payload that does not decode — and the two are deliberately different.
 * @internal
 */
export declare function decodeVacuumFault(raw: ParamValue | undefined, codec: RawDpCodec | undefined): number | undefined;
/**
 * Decode one end of the do-not-disturb window as `"HH:MM"`, or `undefined`.
 *
 * One string rather than two numbers per end: four properties for one window is four pieces to
 * reassemble, and they are meaningless apart. `undefined` means no window is configured at
 * all — distinct from `"00:00"`, which is midnight and a real setting.
 *
 * The times are the ROBOT's own clock, with no zone attached. The vendor sends none here, unlike a
 * schedule, which carries the phone's UTC offset per timer.
 * @internal
 */
export declare function decodeDoNotDisturbTime(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): string | undefined;
/**
 * Decode the do-not-disturb switch from either clean line.
 *
 * Discriminates on the value's SHAPE, as {@link decodeCleanType} and {@link decodeVacuumFault} do: the
 * Tuya line reports DP 107 as a plain bool, the AIoT line reports DP 157 as an `UndisturbedResponse`.
 *
 * A present-but-empty `Switch` reads as `false` rather than as missing — proto3 omits a zero-valued
 * field, so "switched off" and "said nothing about the switch" are the same bytes once the container
 * around them is there. An absent CONTAINER is still `undefined`: that is the device not answering.
 * @internal
 */
export declare function decodeDoNotDisturb(raw: ParamValue | undefined, codec: RawDpCodec | undefined): boolean | undefined;
/**
 * Decode the live in-window flag from an `UndisturbedResponse` (DP 157).
 *
 * The companion to {@link decodeDoNotDisturb}, which reports whether the feature is switched ON. This
 * one reports whether the quiet window is open RIGHT NOW — two different questions the same DP answers,
 * which is why this member reads its sibling's payload instead of claiming a wire of its own.
 *
 * **`active` is `Switch`-wrapped** — confirmed on a live T2351, which inside its quiet window reports
 * `active { value: 1 }` beside `undisturbed { sw { value: 1 }, begin { hour: 9 }, end { hour: 23 } }`.
 * The bare-varint branch is kept regardless: it costs one comparison, and a reader that accepts both
 * cannot be broken by a firmware that changes its mind.
 *
 * The AIoT line only. On the Tuya line DP 107 is a plain bool carrying the SWITCH, and no wire there
 * states the window — so a non-protobuf value answers `undefined` rather than borrowing the switch.
 *
 * An absent `active` beside a present `undisturbed` reads as `false`: proto3 omits a zero, so "the
 * window is not open" and "said nothing about it" are the same bytes once the message is recognisable.
 * An absent `undisturbed` is `undefined` — the payload is not one of these at all.
 * @internal
 */
export declare function decodeDoNotDisturbActive(raw: ParamValue | undefined, codec: RawDpCodec | undefined): boolean | undefined;
/**
 * Read one figure out of a `CleanStatistics` (DP 167), or take a plain number as it stands.
 *
 * Both clean lines answer through this. The legacy Tuya line puts each figure on its own DP as a bare
 * integer; the AIoT line buries all of them in one message. The value's SHAPE says which arrived — the
 * same discrimination {@link decodeCleanType} and {@link decodeVacuumFault} use to span the two lines on
 * one property, and the reason these figures need only one name each rather than one per platform.
 *
 * A present-but-empty container reads as `0`: a robot that has just started a run has cleaned no area,
 * and proto3 omits the zero. An absent container is `undefined` — this device does not report it.
 *
 * **The plain-number passthrough belongs to a member that owns its own Tuya DP**, where that DP carries
 * exactly the figure being asked for. A member with no wire of its own must not use it: its owner may
 * have been installed by a read ALIAS, and it would then be handed another figure entirely — the Tuya
 * DP 109 session duration reported as a lifetime run count. Such a member screens the value first; see
 * `lifetimeCleanCount`.
 * @internal
 */
export declare function decodeCleanStat(raw: ParamValue | undefined, codec: RawDpCodec | undefined, container: number, field: number): number | undefined;
/**
 * Decode one `Switch`-wrapped toggle out of a `UnisettingResponse` (DP 176).
 *
 * Every toggle in this message is the same two-level shape — a single-field `Switch` wrapper whose
 * `value` is the bool — so one reader serves all of them and each member only names its field number.
 *
 * **Response numbers only.** The REQUEST counterpart numbers the same settings differently and only
 * `children_lock` sits at 1 in both, so {@link UNISETTING_FIELD} is a read-side table and a writer of
 * this DP must never borrow it. That is the trap this whole message carries; see the constant's doc.
 *
 * A present-but-empty `Switch` reads as `false`: proto3 omits a zero, so "off" and "said nothing about
 * this toggle" are the same bytes once the wrapper is there. An absent wrapper is `undefined` — the
 * device did not report the setting at all.
 * @internal
 */
export declare function decodeUnisetting(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): boolean | undefined;
/**
 * Read one top-level `string` field out of a `DeviceInfo` (DP 169).
 *
 * An absent or empty field answers `undefined`: proto3 omits an empty string, so "this robot did not
 * say" and "it said nothing" are the same bytes, and an empty SSID is not a network name.
 * @internal
 */
export declare function decodeRobotInfoText(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): string | undefined;
/**
 * Read the robot's hardware revision out of a `DeviceInfo` (DP 169) — a plain integer, unlike every
 * other field of this message.
 * @internal
 */
export declare function decodeRobotHardware(raw: ParamValue | undefined, codec: RawDpCodec | undefined): number | undefined;
/** `LanguageResponse.State` — where a voice-pack download has got to. */
export declare const VOICE_PACK_STATES: readonly ["idle", "updating", "success", "failure"];
export type VoicePackState = (typeof VOICE_PACK_STATES)[number];
/**
 * Read one varint field out of a `LanguageResponse` (DP 162).
 *
 * A flat message, so one level rather than the two the consumables and settings reports need. A field
 * absent from a payload that DID parse reads as `0`, the proto3 default — for `current_id` that is the
 * vendor's own way of saying the robot is on the pack it shipped with. An unparseable payload is
 * `undefined`: the device said nothing this can be read from.
 * @internal
 */
export declare function decodeLanguageField(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): number | undefined;
/**
 * Read a `Numerical`-wrapped value out of a `UnisettingResponse` (DP 176) as the NUMBER it is.
 *
 * `Numerical { uint32 value = 1 }` and `Switch { bool value = 1 }` are the same two bytes on the wire.
 * So a `Numerical` read through {@link decodeUnisetting} is accepted without complaint and reports
 * "30 minutes" as `true`: nothing errors, nothing looks wrong, and the number is gone.
 * `dust_full_remind` is one of these.
 *
 * A present-but-empty wrapper reads as `0`, which for a duration means the feature is off.
 * @internal
 */
export declare function decodeUnisettingNumber(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): number | undefined;
/**
 * Which layers the robot's live map carries, by bit position — the vendor's `LiveMap.StateBit`.
 *
 * A bitmask rather than an enum: the vendor's own comment says the values combine, so a map with a
 * base layer and room outlines reports both bits at once. Published as named bit positions rather than
 * as raw shifts.
 */
export declare const LIVE_MAP_BITS: {
    readonly base: 0;
    readonly rooms: 1;
    readonly kitchen: 2;
    readonly pet: 3;
};
/**
 * Read a `Switch`- or `Active`-wrapped bool out of `UnisettingResponse.unistate` (DP 176).
 *
 * Two levels down rather than one: the toggles sit at the top of the message and these sit inside
 * `unistate`, so the ordinary toggle reader finds nothing here.
 * @internal
 */
export declare function decodeUnistateFlag(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): boolean | undefined;
/**
 * Read a bare `uint32` out of `UnisettingResponse.unistate` (DP 176), or one nested a further level
 * inside a wrapper there — `live_map.state_bits` is the only field that needs the second step.
 * @internal
 */
export declare function decodeUnistateNumber(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number, inner?: number): number | undefined;
/**
 * Read a BARE `uint32` off the top level of a `UnisettingResponse` (DP 176).
 *
 * `ap_signal_strength` is the one field of this message that is not wrapped in anything, so neither of
 * the two readers above reaches it: both step into a sub-message that is not there.
 * @internal
 */
export declare function decodeUnisettingTopLevel(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): number | undefined;
/**
 * `ConsumableRequest.Type` — which part a reset clears, in the vendor's REQUEST numbering.
 *
 * **These are not the response's field numbers and must never be swapped for them.** The report puts
 * the side brush at field 1 and the dirty-water tank at 10; the request enumerates from ZERO with no
 * gap, so the side brush is 0 and the dirty-water tank is 7. Nine parts, two numbering schemes, one
 * message pair — the same trap `UNISETTING_FIELD` carries, and the reason a reader's table is never a
 * writer's.
 */
/** The replaceable parts whose hours-used counter can be reset. */
export declare const CONSUMABLE_PARTS: readonly ["sideBrush", "rollingBrush", "filter", "scraper", "sensors", "mop", "dustBag", "dirtyWaterTank", "dirtyWaterFilter"];
export type ConsumablePart = (typeof CONSUMABLE_PARTS)[number];
/** Part name to the vendor's `ConsumableRequest.Type`, in one table so no index arithmetic can drift. */
export declare const CONSUMABLE_RESET_TYPE: Readonly<Record<ConsumablePart, number>>;
/**
 * Build a `ConsumableRequest` (DP 168) clearing the hours on one part.
 *
 * `reset_types` is REPEATED, so the wire shape allows clearing several at once. Only one is offered:
 * a caller replacing two parts can send two frames, and a single-part call is the one that cannot be
 * half-right — an accidental multi-reset silently discards service history the device never
 * recomputes.
 *
 * **Unverified.** The message and its enum are the vendor's own, and the app has the feature
 * (`resetAccessory(deviceId, accessory, callback)` → `resetAccessories`, taking exactly this kind of
 * integer part id), but no capture has shown the frame accepted — so no setter is installed.
 * @internal
 */
export declare function encodeConsumableReset(part: ConsumablePart): string;
/**
 * Decode one part's hours-used out of a `ConsumableRuntime` (DP 168).
 *
 * Same two-level shape for every part, so one reader serves all nine and each member names its field.
 *
 * A present-but-empty `Duration` reads as `0`, not as missing: a part fitted and never run has no hours
 * on it, and proto3 omits the zero. An absent `Duration` is `undefined` — this robot does not track
 * that part, which is a real answer for a model that does not have one.
 * @internal
 */
export declare function decodeConsumableHours(raw: ParamValue | undefined, codec: RawDpCodec | undefined, field: number): number | undefined;
/**
 * Decode a `WorkStatus` (DP 153) Raw-DP value to a {@link VacuumActivity}. That DP carries a whole
 * protobuf message rather than a scalar, so the payload is read through the injected {@link RawDpCodec}:
 * the codec owns the structure, this owns which field number carries which meaning. `"unknown"` covers
 * every way the answer can be absent — an unbound device (no codec), a malformed payload, no
 * `state` field, or a state value missing from {@link WORK_STATE_ACTIVITY}.
 *
 * `CLEANING` is the one state that is not final on its own; {@link resolveCleaningState} reads the
 * sub-messages beside it to separate cleaning from paused and from a mop cycle on the dock.
 * @internal
 */
export declare function decodeVacuumActivity(raw: ParamValue | undefined, codec: RawDpCodec | undefined): VacuumActivity;
/**
 * Bound RoboVac reads and controls — the object returned by `dev.vacuumClean()`.
 *
 * All reads, `setPower`, and the three mode-control verbs are DERIVED from `VACUUM_CLEAN_MEMBERS`.
 * Each getter is present only when the device reports the backing DP. `setPower` and the three
 * mode-control verbs are AIoT-only: no Tuya clean-line write has been confirmed on a device, so none
 * is dispatched.
 *
 * Tuya clean-line read members (`lifetimeCleanTime`, `lifetimeCleanArea`, `waterTank`, `mopPad`)
 * are populated only once the device has reported those DPs over MQTT or the initial Tuya DP poll.
 */
export type VacuumCleanActions = Surface<typeof VACUUM_CLEAN_MEMBERS>;
/**
 * Every `vacuum_clean` read plus the writes and mode-control verbs.
 *
 * Every write here is AIoT-only, gated on `isAiotVacuum`: `power` (DP 151) and the three mode-control
 * verbs (`startCleaning`, `returnToDock`, `pauseCleaning`, all DP 152 `ModeCtrlRequest`). DP 151 and
 * DP 152 belong to the shared AIoT product schema rather than to a device's reported param set, so
 * gating them on a reported DP would hide them on real hardware. No legacy Tuya clean-line write is
 * dispatched at all — that direction has no live `publishDps` capture behind it.
 *
 * Each AIoT mode-control verb carries its own `seq` counter per bind (the T2351 accepts per-closure
 * counters — two separately-obtained action objects both starting at 112 do not cause the device to
 * complain, so the seq is not enforced as globally monotonic).
 *
 * DP-gated READS: `doNotDisturb` (DP 107, Bool ro) and `rssi` (DP 134, WiFi signal strength) are
 * installed only when the device has reported those DPs. The `locate` action (DP 160) is owned by the
 * `locate` capability module.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const VACUUM_CLEAN_MEMBERS: {
    /**
     * The robot's power switch, and NOT a way to start a job — `startCleaning` is that.
     * DP 151 belongs to the shared AIoT product DP schema every clean-line device speaks, so the write
     * is gated on the confirmed AIoT platform (category-based via `isAiotVacuum`) rather than on a
     * reported DP — no equivalent power DP is confirmed on the legacy Tuya clean line.
     */
    readonly power: {
        readonly param: 151;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Power on/off (DP 151 power switch, cloud get_product_data_point).";
        readonly write: (v: string | number | boolean, _ctx: import("./types.js").CommandContext) => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /** Stored as the raw structured payload; the activity is decoded out of it at read time. */
    readonly activity: {
        readonly param: 153;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "cleaning" | "docked" | "error" | "idle" | "paused" | "returning" | "unknown";
        readonly decodedKind: "enum";
        readonly decodedValues: readonly ["idle", "error", "docked", "cleaning", "returning", "paused", "unknown"];
        readonly description: string;
    };
    /**
     * The robot's own speaker loudness — its spoken prompts and chimes, nothing to do with suction noise.
     * Confirmed writable via `get_product_data_point` (`writable: true`); no live publishDps capture yet.
     * Reaches the getters only via `decodeState`, since the robot's cloud record carries no DPs at all.
     */
    readonly volume: {
        readonly param: 161;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly description: "Speaker volume 0-100 (DP 161, Value ro). AIoT clean line.";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * Charge percentage — DP 163 for the AIoT clean line; DP 104 for the legacy Tuya (G-series/X8)
     * via a `readAliases` entry gated on {@link isTuyaVacuum}. Deliberately NOT the security param 1101
     * the `battery` capability reads, so a robot's charge is here rather than on `dev.battery()`.
     * Read-only, populated only once a realtime report lands.
     */
    readonly battery: {
        readonly param: 163;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly readAliases: readonly [{
            readonly paramType: 104;
            readonly available: typeof isTuyaVacuum;
        }];
        readonly description: "Battery level 0-100 (DP 163 AIoT / DP 104 Tuya). NOTE: clean namespace — not param 1101.";
    };
    /**
     * Which voice pack the robot is speaking — the vendor's own numbered id, not a locale.
     *
     * DP 162 carries a `LanguageResponse`, not a locale code — a base64 protobuf message rather than a
     * language tag. The DP is Raw in both directions, confirmed against the schema and the product
     * catalogue.
     *
     * The id alone is what the device reports; which voice it corresponds to is a vendor table keyed by
     * firmware, and this SDK does not carry one. There is no setter either: selecting a pack means
     * sending a `LanguageRequest.Desc` carrying a CDN url and an md5 the device verifies, which is not a
     * descriptor this SDK can construct.
     */
    readonly voicePack: {
        readonly param: 162;
        readonly type: "number";
        readonly kind: "identifier";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "identifier";
        readonly description: "The voice pack in use — LanguageResponse.current_id (DP 162, Raw protobuf). AIoT clean line.";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * The voice pack the robot fell back to, which is the one its firmware shipped with. Differs from
     * {@link VACUUM_CLEAN_MEMBERS.voicePack} exactly when someone has chosen another.
     */
    readonly defaultVoicePack: {
        readonly readsFrom: "voicePack";
        readonly type: "number";
        readonly kind: "identifier";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "identifier";
        readonly description: "The firmware's own voice pack — LanguageResponse.default_id (DP 162, Raw protobuf).";
    };
    /**
     * How a voice-pack change is going. A pack is downloaded from a CDN and md5-checked by the device, so
     * a selection is not instant and can fail — this is the field that says which happened.
     */
    readonly voicePackState: {
        readonly readsFrom: "voicePack";
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "failure" | "idle" | "success" | "updating" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly string[];
        readonly description: "Voice-pack download state — LanguageResponse.state (DP 162, Raw protobuf).";
    };
    /**
     * The installed voice pack's version, as the device counts it. Meaningful only against the vendor's
     * own catalogue for the same pack id; on its own it is a number that changes when a pack is updated.
     */
    readonly voicePackVersion: {
        readonly readsFrom: "voicePack";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "Installed voice-pack version — LanguageResponse.version (DP 162, Raw protobuf).";
    };
    /**
     * The SETTING for what to do with a surface, not what a running job is doing — the two disagree while
     * a change is being applied. Stored as the raw structured payload (`type: "string"`), with the field
     * lifted out by `decode`: the injected codec turns the DP into a field tree and this capability names
     * which field means what, which is why the transport never has to know DP 154. The decode's own
     * return type wins on the surface, so the getter answers the named `VacuumCleanType` union.
     * For Tuya devices, DP 113 (Enum: "Sweep"|"SweepMop"|"Mop") is read via a `readAliases` entry.
     */
    readonly cleanType: {
        readonly param: 154;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "Mop" | "Sweep" | "SweepMop" | "mop" | "sweep" | "sweepAndMop" | "sweepThenMop" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly string[];
        readonly readAliases: readonly [{
            readonly paramType: 113;
            readonly available: typeof isTuyaVacuum;
        }];
        readonly description: "Configured cleaning type from CleanParam.clean_type (DP 154 AIoT protobuf) or DP 113 Tuya Enum.";
    };
    /**
     * What the robot does when it meets a carpet — raise the mop, drive around, or carry on over it.
     *
     * Reads its sibling's DP 154 payload: `clean_carpet` sits beside `clean_type` in the one `CleanParam`
     * the device reports, so there is one param and several readings of it.
     */
    readonly carpetStrategy: {
        readonly readsFrom: "cleanType";
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "autoRaise" | "avoid" | "ignore" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly string[];
        readonly description: "Carpet strategy from CleanParam.clean_carpet (DP 154 AIoT, Raw protobuf).";
    };
    /**
     * How far past the mapped edge a job reaches.
     *
     * The index order is the WIRE's, not the app's display order, so a raw index disagrees with the app's
     * own position for it. This read answers the NAME.
     */
    readonly cleanExtent: {
        readonly readsFrom: "cleanType";
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "narrow" | "normal" | "quick" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly string[];
        readonly description: "Clean extent from CleanParam.clean_extent (DP 154 AIoT, Raw protobuf). Wire order, not app order.";
    };
    /**
     * Whether the robot is left to its own judgement about a room — suction and water chosen per surface
     * rather than held at what the user set.
     */
    readonly smartMode: {
        readonly readsFrom: "cleanType";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Smart mode from CleanParam.smart_mode_sw (DP 154 AIoT, Raw protobuf).";
    };
    /**
     * How much water the mop lays down — the AIoT line's own scale.
     *
     * Distinct from `mopWater`, which is the Tuya line's DP 105 and reports `Dry`/`Low`/`Mid`/`High`.
     * The two are NOT merged under one name: this scale has three members and that one has four, so any
     * mapping between them would be invented rather than read.
     */
    readonly mopLevel: {
        readonly readsFrom: "cleanType";
        readonly type: "string";
        readonly provenance: "verified";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "high" | "low" | "middle" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly string[];
        readonly description: "Mop water level from CleanParam.mop_mode.level (DP 154 AIoT). Captured on a live T2351.";
    };
    /**
     * Whether the robot makes an extra pass along edges while mopping — the app calls it edge-hug
     * mopping. Sits beside {@link VACUUM_CLEAN_MEMBERS.mopLevel} in the same `mop_mode`, which is why
     * this read names its inner field rather than taking the first scalar it finds.
     */
    readonly mopCornerClean: {
        readonly readsFrom: "cleanType";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Edge-hug mopping from CleanParam.mop_mode.corner_clean (DP 154 AIoT). Captured on a live T2351.";
    };
    /**
     * How many passes one job makes over the same floor. `0` is the device stating no repeat rather than
     * a robot that will not clean.
     */
    readonly cleanTimes: {
        readonly readsFrom: "cleanType";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "Passes per job from CleanParam.clean_times (DP 154 AIoT, Raw protobuf).";
    };
    /**
     * The robot's current fault, as a numeric code. `0` is no fault; `undefined` is a device that has not
     * said, which is not the same thing.
     *
     * One number for both clean lines: the AIoT line reports an `ErrorCode` message on DP 177 carrying a
     * list of faults and a list of warnings, and the legacy Tuya line reports a plain integer on DP 106.
     * {@link decodeVacuumFault} answers the first fault, or the first warning when there is no fault.
     *
     * The code's MEANING is the vendor's own table and is not interpreted here.
     *
     * The DP 106 alias is DELIBERATELY ungated, unlike `battery` and `cleanType` which gate their
     * legacy aliases on `isTuyaVacuum`. A fault is the one reading worth surfacing even when the
     * family classification is wrong or absent, and {@link decodeVacuumFault} discriminates on the
     * value's SHAPE rather than on the family — so a device carrying DP 106 decodes sanely whichever
     * line it turns out to be on. The asymmetry is the point, not an oversight.
     */
    readonly errorCode: {
        readonly param: 177;
        readonly type: "number";
        readonly provenance: "mega";
        readonly readAliases: readonly [{
            readonly paramType: 106;
        }];
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: string;
    };
    /**
     * High-level activity for the X8 Pro Tuya clean line (DP 15, Enum string). Decoded from the device's
     * `status` string to a {@link VacuumActivity} via `decodeTuyaWorkStatus`. Live-confirmed "Sleeping"
     * at rest. `"unknown"` covers any value absent from the schema-confirmed set.
     *
     * Distinct from {@link activity} (DP 153, protobuf), which the AIoT T2351 reports instead.
     */
    readonly workStatus: {
        readonly param: 15;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown) => "cleaning" | "docked" | "error" | "idle" | "paused" | "returning" | "unknown";
        readonly decodedKind: "enum";
        readonly decodedValues: readonly ["idle", "error", "docked", "cleaning", "returning", "paused", "unknown"];
        readonly description: "High-level activity from DP 15 (status, Enum). X8 Pro Tuya clean line. Live-confirmed Sleeping.";
    };
    /**
     * Cleaning mode (DP 5, Enum string). Live-confirmed "auto". Distinct from the AIoT suction/mode
     * controls. Write direction is unverified — no live publishDps capture.
     *
     * Known values from schemaInfo.schema: `TUYA_WORK_MODES`.
     */
    readonly workMode: {
        readonly param: 5;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown) => TuyaWorkMode | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly ["auto", "room", "zone", "spot", "fast_mapping"];
        readonly description: "Cleaning mode from DP 5 (mode, Enum). X8 Pro Tuya clean line. Live-confirmed auto. Write unverified.";
    };
    /**
     * Suction / cleaning strength (DP 102, Enum string). Live-confirmed "Off" at rest.
     * Write direction is unverified — no live publishDps capture.
     *
     * Known values from schemaInfo.schema: `TUYA_CLEANING_STRENGTHS`.
     */
    readonly cleaningStrength: {
        readonly param: 102;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown) => TuyaCleaningStrength | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly ["Off", "Quiet", "Standard", "Turbo", "Max"];
        readonly description: "Suction/cleaning strength from DP 102 (cleaning_strength, Enum). X8 Pro Tuya clean line. Live-confirmed Off. Write unverified.";
    };
    /**
     * Mop water flow level (DP 105, Enum string). Live-confirmed "Mid" at rest.
     * Write direction is unverified — no live publishDps capture.
     *
     * Known values from schemaInfo.schema: `TUYA_MOP_WATER_LEVELS`.
     */
    readonly mopWater: {
        readonly param: 105;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown) => TuyaMopWaterLevel | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly ["Dry", "Low", "Mid", "High"];
        readonly description: "Mop water flow level from DP 105 (MopWater, Enum). X8 Pro Tuya clean line. Live-confirmed Mid. Write unverified.";
    };
    /**
     * Session cleaning duration in seconds (DP 109, Value). Live-confirmed 4200 (= 70 min) at rest.
     * Read-only — no write is expected for a session counter.
     */
    readonly clearTime: {
        readonly param: 167;
        readonly type: "number";
        readonly unit: "s";
        readonly kind: "seconds";
        readonly provenance: "mega";
        readonly readAliases: readonly [{
            readonly paramType: 109;
            readonly available: typeof isTuyaVacuum;
        }];
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "seconds";
        readonly description: string;
    };
    /**
     * Session cleaned area in m² (DP 110, Value). Live-confirmed 54 at rest. Read-only.
     */
    readonly clearArea: {
        readonly param: 110;
        readonly readsFrom: "clearTime";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: string;
    };
    /**
     * Speaker loudness 0-100 (DP 111, Value). Live-confirmed 38.
     * Distinct from {@link volume} (DP 161), which the AIoT T2351 reports.
     */
    readonly loudness: {
        readonly param: 111;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly description: "Speaker loudness 0-100 from DP 111 (Loudness). X8 Pro Tuya clean line. Live-confirmed.";
    };
    /**
     * Lifetime total cleaning time in seconds (DP 119, Value). Counts across all sessions.
     * Confirmed from `thing.m.device.ref.info.list` v5.4 schemaInfo.schema (X8 Pro,
     * product `wahqax6ifjgs1c4n`). Read-only accumulator — no write expected.
     */
    readonly lifetimeCleanTime: {
        readonly param: 119;
        readonly readsFrom: "clearTime";
        readonly type: "number";
        readonly unit: "s";
        readonly kind: "seconds";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "seconds";
        readonly description: string;
    };
    /**
     * Lifetime total cleaned area in m² (DP 120, Value). Counts across all sessions.
     * Confirmed from `thing.m.device.ref.info.list` v5.4 schemaInfo.schema (X8 Pro,
     * product `wahqax6ifjgs1c4n`). Read-only accumulator — no write expected.
     */
    readonly lifetimeCleanArea: {
        readonly param: 120;
        readonly readsFrom: "clearTime";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: string;
    };
    /**
     * How many runs the robot has completed in its lifetime.
     *
     * AIoT only — it rides inside the same `CleanStatistics` the two figures above read, and the Tuya
     * clean line has no DP for it. So this one borrows without a wire of its own, where its siblings keep
     * theirs and only fall back to the payload.
     */
    readonly lifetimeCleanCount: {
        readonly readsFrom: "clearTime";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "Completed runs in the robot's lifetime — CleanStatistics.user_total.clean_count (DP 167 AIoT).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * Water tank attached (DP 127, Bool ro). Confirmed from `thing.m.device.ref.info.list` v5.4.
     * `true` when the water tank is mounted; `false` when removed. Read-only sensor — the device
     * reports this, the app does not write it.
     */
    readonly waterTank: {
        readonly param: 127;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Water tank attached (DP 127, Bool ro). X8 Pro Tuya clean line. Schema-confirmed.";
    };
    /**
     * Mop pad attached (DP 129, Bool ro). Confirmed from `thing.m.device.ref.info.list` v5.4.
     * `true` when the mop pad is mounted; `false` when removed. Read-only sensor.
     */
    readonly mopPad: {
        readonly param: 129;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Mop pad attached (DP 129, Bool ro). X8 Pro Tuya clean line. Schema-confirmed.";
    };
    /**
     * Child lock — when on, the robot ignores its physical buttons.
     *
     * AIoT clean line only; no equivalent is confirmed on the Tuya schema, so there is no read alias.
     */
    readonly childLock: {
        readonly param: 176;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Child lock from UnisettingResponse.children_lock (DP 176 commonSettings, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * Whether a cruise resumes by itself after the robot has charged, rather than ending at the dock.
     */
    readonly cruiseContinue: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Resume a cruise after charging — UnisettingResponse.cruise_continue_sw (DP 176, Raw protobuf).";
    };
    /**
     * Whether the robot keeps more than one saved map — a house with more than one floor needs this on.
     */
    readonly multiMap: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Multi-map storage — UnisettingResponse.multi_map_sw (DP 176, Raw protobuf).";
    };
    /**
     * The obstacle-recognition camera. Off means the robot navigates without it, not that it is broken.
     */
    readonly aiSee: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Obstacle-recognition camera — UnisettingResponse.ai_see (DP 176, Raw protobuf).";
    };
    /**
     * The vendor's `water_level_sw`. Named after the wire rather than given a friendlier name: what it
     * switches is not stated anywhere this SDK can point at, and a guessed name would be a claim.
     */
    readonly waterLevelSwitch: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "UnisettingResponse.water_level_sw (DP 176, Raw protobuf). Vendor name kept — its meaning is unconfirmed.";
    };
    /**
     * Whether the robot offers restricted-area suggestions after a run — the prompts that ask to fence
     * off a spot it got stuck in.
     */
    readonly suggestRestricted: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Restricted-area suggestions — UnisettingResponse.suggest_restricted (DP 176, Raw protobuf).";
    };
    /**
     * Extra corner passes while mopping. Slower runs, cleaner corners.
     */
    readonly deepMopCorner: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Deep corner mopping — UnisettingResponse.deep_mop_corner_sw (DP 176, Raw protobuf).";
    };
    /**
     * How long the robot waits before warning that its dust bag is full, in MINUTES.
     *
     * `dust_full_remind` is a `Numerical`, not a `Switch`, and the two are the same two bytes on the
     * wire — `{ value = 1 }` either way — so reading it as a boolean reports a thirty-minute setting as
     * `true` with nothing to show anything went wrong. `0` means the reminder is off.
     */
    readonly dustFullRemindMinutes: {
        readonly readsFrom: "childLock";
        readonly type: "number";
        readonly unit: "min";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: string;
    };
    /**
     * Whether the robot steers around pet mess rather than through it.
     */
    readonly poopAvoidance: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Pet-mess avoidance — UnisettingResponse.poop_avoidance_sw (DP 176, Raw protobuf).";
    };
    /**
     * The pet-owner profile, which changes how the robot treats obstacles and how often it cleans.
     */
    readonly petMode: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Pet mode — UnisettingResponse.pet_mode_sw (DP 176, Raw protobuf).";
    };
    /**
     * Whether the robot holds a map it can actually clean from — at least one with room outlines.
     *
     * The precondition for every area-select frame: a room or zone clean sent at a robot with no valid
     * map is a request it cannot honour, and this is the device's own answer rather than an inference
     * from whether a scene happens to name one.
     */
    readonly hasValidMap: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Whether a usable map exists — UnisettingResponse.unistate.map_valid (DP 176, Raw protobuf).";
    };
    /**
     * Which layers the live map carries, as the vendor's own bitmask — see {@link LIVE_MAP_BITS}.
     *
     * A bitfield rather than an enum because the vendor says so outright: the values combine, and a map
     * with a base layer and room outlines reports both at once.
     */
    readonly mapLayers: {
        readonly readsFrom: "childLock";
        readonly type: "number";
        readonly kind: "bitfield";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "bitfield";
        readonly description: "Live-map layers as a bitmask — UnisettingResponse.unistate.live_map.state_bits (DP 176, Raw protobuf).";
    };
    /**
     * The cleaning-strategy version the robot is running. A bare number the vendor gives no scale for —
     * diagnostic, and meaningful only against another reading of the same robot.
     */
    readonly cleanStrategyVersion: {
        readonly readsFrom: "childLock";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "Cleaning-strategy version — UnisettingResponse.unistate.clean_strategy_version (DP 176, Raw protobuf).";
    };
    /**
     * WiFi signal strength as a PERCENTAGE, 0-100 — the AIoT line's own reading.
     *
     * Distinct from `rssi`, which is the Tuya line's DP 134 in dBm and absent on this hardware. Reported
     * as the vendor states it: eufy-clean converts this to
     * a dBm-looking number with `(value / 2) - 100`, which is a plausible-looking figure with no basis in
     * anything the device sends.
     */
    readonly wifiSignal: {
        readonly readsFrom: "childLock";
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "percent";
        readonly description: "WiFi signal strength 0-100% — UnisettingResponse.ap_signal_strength (DP 176, Raw protobuf).";
    };
    /**
     * Whether the robot captures stills while cleaning.
     */
    readonly livePhoto: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Capture stills while cleaning — UnisettingResponse.live_photo_sw (DP 176, Raw protobuf).";
    };
    /**
     * Smart-follow mode. Numbered 13 in the response and 12 in the request — the widest gap in a message
     * whose two directions disagree about almost every field.
     */
    readonly smartFollow: {
        readonly readsFrom: "childLock";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Smart-follow mode — UnisettingResponse.smart_follow_sw (DP 176, Raw protobuf).";
    };
    /**
     * Hours run on the current side brush.
     *
     * The owner of DP 168 — the other eight counters read their own field out of this same payload, which
     * is why they declare `readsFrom` rather than a wire of their own. Hours USED, counting up: the
     * vendor sends no life expectancy, so a percentage remaining is a calibration rather than a number
     * this SDK can invent.
     */
    readonly sideBrushHours: {
        readonly param: 168;
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Side-brush hours used — ConsumableRuntime.side_brush (DP 168 consumables, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * Hours run on the current rolling brush.
     */
    readonly rollingBrushHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Rolling-brush hours used — ConsumableRuntime.rolling_brush (DP 168, Raw protobuf).";
    };
    /**
     * Hours run on the current filter mesh.
     */
    readonly filterHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Filter-mesh hours used — ConsumableRuntime.filter_mesh (DP 168, Raw protobuf).";
    };
    /**
     * Hours run on the current scraper.
     */
    readonly scraperHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Scraper hours used — ConsumableRuntime.scrape (DP 168, Raw protobuf).";
    };
    /**
     * Hours since the sensors were last cleaned.
     */
    readonly sensorHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Hours since the sensors were cleaned — ConsumableRuntime.sensor (DP 168, Raw protobuf).";
    };
    /**
     * Hours run on the current mop pad.
     */
    readonly mopHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Mop-pad hours used — ConsumableRuntime.mop (DP 168, Raw protobuf).";
    };
    /**
     * Hours since the dust bag was last changed.
     */
    readonly dustBagHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Dust-bag hours used — ConsumableRuntime.dustbag (DP 168, Raw protobuf).";
    };
    /**
     * Hours since the waste-water tank was last emptied. Field 10, not 8 — the vendor leaves 8 and 9
     * unused and closing that gap would read the wrong counter.
     */
    readonly dirtyWaterTankHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Waste-water-tank hours — ConsumableRuntime.dirty_watertank (DP 168, Raw protobuf).";
    };
    /**
     * Hours run on the waste-water filter.
     */
    readonly dirtyWaterFilterHours: {
        readonly readsFrom: "sideBrushHours";
        readonly type: "number";
        readonly unit: "h";
        readonly kind: "hours";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "hours";
        readonly description: "Waste-water-filter hours — ConsumableRuntime.dirty_waterfilter (DP 168, Raw protobuf).";
    };
    /**
     * Do-not-disturb — when on, the robot suppresses its voice announcements.
     *
     * Reports whether the feature is SWITCHED ON, not whether the quiet window happens to be open right
     * now; `UndisturbedResponse` carries that as a separate `active` flag which this deliberately skips.
     */
    readonly doNotDisturb: {
        readonly param: 157;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly readAliases: readonly [{
            readonly paramType: 107;
            readonly available: typeof isTuyaVacuum;
        }];
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: string;
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * Whether the do-not-disturb window is open RIGHT NOW — the live flag, not the switch beside it.
     *
     * `doNotDisturb` answers whether the feature is switched on; this answers whether the quiet window is
     * in force. The two disagree for most of the day.
     *
     * Reads its sibling's payload rather than a wire of its own: `active` and `sw` are two fields of the
     * one `UndisturbedResponse` the device reports on DP 157, so there is one param and two readings of
     * it. AIoT only — the Tuya line's DP 107 carries the switch and says nothing about the window.
     */
    readonly doNotDisturbActive: {
        readonly readsFrom: "doNotDisturb";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => boolean | undefined;
        readonly decodedKind: "boolean";
        readonly description: "Whether the do-not-disturb window is open now — Undisturbed.active (DP 157 AIoT, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * When quiet hours start, as `"HH:MM"` on the robot's own clock.
     *
     * The window itself, which neither `doNotDisturb` (the switch) nor `doNotDisturbActive` (the live
     * flag) states. `undefined` means no window is configured; `"00:00"` is midnight and real.
     */
    readonly doNotDisturbStart: {
        readonly readsFrom: "doNotDisturb";
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => string | undefined;
        readonly decodedKind: "text";
        readonly description: "Quiet hours start, HH:MM — Undisturbed.begin (DP 157 AIoT, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /** When quiet hours end, as `"HH:MM"` on the robot's own clock. */
    readonly doNotDisturbEnd: {
        readonly readsFrom: "doNotDisturb";
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => string | undefined;
        readonly decodedKind: "text";
        readonly description: "Quiet hours end, HH:MM — Undisturbed.end (DP 157 AIoT, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * Whether the robot is taking a charge, and how that is going.
     *
     * `undefined` is the answer for a robot that is not charging: the vendor omits the whole `charging`
     * message rather than sending a "no" value, so absence IS the reading. `"fault"` is the vendor's
     * `ABNORMAL` — contacts touching but no charge flowing, which is the state a user needs told about
     * and which `activity` alone reports as a contented `"docked"`.
     */
    readonly chargeState: {
        readonly readsFrom: "activity";
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "charged" | "charging" | "fault" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly string[];
        readonly description: "Charge state — WorkStatus.charging (DP 153, Raw protobuf). Absent while not charging.";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * What put the robot in the state it is in — an app, the button on its lid, a schedule, its own
     * judgement, or the remote.
     *
     * The difference between "it went home" and "it went home because the battery ran low", which the
     * activity alone cannot express. `"unknown"` is the vendor's own zero and what a robot reports just
     * after boot, so it is an answer rather than a gap.
     */
    readonly triggerSource: {
        readonly readsFrom: "activity";
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "app" | "button" | "remote" | "robot" | "schedule" | "unknown" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly string[];
        readonly description: "What caused the current state — WorkStatus.trigger.source (DP 153, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * How many schedules the robot holds — the owner of DP 164.
     *
     * The device reports its timers in full on every change, so a count is a real reading of that report
     * rather than a summary of one: zero means no schedules are set, and `undefined` means this robot has
     * not reported the DP at all. The schedules themselves are a list, which no property can be, so they
     * are read through {@link VACUUM_CLEAN_MEMBERS.schedules} beside this.
     */
    readonly scheduleCount: {
        readonly param: 164;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "How many schedules the robot holds — TimerResponse.timers (DP 164, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * How many of those schedules will actually fire — switched on, and still pointing at something that
     * exists.
     *
     * A timer whose scene or map was deleted is kept and reported `valid: false` rather than removed, so
     * "three schedules" and "three schedules that work" are genuinely different numbers.
     */
    readonly activeScheduleCount: {
        readonly readsFrom: "scheduleCount";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "How many schedules are on and usable — TimerInfo.status (DP 164, Raw protobuf).";
    };
    /**
     * The schedules themselves, decoded from the same DP 164 report the two counts above read.
     *
     * A query rather than a property: its value is a list, and the property schema holds scalars. It
     * answers from state already received — the robot pushes its whole timer list on boot and after any
     * change — so this sends nothing and cannot fail against a device that is merely asleep.
     */
    readonly schedules: {
        readonly method: (deps: import("./members.js").MemberDeps) => () => readonly VacuumSchedule[] | undefined;
        readonly description: string;
        readonly available: ((ctx: import("./types.js").CommandContext) => boolean) & ((ctx: import("./types.js").CommandContext) => boolean);
        readonly args?: readonly import("./types.js").ActionArgSpec[];
        readonly answers: true;
    };
    /**
     * How many cleaning scenes the robot holds — the owner of DP 180.
     *
     * A scene is a saved routine over rooms or zones. The robot reports the LIST here; the tasks inside
     * a scene are only ever sent to it, never reported back, so this counts what the device publishes.
     */
    readonly sceneCount: {
        readonly param: 180;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "How many cleaning scenes the robot holds — SceneResponse.infos (DP 180, Raw protobuf).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * How many of those scenes can still run. A scene whose map was deleted or no longer matches is kept
     * and reported invalid rather than removed, so the two counts differ for a real reason — and
     * `scenes()` says which reason, per scene.
     */
    readonly usableSceneCount: {
        readonly readsFrom: "sceneCount";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "How many scenes can still run — SceneInfo.valid (DP 180, Raw protobuf).";
    };
    /**
     * The scenes themselves, decoded from the same DP 180 report the two counts read.
     *
     * Answers from state already received, like `schedules` — the robot pushes its whole scene list on
     * boot and after any change, so this sends nothing.
     *
     * **Where a real map id comes from.** Each scene names the map its rooms belong to, and so does a
     * scheduled rooms-clean. Not from multi-map management on DP 172: the vendor's own `multi_maps.proto`
     * sends a map list over p2p rather than the data point.
     */
    readonly scenes: {
        readonly method: (deps: import("./members.js").MemberDeps) => () => readonly VacuumScene[] | undefined;
        readonly description: string;
        readonly available: ((ctx: import("./types.js").CommandContext) => boolean) & ((ctx: import("./types.js").CommandContext) => boolean);
        readonly args?: readonly import("./types.js").ActionArgSpec[];
        readonly answers: true;
    };
    /**
     * The network name the robot is joined to — `DeviceInfo.wifi_name` (DP 169).
     *
     * Reads a payload the DOCK capability owns. `DeviceInfo` is one message carrying the robot's network
     * facts beside the dock's firmware version, and the one-owner rule is per product line, so DP 169 has
     * a single owner — `vacuumDock().dockFirmwareVersion` — and these four members borrow it by name.
     * Putting them on the dock object instead would have filed the robot's IP under the wrong thing.
     *
     * Reported when the robot comes online and again when its IP changes, so it is as current as the last
     * such report and absent on a robot that has not reconnected since binding.
     */
    readonly wifiSsid: {
        readonly readsFrom: {
            readonly property: "dockFirmwareVersion";
            readonly param: 169;
        };
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => string | undefined;
        readonly decodedKind: "text";
        readonly description: "The WiFi network the robot is on — DeviceInfo.wifi_name (DP 169, Raw protobuf).";
    };
    /** The robot's address on that network — `DeviceInfo.wifi_ip` (DP 169). */
    readonly wifiIp: {
        readonly readsFrom: {
            readonly property: "dockFirmwareVersion";
            readonly param: 169;
        };
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => string | undefined;
        readonly decodedKind: "text";
        readonly description: "The robot's IP on its WiFi network — DeviceInfo.wifi_ip (DP 169, Raw protobuf).";
    };
    /** The robot's MAC address — `DeviceInfo.device_mac` (DP 169). */
    readonly macAddress: {
        readonly readsFrom: {
            readonly property: "dockFirmwareVersion";
            readonly param: 169;
        };
        readonly type: "string";
        readonly kind: "identifier";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => string | undefined;
        readonly decodedKind: "identifier";
        readonly description: "The robot's MAC address — DeviceInfo.device_mac (DP 169, Raw protobuf).";
    };
    /**
     * The robot's hardware revision — `DeviceInfo.hardware` (DP 169). A bare integer the vendor gives no
     * scale for; it distinguishes two builds of one model, not one model from another.
     */
    readonly hardwareVersion: {
        readonly readsFrom: {
            readonly property: "dockFirmwareVersion";
            readonly param: 169;
        };
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => number | undefined;
        readonly decodedKind: "scalar";
        readonly description: "The robot's hardware revision — DeviceInfo.hardware (DP 169, Raw protobuf).";
    };
    /**
     * WiFi RSSI in dBm (DP 134, Value ro). Schema-confirmed from `thing.m.device.ref.info.list` v5.4.
     * Negative integer; closer to zero is stronger.
     */
    readonly rssi: {
        readonly param: 134;
        readonly type: "number";
        readonly unit: "dBm";
        readonly kind: "dbm";
        readonly provenance: "mega";
        readonly description: "WiFi RSSI in dBm (DP 134, Value ro). Schema-confirmed.";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * The ModeCtrl verbs whose METHOD NUMBER is not yet captured.
     *
     * Each shares its frame with the three verified verbs above — same message, same two fields, same
     * encoder — so what is unconfirmed is the number alone. That still keeps them `unverified`: a wrong
     * number is a different command arriving at real hardware, and an AIoT DP write is fire-and-forget,
     * so a mistake looks exactly like success. They are declared so the capability documents what the
     * robot accepts, and one capture per verb is all that stands between them and a working setter.
     */
    /**
     * Tell the robot a replaceable part is new, clearing its hours.
     *
     * The other half of the consumables feature: nine counters are read, and this is the write that
     * clears one.
     *
     * **Unverified, so no setter is installed.** The message, the field and the enum are the vendor's
     * own, and the app has the feature — `resetAccessory(deviceId, accessory, callback)` calling
     * through to `resetAccessories`, taking exactly this kind of integer part id. What is missing is a
     * capture showing the frame accepted, and an AIoT DP write is fire-and-forget, so a wrong one would
     * look like success while quietly discarding service history the device never recomputes.
     */
    readonly resetConsumable: {
        readonly type: "string";
        readonly kind: "enum";
        readonly enumValues: {
            [k: string]: "dirtyWaterFilter" | "dirtyWaterTank" | "dustBag" | "filter" | "mop" | "rollingBrush" | "scraper" | "sensors" | "sideBrush";
        };
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: (value: string | number | boolean) => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: string;
    };
    /**
     * End the current job outright, as opposed to {@link VACUUM_CLEAN_MEMBERS.pauseCleaning}, which
     * leaves it resumable.
     */
    readonly stopCleaning: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Stop the current job (ModeCtrlRequest method 12 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Carry on with a paused job rather than starting a new one — the counterpart to
     * {@link VACUUM_CLEAN_MEMBERS.pauseCleaning}.
     */
    readonly resumeCleaning: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
    /**
     * Send the robot to the dock to wash its mops. Distinct from the dock's own `washMops`, which asks
     * the STATION to run its cycle: this one moves the robot there first.
     */
    readonly startWashingMops: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Go and wash the mops (ModeCtrlRequest method 10 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Call off a mop-wash trip in progress.
     */
    readonly stopWashingMops: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Stop washing the mops (ModeCtrlRequest method 17 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Call off a return-to-dock in progress, leaving the robot where it is.
     */
    readonly stopReturnToDock: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Stop returning to the dock (ModeCtrlRequest method 15 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Clean the robot's immediate surroundings. Takes no target — the spot is wherever it is standing,
     * which is why this one needs no `Param` and its area-selecting cousins do.
     */
    readonly startSpotClean: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Spot-clean where the robot stands (ModeCtrlRequest method 3 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Run a fast mapping pass without cleaning — how a robot learns a floor it has not seen.
     */
    readonly startMapping: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Run a fast mapping pass (ModeCtrlRequest method 9 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Patrol the whole map without cleaning — the camera-equipped models use this to look around.
     */
    readonly startCruise: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Start a global cruise (ModeCtrlRequest method 20 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Enter remote-control cleaning, where the app drives. The SDK offers no steering wire, so this is
     * only half a feature until one exists — declared for completeness of the vocabulary.
     */
    readonly startRemoteControl: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Enter remote-control cleaning (ModeCtrlRequest method 5 over DP 152). Method number not captured — unverified.";
    };
    /**
     * Leave remote-control mode.
     *
     * **Uses `STOP_TASK`, not `STOP_RC_CLEAN`.** The product catalogue's own note on DP 155 spells the
     * flow out: enter with `START_RC_CLEAN` or any direction, leave with
     * `ModeCtrlRequest.method.STOP_TASK`. `STOP_RC_CLEAN`(16) exists in the enum but is not what the app
     * sends to exit.
     */
    readonly stopRemoteControl: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: string;
    };
    /**
     * Steer the robot while it is in remote-control mode — DP 155, an enum of directions rather than a
     * `ModeCtrlRequest`.
     *
     * `brake` stops the current movement without leaving remote-control mode; the catalogue's note says
     * the app sends it on key-release. Leaving the mode entirely is
     * {@link VACUUM_CLEAN_MEMBERS.stopRemoteControl}.
     *
     * Sending any direction also ENTERS remote control, so no separate start is needed.
     */
    readonly remoteControlDirection: {
        readonly param: 155;
        readonly type: "string";
        readonly kind: "enum";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly enumValues: {
            readonly 0: "Brake";
            readonly 1: "Forward";
            readonly 2: "Back";
            readonly 3: "Left";
            readonly 4: "Right";
        };
        readonly write: (v: string | number | boolean) => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: string;
    };
    /**
     * Whether the robot resumes an interrupted job after charging, rather than treating the next start
     * as a fresh run. The vendor calls this 断点续扫 — "resume from the break point".
     */
    readonly resumeClean: {
        readonly param: 156;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "Resume an interrupted job after charging (DP 156 pause_job, Bool).";
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
    /**
     * Stop smart-follow mode. There is no start verb in the vendor's parameterless set — the mode is
     * switched on through `smartFollow` in the DP 176 settings, and only stopped from here.
     */
    readonly stopSmartFollow: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Stop smart-follow mode (ModeCtrlRequest method 18 over DP 152). Method number not captured — unverified.";
    };
    /** Start an auto-clean run via ModeCtrlRequest method 0 with one `AutoClean` pass (DP 152). AIoT only — Tuya write unverified. */
    readonly startCleaning: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
    /** Return to the dock via ModeCtrlRequest method 6 (DP 152). AIoT only — Tuya write unverified. */
    readonly returnToDock: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
    /** Pause the current cleaning task via ModeCtrlRequest method 13 (DP 152). AIoT only — Tuya write unverified. */
    readonly pauseCleaning: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
    /**
     * Run a saved cleaning scene by its id (ModeCtrlRequest method 24 over DP 152).
     *
     * The id is the device's own, as {@link VACUUM_CLEAN_MEMBERS.scenes} reports it — `VacuumScene.id`
     * off the `SceneResponse` on DP 180. A scene the device reports invalid stays reportable and running
     * it is still a well-formed request; `VacuumScene.invalidReason` says why the device will refuse.
     *
     * Frame shape is byte-proven against the shared outer `ModeCtrlRequest`, and method 24 has been
     * WATCHED: run on a T2351, it started the named scene.
     */
    readonly startScene: import("./members.js").MethodMember<(sceneId: number) => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
    /**
     * State the cleaning settings a run uses — `CleanParamRequest.clean_param` over DP 154.
     *
     * The write counterpart of {@link VACUUM_CLEAN_MEMBERS.cleanType},
     * {@link VACUUM_CLEAN_MEMBERS.cleanExtent} and {@link VACUUM_CLEAN_MEMBERS.mopLevel}: one message
     * carries all three, so they are set together rather than through three setters that would each send
     * the same message with the other two silent.
     *
     * **The evidence, and its limit.** The frame is field 1 of `CleanParamRequest`, which carries the
     * very `CleanParam` this module decodes out of field 1 of the reports a live T2351 sends — the
     * field numbers, the single-field wrappers and the `mop_mode.level` scale are all read off that
     * capture, and `encodeCleanParam` writes what `decodeCleanParamValue` reads. What is NOT captured is
     * the write direction itself. It ships as a method rather than an unverified write because the
     * hazard that rule answers does not arise here: DP 154 is the robot's own settings report, so a frame
     * it does not accept leaves those three reads unchanged, where a wrong fire-and-forget command would
     * look exactly like success.
     *
     * Suction is not here. It has its own data point and its own capability — a `fan` field exists in
     * this message and is deliberately not written, for the same reason it is not read.
     */
    readonly setCleanParam: {
        readonly method: (deps: import("./members.js").MemberDeps) => (cleanType: VacuumCleanType, cleanExtent: CleanExtent, mopLevel: MopLevel) => Promise<void>;
        readonly description: string;
        readonly available: ((ctx: import("./types.js").CommandContext) => boolean) & ((ctx: import("./types.js").CommandContext) => boolean);
        readonly answers?: true;
        readonly args: readonly [{
            readonly name: "cleanType";
            readonly kind: "enum";
            readonly values: readonly ["sweep", "mop", "sweepAndMop", "sweepThenMop"];
            readonly description: "What the robot does with a surface.";
        }, {
            readonly name: "cleanExtent";
            readonly kind: "enum";
            readonly values: readonly ["normal", "narrow", "quick"];
            readonly description: "How far past the mapped edge a job reaches. Wire order, not app order.";
        }, {
            readonly name: "mopLevel";
            readonly kind: "enum";
            readonly values: readonly ["low", "middle", "high"];
            readonly description: "How much water the mop lays down. Only meaningful for a clean type that mops.";
        }];
    };
    /**
     * Clean the named rooms of a named map (ModeCtrlRequest method 1 over DP 152).
     *
     * `mapId` has no default and that is deliberate: room ids are per map, so assuming the map a
     * single-floor home would have sends a two-floor home's ids against the wrong floor. `SceneInfo.mapid`
     * on DP 180 and a scheduled rooms-clean's `map_id` are the two real map ids the device reports.
     *
     * `cleanTimes` is how many passes to make over the set; rooms with no `order` are visited in the
     * order given.
     *
     * Frame shape is byte-proven against the shared outer `ModeCtrlRequest`, and method 1 has been
     * WATCHED: run on a T2351, it cleaned the rooms named.
     */
    readonly cleanRooms: import("./members.js").MethodMember<(mapId: number, rooms: readonly VacuumRoomTarget[], cleanTimes?: number) => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
    /**
     * Clean the given rectangles of a named map (ModeCtrlRequest method 2 over DP 152).
     *
     * Corners are SIGNED centimetres in the map's own frame, whose origin sits wherever the robot first
     * mapped from — negative coordinates are ordinary and are ZigZag-encoded, not written as plain
     * varints. Same `mapId` reasoning as {@link VACUUM_CLEAN_MEMBERS.cleanRooms}, and the same evidence:
     * method 2 was run on a T2351 and cleaned the rectangles given.
     */
    readonly cleanZones: import("./members.js").MethodMember<(mapId: number, zones: readonly VacuumZoneTarget[]) => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
};
/** `vacuum_clean` — core RoboVac scalar state + decoded activity: power, activity, volume, battery. */
export declare const VACUUM_CLEAN: CapabilityModule;
