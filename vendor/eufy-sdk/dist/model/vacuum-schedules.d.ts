/**
 * The schedules a robot vacuum holds — `TimerResponse` on DP 164, decoded.
 *
 * The DP number comes from a `get_product_data_point` dump; the product catalogue names the DP, and the
 * vendor's `timing.proto` carries the message.
 *
 * The shape is deeper than anything else on this line — a repeated `TimerInfo`, each with four nested
 * containers and a `oneof` for what the timer actually does — which is why it decodes here rather than
 * as one more field reader inside `vacuum-clean`. It reads a payload and answers a list; it never asks
 * the device for one, and it holds no DP number of its own.
 *
 * **`TimerInfo.Addition` is deliberately not decoded.** It carries the account ids of whoever created
 * and last edited each timer — the kind of value this SDK does not surface without a reason.
 *
 * @module model/vacuum-schedules
 */
import type { RawDpCodec } from "../core/contracts.js";
/** What a timer runs when it fires, as the vendor's `Action` oneof names it. */
export declare const VACUUM_SCHEDULE_ACTIONS: readonly ["autoClean", "roomsClean", "cruise", "sceneClean"];
export type VacuumScheduleAction = (typeof VACUUM_SCHEDULE_ACTIONS)[number];
/**
 * Weekdays in the vendor's own bit order — Sunday first, because `Cycle.week_bits` puts it at bit 0.
 *
 * Written out rather than derived from a locale so the mapping is the wire's and not the reader's.
 */
export declare const VACUUM_SCHEDULE_WEEKDAYS: readonly ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export type VacuumScheduleWeekday = (typeof VACUUM_SCHEDULE_WEEKDAYS)[number];
/** One schedule the robot holds. */
export interface VacuumSchedule {
    /** The device's own id for this timer — what a future edit or delete would name it by. */
    readonly id: number;
    /** Whether the timer is switched on. A valid timer that is off stays stored and does not fire. */
    readonly enabled: boolean;
    /**
     * Whether the device still considers the timer usable. A timer pointing at a deleted scene or a map
     * that no longer exists is reported `valid: false` rather than removed, so the app can show why.
     */
    readonly valid: boolean;
    /** `true` for a weekly timer, `false` for one that fires once. */
    readonly repeats: boolean;
    /** Hour of the day it fires, 0–23, in the user's own timezone — see {@link utcOffsetSeconds}. */
    readonly hour: number;
    /** Minute of the hour it fires, 0–59. */
    readonly minute: number;
    /**
     * The days a repeating timer fires on. Empty for a one-shot timer, and empty for a repeating one
     * whose `week_bits` is zero — which the device treats as a timer that never fires.
     */
    readonly weekdays: readonly VacuumScheduleWeekday[];
    /**
     * The offset from UTC the timer's clock was set against, in seconds east.
     *
     * Carried per timer rather than per device: the robot stores whatever the phone that created the
     * schedule told it, so an absolute instant follows from this offset and not from any local zone.
     */
    readonly utcOffsetSeconds: number;
    /** Whether the phone that created the timer said its region observes daylight saving. */
    readonly daylightSaving: boolean;
    /** What the timer runs. */
    readonly action: VacuumScheduleAction;
    /** The map the run targets, for a rooms-clean or a cruise. */
    readonly mapId?: number;
    /** The rooms a rooms-clean visits, in the order the timer lists them. */
    readonly roomIds?: readonly number[];
    /** The scene a scene-clean runs. */
    readonly sceneId?: number;
    /** The scene's name as the device last saw it — kept so a deleted scene can still be named. */
    readonly sceneName?: string;
}
/**
 * Decode a `TimerResponse` (DP 164) to the schedules it reports, or `undefined`.
 *
 * `undefined` means the payload could not be read at all — no codec, not a Raw-DP value, malformed
 * bytes. An **empty array** is a different and equally real answer: the device reports its timers in
 * full every time, so a report carrying none says this robot has no schedules set.
 *
 * The device sends this unprompted on boot and after any change, and in reply to an `INQUIRY`. Which
 * of those produced a given payload does not change the reading — every report is the complete list —
 * so the request `method` and `seq` beside it are not surfaced.
 */
export declare function decodeVacuumSchedules(raw: unknown, codec: RawDpCodec | undefined): readonly VacuumSchedule[] | undefined;
/** How many schedules a `TimerResponse` reports, or `undefined` when the payload could not be read. */
export declare function decodeVacuumScheduleCount(raw: unknown, codec: RawDpCodec | undefined): number | undefined;
/** How many of the reported schedules are switched on and still usable. */
export declare function decodeActiveVacuumScheduleCount(raw: unknown, codec: RawDpCodec | undefined): number | undefined;
