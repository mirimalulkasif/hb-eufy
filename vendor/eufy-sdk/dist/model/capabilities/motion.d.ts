import { type Surface } from "./members.js";
import type { CapabilityModule, CommandContext } from "./types.js";
import type { Command } from "../../core/contracts.js";
/**
 * The P2P **feature-command ids** this motion capability drives. Capability-owned wire vocabulary
 * (transport forwards `cmd.param` opaquely; full id→name catalog in the generated
 * `transport/p2p/commands.ts`).
 */
export declare const MOTION_CMD: {
    /**
     * Motion / PIR detection on-off (app `CAMERA_PIR`). ✅ Wire reversed from a
     * live outbound capture + replay-verified on T8425 (ch3): the direct-binary 136-byte struct
     * `[u32 ch][u32 value][account_id pad128]`, signCode 8 — SAME shape as watermark 1214. 1 = on, 0 = off.
     */
    readonly CAMERA_PIR: 1011;
    /**
     * Motion sensitivity (app `SET_MOTION_DETECTION_SENSITIVITY_DOORBELL`, despite the name NOT
     * doorbell-specific — see below). ✅ Wire captured live on a T8170 ( 2026-07-23,
     * confirmed exchange), moving the sensitivity slider twice: `1350`
     * SET_PAYLOAD, cmd 1276, mChannel `<deviceCh>`, explicit mValue3:0, `payload:{sensitivity:<int>,
     * channel:<deviceCh>}`. Two real values captured: slider position 0 → `sensitivity:1`, slider
     * position 6 → `sensitivity:7` — the wire is **1-indexed**, one higher than the app UI's 0-indexed
     * display. Captured on a T8170; no other model is assumed to share it.
     */
    readonly MOTION_SENSITIVITY: 1276;
    /**
     * PIR sensitivity on a standalone motion **sensor** (app `APP_CMD_MOTION_SENSOR_SET_PIR_SENSITIVITY`).
     * The same user-facing setting as {@link MOTION_SENSITIVITY}, under a DIFFERENT id — a camera takes
     * 1276, a sensor takes this. ✅ Captured live 2026-08-03 on a T8910: the app sent 1609 as a
     * direct-binary 136-byte frame on the sensor's channel, and the value reads back on the cloud param
     * of the same id. Sending a camera's 1276 to a sensor is a fire-and-forget no-op that looks like a
     * success, which is why the two are kept apart rather than merged.
     *
     * ⚠️ The value is NOT the app's slider index. Its picker offers five steps (low → high, annotated
     * with a detection distance), while two sensors on one account read 8 and 37 — so the mapping from
     * a step to this number is unknown, and no range can be validated beyond rejecting below 1. A caller
     * setting this is passing through a raw device value, not choosing a documented level.
     *
     * A change applies after about a minute, or immediately if the sensor is triggered — the app says so
     * on the same screen, and the same wake behaviour governs every write to a sensor.
     */
    readonly SENSOR_PIR_SENSITIVITY: 1609;
    /**
     * Enter a motion sensor's **user test mode** (app `APP_CMD_MOTION_SENSOR_ENTER_USER_TEST_MODE`).
     *
     * ✅ Decrypted from the app's own frame and replayed live on a T8910 (2026-08-03): a `1350`
     * SET_PAYLOAD whose payload carries the sensor's channel — `{"cmd":1613,"payload":{"channel":<ch>}}`.
     * The channel MUST be in the payload; passing it only as the envelope's `mChannel` with an empty
     * payload is refused with `-1`. The station acknowledges with `0` and confirms by reporting
     * {@link SENSOR_WORK_MODE} `1`.
     */
    readonly SENSOR_ENTER_TEST_MODE: 1613;
    /**
     * Leave a motion sensor's user test mode (app `APP_CMD_MOTION_SENSOR_EXIT_USER_TEST_MODE`).
     *
     * ✅ Replayed live on a T8910, confirmed by {@link SENSOR_WORK_MODE} reporting `0`. NOT the same
     * shape as its {@link SENSOR_ENTER_TEST_MODE} counterpart: this is a direct-binary frame with the id
     * as the outer command, and each is refused in the other's shape.
     */
    readonly SENSOR_EXIT_TEST_MODE: 1610;
    /**
     * The mode a motion sensor reports it is in (app `APP_CMD_MOTION_SENSOR_WORK_MODE`), inbound only —
     * `1` while test mode is on, `0` once it is left. Never present in the cloud record; it exists only
     * on the P2P path.
     */
    readonly SENSOR_WORK_MODE: 1612;
    /**
     * AI detection TYPE — which classifications trigger a detection (person / pet / vehicle / …).
     * From the app's own JS parser (command_schema.json): `1350` SET_PAYLOAD, inner cmd `AI_DETECT_TYPE`
     * (1298), `payload:{ai_detect_type:<bitmask>, channel:<deviceCh>}` — same envelope shape as the
     * ✅-verified night-vision (1277). 1298 holds the detailed BITMASK. ✅ Bits decoded live + confirmed
     * vs the app (see {@link AiDetectType} / {@link encodeAiDetectType}). ✅ WRITE HW-verified live on
     * T8124 (each write landed byte-exact + read back: 0x30003 → 0x8 → 0x3000b).
     */
    readonly AI_DETECT_TYPE: 1298;
    /**
     * Notification **snooze** — temporarily silence motion/detection notifications for N seconds. ✅ WIRE
     * CONFIRMED on a T8170 (2026-07-23,
     * app force-relaunched to guarantee a fresh handshake): a **bare JSON frame, NOT a `1350`/`1700`
     * envelope** — outer P2P cmd IS `1271` itself, plaintext exactly `{account_id,...}` (see
     * {@link module:./intent setJsonRaw}). Three real writes captured on the device channel (ch2):
     * `{snooze_time:21600,chime_onoff:0,homebase_onoff:1,motion_notify_onoff:1,startTime:1784794716}`,
     * `{snooze_time:0}` (clearing/cancelling — the bare shape, no extra fields), and
     * `{snooze_time:3600,chime_onoff:0,homebase_onoff:0,motion_notify_onoff:1,startTime:1784794730}`.
     * Confirms `command_schema.json`'s field names exactly; it is a real P2P frame, not the cloud-only
     * HTTP path a `paramValue = base64(JSON.stringify(payload))` shape might suggest.
     * `chime_onoff`/`homebase_onoff`/`motion_notify_onoff` meanings are NOT independently verified
     * (only observed alongside 2 different snooze picks) — `setSnoozeTime` ships the exact 2nd-capture
     * values as fixed defaults rather than exposing them, since their semantics aren't confirmed enough
     * to make configurable without risking a wrong guess on a fire-and-forget write.
     */
    readonly SNOOZE_TIME: 1271;
    /**
     * Use AI classification ONLY at night (app `APP_CMD_BAT_DOORBELL_SET_ONLY_USE_AI_AT_NIGHT`).
     * `1350` SET_PAYLOAD, inner cmd 1719, `payload:{only_ai:0|1}`, mValue3 0. The envelope's mChannel is
     * the DEVICE channel — which is set by NOT passing `setPayload`'s explicit-channel arg, and is
     * independent of what keys the payload carries. (Contrast 1277/1298, which DO carry a `channel`
     * payload key AND pass mChannel 0 explicitly; the two are separate choices, not linked.)
     *
     * ⚠️ Replay + readback confirmed on a HomeBase-attached T8425 (1719 `0`→`1`→`0`), NOT byte-captured.
     */
    readonly HUMAN_ONLY_AT_NIGHT: 1719;
    /**
     * Loitering detection (app `APP_CMD_DUALCAM_SET_RADAR_WD_SWITCH`) — alert on lingering, not passing.
     * `1350` SET_PAYLOAD, inner cmd 2706, `payload:{radar_wd_switch:0|1}`, mValue3 0, mChannel = device
     * channel. Observed on the T8214 doorbell only.
     *
     * **READ is object-OR-scalar.** The app reads it as
     * `typeof v === "object" ? v.radar_wd_switch : v`, so the stored value may be a JSON object
     * `{radar_wd_switch,…}` OR a bare scalar — a plain bool coercion reports `false` for the object
     * form, so a feature that is on reads as off.
     * Decoded by {@link decodeRadarWdSwitch} to match the app.
     *
     * ⚠️ Replay + readback confirmed on a T8214 (2706 `0`→`1`→`0`), NOT byte-captured.
     */
    readonly LOITERING_DETECTION: 2706;
    /**
     * Detection sensitivity on the inverted seven-step camera scale (app `APP_CMD_SET_PIRSENSITIVITY`).
     * Reported by nine camera families but only accepted by the one whose reported value falls on its
     * seven-step ladder, which is how the scale is resolved without consulting the model.
     */
    readonly CAMERA_PIR_SENSITIVITY: 1210;
    /**
     * Detection sensitivity an indoor camera reports AND accepts (app `INDOOR_MOTION_DETECTION_SENSITIVITY`),
     * as a `1700` control payload carrying an index rather than the `1350` envelope its siblings take.
     */
    readonly INDOOR_SENSITIVITY_INDEX: 6041;
    /**
     * Detection sensitivity a solo camera REPORTS (app `SET_MOTION_DETECTION_SENSITIVITY_SOLO`). It does
     * not accept writes on this id — the write goes to {@link MOTION_SENSITIVITY}, which is why a scale
     * carries a read id and a write id separately.
     */
    readonly SOLO_SENSITIVITY: 6070;
};
/**
 * AI detection type bits — the `ai_detect_type` bitmask, decoded on-device and cross-checked against
 * the app. `enabledBase` (0x30000) is the "AI detection on" flag, set on every camera and always OR'd
 * into a value. `humanRecognition` (face) and `humanDetection` always co-occur in observed data; the app
 * lists them in this order. (Some indoor cams set extra high bits — sound/crying — not modelled here.)
 */
export declare const AiDetectType: {
    /** "AI detection enabled" base — always present in a valid value. */
    readonly enabledBase: 196608;
    readonly humanRecognition: 1;
    readonly humanDetection: 2;
    readonly vehicle: 4;
    readonly pet: 8;
};
/** Bound motion controls — the object returned by `dev.motion()`. */
export type MotionActions = Surface<typeof MOTION_MEMBERS> & {
    /** How many steps this device's picker offers, or `undefined` when its scale is not known. */
    sensitivitySteps(): number | undefined;
    /**
     * Current detection-sensitivity step, 1 being the least sensitive.
     *
     * Resolved through the same scale the write uses, because the id a device reports this on differs
     * between scales and several devices report more than one of them — so a caller reading the raw
     * param would have to know which one counts, and in which direction. `undefined` when the device has
     * not reported yet, or reports a value no known ladder contains.
     */
    sensitivityStep(): number | undefined;
    /**
     * Set the detection-sensitivity step, from 1 (least sensitive) up to `sensitivitySteps`.
     *
     * A step, not a device value: the five device families this is captured on use four different
     * command ids, three frame shapes and two opposite numeric directions, so a raw number means the
     * opposite thing depending on what it is sent to. Step 1 is always the least sensitive.
     *
     * Rejects a step outside the device's own range, and throws for a model whose scale has not been
     * captured — a wrong id is a fire-and-forget no-op that would otherwise look like it worked.
     */
    setSensitivityStep(step: number): Promise<void>;
};
/** Named AI detection types, for {@link encodeAiDetectType} / {@link decodeAiDetectType}. */
export interface AiDetectFlags {
    humanRecognition?: boolean;
    humanDetection?: boolean;
    vehicle?: boolean;
    pet?: boolean;
}
/** Encode named detection types → the `ai_detect_type` bitmask (always includes the enabled base). */
export declare function encodeAiDetectType(flags: AiDetectFlags): number;
/** Decode an `ai_detect_type` bitmask → which detection types are on. */
export declare function decodeAiDetectType(value: number): AiDetectFlags;
/**
 * The `ai_detect_type` bitmask from a stored 1298 value: the bare number, or the numeric
 * `ai_detect_type` field of the JSON object form. Answers `undefined` for any other shape.
 */
declare function decodeAiDetectTypeParam(raw: unknown): number | undefined;
/**
 * Decode a `radar_wd_switch` (2706, loitering) read the way the app does:
 * `typeof v === "object" ? v.radar_wd_switch : v`. The device may store it as a JSON object
 * `{radar_wd_switch,…}` OR a bare scalar, so a plain bool coercion mis-reads the object form as
 * `false` (see `MOTION_CMD.LOITERING_DETECTION`). Returns `undefined` for an unreadable value
 * rather than guessing.
 * @internal
 */
export declare function decodeRadarWdSwitch(raw: unknown): boolean | undefined;
/**
 * `motion` — PIR / motion detection. `motionDetection` (1011), `motionSensitivity` (see
 * `MOTION_CMD.MOTION_SENSITIVITY`), and `snoozeTime` (see `MOTION_CMD.SNOOZE_TIME`) are
 * all verified: read AND write.
 */
/**
 * Every `motion` feature, declared once — the property schema, the typed getters, the derived setters,
 * the intent routes and the descriptions all come out of this table.
 *
 * The four raw sensitivity params are read-only members: each family reports its ladder under a
 * DIFFERENT id and two of them run inverted, so the meaningful value is the STEP, resolved across
 * all four by the methods in `actions()`. They stay in the schema because the device reports them and a
 * diagnosis may want the raw number.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const MOTION_MEMBERS: {
    /**
     * The master motion/PIR switch. `writeAs` names the setter `setDetection` rather than the
     * `setDetectionEnabled` the key would derive. The write calls `requireFamily` first, because
     * this frame is captured on cameras only and a P2P write is fire-and-forget — sent to a sensor it
     * would be dropped silently while the call reported success, so it throws instead.
     */
    readonly detectionEnabled: {
        readonly param: 1011;
        readonly property: "motionDetection";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: "Motion/PIR detection enabled (verified: param 1011 = CAMERA_PIR).";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
        readonly writeAs: "setDetection";
    };
    /**
     * First of the four raw sensitivity params, all `unexposed`: reported, so they stay in the schema and
     * answer through `getProperty` for a diagnosis, but given no typed getter because a raw number here
     * means nothing on its own — each family reports its ladder under a different id and two run
     * inverted. The meaningful value is the STEP, resolved across all four by `sensitivityStep()` in
     * `actions()`. This id is both the read and the write for the five-step rising scale.
     */
    readonly motionSensitivity: {
        readonly param: 1276;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly unexposed: true;
        readonly description: string;
    };
    /**
     * 1298 holds the detailed AI-type BITMASK (live-observed: `0x30000` enabled-base | type bits, e.g. a
     * T8425 reads `0x3000f`). Cams also report 1299 (`hbAiDetectType`) but that is a separate, simpler
     * value (1) — NOT this bitmask, so 1298 is the read/write id.
     *
     * The value arrives in two shapes, both read by the app's 1298 parser: a bare bitmask, or a JSON
     * object carrying the same bitmask as `ai_detect_type` (see {@link decodeAiDetectTypeParam}).
     */
    readonly aiDetectType: {
        readonly param: 1298;
        readonly type: "string";
        readonly decode: typeof decodeAiDetectTypeParam;
        readonly decodedKind: "bitfield";
        readonly provenance: "verified";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * The raw sensitivity a solo camera REPORTS — and only reports: its scale writes to
     * `MOTION_CMD.MOTION_SENSITIVITY` instead, which is why `SensitivityScale` carries a read id and
     * a write id separately. `unexposed` like its three siblings; read the resolved step instead.
     */
    readonly soloSensitivity: {
        readonly param: 6070;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly unexposed: true;
        readonly description: "Raw sensitivity a solo camera reports (verified: param 6070).";
    };
    /**
     * The raw sensitivity an indoor camera reports, on the one id whose write takes a `1700` control
     * payload carrying an index rather than the `1350` envelope its siblings use — a frame-shape
     * difference `sensitivityCommand` resolves from the scale. `unexposed` like its three siblings.
     *
     * Some devices report 6041 as a base64 JSON list of per-sensor entries
     * (`{"list":[{"sensor_id":…,"sensitivity":…}]}`) rather than a scalar. That value is stored verbatim
     * and this getter answers `undefined` for it: only the scalar form is confirmed to be this step.
     */
    readonly indoorSensitivity: {
        readonly param: 6041;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly unexposed: true;
        readonly description: "Raw sensitivity an indoor camera reports (verified: param 6041).";
        readonly decode: (raw: unknown) => number | undefined;
    };
    /**
     * The raw sensitivity on the INVERTED seven-step camera scale — a HIGHER number is LESS sensitive, so
     * this is the member where reading the number as a level gets the direction backwards. Nine camera
     * families report 1210 and only the one whose value lands on that ladder accepts it, which is how
     * `scaleFor` tells them apart without consulting the model. `unexposed`; read the step instead.
     */
    readonly pirSensitivityRaw: {
        readonly param: 1210;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly unexposed: true;
        readonly description: "Raw sensitivity reported on the inverted seven-step scale (verified: param 1210).";
    };
    /**
     * The raw sensitivity a standalone PIR sensor reports, on its own inverted five-step ladder — the
     * sensor-side counterpart to the camera's 1276, kept apart because sending a camera's id to a sensor
     * is a fire-and-forget no-op that looks like success. The number is not the app's picker index (see
     * `MOTION_CMD.SENSOR_PIR_SENSITIVITY`), which is exactly why it is `unexposed`.
     */
    readonly sensorPirSensitivity: {
        readonly param: 1609;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly unexposed: true;
        readonly description: "Raw sensitivity a standalone PIR sensor reports (verified: param 1609, inverted ladder).";
    };
    /**
     * A standalone motion sensor's user test mode — the ONLY state in which such a sensor reports
     * detections over P2P; outside it, detections arrive on the push path. `realtime` is deliberately NOT
     * set: the id never appears in the cloud record, so the getter arrives only once the station has
     * reported it.
     *
     * The write is the one asymmetric pair here — enter is a `1350` payload carrying the channel, leave is
     * a direct-binary frame, and each is refused in the other's shape. Sensor-family only; a camera
     * throws via `requireFamily`.
     */
    readonly testMode: {
        readonly param: 1612;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * Seconds of notification silence remaining, `0` for none — and the reason this member has both a
     * `type: "string"` and a `decode`: the device reports the whole snooze CONFIG, so the stored property
     * describes the blob while `decodeSnoozeSeconds` lifts the duration out of it on read. The
     * `decode`'s return type is what a caller gets, so the getter answers a number.
     *
     * Writing a positive duration re-sends the capture's fixed companion fields rather than exposing them
     * (`snoozePayload`); writing 0 sends the bare clear shape. Camera-family only.
     */
    readonly snoozeTime: {
        readonly param: 1271;
        readonly type: "string";
        readonly provenance: "verified";
        readonly min: 0;
        readonly decode: (raw: unknown) => number | undefined;
        readonly decodedKind: "seconds";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * Not every model offers it, and one that does not accepts the frame without acting on it — so the
     * write is offered only where the device reports the id, and the surface says it is optional.
     */
    readonly humanOnlyAtNight: {
        readonly param: 1719;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: string;
        readonly requires: readonly [1719];
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The app reads it as `typeof v === "object" ? v.radar_wd_switch : v`, so the stored value may be a
     * JSON object OR a bare scalar — a plain bool coercion reports `false` for the object form.
     */
    readonly loiteringDetection: {
        readonly param: 2706;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly coerce: (raw: string | number | boolean) => boolean;
        readonly description: string;
        readonly requires: readonly [2706];
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
};
export declare const MOTION: CapabilityModule;
export {};
