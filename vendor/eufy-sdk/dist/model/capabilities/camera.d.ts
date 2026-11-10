import { isCameraCodec } from "./access.js";
import { type Surface } from "./members.js";
import type { AvailabilityContext, CapabilityModule, CommandContext } from "./types.js";
import { type Command, type MediaProvider } from "../../core/contracts.js";
/**
 * The P2P **feature-command ids** this camera capability drives (direct-binary switches + `1350`
 * SET_PAYLOAD sub-commands). These are the capability's own wire vocabulary — the transport carries
 * `cmd.param` opaquely and never names them (the full 541-entry id→name catalog lives in the generated
 * `transport/p2p/commands.ts`). Each entry notes its app `CommandType` name.
 */
export declare const CAMERA_CMD: {
    /** Camera-reported Wi-Fi signal (app `CMD_GET_WIFI_RSSI`). */
    readonly WIFI_RSSI: 1142;
    /** Camera on/off. Read and write polarity depend on the family and topology. */
    readonly CAMERA_ENABLE: 1035;
    /** Wrapped T8410 power switch on HomeBase 3. */
    readonly PRIVACY_MODE: 6250;
    /**
     * Camera status LED on/off — the "power/recording" indicator. The
     * app JS has a sibling param `1056` (`APP_CMD_LIVEVIEW_LED_SWITCH`) for the SAME UI "Status Light"
     * setting on some other model/generation — confirmed real (a full parser class exists) but tested
     * live with no effect on a T8425 (which uses 1045, shipped here); which model actually uses 1056
     * is unconfirmed. Don't wire 1056 as an alias of this without per-model evidence.
     */
    readonly DEV_LED_SWITCH: 1045;
    /**
     * Rotate the image 180° on/off. Direct param, value 0 = normal, 1 = flipped. The app's constant is
     * `INDOOR_ROTATE_IMAGE`, but it is NOT indoor-only — ✅ verified live on an OUTDOOR floodlight cam
     * (T8425), so we drop the misleading "indoor". App parser: `{cmd:1207, params:{enable:0|1}}`.
     */
    readonly ROTATE_IMAGE: 1207;
    /**
     * On-screen watermark / OSD overlay (app `CMD_SET_DEVS_OSD`). ✅ Wire verified live on T8425 (ch3):
     * a **3-value enum**, not a bool — 0 = off, 1 = timestamp, 2 = timestamp + logo. Direct-binary
     * `[channel][value]`. (Labels/enum in {@link Watermark}.)
     */
    readonly SET_DEVS_OSD: 1214;
    /**
     * Video-doorbell status-LED on/off. Rides the `1350` SET_PAYLOAD envelope
     * (`{account_id,cmd:1716,mChannel,mValue3:1716,payload:{light_enable:0|1}}`),
     * signCode 8. ✅ verified live on Doorbell Dual T8214. Family-specific wire for the same semantic
     * status LED setting ordinary cameras report under 1045.
     */
    readonly DOORBELL_LED: 1716;
    /**
     * Night-vision mode (app `NIGHT_VISION_TYPE`). Enum: 0 = off, 1 = infrared/auto (B&W), 2 = full colour.
     * ✅ All three verified live on T8425: `1350` SET_PAYLOAD, inner cmd 1277, `payload:{channel:<deviceCh>,
     * night_sion:N}`, mChannel 0, mValue3 0. Standalone (SINGLE-connect) uses direct `IC_NIGHT_VISION_TYPE`
     * (1013). (Some models omit full colour; enum in {@link NightVision}.)
     */
    readonly NIGHT_VISION_TYPE: 1277;
    /** T8442 infrared night vision on/off: direct L1 int-string, hardware verified (0/1). */
    readonly IC_NIGHT_VISION_TYPE: 1013;
    /**
     * Push-notification STYLE — how much a detection push carries: text alone, a thumbnail, or text
     * followed by a thumbnail. App `CMD_INDOOR_PUSH_NOTIFY_TYPE`, and the "indoor" is a misnomer: the
     * wire is confirmed on an OUTDOOR standalone camera (T8171). The app's id→name table carries TWO
     * aliases for this id, `ENTER_OTA` and `INDOOR_PUSH_NOTIFY_TYPE`; the confirmed behaviour is the
     * notification style.
     *
     * Wire verified live on a T8171 (standalone, own channel, reached over the cloud/WAN path): the
     * `1700` CONTROL_PAYLOAD wrapper, signCode 8, plaintext
     * `{"commandType":6020,"data":{"value":N,"transaction":"<epoch ms>"}}`. All three values captured
     * byte-exact, each read back on the cloud param within ~10s. The station answers on the same wrapper
     * ~600ms later with a 4-byte body — the command's int32 result — so this write is not
     * fire-and-forget, unlike the direct-binary switches.
     * (Values in {@link NotificationStyle}.)
     */
    readonly PUSH_NOTIFY_TYPE: 6020;
    /**
     * **Sound detection** switch — whether the camera triggers on what it hears, beside the motion
     * trigger it triggers on what it sees.
     *
     * Wire observed live on an indoor pan-tilt (standalone, mains, own channel): the `1700`
     * CONTROL_PAYLOAD wrapper, plaintext `{"commandType":6043,"data":{"status":0|1}}`. Both directions
     * captured byte-exact and read back on the cloud param, twice each; no other parameter moved.
     */
    readonly SOUND_DETECTION: 6043;
    /**
     * How loud a sound has to be to trigger {@link CAMERA_CMD.SOUND_DETECTION} — the app's three-position
     * control writes `1` lowest, `3` mid, `5` highest.
     *
     * Wire observed live on the same camera: `{"commandType":6044,"data":{"index":N}}` in the `1700`
     * wrapper. The payload field is `index`, NOT the `value` its neighbours use — each of these
     * commands names its field differently, so there is no generic setter for the family.
     */
    readonly SOUND_DETECTION_SENSITIVITY: 6044;
    /**
     * WHICH sounds trigger {@link CAMERA_CMD.SOUND_DETECTION} — all sound, or crying alone.
     *
     * Wire observed live: `{"commandType":6046,"data":{"type":N}}` in the `1700` wrapper, both values
     * captured and read back. (Values in {@link SoundDetectionType}.)
     */
    readonly SOUND_DETECTION_TYPE: 6046;
    /**
     * **Anti-theft detection** switch (app `APP_CMD_EAS_SWITCH`). Despite the "EAS" name the app's own
     * parser maps this id onto `anti_theft_detection_switch`, so the camera member uses that semantic
     * name. The app's "EAS" resource strings mix emergency- and anti-theft-worded copy; the parser is
     * the tiebreak.
     *
     * Wire from the app's own JS: a scalar `params:{value:0|1}`. Emitted with the **adaptive** form so
     * topology picks the level — level-2/direct on a HomeBase-attached device, level-1 on a standalone.
     *
     * ⚠️ Replay + readback confirmed on a **HomeBase-attached** T8425 only (1015 read `0` → write → `1`
     * → restore): the frame is confirmed accepted and persisted, NOT byte-compared to the app's. The
     * **standalone** path is unverified, and newer (v3) devices use a *different* id for the same
     * switch — `APP_CMD_NEW_EAS_SWITCH` (2735) — which has no path here; don't assume 1015 drives them.
     */
    readonly EAS_SWITCH: 1015;
    /**
     * RECORDING quality — what gets stored, not the live view; {@link CAMERA_CMD.STREAMING_QUALITY_SET}
     * below is the live one, and the app's name for this id is `multicamSetRecordQuailty`.
     * Wire confirmed on a T8425 ch3: `1350` SET_PAYLOAD, inner cmd 2731,
     * `payload:{channel:0, mode:0, primary_view:0, quality:N}`, mValue3 0, on the device channel. Tiers
     * 1/2/3, named in {@link RECORDING_QUALITY_TIERS} — no tier 0 on this wire, where streaming has one.
     * That is a fact about 2731 on the cameras it was confirmed on, not about recording everywhere. A
     * doorbell has no recording-quality setting at all, and its live-view quality rides neither 2730 nor
     * 2731 but 1705, on a domain of its own (5 = Auto, 6/7/8 = Low/Medium/High, all four observed).
     */
    readonly RECORDING_QUALITY_SET: 2731;
    /**
     * LIVE-VIEW quality — a separate setting from {@link CAMERA_CMD.RECORDING_QUALITY_SET}, and the app's
     * names for the two invert what they suggest: 2730 is `multicamSetVideoQuailty` and drives the
     * Streaming Quality picker, while 2731 is `multicamSetRecordQuailty` and drives Recording Quality.
     * Changing one leaves the other's parameter untouched, which is how they were told apart.
     *
     * Unlike recording it offers a tier 0, `Auto`. Wire verified live on a T8170 (standalone): the `1350`
     * SET_PAYLOAD envelope, signCode 8, plaintext `{"cmd":2730,"payload":{"transaction":"<epoch ms>",
     * "quality":N,"channel":0,"mode":0,"primary_view":0},"account_id":…}`. All four tiers captured
     * byte-exact and read back on parameter 1020; the station echoes the same payload back as a `1351`
     * NOTIFY_PAYLOAD carrying the same `transaction`.
     */
    readonly STREAMING_QUALITY_SET: 2730;
};
/** Whether a model-side record or bound context reports the camera-owned legacy EAS switch. */
export declare function hasReportedEasSwitch(source: {
    params?: Record<number, string>;
    paramIds?: ReadonlySet<number>;
}): boolean;
/**
 * On-screen watermark / OSD overlay options. The value is the UI radio index. Use
 * `Watermark.TimestampAndLogo` etc. with `setWatermark` / `setProperty(sn,"watermark",…)`.
 */
export declare const Watermark: {
    /** No timestamp or logo. */
    readonly Off: 0;
    /** Timestamp only. */
    readonly Timestamp: 1;
    /** Timestamp + eufy logo. */
    readonly TimestampAndLogo: 2;
};
/** A watermark option — the value side of {@link Watermark}. */
export type WatermarkValue = (typeof Watermark)[keyof typeof Watermark];
export declare const NotificationStyle: {
    /** The push carries text alone. */
    readonly TextOnly: 1;
    /** The push carries a thumbnail of the detection. */
    readonly IncludedThumbnail: 2;
    /** The push arrives as text, then updates with a thumbnail. */
    readonly TextFirstThenThumbnail: 3;
};
/** A notification style — the value side of {@link NotificationStyle}. */
export type NotificationStyleValue = (typeof NotificationStyle)[keyof typeof NotificationStyle];
export declare const SoundDetectionType: {
    /** Crying alone triggers a detection. */
    readonly Crying: 1;
    /** Any sound loud enough for the sensitivity triggers a detection. */
    readonly AllSound: 2;
};
/** A sound-detection type — the value side of {@link SoundDetectionType}. */
export type SoundDetectionTypeValue = (typeof SoundDetectionType)[keyof typeof SoundDetectionType];
/**
 * Night-vision mode: 0=Off, 1=Infrared (the app shows "B&W Auto"), 2=FullColor ("Color"). Use
 * `NightVision.FullColor` etc. with `setNightVision` / `setProperty(sn,"nightVision",…)`. Some models
 * omit `FullColor`.
 */
export declare const NightVision: {
    /** Off — never use infrared. */
    readonly Off: 0;
    /** Infrared / "B&W Auto" — black-and-white night vision. */
    readonly Infrared: 1;
    /** Full colour night vision (models with a spotlight / starlight sensor). */
    readonly FullColor: 2;
};
/** A night-vision mode — the value side of {@link NightVision}. */
export type NightVisionValue = (typeof NightVision)[keyof typeof NightVision];
/**
 * Video record-quality names. The stored value is a quality TIER; the two lower tiers are the same
 * resolution on every camera confirmed so far, and the top tier is whatever the camera's sensor gives —
 * 2K on a T8171, 3K on a T8170 and a T8425 — so it is named for its RANK, not for a resolution.
 *
 * Naming it "3K HD" would be a claim the SDK cannot ground: a camera does not report its top
 * resolution (the cloud record's `product` is null and no parameter carries it), and the app's own model
 * registry spells a resolution into only some older families, neither of the confirmed ones among them.
 * A resolution label is presentation, and one that cannot be derived is presentation the SDK would get
 * wrong; `Max` is a fact about the tier.
 */
export declare const RecordingQuality: {
    readonly HD720: "HD (720P)";
    readonly FullHD1080: "Full HD (1080P)";
    readonly Max: "Max";
};
/** A video-quality name — the value side of {@link RecordingQuality}. */
export type RecordingQualityName = (typeof RecordingQuality)[keyof typeof RecordingQuality];
/**
 * Quality tier → name. Tiers confirmed on real devices: 1 = 720P, 2 = 1080P, 3 = the sensor's maximum
 * (observed as 2K on a T8171 and 3K on a T8170 and a T8425, hence the rank rather than a resolution).
 * The vendor names by rank itself where a resolution would not travel: a doorbell's live-view picker
 * reads Auto/Low/Medium/High.
 */
export declare const RECORDING_QUALITY_TIERS: Readonly<Record<number, string>>;
/**
 * Live-view quality names — the recording tiers plus `Auto`, which 2730 offers and 2731 does not: the
 * camera picks a tier from the link instead of being pinned to one.
 */
export declare const StreamingQuality: {
    readonly HD720: "HD (720P)";
    readonly FullHD1080: "Full HD (1080P)";
    readonly Max: "Max";
    readonly Auto: "Auto";
};
/** A live-view quality name — the value side of {@link StreamingQuality}. */
export type StreamingQualityName = (typeof StreamingQuality)[keyof typeof StreamingQuality];
/**
 * Live-view quality tier → name. Tier 0 is `Auto`; 1, 2 and 3 are the recording tiers, confirmed to
 * carry the same names on a T8170 and a T8171.
 */
export declare const STREAMING_QUALITY_TIERS: Readonly<Record<number, string>>;
/** Resolve a live-view quality tier to its name — or `undefined` if it is not a tier. */
export declare function resolveStreamingQuality(value: number): string | undefined;
/**
 * Resolve a `setStreamingQuality` argument — a name ({@link StreamingQuality}) or a raw tier — to a
 * valid tier, else `undefined`. `Auto` is tier 0 here, so unlike the recording resolver a 0 is
 * accepted; anything outside the tier set is still refused rather than sent.
 */
export declare function resolveStreamingQualityTier(value: number | string | boolean): number | undefined;
/** Resolve a raw `quality` tier value to its resolution label — or `undefined`. */
export declare function resolveRecordingQuality(value: number): string | undefined;
/** Inverse: the raw `quality` tier value for a resolution NAME — or `undefined` if not a known tier. */
export declare function resolveRecordingQualityValue(name: string): number | undefined;
/**
 * Resolve a `setRecordingQuality` argument — a resolution NAME ({@link RecordingQuality}) OR a raw tier — to a
 * valid tier value, else `undefined`. Unlike a bare `Number()`, this rejects a value that isn't a real
 * tier (0, negative, out of range): the write is fire-and-forget, so an out-of-range quality value
 * would look like it worked while doing nothing. A numeric string ("2") is a raw tier; a non-numeric
 * string is looked up as a resolution name; a boolean is not a tier.
 */
export declare function resolveRecordingQualityTier(value: number | string | boolean): number | undefined;
/**
 * Bound camera controls — the object returned by `dev.camera()`.
 *
 * The reads, their setters and the media methods are all DERIVED from `CAMERA_MEMBERS`: one
 * declaration per feature gives the getter, the setter, its argument type and its description, and a
 * media method takes its signature from {@link MediaProvider} itself. The media half lands optional
 * because it exists only on a device bound to a provider. Only the no-argument power verbs — which
 * carry no value, so no member can hold them — are written out below.
 */
export type CameraActions = Surface<typeof CAMERA_MEMBERS> & {
    /** Power the camera on. */
    on(): Promise<void>;
    /** Power the camera off. */
    off(): Promise<void>;
};
/** T8442 has a binary night-vision wire, unlike cameras with the three-mode 1277 control. */
declare function isT8442(ctx: AvailabilityContext): boolean;
/**
 * Every `camera` feature, declared once. The property schema, the typed getters, the derived setters,
 * the intent routes, the media methods and the descriptions all come out of this table.
 *
 * The enum members publish no option set of their own beyond `enumValues` — a second copy of a set
 * could only drift from it — and each refusal message is generated from that same set.
 *
 * No `reboot`: it is a STATION operation with an unproven wire, shipped as the device-level
 * `EufyMega.reboot(sn)` (wire-confirmed station-scalar RESTART_HUB) rather than guessed at here.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const CAMERA_MEMBERS: {
    /** Reads the latest cached report and exposes no setter. */
    readonly wifiRssi: {
        readonly param: 1142;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "apk";
        readonly description: "Camera-reported Wi-Fi signal; physical units and a quality scale are unspecified.";
    };
    /**
     * The default READ is the *disable*-bit convention (1035 "0" ⇒ ON, 2001 direct); the WRITE polarity is
     * family-dependent — see `powerValue` / `isEnableBitPolarity`. Battery/solo cams report the state under
     * 1035, standalone indoor/outdoor cams under 2001 OPEN_DEVICE with direct polarity, so 2001 is a
     * read-alias. Both verified live, and the write polarity is confirmed against the app's own frames.
     *
     * T8410 on HomeBase 3 reports 1035 as an enable bit ("1" ⇒ ON). That reported state does not reliably
     * reflect the privacy command. `readReflectsWrite` states this distinction.
     *
     * The privacy param (6250) is reported by the outdoor-PT family and by no other camera measured, and both
     * of its polarities are observed. It is deliberately NOT aliased here: it moved in the same step as 1035, so
     * the reading cannot say whether power and privacy are one state or two — so
     * aliasing a second param could only fold two possible states into one getter for no gain.
     */
    readonly enabled: {
        readonly param: 1035;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly invert: true;
        readonly invertFor: (ctx: AvailabilityContext) => false | undefined;
        readonly readAliases: readonly [{
            readonly paramType: 2001;
            readonly invert: false;
        }];
        readonly readReflectsWrite: (ctx: CommandContext) => boolean;
        readonly description: string;
        readonly observation: {
            readonly event: "cameraEnabledChanged";
            readonly reflects: (value: string | number | boolean, ctx: CommandContext) => {
                param: number;
                expected: boolean | number;
                observed: boolean;
            } | undefined;
            readonly timeoutMs: 20000;
        };
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
        readonly aliases: {
            readonly on: true;
            readonly off: false;
        };
    };
    /**
     * A 180° rotation for a ceiling or upside-down mount, not a mirror — the app's own constant calls it
     * `INDOOR_ROTATE_IMAGE` but it is not indoor-only. `apk` provenance: the wire is read out of the app
     * parser and the write has not been driven on hardware, so treat a silent no-op as possible and
     * confirm by re-reading rather than by trusting the dispatch.
     */
    readonly imageFlipped: {
        readonly param: 1207;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * A THREE-VALUE enum, not the boolean the name suggests — the middle option is timestamp without the
     * logo, so a plain switch cannot express every state the device has. `coerceEnumValue` refuses
     * anything outside {@link Watermark} instead of coercing it: on a fire-and-forget write a bogus index
     * would dispatch and look like it worked. The labels are the app's radio order.
     */
    readonly watermark: {
        readonly param: 1214;
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: {
            readonly 0: "Off";
            readonly 1: "Timestamp";
            readonly 2: "Timestamp + Logo";
        };
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * Whether the camera triggers on what it HEARS — the sound counterpart to motion detection, which the
     * app presents beside it. The camera keeps the sensitivity and the type it was last given, so
     * switching this off and on again restores the previous configuration rather than resetting it.
     */
    readonly soundDetection: {
        readonly param: 6043;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * How loud a sound must be to trigger: `1` lowest, `3` mid, `5` highest, on the app's own
     * three-position control. A `scalar` rather than an enum — the endpoints and the midpoint are
     * observed, so 2 and 4 are a prediction of the scale's shape rather than values the wire is known to
     * take. Independent of {@link CAMERA_MEMBERS.soundDetection}: the camera stores it whether sound
     * detection is on or off.
     */
    readonly soundDetectionSensitivity: {
        readonly param: 6044;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * WHICH sounds count — any sound, or crying alone. `coerceEnumValue` refuses anything outside
     * {@link SoundDetectionType} rather than coercing it: both neighbouring values are real types, so a
     * coerced one arms the wrong trigger and reports success.
     */
    readonly soundDetectionType: {
        readonly param: 6046;
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: {
            readonly 1: "Crying";
            readonly 2: "All Sound";
        };
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * `coerceEnumValue` refuses anything outside {@link NotificationStyle} instead of coercing it: every
     * neighbouring value is itself a real style, so a coerced one selects the wrong notification and
     * reports success.
     *
     * `transaction` is part of the verified frame — a decimal epoch-in-milliseconds string, fresh per
     * command.
     */
    readonly notificationStyle: {
        readonly param: 6020;
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: {
            readonly 1: "Text Only";
            readonly 2: "Included Thumbnail";
            readonly 3: "Text First, Then Thumbnail";
        };
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * Three modes, and `FullColor` is the conditional one: a model without a spotlight or starlight
     * sensor omits it, and the wire accepts the value regardless — the device's own reported set is the
     * only statement of which of the three it has. `coerceEnumValue` rejects a value outside
     * {@link NightVision} rather than coercing it. The payload key on the wire is `night_sion`.
     */
    readonly nightVision: {
        readonly param: 1277;
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: {
            readonly 0: "Off";
            readonly 1: "Infrared";
            readonly 2: "Full Color";
        };
        readonly enumValuesFor: (ctx: AvailabilityContext) => {
            0: string;
            1: string;
        } | undefined;
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly readAvailable: (ctx: AvailabilityContext) => boolean;
        readonly readAliases: readonly [{
            readonly paramType: 2002;
            readonly available: typeof isT8442;
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * Live-view quality, the pair to {@link CAMERA_MEMBERS.recordingQuality} and a different setting on a
     * different wire: changing one leaves the other's parameter untouched.
     *
     * The READ is 1020, which reports the resolved tier as a plain integer, while the WRITE rides 2730's
     * `1350` payload. They are two ids for one setting because 2730 carries a per-mode config and 1020
     * carries the tier in force; the tier is what this property means. 1020 is also the name the param
     * dictionary already gives that id, and `Device` keys state by NAME — a member claiming 2730 under
     * this name would collide with it on a device reporting both.
     *
     * `transaction` is part of the frame that was captured, so it is sent. The recording sibling's own
     * confirmed frame carries no such field; neither is inferred from the other.
     */
    readonly streamingQuality: {
        readonly accepts: StreamingQualityName;
        readonly param: 1020;
        readonly type: "number";
        readonly kind: "enum";
        readonly enumValues: Readonly<Record<number, string>>;
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly args: readonly [{
            readonly name: "quality";
            readonly kind: "enum";
            readonly description: "A tier, or the name it maps to. 0 is Auto.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * `type` is how the value is STORED, and 2731 stores the whole config — the ACTIVE tier is lifted out
     * of it by `decode`, so the getter answers a tier while the schema stays honest. The setter
     * takes a resolution NAME as well as the tier the getter answers.
     */
    readonly recordingQuality: {
        readonly accepts: RecordingQualityName;
        readonly param: 2731;
        readonly type: "string";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly decode: (raw: unknown) => number | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: number[];
        readonly enumValues: Readonly<Record<number, string>>;
        readonly description: string;
        readonly args: readonly [{
            readonly name: "quality";
            readonly kind: "enum";
            readonly description: "A tier; the resolution name it maps to is accepted too.";
        }];
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * Not every model has the feature, and one without it accepts the frame without acting on it — so the
     * write is offered only where the device reports 1015, the same param the read is gated on.
     */
    readonly antiTheftDetection: {
        readonly param: 1015;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly requires: readonly [1015];
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * Privacy mode — the multi-frame burst. Nothing reports it back, so it is a setter with no getter, and
     * it declares no param: the id the burst is built from is the transport's, not this capability's.
     *
     * Being write-only, it is named by `unobservableMembers(dev.camera())`, which distinguishes "this camera
     * is not in privacy mode" from "this camera cannot say" rather than leaving both as `undefined`. That
     * distinction matters most on the families whose power rides this same envelope — see {@link enabled}.
     */
    readonly privacy: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: "Privacy mode (PRIVACY_MODE 6250) — the multi-frame burst the sink plays.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The same status LED is reported under 1045 on ordinary cameras and 1716 on video doorbells. The
     * alias is the same semantic value on a family-specific wire. The parameter valid for the resolved
     * family is sufficient evidence to install both the getter and family-aware setter.
     */
    readonly statusLed: {
        readonly param: 1045;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly readAvailable: (ctx: AvailabilityContext) => boolean;
        readonly readAliases: readonly [{
            readonly paramType: 1716;
            readonly available: (ctx: AvailabilityContext) => boolean;
        }];
        readonly requiresRead: true;
        readonly description: "Camera status LED. Video doorbells report the same state under their button-ring LED parameter.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    readonly views: import("./members.js").ProvidedMember<"media", (() => readonly number[]) | undefined>;
    /**
     * Media is not a property: it returns DATA rather than moving state, its options are richer than a
     * value, and it exists only on a device bound to a provider. Each is declared once, with its
     * signature taken FROM {@link MediaProvider} — so a change there is a compile error here, not a drift.
     *
     * Every pull is refused where a reliable {@link CAMERA_MEMBERS.enabled} reads false, with {@link CameraDisabledError} —
     * `live`, `snapshotLive`, `record`, `openReadable` and `recordFragments` alike, since each opens media on a
     * camera that serves none. That reading is the on/off source; a live probe is not one, since a disabled
     * camera answers a start with audio and never a video frame.
     *
     * {@link CAMERA_MEMBERS.snapshotStored} is exempt — a retained push thumbnail is not a pull. A reading of
     * `undefined` refuses nothing: families reporting neither wire param leave the state unknown, and unknown is
     * not known-off.
     *
     * The refusal REJECTS on the four that answer with a promise, and THROWS on
     * {@link CAMERA_MEMBERS.recordFragments}, which answers with a handle.
     */
    readonly snapshotStored: import("./members.js").ProvidedMember<"media", false | (() => Promise<Buffer<ArrayBufferLike>>) | undefined>;
    readonly snapshotLive: import("./members.js").ProvidedMember<"media", false | ((opts?: Parameters<MediaProvider["snapshotLive"]>[0]) => Promise<{
        jpeg: Buffer;
        width: number;
        height: number;
        retained?: true;
    }>)>;
    readonly live: import("./members.js").ProvidedMember<"media", (opts?: Parameters<MediaProvider["live"]>[0]) => Promise<import("../../core/contracts.js").LiveStreamConsumer>>;
    readonly record: import("./members.js").ProvidedMember<"media", false | ((seconds: number, opts?: {
        timeoutMs?: number;
        skipKeyframes?: number;
    } | undefined) => Promise<Buffer<ArrayBufferLike>>)>;
    readonly openReadable: import("./members.js").ProvidedMember<"media", false | ((opts?: Parameters<NonNullable<MediaProvider["openReadable"]>>[0]) => Promise<import("node:stream").Readable>) | undefined>;
    readonly recordFragments: import("./members.js").ProvidedMember<"media", false | ((opts?: Parameters<NonNullable<MediaProvider["recordFragments"]>>[0]) => import("../../core/contracts.js").FragmentRecordingHandle) | undefined>;
    readonly downloadRecording: import("./members.js").ProvidedMember<"media", false | ((opts: Parameters<NonNullable<MediaProvider["downloadRecording"]>>[0]) => Promise<import("../../core/contracts.js").RecordingDownload>) | undefined>;
    /**
     * Push audio from the host to this camera's speaker. Gated on the **speaker** param specifically —
     * not the `audio` capability, which resolves on a microphone alone and would advertise a speaker the
     * device never reported. Talkback holds a media session open for its duration, so it carries the same
     * power hint `live` does; without it a battery camera talked to with no stream running would stream
     * unbounded.
     */
    readonly talkback: import("./members.js").ProvidedMember<"media", false | ((opts?: Parameters<NonNullable<MediaProvider["talkback"]>>[0]) => Promise<import("../../core/contracts.js").TalkbackHandle>) | undefined>;
};
export declare const CAMERA: CapabilityModule;
export {};
