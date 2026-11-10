/**
 * Device classifier — axis **B2** (command-codec family).
 *
 * ## What this module does
 * Given a cloud device record, it answers one question: *which wire-protocol family
 * does this device belong to?* — i.e. its {@link Codec} (`station | camera | sensor |
 * lock | keypad`). It also exposes the baseline {@link Capability} set every member of a
 * codec gets for free (before model rows / inference add device-specific extras).
 *
 * ## Why it is data-driven (no per-SKU table)
 * eufy assigns every product a numeric **DeviceType** at the cloud, and that number — not
 * the marketing model code — is the authoritative family discriminator. So the primary
 * classifier ({@link codecForType}) is a small set of range / membership checks over the
 * DeviceType space, with each group's DeviceType *names* spelled out in comments. A brand
 * new camera SKU that ships with a DeviceType inside the camera range classifies correctly
 * with zero code changes — that is the whole point of keeping this as data, not a wall of
 * per-model predicates.
 *
 * The DeviceType groupings below are distilled from a third-party reverse-engineering
 * project's device enum and its ~70 `isCamera`/`isStation`/`isSensor`/`isLock`/`isKeyPad`
 * predicates, collapsed into a handful of numeric sets. That is a NAME/grouping source only —
 * every behaviour keyed off a group is grounded in the V6 app or our own captures.
 *
 * ## Fallbacks
 * When the cloud record has no DeviceType (older firmware, partial records), we fall back to
 * a conservative regex over the model T-code ({@link codecFromModel}). {@link classify}
 * chains the two and defaults to `"camera"` — the most common eufy-security device and a
 * safe read-only default (a misrouted camera codec degrades to "video-ish" behaviour rather
 * than, say, attempting lock actuation).
 *
 * @module model/classify
 */
import type { Codec, CloudRecord } from "./types.js";
/**
 * Map eufy's numeric **DeviceType** to a command {@link Codec}.
 *
 * Resolution order (first match wins): station → lock → sensor → keypad → camera. Anything
 * that is a recognised security endpoint but not in the station/lock/sensor/keypad sets is
 * treated as a **camera** (cameras, doorbells, floodlight/wall-light cams, garage cams,
 * solocams, eufyCams, smart-drop, the LOCK_85V0 video-doorbell, etc.) — this is the large,
 * fast-growing family, so it is the residual bucket rather than an explicit list.
 *
 * @param deviceType eufy DeviceType integer (e.g. `9` = CAMERA2, `54` = LOCK_8503 / R10).
 * @returns the codec, or `undefined` for a genuinely unknown / non-finite input.
 */
export declare function codecForType(deviceType: number): Codec | undefined;
/**
 * Fallback classifier used when {@link CloudRecord.deviceType} is absent. Matches eufy
 * product **T-codes** by family prefix. Deliberately conservative — it only claims a codec
 * when the T-code range is a strong, unambiguous family signal; otherwise it returns
 * `undefined` and lets {@link classify} apply the camera default.
 *
 * Known T-code families (case-insensitive):
 *  - `T85xx` / `T852x` / `T850x` → **lock** (Smart Lock R-series, video lock, etc.),
 *    EXCEPT `T8520`-prefixed which can be lock variants — still lock.
 *  - `T74xx` → **lock** (SmartSafe 7400-series).
 *  - `T80xx` / `T8001` / `T8002` / `T8010` / `T8030` / `T8023` / `T8025` → **station**
 *    (HomeBase / HomeBase 2 / 3 / Mini), `T9000` (the app's own model registry files it as family
 *    `STATION_9000`, the one station family outside the T8 band), and `T8N00` (NVR) → station.
 *  - `T89xx` (entry/motion/water/siren sensors, e.g. T8900/T8910/T8920) → **sensor**.
 *  - `T87xx` keypad (`T8960`) → **keypad**.
 *  - any other `T8…` security T-code → **camera** (the default security family).
 *
 * @param model product/model code (T-code), e.g. `"T8423"`. `undefined`/empty → `undefined`.
 * @returns the inferred codec, or `undefined` when the code is unrecognised.
 */
export declare function codecFromModel(model: string | undefined): Codec | undefined;
/**
 * Resolve a {@link CloudRecord} to its command {@link Codec}.
 *
 * Strategy: trust the cloud-provided numeric DeviceType first ({@link codecForType}); if
 * that is absent/unknown, fall back to the model T-code ({@link codecFromModel}); if both
 * fail, default to `"camera"` — the most common eufy-security device and a safe read-only
 * default. **Always** returns a concrete codec.
 *
 * @param rec the minimal cloud record slice (deviceType + model are what matter here).
 * @returns the resolved codec (never `undefined`).
 */
export declare function classify(rec: CloudRecord): Codec;
