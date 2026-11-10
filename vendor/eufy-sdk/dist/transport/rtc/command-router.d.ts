/**
 * RTC command router: drives a station over the portal's WebRTC data channel instead of P2P.
 *
 * The T9000 answers no P2P lookup, but it accepts the portal's control channel: sign → WS join → scall →
 * SDP answer → ICE over the relay the hub grants → DTLS → SCTP data channels, with commands riding
 * `WebrtcDataChannel` as portal packets (see {@link buildPortalPacket}).
 *
 * `set-payload` rides the `1350` SET_PAYLOAD envelope, inner `{account_id, cmd, mValue3, payload}`;
 * `set-json` rides the `1700` CONTROL_PAYLOAD envelope, inner `{account_id, cmd, commandType, data}`.
 * A command to the station goes on the station channel `255`; an attached device's command shares the
 * station's session and keeps the device's channel. Other command kinds are refused.
 *
 * One session per station, reused across commands and closed after {@link IDLE_CLOSE_MS} without one;
 * a live pull holds it open. Sends on a session are serialised; an ACK is correlated by its outer command
 * and segment, since it carries no inner command. An ACK is not an observation of the resulting state.
 *
 * Live view of an attached camera rides the same session (the hub accepts one RTC session per account),
 * through one shared live source per station: the station serves one camera at a time, so a second
 * camera is refused until the first one's view ends.
 */
import { type Command, type MediaProvider } from "../../core/contracts.js";
import type { Logger } from "../../core/logger.js";
import { RtcSession, type RtcSessionOptions } from "./session.js";
export interface RtcIdentity {
    authToken: string;
    userId: string;
    /** The `gtoken` header value the mega session's authed HTTP calls carry. */
    gtoken: string;
}
/** Where a command goes: the station's session, and whether it addresses the station or a device on it. */
export interface RtcRoute {
    /** The station's signaling exchange; defaults to compact SDP. */
    signalingMode?: "call" | "scall";
    /** Candidate policy used by the station's exchange; defaults to relay-only. */
    iceTransportPolicy?: "relay" | "all";
    /**
     * The station streams video as RTP on its offer's video track and serves no data channel, so it takes
     * no portal command; see `RtcPeerOptions.mediaTrack`.
     */
    mediaTrack?: boolean;
    stationSn: string;
    /**
     * The station's `member.admin_user_id`, the account the session and the payload name; the logged-in
     * user when the station's record carries none.
     */
    adminUserId?: string;
    /** True for a device attached to the station, which keeps the command's own channel. */
    attached: boolean;
}
/** The camera a live view is for, on its station's route. */
export interface RtcLiveRoute extends RtcRoute {
    cameraSn: string;
    /** The camera's `device_channel` on the station. */
    channel: number;
}
export interface RtcCommandRouterDeps {
    /** The logged-in session's credentials; `undefined` while logged out. */
    identity: () => RtcIdentity | undefined;
    /** The mega shard the account signs on (`"ie-pr"`, `"eu-pr"`, `"us-pr"`); picks the smart host. */
    shard: () => string;
    /** ISO country sent on the sign request (default `US`). */
    country?: string;
    logger?: Logger;
    onError?: (e: Error) => void;
    /** ffmpeg for the live still (`ffmpeg` on PATH by default). */
    ffmpegPath?: string;
    createSession?: (opts: RtcSessionOptions) => RtcSession;
}
export declare class RtcCommandRouter {
    private readonly deps;
    private readonly sessions;
    private readonly lives;
    private readonly warm;
    private readonly callSources;
    constructor(deps: RtcCommandRouterDeps);
    dispatchCommand(route: RtcRoute, cmd: Command): Promise<void>;
    /**
     * The media of a camera on a T9000: live video, a readable feed and a live still over the station's
     * session. Recording has no wire here and is refused; the optional members it has no wire for are absent.
     */
    mediaProviderFor(route: RtcLiveRoute): MediaProvider;
    /**
     * Live view of a station on a {@link RtcRoute.mediaTrack} route: a live feed, a readable feed and a live
     * still, from one shared source per station whose every warm-up places a fresh `call` on its own
     * session. Recording has no wire here and is refused.
     */
    trackMediaProviderFor(route: RtcRoute): MediaProvider;
    /** NVR media uses a dedicated call per camera, independent of station commands. */
    nvrMediaProviderFor(route: RtcLiveRoute, views: readonly number[]): MediaProvider;
    /** Share a dedicated-call source and its consumer operations under one route key. */
    private callMediaProviderFor;
    /**
     * Tear down every station session (logout / shutdown). Each live source is disposed before its session
     * closes, so its consumers end cleanly and its stop still rides the session.
     */
    close(): void;
    /**
     * Hand `use` the station's live source for this camera, in the same turn the source is created or reused,
     * so a consumer it attaches is counted before any other caller looks.
     *
     * The station streams one camera at a time. Another camera whose source has consumers refuses this one,
     * before the session is awaited and again after; one with none (never attached or lingering)
     * holds nothing a viewer needs, so it is disposed and the slot taken. The first caller's
     * {@link SharedSourceHints} configure a new source.
     */
    private withLiveSource;
    /** Refuse a camera while another camera on its station has consumers. */
    private refuseIfWatched;
    private newLiveSource;
    /**
     * Completes on the command ACK or a correlated control-result notification. The notification must
     * match the request channel, parameter and segment and contain a structured payload. Receipt does
     * not establish physical actuation. The command is sent once, bounded by {@link ACK_TIMEOUT_MS}.
     */
    private sendAwaitAck;
    private newSession;
    private stationSession;
    /**
     * One bounded bring-up: the session is up when its command channel opens, and it fails, with the
     * session closed and every listener gone, when `connect()` throws, the session closes first (rejecting
     * with the failure that closed it, when it carries one), or {@link CONNECT_TIMEOUT_MS} passes. A single
     * promise, so an early failure cannot leave a second one rejecting unheard.
     */
    private bringUp;
    /**
     * Hold a station's command session open: one hold per station, its idle-close ({@link IDLE_CLOSE_MS})
     * suppressed, {@link PORTAL_KEEPALIVE} sent every {@link PORTAL_KEEPALIVE_MS}, and the session dropped
     * on a tick that finds the previous keepalive unechoed. A closed session ends the hold.
     *
     * Answers an idempotent disposer that releases the hold. Throws when no account is logged in.
     */
    keepWarm(route: RtcRoute): () => void;
    /**
     * Bring a station session up for a {@link keepWarm} hold and start its keepalive. A bring-up that fails,
     * or a hold disposed before it completes, clears the hold and arms no timer. Each tick first checks
     * that the hub echoed the previous keepalive, and drops the session when it did not. The keepalive
     * stops when the session closes, which also clears the hold so the next command or `keepWarm`
     * rebuilds cleanly.
     */
    private warmUp;
    /** Stop a hold's keepalive and remove its listeners from the session it watches. */
    private unwatch;
    private touch;
    private drop;
}
