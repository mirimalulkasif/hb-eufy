import { type Surface } from "./members.js";
import type { CapabilityModule, CommandContext } from "./types.js";
import type { Command } from "../../core/contracts.js";
/**
 * The guard modes `setMode` can SET — every mode a station reports, all nine confirmed against real
 * hardware. `ArmingMode` is both the const value-object (`ArmingMode.home`) and the union type of its
 * values, so callers pass the named constant: `setMode(ArmingMode.home)`.
 *
 * The domain of `setMode` (cmd 1224) alone. The alarm-delay write (cmd 1255) carries its own mode integer
 * on a separate wire and takes {@link AlarmDelayMode}, which stays NARROWER — evidence for one command is
 * not evidence for the other, and 1255 still has no capture beyond its byte-captured three.
 *
 * A mode belongs here only once its write is confirmed against real hardware, because a fire-and-forget
 * wire makes a wrong mode look exactly like success; `ARMING_MODE_WIRE` carries the per-value evidence.
 * The union is also what `ARMING_MODE_WIRE` is keyed by, so the table cannot name a mode this does not.
 */
export declare const ArmingMode: {
    /** Armed — full protection, nobody home (wire value 0). */
    readonly away: "away";
    /** Armed for occupancy — reduced/perimeter protection while home (wire value 1). */
    readonly home: "home";
    /** Scheduled — the station follows the timetable configured in the app (wire value 2). */
    readonly schedule: "schedule";
    /** Custom 1 — a user-defined posture configured in the app (wire value 3). */
    readonly custom1: "custom1";
    /** Custom 2 — a user-defined posture configured in the app (wire value 4). */
    readonly custom2: "custom2";
    /** Custom 3 — a user-defined posture configured in the app (wire value 5). */
    readonly custom3: "custom3";
    /** Off — the station's alarm system is switched off entirely (wire value 6). */
    readonly off: "off";
    /** Geofenced — the station follows the app's location-based rules (wire value 47). */
    readonly geo: "geo";
    /** Disarmed — no alarms; sensors still report state (wire value 63). */
    readonly disarmed: "disarmed";
};
export type ArmingMode = (typeof ArmingMode)[keyof typeof ArmingMode];
/**
 * The modes the alarm-delay write (cmd 1255) accepts a `mode_id` for — the three guard modes whose wire
 * integer is byte-captured.
 *
 * A domain of its own, because the two mode integers ride different commands: `setMode` writes `mode_type`
 * on cmd 1224, and cmd 1255 carries `mode_id`. Neither wire validates the integer, so each union IS its
 * command's gate, and evidence for one is not evidence for the other. `custom1` is confirmed on 1224 only;
 * 1255 has no capture carrying mode 3, and no known GET to read one back — the app's own replies
 * `{count:0,data:null}` — so it is absent here. Narrower than {@link ArmingMode} by exactly that value.
 */
export declare const AlarmDelayMode: {
    /** Armed — full protection, nobody home (wire value 0). */
    readonly away: "away";
    /** Armed for occupancy — reduced/perimeter protection while home (wire value 1). */
    readonly home: "home";
    /** Disarmed — no alarms; sensors still report state (wire value 63). */
    readonly disarmed: "disarmed";
};
export type AlarmDelayMode = (typeof AlarmDelayMode)[keyof typeof AlarmDelayMode];
/**
 * The P2P **feature-command ids** this arming capability drives. Capability-owned wire vocabulary
 * (transport forwards `cmd.param` opaquely; full id→name catalog in the generated
 * `transport/p2p/commands.ts`).
 */
export declare const ARMING_CMD: {
    /**
     * Guard/arming mode (app `GUARD_MODE`). ✅ Wire ENVELOPE verified live on a T8030 (
     * 2026-07-23), cycling Away→Disarmed→Home in the
     * real app: `1350` SET_PAYLOAD, cmd 1224 (SAME id as the read param), mChannel 0, explicit
     * mValue3:0, `payload:{mode_type:<int>, user_name:<string>}`.
     *
     * ⚠️ Only 3 of the 9 modes were exercised in that capture — `mode_type` 0 (away), 63 (disarmed), 1
     * (home), all confirmed byte-exact. Re-confirmed live 2026-08-05: each reported its own MODE_SWITCH push
     * within ~5s of the write. The remaining six are live confirmations rather than captures — `custom1` 3
     * first, then `schedule` 2, `custom2` 4, `custom3` 5, `off` 6 and `geo` 47 — each sent as this exact
     * frame and each observed to bring MODE_SWITCH back, so all nine are settable. `ARMING_MODE_WIRE` has
     * the per-value evidence and the dates.
     *
     * The ENCRYPTION LEVEL is the session's to pick (`"auto"`), not this command's: the T8030 the envelope
     * was captured on holds a level-2 key and seals it level-2, while an own-session camera that never
     * negotiates one carries the same envelope level-1. See `armingCommand`.
     *
     * A T8410C takes the mode as a direct frame instead of this envelope; see {@link DIRECT_ARMING_MODELS}.
     */
    readonly SET_ARMING: 1224;
    /**
     * One guard mode's per-device action table (app `CMD_SET_ALL_ACTION`), which carries the alarm delays
     * and each device's actions in that mode. ✅ WIRE CAPTURED live on a T8030 (
     * 2026-07-23, both directions): a **bare
     * JSON frame, no `1350`/`1700` envelope** — outer P2P cmd IS `1255` itself, station channel 255,
     * plaintext `{account_id, count_down_alarm:{channel_list,delay_time},
     * count_down_arm:{channel_list,delay_time}, devices:[{action,device_channel}], mode_id,
     * siren_sensor_action:[{action,device_channel}]}`.
     *
     * **Disambiguated from a live-countdown-state echo** (2026-07-23): a full arm→wait-through-exit-
     * delay→disarm cycle produced ZERO traffic on this cmd, while every edit of the app's "Alarm Delay"
     * screen did — so this is a genuine settings WRITE, not a realtime push.
     *
     * **Why `setAlarmDelayConfig` takes the FULL config, not just a duration**: `channelList` identifies
     * WHICH sensor channels get the delay (confirmed: setting 45s on one specific sensor produced
     * `channel_list:[<that sensor's channel>], delay_time:45`) — it is not a simple on/off. The
     * corresponding GET command (`1310`/inner cmd `40003`, sent by the app right before editing) always
     * replied `{count:0,data:null}` in every capture — genuinely empty, not a decrypt failure (confirmed
     * via the same bidirectional decrypt this finding used) — so the app does NOT read the current
     * config this way; a T8010 reports it on its own params instead, see below. Without a working GET,
     * safely PATCHING just one channel in or out of an existing list isn't possible without risking
     * clobbering the rest — so
     * this ships as a caller-supplies-everything write instead of guessing a merge.
     * `devices`/`siren_sensor_action` are even less understood (raw per-device action codes, meaning
     * unconfirmed) and MUST come from a value independently read/captured for the target mode —
     * see `AlarmDelayConfig`'s field docs.
     *
     * ✅ On a T8010 the app writes the same command for the Device Control screen: header channel 0, the
     * whole table of the mode `{mode_id, devices, count_down_alarm, count_down_arm}`, acked by an all-zero
     * 1255 reply. The T8010 reports each table on its own params, Home on 1157 and Away on 1158, and the
     * reported table follows a write within 15 s. See {@link DEVICE_NOTIFY_FLAG}.
     */
    readonly SET_ALL_ACTION: 1255;
};
/**
 * The guard modes whose device notification is read and written. Home and away are replayed on a T8010;
 * `custom1` (wire 3) is captured on a T8170, whose own params report it on 1148.
 */
export type DeviceNotificationMode = Extract<ArmingMode, "home" | "away" | "custom1">;
/**
 * Alarm-delay durations the app's OWN picker UI offers — `AlarmDelaySeconds` is both the const
 * value-object (`AlarmDelaySeconds.sec45`) and the union type of its values, so callers pass the
 * named constant: `{delaySeconds: AlarmDelaySeconds.sec45}`.
 *
 * **NOT a wire constraint** — the device itself does NOT validate against this list: a live test sent
 * `50` (off this list) and the app reflected it correctly, no rejection. Typed as a closed set anyway
 * so `setAlarmDelayConfig` callers get the same choices a human editing the same setting in the app
 * would see, rather than an arbitrary int that could silently diverge from every value the real UI
 * can actually produce.
 */
export declare const AlarmDelaySeconds: {
    readonly off: 0;
    readonly sec15: 15;
    readonly sec30: 30;
    readonly sec45: 45;
    readonly sec60: 60;
    readonly min3: 180;
    readonly min5: 300;
};
export type AlarmDelaySeconds = (typeof AlarmDelaySeconds)[keyof typeof AlarmDelaySeconds];
/** One `channelList`+`delaySeconds` countdown pair — see {@link AlarmDelayConfig}. */
export type AlarmDelayCountdown = {
    /** Device channels this countdown applies to. */
    channelList: number[];
    /** Delay duration — one of {@link AlarmDelaySeconds}, shared across every channel in `channelList`. */
    delaySeconds: AlarmDelaySeconds;
};
/** One device's participation entry in {@link AlarmDelayConfig.devices} / `.sirenSensorAction`. */
export type AlarmDelayDeviceAction = {
    deviceChannel: number;
    /** Raw per-device action code. Meaning NOT independently confirmed — pass through verbatim from a
     * value read/captured for this exact mode, never invented. */
    action: number;
};
/**
 * The FULL per-mode alarm/arm-delay configuration the device accepts as one write — see the
 * `setAlarmDelayConfig` doc for why this is a caller-supplies-everything shape rather than a simple
 * `setEntryDelay(seconds)` toggle.
 */
export type AlarmDelayConfig = {
    /** Per-sensor ENTRY/alarm delay — the app's "Alarm Delay" UI setting. Confirmed on-device: a delay
     * set on one sensor lands as that sensor's channel plus the chosen duration. */
    countDownAlarm: AlarmDelayCountdown;
    /** A second, distinct countdown carried alongside `countDownAlarm`. It stayed empty across every
     * observed `countDownAlarm` edit, so its own trigger condition is UNCONFIRMED. */
    countDownArm: AlarmDelayCountdown;
    /** Every device's participation + action for THIS mode. UNCONFIRMED semantics (the action code's
     * meaning is unknown) — it stayed identical across every `countDownAlarm`-only edit within the same
     * mode, so pass through exactly what was read back for that mode; never invent a value. */
    devices: AlarmDelayDeviceAction[];
    /** Siren behavior per device for this mode. Same caveat as `devices`. */
    sirenSensorAction: AlarmDelayDeviceAction[];
};
/**
 * Bound guard-mode controls — the object returned by `dev.arming()`.
 *
 * Everything is DERIVED from `ARMING_MEMBERS`. `setMode` is the mode member's own derived setter;
 * `setAlarmDelayConfig` is a `method` because it takes TWO arguments (a mode and a whole config),
 * which no value setter can express.
 */
export type ArmingActions = Surface<typeof ARMING_MEMBERS>;
/**
 * Every `arming` feature, declared once.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const ARMING_MEMBERS: {
    /**
     * Read and write are the same nine modes, so `enumValues` is the whole domain: `writeDomain` falls back
     * to it, and the derived setter, the refusal message and the offered argument all read from that one
     * declaration. A member states an `args` entry only where the two sides DIFFER. See
     * {@link ARMING_MODE_WIRE} for the per-value evidence.
     *
     * `armingCommand` may also throw synchronously (missing account identity) and `bindMembers` turns that
     * into a rejection, so the builder stays plain.
     *
     * The setter takes either vocabulary — see `armingModeOf` — because the getter answers the wire integer,
     * and a value a caller just read has to be one it can write back.
     *
     * MODE_SWITCH carries no value. Live qualification on a standalone camera showed that authoritative
     * readback requires a bounded cloud-list refresh, and that its P2P session must be reset after
     * convergence before a following mode write; an attached device must never reset its shared HomeBase.
     */
    readonly mode: {
        readonly accepts: ArmingMode;
        readonly param: 1224;
        readonly property: "armingMode";
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: Record<number, string>;
        readonly provenance: "verified";
        readonly description: string;
        readonly observation: {
            readonly event: "armingModeChanged";
            readonly reflects: (value: string | number | boolean) => {
                param: 1224;
                expected: number;
            };
            readonly resetStandaloneSession: true;
            readonly timeoutMs: 20000;
        };
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * Write the FULL per-mode alarm/arm-delay configuration. The device accepts the whole config as one
     * write, not a single duration field, so a partial update is not possible. An expert/advanced API: the
     * caller is responsible for supplying `devices`/`sirenSensorAction` (and the `countDownAlarm`/
     * `countDownArm` entries they are NOT changing) from a value they have independently read/captured for
     * this mode — there is no known GET to fetch it automatically, and a wrong guess here can silently
     * misconfigure which sensors arm/trigger for real.
     *
     * Takes {@link AlarmDelayMode}, not {@link ArmingMode}: a delay is configurable only for a mode whose
     * integer is captured on THIS command, and `custom1` is confirmed on cmd 1224 only. The frame carries
     * that integer in `mode_id` with no runtime validation and no readback, so a mode outside this union
     * would be the same unverified guess `setMode` refuses.
     */
    readonly setAlarmDelayConfig: import("./members.js").MethodMember<(mode: AlarmDelayMode, config: AlarmDelayConfig) => Promise<void>>;
    /**
     * Whether the device on `channel` sends a push notification in `mode`: its {@link DEVICE_NOTIFY_FLAG}
     * in the action table the station reports for that mode. `undefined` where the station reports no table
     * or the table does not list `channel`. A standalone camera answers from its own 1225/1239/1148 flags,
     * for its own channel only. A device's channel is `EufyDevice.channel`.
     */
    readonly deviceNotification: import("./members.js").MethodMember<(mode: DeviceNotificationMode, channel: number) => boolean | undefined> & {
        available: (ctx: CommandContext) => boolean;
    };
    /**
     * Turn the push notification of the device on `channel` on or off in `mode` (cmd
     * {@link ARMING_CMD.SET_ALL_ACTION}): the station's reported table written back with that one flag
     * changed. A standalone camera is sent a one-entry `{mode_id, devices}` table built from its own flags,
     * for its own channel only. Rejects, sending nothing, where the table does not list `channel`. A write
     * builds on the last one sent for that mode until the device reports a table (`${mode}Action` on a
     * standalone camera) observed 15 s after it, so a second write does not revert it; a write whose dispatch
     * rejects is not built on.
     */
    readonly setDeviceNotification: import("./members.js").MethodMember<(mode: DeviceNotificationMode, channel: number, on: boolean) => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
};
/**
 * `arming` — guard/arming mode. `armingMode` (see {@link ARMING_CMD.SET_ARMING}) has a verified read/write
 * MECHANISM, and all 9 modes it reports are now confirmed as writes — the {@link ArmingMode} union is the
 * whole set. See `ARMING_MODE_WIRE` for which three are byte-captured and which six are live-confirmed.
 * The alarm-delay write (cmd 1255) is unaffected and keeps its narrower {@link AlarmDelayMode}.
 */
export declare const ARMING: CapabilityModule;
