/**
 * Managed realtime live stream over P2P — turns a station's `CMD_VIDEO_FRAME` (1300) /
 * `CMD_AUDIO_FRAME` (1301) frames into a clean, continuous **Annex-B H.264** (+ audio) elementary
 * feed a muxer can ingest.
 *
 * Two video frame variants are handled:
 *  - **Plaintext** (`signCode 0`, e.g. HomeBase-attached cameras): a fixed 22-byte frame header
 *    (`parseVideoFrameHeader`) followed directly by Annex-B NAL units — verified live (960×540,
 *    keyframe = header flag bit0). We strip the 22-byte header.
 *  - **Encrypted** (E2E cameras): the body is AES-256-GCM under a per-stream media key wrapped in a
 *    keyframe ECIES envelope. If an `eccPrivateKey` is supplied we run `VideoFrameDecoder`; otherwise
 *    those frames are skipped (no key → no video).
 *
 * Emits: `video` ({@link LiveVideoFrame} — Annex-B), `audio` ({@link LiveAudioFrame}), `start`, `stop`,
 * `error`.
 */
import { EventEmitter } from "node:events";
import { type P2PSession } from "./p2p-session.js";
import { type Logger } from "../../core/logger.js";
import type { LiveAudioFrame, LiveVideoFrame } from "../../core/contracts.js";
/**
 * How often the media start is re-issued to hold a stream open, when a caller expresses no preference.
 *
 * This is **on by default** because some cameras stop sending without it. With the nudge disabled, a
 * T8170 went quiet 13.6 s into a plain `live()` — no `stop`, no `error`, the feed simply stopped — and
 * ran the full window with it on (185 frames vs 704 over 40 s).
 *
 * Which cameras need it does **not** follow topology or power source, so there is no predicate to gate
 * it on: measured across four cameras, an own-session T8410 and both HomeBase-attached cameras (T8210,
 * T8114) held a 40 s stream up with the nudge disabled, while the own-session T8170 did not. All four
 * are battery. Since a camera that needs it goes silent rather than reporting anything, the default
 * covers the one that fails.
 *
 * What the nudge costs differs by topology, and only one branch is a true keepalive: an own-session
 * camera's `startLiveMedia` tracks that the stream is already started and sends the small ping, while a
 * HomeBase-attached camera has no such state and re-sends the full media start — a genuine restart on
 * that path.
 *
 * That restart is harmless on a station serving ONE camera and harmful on a station serving several: it
 * re-asserts this camera's channel every interval, so two attached streams contend continuously. Measured on
 * a real base as a full start every 3 s from each. So an attached stream stops nudging as soon as the station
 * delivers a frame of its own channel — see the private `settleKeepalive`. The measurement that justifies it
 * is the one above: the attached cameras held their window with the nudge disabled outright.
 */
export declare const DEFAULT_KEEPALIVE_MS = 3000;
export interface LiveStreamOptions {
    /**
     * Camera channel to START (the device's `device_channel`) — sent in CMD_START_REALTIME_MEDIA to
     * select which camera on a multi-camera HomeBase streams. Defaults to the station channel.
     *
     * On a HomeBase-attached camera it is ALSO what inbound media is matched against, so one camera's stream
     * never carries another camera's frames: a station fanning several cameras out over one session tags every
     * media frame with the camera it belongs to. A frame tagged for a channel a sibling started is never taken,
     * however long the station keeps serving that sibling instead of this one.
     */
    channel?: number;
    /** Camera ECC private key (32B) for E2E/encrypted cameras; omit for plaintext cameras. */
    eccPrivateKey?: Buffer;
    /** Admin account id — required for the level-2 (`signCode 8`) media-start payload selecting a camera. */
    accountId?: string;
    /**
     * Re-send the media start every N ms to hold the stream open. Defaults to
     * {@link DEFAULT_KEEPALIVE_MS}; pass `0` to disable.
     */
    keepAliveMs?: number;
    /**
     * How long an attached stream tolerates silence on its own channel before re-asserting again, in ms.
     *
     * The re-assert is settled by the first own-channel frame, because settling it is what stops two attached
     * streams contending over one session, which serves one camera at a time. Silence for this long says the station
     * is no longer serving this camera, which is the only condition the re-assert was for. Defaults to twice
     * the keepalive interval, so a stream whose media flows never reaches it.
     */
    stallMs?: number;
    /**
     * Whether re-asserting this camera's channel is still wanted, consulted each time the stall window
     * elapses. Absent means always wanted.
     *
     * A re-assert on an attached camera is a full media start, so it takes the station from whichever camera
     * it was serving. Whether that is wanted depends on who is attached to this pull and to its siblings,
     * which this stream cannot see. Its owner can, so it asks rather than assuming.
     *
     * The watch keeps re-arming while this answers false, so a pull that gains a consumer re-asserts at the
     * next window rather than staying silent for the rest of its life.
     */
    reassertWanted?: () => boolean;
    /**
     * Runtime topology fact (from the device record: `parent_sn && parent_sn !== sn`): true = the camera
     * rides a HomeBase's session (start via the level-2 `1003` payload), false = own-session camera
     * (start via the `1700`/`cmd 1000` path, level-2 or level-1 per the session key). NOT a family trait.
     */
    homeBaseAttached?: boolean;
    /** Diagnostics sink. Omit for silence. */
    logger?: Logger;
}
export declare class LiveStream extends EventEmitter {
    private readonly session;
    private readonly opts;
    private listening;
    private decoder?;
    private kaTimer?;
    /** Last codec sniffed off a keyframe; delta frames (no config NAL) inherit it. Default h264. */
    private lastCodec;
    /** Rebuilds an access unit the station split across several frames — see {@link AccessUnitAssembler}. */
    private readonly units;
    /** Whether a missing video datagram or incomplete unit invalidated the current reference chain. */
    private awaitingKeyframeAfterGap;
    private readonly videoGapHandler;
    /** The channel inbound media must be tagged with, once {@link acceptsMedia} trusts the station's tag. */
    private mediaChannel?;
    private tracedFirstVideoCommand;
    private tracedFirstVideoUnit;
    private tracedFirstKeyframe;
    private tracedDecodeFailures;
    private tracedFirstForeignFrame;
    private stallTimer?;
    /**
     * The channel this stream starts, stops, traces under and matches its own abandonment on. An omitted
     * channel resolves to {@link STATION_CHANNEL} — the value the session resolves it to.
     */
    private readonly channel;
    private readonly handler;
    /** Forwards `liveStartUnacknowledged` only where it carries this stream's own channel. */
    private readonly unackedHandler;
    private readonly logger;
    constructor(session: P2PSession, opts?: LiveStreamOptions);
    /** Emit a live trace under its session's handle and the channel this stream pulls. */
    private trace;
    /** Begin streaming: attach the frame listener and tell the station to start realtime media. */
    start(): this;
    /**
     * Stop re-issuing the media start once this camera's own media has arrived, on an attached camera.
     *
     * The nudge differs by topology and only one branch is a ping: an own-session camera sends a small
     * keepalive, while an attached camera has no such state and re-sends the FULL media start. Over one session,
     * which serves one camera at a time, that restart re-asserts this channel against whatever else is warm on
     * it, so two
     * attached streams restart every interval and contend for the station continuously — measured on a real base
     * as a full start every 3 s from each.
     *
     * A frame of this camera's own channel is the station stating it is serving THIS camera, which is the only
     * thing the restart was trying to bring about. The SDK's own measurement agrees it is then unnecessary: both
     * attached cameras held a 40 s stream with the nudge disabled, while the own-session camera that needs it
     * went quiet at 13.6 s without it — so an own-session stream keeps its ping.
     *
     * The warm-up retry a shared source runs is untouched: it recovers a start that raced the level-2 key, and
     * it stops at the first keyframe by its own rule.
     */
    private settleKeepalive;
    /**
     * Re-arm the attached re-assert if this camera's own media goes silent.
     *
     * Holding the re-assert off is right while the station is serving this camera and wrong the moment it stops:
     * a station that switches to a sibling leaves this stream with no frames, no error and no `stop`, and the
     * warm-up watch that would have caught it was cleared by the first frame. Silence is therefore the condition
     * the re-assert exists for, and the only one — re-arming while media flows is the contention this settle was
     * introduced to remove.
     *
     * Replaced on every own-channel frame, so the window is measured from the last one.
     *
     * Gated on {@link LiveStreamOptions.reassertWanted}: silence with nobody attached is not a condition to
     * act on, because the re-assert would take the station from a camera someone is watching.
     */
    private armStallWatch;
    /**
     * Re-issue the start command (idempotent while listening) — the media-start / keepalive nudge. The
     * shared source calls this to retry a start that raced key negotiation, until frames flow. Safe to
     * call repeatedly: `startLiveMedia` self-selects start vs keepalive per the session state.
     */
    nudge(force?: boolean): void;
    private sendStart;
    /** Stop streaming: detach the listener and tell the station to stop. Idempotent. */
    stop(): void;
    /** Extract the Annex-B payload from a plaintext 1300 frame (fixed 22-byte header), or undefined. */
    private plaintextAnnexB;
    private onFrame;
    /**
     * Whether this stream may take `frame` — the demultiplexer for a station that serves several cameras.
     *
     * Every stream over a station's session reads the same inbound feed, so with two cameras warm each stream
     * sees both. The station DOES say which camera a media frame belongs to: measured with two cameras of
     * different geometry streaming at once on one HomeBase, the frame's channel field partitioned them
     * exactly — 43 frames of 1920x1080 on the started channel 0 and 28 of 640x480 on channel 2, video and
     * audio alike — while each handle was delivered both cameras' frames.
     *
     * The tag is only meaningful where a station fans out to several cameras. A camera that owns its session
     * numbers its stream for itself: one was started on channel 0 and tagged its frames channel 1, so
     * matching there would drop the whole stream. Hence only an attached camera filters.
     *
     * The match is UNCONDITIONAL, however long a station serves another camera instead of this one.
     *
     * One session serving one camera at a time hands a newly opened camera nothing but its sibling's frames until
     * it switches, so "no media of my own yet, plenty for someone else" is what an ordinary handover looks like
     * and does not distinguish a station that tags differently from one that is simply busy.
     *
     * A stream receiving none of its own media reaches the warm-up deadline and raises a typed start failure
     * naming the stage it got to. Delivering another camera's picture raises nothing.
     */
    private acceptsMedia;
    /**
     * The Annex-B payload of a frame that starts an access unit. The session decodes it when it can (it
     * holds the RSA private key, and handles the plaintext form); the legacy header-strip and the ECIES
     * {@link VideoFrameDecoder} are the fallbacks for an E2E camera.
     */
    private annexbOf;
    /**
     * Report an access unit the transport could not complete.
     *
     * Loud once per stream, then quiet: a station losing datagrams steadily would otherwise flood a host's
     * log with one line per unit, and the first one already says everything the rest repeat. A dropped unit is
     * otherwise silent in both directions: no frame reaches a consumer, and nothing states why.
     */
    private reportDroppedUnit;
}
export interface LiveStream {
    on(event: "video", listener: (frame: LiveVideoFrame) => void): this;
    on(event: "audio", listener: (frame: LiveAudioFrame) => void): this;
    on(event: "start" | "stop", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "budget", listener: (notice: import("../../core/contracts.js").StreamBudgetNotice) => void): this;
    /** This channel's media start was abandoned unacknowledged — see {@link LiveStreamHandle}. */
    on(event: "unacknowledged", listener: () => void): this;
    emit(event: "video", frame: LiveVideoFrame): boolean;
    emit(event: "audio", frame: LiveAudioFrame): boolean;
    emit(event: "start" | "stop" | "unacknowledged"): boolean;
    emit(event: "error", err: Error): boolean;
}
