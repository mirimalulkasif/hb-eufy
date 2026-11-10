import { isHomeBase } from "../device-family.js";
import { type Surface } from "./members.js";
import type { AvailabilityContext, CapabilityModule, CommandContext } from "./types.js";
import type { Command } from "../../core/contracts.js";
/**
 * The siren's **state-backed param ids** — each is a param the device reports (and some are also
 * writable). Named `SIREN_PARAM` vs `SIREN_CMD` below (momentary triggers with no reported state) so
 * the split the code implements is explicit. Surveyed + write-captured on a real T90R0
 * (`SIREN_SENSOR_E20`, 2026-08-03).
 */
export declare const SIREN_PARAM: {
    /** Whether the siren is sounding (app `APP_CMD_DEV_RING_STATUS`). 1 = sounding, 0 = silent. */
    readonly RING_STATUS: 61008;
    /** Alarm volume as a device level (app `APP_CMD_SIREN_SENSOR_SET_ALARM_VOL`). See {@link SirenVolume}. */
    readonly ALARM_VOLUME: 1825;
    /** Seconds an alarm sounds before stopping itself (app `APP_CMD_DEV_ALARM_TIMEOUT`). */
    readonly ALARM_TIMEOUT: 61006;
    /** Do-not-disturb (app `APP_CMD_SENSOR_NOT_DISTURB`). */
    readonly NOT_DISTURB: 1828;
};
/**
 * The siren's **write-only command ids**. Momentary actions install only when their family-specific
 * reported evidence and topology gates hold.
 */
export declare const SIREN_CMD: {
    /** Sound the siren briefly as a test (app `APP_CMD_SIREN_SENSOR_ALARM_TEST`). */
    readonly ALARM_TEST: 1826;
    /** Manually stop a sounding alarm (app `APP_CMD_SIREN_SENSOR_MANUAL_STOP_ALARM`). */
    readonly MANUAL_STOP: 1871;
    /** Station-family HomeBase duration alarm, verified live on T8010 and T8030 (app `SET_TONE_FILE`). */
    readonly HOMEBASE_TONE: 1201;
    /** HomeBase alarm volume percentage (app `CMD_SET_HUB_SPK_VOLUME`). */
    readonly HUB_SPK_VOLUME: 1235;
    /** HomeBase alarm-tone selection (app `APP_CMD_HUB_ALARM_TONE`). */
    readonly HUB_ALARM_TONE: 1281;
    /** Attached-camera duration alarm, verified live on T8114 and T8210 (app `SET_DEVS_TONE_FILE`). */
    readonly CAMERA_TONE: 1202;
};
/**
 * Siren alarm volume — a small device level 1-3 (Low/Mid/High), NOT a percentage. Pass a value to
 * `setVolume`.
 */
export declare const SirenVolume: {
    readonly Low: 1;
    readonly Mid: 2;
    readonly High: 3;
};
/** A siren volume level — the value side of {@link SirenVolume}. */
export type SirenVolumeValue = (typeof SirenVolume)[keyof typeof SirenVolume];
/**
 * The alarm-duration presets the app offers, in seconds (1/5/10/15 minutes). These are the only
 * values captured, so `setAlarmDuration` accepts exactly these (rejecting others),
 * the same way the arming capability makes its delay presets the parameter type.
 */
export declare const SirenAlarmDuration: {
    readonly Min1: 60;
    readonly Min5: 300;
    readonly Min10: 600;
    readonly Min15: 900;
};
/** A siren alarm duration in seconds — the value side of {@link SirenAlarmDuration}. */
export type SirenAlarmDurationValue = (typeof SirenAlarmDuration)[keyof typeof SirenAlarmDuration];
/** HomeBase alarm tone options, 1-indexed; both options were confirmed on a T8030. */
export declare const HubAlarmTone: {
    readonly Tone1: 1;
    readonly Tone2: 2;
};
/** A HomeBase alarm tone option. */
export type HubAlarmToneValue = (typeof HubAlarmTone)[keyof typeof HubAlarmTone];
/**
 * Bound siren controls — the object returned by `dev.siren()`.
 *
 * Everything is derived from `SIREN_MEMBERS`. Each optional member is installed only for the exact
 * standalone-siren, HomeBase, or camera evidence that proves its wire contract.
 */
export type SirenActions = Surface<typeof SIREN_MEMBERS>;
/** Whether this context belongs to the sensor codec used by standalone sirens. */
declare function isSensorCodec(ctx: AvailabilityContext): boolean;
/** Whether a sensor-codec device reports the combined standalone siren evidence. */
declare function isEvidencedStandaloneSiren(ctx: CommandContext): boolean;
/**
 * Every audible alarm-output feature, declared once. Standalone sirens expose observed state,
 * configuration, test, and stop; evidenced HomeBases expose alarm configuration plus trigger/stop;
 * verified attached cameras expose trigger/stop only.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const SIREN_MEMBERS: {
    /**
     * Authoritative sounding state reported by a standalone siren. HomeBase and camera command
     * acknowledgements do not install or update this read.
     */
    readonly active: {
        readonly param: 61008;
        readonly property: "siren";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly available: typeof isSensorCodec;
        readonly description: string;
    };
    /**
     * Rejected, not clamped, outside the 1-3 set: the write is fire-and-forget, so an out-of-range level
     * would look like it worked.
     */
    readonly volume: {
        readonly param: 1825;
        readonly property: "sirenVolume";
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly available: typeof isSensorCodec;
        readonly requires: readonly [1825];
        readonly enumValues: Record<number, string>;
        readonly args: readonly [{
            readonly name: "level";
            readonly kind: "scalar";
            readonly description: "A device level 1-3 (Low/Mid/High), not a percentage.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /** Only the four captured presets are accepted: no capture supports an arbitrary duration. */
    readonly alarmDuration: {
        readonly param: 61006;
        readonly type: "number";
        readonly unit: "s";
        readonly kind: "seconds";
        readonly provenance: "verified";
        readonly available: typeof isSensorCodec;
        readonly requires: readonly [61006];
        readonly enumValues: Record<number, string>;
        readonly args: readonly [{
            readonly name: "seconds";
            readonly kind: "seconds";
            readonly description: "One of the app's presets: 60/300/600/900.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * Read-only: `apk` provenance means the id comes from the disassembled app and the only live evidence
     * is a T90R0 reporting 0, which fixes neither the polarity's other value nor a write frame. Typed
     * `bool` on the app's own naming; do not add a setter until a toggle is captured.
     */
    readonly doNotDisturb: {
        readonly param: 1828;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly available: typeof isSensorCodec;
        readonly description: "Do-not-disturb (1828 APP_CMD_SENSOR_NOT_DISTURB). Observed 0 on a T90R0.";
    };
    /** HomeBase alarm volume is a percentage on a station-scalar wire, unlike standalone level 1-3. */
    readonly alarmVolume: {
        readonly param: 1235;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly writeOnly: true;
        readonly provenance: "verified";
        readonly available: typeof isHomeBase;
        readonly requires: readonly [1281, 1282];
        readonly min: 0;
        readonly max: 100;
        readonly description: "HomeBase alarm volume 0..100 (1235 CMD_SET_HUB_SPK_VOLUME). Verified audible on a T8030.";
        readonly write: (v: string | number | boolean) => Command;
    };
    /** HomeBase alarm tone keeps its independently verified two-option domain. */
    readonly alarmTone: {
        readonly param: 1281;
        readonly property: "hubAlarmTone";
        readonly type: "number";
        readonly kind: "enum";
        readonly enumValues: Record<number, string>;
        readonly provenance: "verified";
        readonly available: typeof isHomeBase;
        readonly requires: readonly [1281, 1282];
        readonly args: readonly [{
            readonly name: "tone";
            readonly kind: "enum";
            readonly description: "One of the app's alarm tones (1-indexed).";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /** Sound a standalone siren briefly using its dedicated installation-test wire. */
    readonly test: {
        readonly action: (ctx: CommandContext) => Command;
        readonly available: typeof isEvidencedStandaloneSiren;
        readonly description: "Sound the siren briefly as a test.";
    };
    /** Trigger a verified station-family HomeBase or evidenced attached-camera alarm for a bounded duration. */
    readonly trigger: {
        readonly method: (deps: import("./members.js").MemberDeps) => (seconds: number) => Promise<void>;
        readonly description: string;
        readonly available: ((ctx: CommandContext) => boolean) & ((ctx: CommandContext) => boolean);
        readonly answers?: true;
        readonly args: readonly [{
            readonly name: "seconds";
            readonly kind: "seconds";
            readonly min: 1;
            readonly description: "A positive whole-number duration.";
        }];
    };
    /** Stop a verified alarm-output family through its own wire contract. */
    readonly stop: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
};
/**
 * `siren` — audible alarm output across independently verified standalone siren, HomeBase, and camera
 * families. Member installation preserves each family's state evidence, units, and wire contract.
 */
export declare const SIREN: CapabilityModule;
export {};
