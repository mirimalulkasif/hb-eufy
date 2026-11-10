import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * The entry sensor's own **command/param ids** — its built-in alarm buzzer (sounds when the door
 * opens while armed), separate from the open/close contact read. Both write wires were captured live
 * on a T90E0 (2026-08-03).
 */
export declare const CONTACT_CMD: {
    /** Alarm sound/tone selection (app `APP_CMD_ALARM_SOUND_TYPE`). See {@link EntryAlarmTone}. */
    readonly ALARM_SOUND_TYPE: 1507;
    /** Alarm volume (app `APP_CMD_ALARM_VOLUME_VALUE`). A device level 1-26, not a percentage. */
    readonly ALARM_VOLUME: 1508;
};
/**
 * The entry sensor's built-in alarm tone: silent, or one of four chimes. Pass a value to
 * `setAlarmSoundType`.
 */
export declare const EntryAlarmTone: {
    /** Silent — no alarm tone. */
    readonly None: 0;
    readonly Water: 1;
    readonly Classic: 2;
    readonly Light: 3;
    readonly Ding: 4;
};
/** An entry-sensor alarm tone — the value side of {@link EntryAlarmTone}. */
export type EntryAlarmToneValue = (typeof EntryAlarmTone)[keyof typeof EntryAlarmTone];
/**
 * Bound entry-sensor controls — the object returned by `dev.contact()`.
 *
 * Everything is DERIVED from `CONTACT_MEMBERS`. The open/close read is the headline; the entry
 * sensor also carries a built-in alarm buzzer whose tone and volume are writable, each setter present
 * only when the device reports the backing param.
 */
export type ContactActions = Surface<typeof CONTACT_MEMBERS>;
/**
 * Every `contact` feature, declared once. `contact` (1550) and `lastSeen` (1551) are verified reads;
 * the built-in alarm tone (1507) and volume (1508) are verified writes captured live on a T90E0.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const CONTACT_MEMBERS: {
    /**
     * The headline read: `true` when the door or window is open. Polarity is the V6 app's own
     * `"1".equals(e)` — see `contactOpen`, which normalises every inbound source through one
     * predicate so the poll, the push and the station notify cannot disagree about what open means.
     * Reporting 1550 is also this capability's detection evidence, so a device with this getter is
     * confirmed to be a contact sensor.
     */
    readonly open: {
        readonly param: 1550;
        readonly property: "contact";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: "Contact state, true=open (verified: param 1550 entry-sensor contact).";
    };
    /**
     * Unix seconds at which the sensor last checked in — the liveness read beside the contact state, and
     * the way to tell a genuinely closed door from a sensor that stopped reporting. A `timestamp` kind
     * takes no `unit`: it is an instant, not a duration.
     */
    readonly lastSeen: {
        readonly param: 1551;
        readonly type: "number";
        readonly kind: "timestamp";
        readonly provenance: "verified";
        readonly description: "Last-seen unix timestamp, seconds (verified: param 1551).";
    };
    /**
     * Link quality to whichever radio the sensor is paired over, in dBm as the device measures it. The
     * same param 1141 the other sub-1G sensors report on, so the number is comparable across them —
     * unlike a bars mapping, which this SDK never applies.
     */
    readonly rssi: {
        readonly param: 1141;
        readonly type: "number";
        readonly unit: "dBm";
        readonly kind: "dbm";
        readonly provenance: "verified";
        readonly description: "Sub-1G/Wi-Fi signal strength (verified: param 1141 = RSSI).";
    };
    /**
     * Rejected, not clamped, outside the tone enum: a fire-and-forget write of a bogus tone would look like
     * it worked. The wire is a direct-binary scalar `[ch][value][acct]` at signCode 8 — the app's own
     * captured frame.
     */
    readonly alarmSoundType: {
        readonly param: 1507;
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: Record<number, string>;
        readonly provenance: "verified";
        readonly requires: readonly [1507];
        readonly args: readonly [{
            readonly name: "tone";
            readonly kind: "enum";
            readonly description: "Silent (0) or one of the four chimes.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: import("./types.js").CommandContext) => import("../../index.js").Command | undefined;
    };
    /**
     * `1350` SET_PAYLOAD, `mChannel` = the device channel, `mValue3` 0, payload carrying the channel and a
     * transaction stamp — the byte-shape of the app's own captured frame. Out of range is refused rather
     * than clamped: the app's slider has no values outside it, so one is a caller error, not a nudge.
     *
     * Level-2 only, though the `mValue3` 0 would allow `"auto"`: an entry sensor's session IS its
     * HomeBase's, which always holds a key — the second of `setPayload`'s two conditions, not an oversight
     * of the first.
     */
    readonly alarmVolume: {
        readonly param: 1508;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly requires: readonly [1508];
        readonly min: 1;
        readonly max: 26;
        readonly args: readonly [{
            readonly name: "level";
            readonly kind: "scalar";
            readonly min: 1;
            readonly max: 26;
            readonly description: "A device level, not a percentage.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: import("./types.js").CommandContext) => import("../../index.js").Command | undefined;
    };
};
/**
 * `contact` — entry/door-window sensor. `contact` (1550) and `lastSeen` (1551) are verified; the
 * built-in alarm tone (1507) and volume (1508) are verified writes captured live on a T90E0.
 */
export declare const CONTACT: CapabilityModule;
