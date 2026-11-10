import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * The P2P **feature-command ids** this doorbell capability drives. Capability-owned wire vocabulary
 * (transport forwards `cmd.param` opaquely; full id→name catalog in the generated
 * `transport/p2p/commands.ts`).
 */
export declare const DOORBELL_CMD: {
    /**
     * Doorbell "quick response" — make the doorbell PLAY a stored voice reply. Same 136-byte
     * direct-binary shape as the camera setters: `value` = the `voice_id` to play. Reversed from a
     * live capture (outer-cmd 1706, signCode 8, on the doorbell's `device_channel`) + the app's
     * `PlayQuickResponseParser` (`{cmd:1706,voice_id}`).
     */
    readonly QUICK_RESPONSE: 1706;
    /**
     * Mechanical (wired) chime enable/disable — whether the doorbell drives an existing wired chime box,
     * the app's "existing doorbell chime" (as opposed to / in addition to the HomeBase acting as the chime,
     * param 1702 `chimeSwitch` above; toggling each switch alone wrote one parameter and named the pair). Same
     * 136-byte direct-binary shape as `QUICK_RESPONSE`/camera on-off: `[u32 channel][u32 value][account_id
     * ASCII, zero-padded to 128 bytes]`, outer P2P cmd = 1703 itself, signCode 8, on the device's own
     * channel. Reversed from a live capture (outer-cmd 1703, signCode 8, captured on the doorbell's
     * `device_channel` — channel 2 for that unit, NOT a wire constant, always use `ctx.channel`):
     * turning ON sent `value=1`, turning OFF sent `value=0` — a plain boolean, 1=on/0=off.
     * App `APP_CMD_BAT_DOORBELL_MECHANICAL_CHIME_SWITCH`.
     */
    readonly MECHANICAL_CHIME_SWITCH: 1703;
    /**
     * Whether the HOMEBASE acts as the doorbell's chime — the app's "HomeBase as chime" switch, as opposed
     * to the wired chime box {@link DOORBELL_CMD.MECHANICAL_CHIME_SWITCH} drives. The app constant reads
     * `CHIME_SWITCH`, which is why this was long described as a separate plug-in chime; toggling that one
     * switch alone on a T8210 behind a HomeBase wrote 1702 and nothing else, and the account has no
     * plug-in chime at all. Same 136-byte direct-binary shape as
     * that sibling: `[u32 channel][u32 value][account_id ASCII, zero-padded to 128 bytes]`, outer P2P cmd
     * 1702 itself, signCode 8, on the device's own channel. Reversed from a live capture (outer-cmd 1702,
     * signCode 8, on the doorbell's `device_channel` — 2 for that unit, NOT a wire constant, always use
     * `ctx.channel`): turning OFF sent `value=0`, turning ON sent `value=1` — a plain boolean.
     * App `APP_CMD_BAT_DOORBELL_CHIME_SWITCH`.
     */
    readonly CHIME_SWITCH: 1702;
    /**
     * Wide Dynamic Range (WDR) image switch — a video/image tone-mapping setting that widens the
     * exposure range in high-contrast scenes (bright sky behind a visitor, etc). SAME 136-byte
     * direct-binary shape/polarity/capture session as `MECHANICAL_CHIME_SWITCH` immediately above: outer
     * P2P cmd 1704, signCode 8, device channel, `value` 1=on/0=off.
     * App `APP_CMD_BAT_DOORBELL_WDR_SWITCH`.
     */
    readonly WDR_SWITCH: 1704;
    /**
     * Doorbell chime ("ding-dong") volume — app `APP_CMD_BAT_DOORBELL_SET_DINGDONG_VOLUME`. UNLIKE the 1703/1704 direct-binary switches above, this rides the
     * `SET_PAYLOAD` (1350) JSON envelope: `{account_id,cmd:1717,mChannel:<deviceCh>,mValue3:0,
     * payload:{dingdong_volume:N}}`, GCM signCode 8, on the doorbell's `device_channel` (2 for the
     * captured unit — always use `ctx.channel`, don't hardcode). `mValue3` is an EXPLICIT `0`, not the
     * `SET_PAYLOAD` default of `mValue3:cmd` (see {@link module:./intent setPayload}'s doc comment) —
     * both live frames captured showed `mValue3:0`. Reversed from a live capture (values 3 and 25
     * observed) — a 0-100 loudness level, distinct from the already-shipped `ringtoneVolume` (1708,
     * direct-binary, `audio.ts`), which is a DIFFERENT control.
     */
    readonly DINGDONG_VOLUME: 1717;
    /**
     * Doorbell chime ("ding-dong") RINGTONE SELECTION — app `APP_CMD_BAT_DOORBELL_SET_DINGDONG_RINGTONE`.
     * SAME `SET_PAYLOAD` (1350) JSON envelope shape as
     * `DINGDONG_VOLUME` immediately above: `{account_id,cmd:1718,mChannel:<deviceCh>,mValue3:0,
     * payload:{dingdong_ringtone:N}}`, GCM signCode 8, doorbell `device_channel`, explicit `mValue3:0`.
     * Reversed from a live capture (values 4 and 0 observed) — `N` is an INTEGER INDEX picking one of
     * several stored chime tones, NOT a boolean.
     */
    readonly DINGDONG_RINGTONE: 1718;
    /**
     * Live-view quality AND the video encoding format, both in one integer — app
     * `CMD_BAT_DOORBELL_VIDEO_QUALITY`. The value is `quality + (highCompression ? 5 : 0)`, where quality
     * is 0 Auto / 1 Low / 2 Medium / 3 High ({@link DoorbellVideoQuality}). The app drives the two from
     * separate menus and each write carries both, so setting either requires the other's current value —
     * which is why neither is a derived setter.
     *
     * The encoding is reversed from writing every option in the app and reading the parameter back: High
     * on high compression is 8 and on low compression 3, Low on low compression 1, Auto on high
     * compression 5. Six of the eight combinations were observed that way; `0` (Auto, low compression) and
     * `2` (Medium, low compression) follow the same arithmetic but were not individually written.
     *
     * Wire captured byte-exact from the app on a T8210 behind a HomeBase: outer P2P cmd 1705 itself — no
     * wrapper — signCode 8, on the doorbell's own channel, the same 136-byte direct-binary
     * `[u32 channel][u32 value][account_id ASCII pad 128]` struct as its 1703/1704 siblings. The station
     * answers with an unencrypted level-1 frame carrying 0.
     *
     * Replayed from this SDK and confirmed on that device: three writes in one session, each read back off
     * the parameter — quality alone, then the encoding format with the quality held, then a restore.
     */
    readonly VIDEO_QUALITY: 1705;
    /**
     * Doorbell quick-response LIST fetch — the sub-command carried inside a `SET_PAYLOAD` (1350)
     * wrapper (app `APP_CMD_GET_CUSTOMIZE_VICOE_LIST`). The station replies with a `NOTIFY_PAYLOAD`
     * (1351) frame whose JSON is `{cmd:6237, payload:{voice_list:[{voice_id,voice_name,voice_path}]}}`.
     * Reversed from the app's `GetQuickResponseListP2pParser` + the capture heap. NOTE: 6238
     * (`APP_CMD_GET_QUICK_RESPONSE`) is the single-file DOWNLOAD, not the list.
     */
    readonly GET_QUICK_RESPONSE_LIST: 6237;
};
/**
 * Doorbell chime ("ding-dong") ringtone selection, as a 0-indexed list. Three indices were confirmed
 * on-device (`0→Default`, `7→Ding`, `8→Hillside`) and land exactly on a plain top-to-bottom order, so
 * the remaining indices follow that same linear order rather than being individually tested. Full name list
 * (10 entries) read off the app's own picker UI. `Circuit` (index 5) is a BEST-EFFORT spelling — its
 * index was not individually wire-tested, only its position in the read-off list.
 */
export declare const DoorbellRingtone: {
    readonly Default: 0;
    readonly Silent: 1;
    readonly Beacon: 2;
    readonly Chord: 3;
    readonly Christmas: 4;
    readonly Circuit: 5;
    readonly Clock: 6;
    readonly Ding: 7;
    readonly Hillside: 8;
    readonly Presto: 9;
};
/** A doorbell ringtone option — the value side of {@link DoorbellRingtone}. */
export type DoorbellRingtoneValue = (typeof DoorbellRingtone)[keyof typeof DoorbellRingtone];
export declare const DoorbellVideoQuality: {
    /** The doorbell picks a quality from the link. */
    readonly Auto: 0;
    readonly Low: 1;
    readonly Medium: 2;
    readonly High: 3;
};
/** A doorbell live-view quality — the value side of {@link DoorbellVideoQuality}. */
export type DoorbellVideoQualityValue = (typeof DoorbellVideoQuality)[keyof typeof DoorbellVideoQuality];
/**
 * One of a Video Doorbell's **quick responses** — a canned voice reply it can play at a visitor.
 * Returned by `dev.doorbell()?.quickResponses()`; pass `voiceId` to `playQuickResponse`. Owned by the
 * doorbell capability (the client transport stays doorbell-agnostic — it only knows generic P2P).
 */
export interface QuickResponse {
    /** The response's `voice_id` — pass to `playQuickResponse` to play it. */
    voiceId: number;
    /** Human-readable label, e.g. "Please leave it at the door". */
    name: string;
    /** On-device audio path, e.g. `/system/snd//QuickReply_1.snd` or `/user/quick_respone_diy//QuickReply_5.aac`. */
    path: string;
    /** `false` = predefined/eufy-shipped (`/system/snd/`); `true` = user-recorded custom (`/user/…`). */
    custom: boolean;
}
/**
 * Bound doorbell controls — the object returned by `dev.doorbell()`. The status LED is NOT here: a
 * doorbell is a `camera`-codec device, so its LED lives on the shared `dev.camera().setStatusLed()`
 * surface, which swaps to the doorbell's own wire by family (one action, not a duplicate here).
 * `playQuickResponse` is always present (it orchestrates a live stream); `quickResponses` (a P2P
 * request/reply query that RETURNS data) is present only when the device is bound to a live client
 * with a {@link MediaProvider} — hence optional, call with `?.`.
 */
export type DoorbellActions = Surface<typeof DOORBELL_MEMBERS>;
/**
 * Parse a doorbell `voice_list` (the `{voice_id,voice_name,voice_path}` records the station returns
 * in the quick-response GET reply) into typed {@link QuickResponse}s. Pure/offline. The `custom` flag
 * is derived from the `voice_path` **prefix** (robust) — predefined responses live under `/system/snd/`,
 * user-recorded ones under `/user/…` — NOT from the id range (ids 1–3 predefined, 100+ custom, but the
 * path is authoritative).
 */
export declare function parseQuickResponses(voiceList: Array<{
    voice_id?: unknown;
    voice_name?: unknown;
    voice_path?: unknown;
}>): QuickResponse[];
/**
 * `doorbell` — chime / ringtone configuration. CONFIRMED against a real Video Doorbell (T8214):
 * the live ids are the `1702-1719` `CMD_BAT_DOORBELL_*` range, observed on that device. The
 * legacy `2015/2022/1306` ids are excluded — they appear on NO owned device. The button-
 * press *event* (ring) is delivered out-of-band via `CMD_DOORBELL_NOTIFY_PAYLOAD` (1701) /
 * push/MQTT — it is handled by the Phase-1 event normalizers, not as a device-list param.
 */
/**
 * Every `doorbell` feature, declared once.
 *
 * Two of the seven reads are read-ONLY here even though the device accepts a write, because the write
 * does not belong to this capability or is not confirmed:
 *  - `ringtoneVolume` (1708) — the WRITE lives on `audio`, which owns every volume wire. 1708 leaks
 *    onto non-doorbell cameras, so `audio` gates its setter on the doorbell capability instead.
 *  - `notificationMode` (1710) — a config JSON the device reports whole; no write is captured.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const DOORBELL_MEMBERS: {
    /**
     * The HOMEBASE as the doorbell's chime — the hub plays the ring, not the wired chime box
     * `mechanicalChimeSwitch` drives. `provenance` is "verified" on our own decrypt of the app's frame:
     * direct-binary `[ch][value][acct]`, 1=on/0=off, the same shape as its 1703 sibling — captured, not
     * inferred from the shared param range.
     */
    readonly chimeSwitch: {
        readonly param: 1702;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: import("./types.js").CommandContext) => import("../../core/contracts.js").Command;
    };
    /**
     * `provenance` is "verified" on our own P2P decrypt of the write wire: direct-binary
     * `[ch][value][acct]`, 1=on/0=off, verified live on a T8214 (ON then OFF).
     */
    readonly mechanicalChimeSwitch: {
        readonly param: 1703;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: import("./types.js").CommandContext) => import("../../core/contracts.js").Command;
    };
    /** Same reasoning and the same capture session as {@link DOORBELL_MEMBERS.mechanicalChimeSwitch}. */
    readonly wdrSwitch: {
        readonly param: 1704;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: "Wide Dynamic Range (WDR) image switch (1704; write wire-confirmed live on T8214 — see DOORBELL_CMD.WDR_SWITCH).";
        readonly write: (v: string | number | boolean, ctx: import("./types.js").CommandContext) => import("../../core/contracts.js").Command;
    };
    /**
     * The READ half of a control whose write lives on `audio` — hence `writtenElsewhere`, which is what
     * keeps the published schema's `writable` true even though this member declares no `write`. The split
     * is deliberate: `audio` owns every volume wire, but 1708 leaks onto non-doorbell cameras, so `audio`
     * gates its setter on this capability while the read stays here where it is doorbell-only. Distinct
     * from `dingdongVolume` (1717), which is a different control on a different wire.
     */
    readonly ringtoneVolume: {
        readonly param: 1708;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "verified";
        readonly writtenElsewhere: true;
        readonly description: string;
    };
    /**
     * A `1350` SET_PAYLOAD envelope (NOT direct-binary) with an explicit `mValue3` 0 — both live frames
     * captured that value. Bounded 0-100 like every sibling volume setter: the write is fire-and-forget,
     * so an out-of-range value would otherwise be sent as-is and look like it worked. `provenance` is
     * "verified" on our own capture, not merely an observed param id.
     */
    readonly dingdongVolume: {
        readonly param: 1717;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "verified";
        readonly min: 0;
        readonly max: 100;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: import("./types.js").CommandContext) => import("../../core/contracts.js").Command;
    };
    /**
     * The same `1350` SET_PAYLOAD shape and capture session as {@link DOORBELL_MEMBERS.dingdongVolume},
     * but an INDEX rather than a level. Clamping a bad index would land on a real-but-wrong tone (garbage
     * → 0, too-big → 9) instead of failing, and only 3 of the 10 indices (0, 7, 8) are wire-tested — so
     * anything outside {@link DoorbellRingtone} is refused.
     */
    readonly dingdongRingtone: {
        readonly param: 1718;
        readonly type: "number";
        readonly kind: "enum";
        readonly enumValues: Record<number, string>;
        readonly provenance: "verified";
        readonly args: readonly [{
            readonly name: "ringtone";
            readonly kind: "enum";
            readonly description: "A tone INDEX, not a volume.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: import("./types.js").CommandContext) => import("../../core/contracts.js").Command | undefined;
    };
    /**
     * The live-view quality half of {@link DOORBELL_CMD.VIDEO_QUALITY}, lifted out of the composite by
     * `decode`. `writtenElsewhere` because the setter needs the OTHER half's current value to rebuild the
     * integer, which a member's `write` — given only the new value and the context — cannot read.
     */
    readonly videoQuality: {
        readonly param: 1705;
        readonly type: "number";
        readonly kind: "enum";
        readonly enumValues: Record<number, string>;
        readonly provenance: "verified";
        readonly writtenElsewhere: true;
        readonly decode: (raw: unknown) => number | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: (0 | 1 | 2 | 3)[];
        readonly description: string;
    };
    /**
     * The encoding half of the SAME integer, so it declares no param of its own and reaches into the
     * owner's value — two members claiming 1705 would leave the second reading a name nothing is stored
     * under, and a paramless member publishes no schema entry at all, which is what keeps that from
     * happening structurally. High compression is the app's default on the captured device.
     */
    readonly highCompressionEncoding: {
        readonly readsFrom: "videoQuality";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly decode: (raw: unknown) => boolean | undefined;
        readonly description: string;
    };
    /**
     * Set both halves of {@link DOORBELL_CMD.VIDEO_QUALITY} at once, because the wire has no way to set
     * one alone: every frame carries the whole integer.
     *
     * Taking both is not a convenience choice. An earlier shape took one and preserved the other by
     * reading it back, and it failed on hardware: the state reader is the snapshot the device was bound
     * with, so a second write in the same session composed against the value from before the first and
     * silently reverted it. Requiring both puts that decision where it can be made correctly — a caller
     * reads {@link DOORBELL_MEMBERS.videoQuality} and {@link DOORBELL_MEMBERS.highCompressionEncoding}
     * and passes what it wants, instead of the SDK guessing from a stale copy.
     */
    readonly setVideoQuality: import("./members.js").MethodMember<(quality: DoorbellVideoQualityValue, highCompression: boolean) => Promise<void>>;
    /**
     * A config blob the device reports WHOLE, so it is typed `string` and handed back unparsed — three
     * settings live inside it (motion notifications, ring notifications, notification style) and the SDK
     * lifts none of them out, because no `decode` is evidenced for the shape. Read-only: no write frame
     * has been captured for it, and a config JSON is exactly where a guessed write does the most damage.
     */
    readonly notificationMode: {
        readonly param: 1710;
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "verified";
        readonly description: string;
    };
    /**
     * Play one of the doorbell's quick responses at the visitor. `voiceId` comes from
     * {@link DOORBELL_MEMBERS.quickResponses}. The doorbell only plays while it has an active media
     * session, so by default this briefly engages a live stream, sends, then tears it down.
     * `{ engage: false }` leaves an already-open stream alone.
     *
     * If engagement was requested but no stream comes up this THROWS, rather than firing 1706 into the
     * void and reporting success — the doorbell would play nothing. The wire is `QUICK_RESPONSE` 1706,
     * the SAME direct-binary command as camera on/off, carrying the voice id as its value.
     */
    readonly playQuickResponse: import("./members.js").MethodMember<(voiceId: number, opts?: {
        engage?: boolean;
    }) => Promise<void>>;
    /**
     * Fetch the doorbell's quick-response list — a P2P request/reply query that returns data, so it
     * exists only on a device bound to a media provider that offers one.
     *
     * The transport stays doorbell-agnostic: it runs a GENERIC SET_PAYLOAD query (sub-cmd → reply
     * payload); this capability owns the sub-command id (6237) and the reply parsing.
     */
    readonly quickResponses: import("./members.js").ProvidedMember<"media", ((opts?: {
        timeoutMs?: number;
    }) => Promise<QuickResponse[]>) | undefined>;
};
export declare const DOORBELL: CapabilityModule;
