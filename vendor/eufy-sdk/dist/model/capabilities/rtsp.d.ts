import type { Command } from "../../core/contracts.js";
import { type Surface } from "./members.js";
import type { AvailabilityContext, CapabilityModule, CommandContext } from "./types.js";
/** The state params this capability owns — its OWN vocabulary, used by no other capability. */
export declare const RTSP_PARAM: {
    /**
     * RTSP publish switch (app `NAS_STREAM_SWITHC`, the vendor's own typo for SWITCH). `1` publishes the
     * camera's stream, `0` withdraws it. ✅ Verified live 2026-08-01 on a HomeBase-attached doorbell and
     * two indoor cameras: written through this param's scalar wire, both directions confirmed by the
     * stream appearing and disappearing on the serving device's RTSP port.
     */
    readonly STREAM_SWITCH: 1145;
    /**
     * The camera's authoritative RTSP URL — `rtsp://user:pass@host/path`, with the credentials it is
     * enforcing right now. The station pushes this back on the 1145 wire as a string data frame once the
     * stream is asked to start (see the transport's device-URL read); {@link RTSP.decodeState} lifts it
     * into state, read as `dev.rtsp()?.url`.
     *
     * A SYNTHETIC id: the wire supplies no second id — the URL rides the same 1145 as the publish bool,
     * and {@link STREAM_SWITCH} already owns that — so the string gets its own id here, keeping the two as
     * distinct properties rather than one id read two ways. Never in the cloud record (P2P-notify only), so
     * it is quarantined in `property-id-integrity`'s `KNOWN_UNLISTED` — which otherwise holds real-but-unlisted
     * ids (1612), so its entry for this one says it is not a wire id at all.
     *
     * `1145 * 10` is a readable, currently-free number, NOT a reserved allocation — height buys nothing,
     * the dictionary already holds real ids past 100000. It is the only synthetic id today; if a second is
     * ever needed, reserve a stated band for them rather than copying this per-site choice.
     */
    readonly STREAM_URL: 11450;
    /**
     * RTSP credentials + the authentication switch (app `NAS_SEND_SECURITY_PASSWD`). A `SET_PAYLOAD`
     * (1350) envelope: `{cmd:1287, mChannel:<deviceCh>, mValue3:0, payload:{mode, passwd, username}}`.
     *
     * ✅ Byte-exact against the app's own frame (confirmed 2026-08-03 on a T8425 behind a T8030): the app
     * auto-generates BOTH a username and a password (16 chars each — its "13 char" UI rule is
     * frontend-only; the firmware accepts any length). The app maps `mode` as `0` = open, `1` = Basic,
     * `2` = Digest and offers Basic/Digest but no "open" option. A standalone T8442 was observed serving
     * a Digest challenge. A HomeBase-attached T8210 echoed freshly supplied Basic credentials in its URL,
     * confirming storage, while unauthenticated `DESCRIBE` remained 200 with no challenge.
     */
    readonly SEND_SECURITY_PASSWD: 1287;
    /**
     * What the NAS records (app `NAS_VIDEO_TYPE_EVENT`): events only or continuously. The readable half
     * of the app's two-frame recording-mode pair (6050 + 6010). ✅ Write verified live on a T8030 by
     * param readback (0 → 1 → 0).
     */
    readonly VIDEO_TYPE_EVENT: 6050;
    /** Second frame of the recording-mode pair — see {@link VIDEO_TYPE_EVENT}. Sent with it, never alone. */
    readonly VIDEO_TYPE_CONTINUE: 6010;
};
/**
 * The RTSP authentication scheme a caller can require. Maps to the credential write's `mode` field.
 *
 * - `"digest"` — request a hashed nonce challenge, observed on a standalone camera. The reader does
 *   not send the plaintext password during RTSP authentication, though configuration still sends it
 *   to the device. The safer choice, and the app's default.
 * - `"basic"` — request Basic authentication, where the reader sends the password base64-encoded on
 *   every request (encoding, not encryption). Offered for players that only speak Basic.
 */
export type RtspAuthScheme = "digest" | "basic";
/**
 * What the NAS records. `Events` stores clips around a detection; `Continuous` records without
 * stopping.
 */
export declare const RtspRecordingMode: {
    /** Record only around detections. */
    readonly Events: 0;
    /** Record continuously. */
    readonly Continuous: 1;
};
/** A NAS recording mode — the value side of {@link RtspRecordingMode}. */
export type RtspRecordingModeValue = (typeof RtspRecordingMode)[keyof typeof RtspRecordingMode];
/**
 * Bound RTSP controls — the object returned by `dev.rtsp()`.
 *
 * This is the vendor's NAS/RTSP feature: publish a camera's stream so a NAS/NVR (or the HomeBase
 * itself) can record it. Two things a caller must know, because neither is expressible in the wire:
 *
 * - **A station publishes for ONE attached camera at a time.** Enabling a second withdraws the first,
 *   silently — the station tracks a single camera, not a set. The SDK cannot detect or prevent this;
 *   a caller driving several cameras owns the arbitration.
 * - **Publication is a persistent device setting, not an SDK-owned media session.** An RTSP consumer
 *   connects directly to the serving device; the SDK does not observe consumer disconnects and does
 *   not withdraw in response. The caller that publishes owns calling `withdraw()` when its recorder is
 *   done. The SDK deliberately applies no live-media power budget: on a device with the `battery`
 *   capability, leaving RTSP published will drain the cell, so the feature suits mains-powered cameras
 *   feeding a recorder.
 *
 * The stream itself is served over plain RTSP on the local network, by the station for a
 * HomeBase-attached camera or by the camera itself when standalone. A standalone camera has been
 * observed serving a Digest challenge. A tested HomeBase-attached camera echoed freshly supplied Basic
 * credentials in its URL but stayed open without them. Verify storage from the device-reported URL
 * and the served effect on each endpoint with an RTSP `DESCRIBE`: 401 = challenged, 200 = open.
 */
export type RtspActions = Surface<typeof RTSP_MEMBERS>;
/**
 * Whether the publish switch has a wire to this camera. A HomeBase S1 Pro (`STATION_9000`) carries an
 * attached camera's commands over its WebRTC control channel, which takes only the `1350` and `1700`
 * envelopes; the switch is a plain scalar, and no other frame for it is captured there. Gating the
 * `published` member drops its read with its setter, since one availability decision covers both.
 */
declare function publishable(ctx: AvailabilityContext): boolean;
/**
 * Every `rtsp` feature, declared once.
 *
 * `setRecordingMode` is a `method`, not a derived setter, because ONE UI change is TWO frames on
 * the wire — the app sends 6050 then 6010, and sending only the first leaves the continuous recorder out
 * of step with the advertised type. A member's `write` returns a single command, so the pair cannot be
 * expressed as one.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const RTSP_MEMBERS: {
    /**
     * This is DEVICE STATE — "whether the stream is published over RTSP" — not a record of who turned it
     * on. So it reads true from more than a caller's own `publish()`: {@link RTSP.decodeState} sets it from
     * the station's URL push (which proves the stream is up) and the cloud poll reports it too. A caller
     * that needs "did *I* turn it on" tracks its own `publish()` call rather than reading this back.
     *
     * `provenance` is name-trust: the name is the app's own typo'd constant (`NAS_STREAM_SWITHC`), so it
     * is "apk". The verified live WRITE — both directions, HomeBase and standalone — is in the description.
     */
    readonly published: {
        readonly param: 1145;
        readonly property: "rtspStream";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
        readonly aliases: {
            readonly publish: true;
            readonly withdraw: false;
        };
        readonly available: typeof publishable;
    };
    /**
     * The device-reported RTSP URL — the full `rtsp://user:pass@host/path`, carrying the credentials the
     * device enforces RIGHT NOW. This is the only source of the freshly-generated pair: the credentials
     * regenerate on every publish toggle and the cloud record lags a cycle, so an assembled URL or an
     * imposed one would not match what the device is enforcing.
     *
     * The flat property name is `rtspUrl`, not `url`: property names are a FLAT namespace shared across
     * every capability (`getProperty`/`setProperty`/`propertyChanged` key on the bare string), so the
     * generic `url` would claim that word SDK-wide. The fluent read stays `dev.rtsp()?.url` — the member
     * key qualifies it there.
     *
     * The FRAME SHAPE — 1145 returning as a NUL-terminated `rtsp://user:pass@host/path` string — was
     * OBSERVED live, so `decodeState` is grounded. The station pushes it only once the stream is asked to
     * start, not from the publish switch alone (field-confirmed).
     *
     * To FETCH the URL, the canonical call is `EufyMega.reportedRtspUrl(sn)` — it provokes and returns it.
     * This member is NOT a second fetch path: it surfaces whatever the station last pushed as inbound
     * state, for code that already holds a `dev.rtsp()` and reacts to `propertyChanged` (a getter that is
     * simply absent until a push has landed), rather than driving the read itself.
     *
     * `provenance` below is `verified` for the VALUE and its frame — not for the id: {@link STREAM_URL}
     * is synthetic and the wire never reports it, so no capture could have "verified" the id itself.
     *
     * Arrives ONLY over the P2P notify wire and never in the cloud record, so it is absent until a push
     * lands and then reads back like any other state. Read-only: the device reports it, a caller does not
     * set it. Lifted from the frame by {@link RTSP.decodeState}.
     */
    readonly url: {
        readonly param: 11450;
        readonly property: "rtspUrl";
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "verified";
        readonly description: string;
    };
    /**
     * The READ half of a control written by `setRecordingMode` below, hence `writtenElsewhere` — one UI
     * change is TWO frames on the wire (6050 then 6010) and a member's `write` returns a single command,
     * so the pair cannot be a derived setter. 6050 is the half the device reports back, which is why the
     * member hangs off that id and not its silent partner.
     */
    readonly recordingMode: {
        readonly param: 6050;
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: Record<number, string>;
        readonly provenance: "apk";
        readonly writtenElsewhere: true;
        readonly description: string;
    };
    /** Persistently publish this camera's stream. The enabling caller owns withdrawing it when done. */
    readonly publish: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
    /** Withdraw this camera's persistent publication; consumer retries do not ask the SDK to republish it. */
    readonly withdraw: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
    /**
     * Store credentials and request authentication on this camera's stream. Served enforcement is
     * topology-dependent and must be verified with `DESCRIBE` (401 = challenged, 200 = open).
     *
     * `scheme` defaults to `"digest"` (a hashed nonce challenge and the app's own default). The reader
     * does not send the plaintext password during Digest authentication, though this configuration write
     * still sends it to the device. Pass `"basic"` only for a player that can't do Digest: Basic sends
     * the password base64-encoded on every request, readable by anyone on the LAN.
     *
     * The write stores credentials on both topologies, but a tested HomeBase-attached endpoint did not
     * enforce the requested mode. Verify storage from the device-reported URL, which embeds the
     * credentials, and enforcement with a `DESCRIBE` (401 = challenged, 200 = open).
     */
    readonly requireAuth: import("./members.js").MethodMember<(username: string, password: string, scheme?: RtspAuthScheme) => Promise<void>>;
    /** Store an anonymous-mode request while keeping the supplied credentials. */
    readonly allowAnonymous: import("./members.js").MethodMember<(username: string, password: string) => Promise<void>>;
    /**
     * Set what the NAS records — events only, or continuously. Sends the app's two-frame pair in one call.
     * Present only when this camera reports the recording-mode state, mirroring the publish switch's own
     * evidence gate.
     *
     * On a battery-powered camera, `Continuous` keeps the stream up and will flatten the battery far
     * faster than event recording — the app only offers it for wired/HomeBase-attached cameras.
     */
    readonly setRecordingMode: import("./members.js").MethodMember<(mode: RtspRecordingModeValue | number) => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
};
/**
 * `rtsp` — publish a camera's stream over RTSP for a NAS/NVR to record.
 *
 * Detection is evidence-only: a device advertises param 1145 or it does not get the accessor. The
 * vendor app gates the setting to a subset of models, but that gate is CLIENT-side — a model whose app
 * never shows the toggle still accepts the write, which is why detection keys off the reported param
 * rather than a model table.
 */
export declare const RTSP: CapabilityModule;
export {};
