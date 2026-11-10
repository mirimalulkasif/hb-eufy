/**
 * One T9000 command session end to end: sign → signalling socket → `scall` → the hub's SDP offer →
 * our answer → ICE → DTLS → the command data channel open.
 *
 * The signalling exchange, as the portal runs it and as confirmed live:
 *
 *   → scall                          (action 3, channel 0, the hub's own session)
 *   ← scall {status: 100, turn}      the hub granted the session and handed out TURN credentials
 *   ← info  {sdp | format:"SDP"}     the hub's offer, as scall JSON
 *   → info  {sdp}                    the answer
 *   ↔ info  {candidate}              trickle ICE on the same channel; "" ends it
 *   ← scall {status: 200}            → ack
 *   ← scall {status: 486 | 408}      busy / timeout: the session fails
 *   ← hangup                         the hub ended it
 *
 * The command data channel is the session: `close` fires once, when the channel closes, the peer fails,
 * the signalling socket drops or {@link RtcSession.close} is called, even while the peer connection is
 * nominally up. A peer that cannot be built when the hub grants the relay ends the session there: the
 * failure is emitted as `error` and `close` fires carrying it.
 *
 * A session whose peer is a {@link RtcPeerOptions.mediaTrack} peer has no command channel: `close` fires
 * when the peer fails or closes, and the video track's packets are emitted as `rtp`.
 *
 * Both the signalling client and the peer are injectable.
 */
import { EventEmitter } from "node:events";
import { RtcPeer, type RtcPeerOptions } from "./peer.js";
import { RtcSignalingClient, type RtcSignalingOptions } from "./signaling.js";
export interface RtcSessionOptions extends RtcSignalingOptions {
    peer?: RtcPeerOptions;
    createSignaling?: (opts: RtcSignalingOptions) => RtcSignalingClient;
    createPeer?: (opts: RtcPeerOptions) => RtcPeer;
}
export interface RtcSessionEvents {
    connected: [];
    /** The session ended; `err` is the failure that ended it, when one did. */
    close: [err?: Error];
    error: [err: Error];
    /** A reassembled command or notify frame: portal packet bytes + the link type it arrived on. */
    commandData: [frame: Buffer, linkType: number];
    /** A reassembled live-video frame. */
    mediaData: [frame: Buffer];
    /** The hub echoed the portal keepalive on the command channel. */
    keepaliveEcho: [];
    /** One packet of the video track, in a {@link RtcPeerOptions.mediaTrack} session. */
    rtp: [packet: Buffer];
}
export declare class RtcSession extends EventEmitter<RtcSessionEvents> {
    private readonly opts;
    private readonly signaling;
    private readonly peer;
    private readonly logger;
    private turn?;
    private authOk;
    private authWaiter?;
    private connected;
    private closed;
    private closeAnnounced;
    private sdpHandled;
    private chain;
    constructor(opts: RtcSessionOptions);
    get isConnected(): boolean;
    /**
     * Start the sequence; resolves once the call is sent. `connected` fires when the channel opens. A session
     * closed by the time the sign fetch or the auth completes rejects instead of opening the socket or
     * placing the call.
     */
    connect(): Promise<void>;
    /** Send one portal packet; false when the command channel isn't open. */
    sendCommand(portalPacket: Buffer): boolean;
    /** Send unframed bytes on the command channel; false when it isn't open. */
    sendRaw(bytes: Buffer): boolean;
    /**
     * Hang up and tear both sides down; `close` fires once, here if nothing announced it before. A
     * `connect()` still waiting for the signalling auth is rejected and its timer stopped.
     */
    close(): void;
    /** {@link RtcSession.close}, with the failure that ended the session handed to `close` when one did. */
    private shutdown;
    /**
     * Trickle one local candidate, or the empty end-of-candidates. The native peer can report one after the
     * signalling socket has closed, and sending then throws inside a native callback, where the throw can't
     * be caught and aborts the process. A candidate with no open socket is dropped.
     */
    private trickle;
    private announceClose;
    private waitForAuth;
    /** Settle a pending auth wait: resolve it, or reject it with `err`; either way its timer stops. */
    private settleAuth;
    private onSignaling;
    /** A `scall` status: `100` grants the relay, `200` is acknowledged, `486`/`408` fail the session. */
    private onCall;
    /**
     * An `info`: trickle ICE, in either of the two shapes the hub sends, or the hub's SDP offer. The offer
     * is answered only once a TURN grant is in: the peer is relay-only, so an offer ahead of `scall 100`
     * is reported and left unanswered.
     */
    private onInfo;
}
