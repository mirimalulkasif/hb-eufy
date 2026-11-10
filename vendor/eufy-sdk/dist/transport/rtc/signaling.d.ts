/**
 * The T9000's signalling channel: the WebSocket through which a client and a HomeBase S1 Pro agree on a
 * WebRTC session. It is the wire the security.eufy.com web client uses (`/v1/rtc/ws/join`), and the hub
 * accepts it from any client presenting the account's mega token.
 *
 * Sequence:
 *
 *   1. `GET https://<smart host>/v1/smart/nvr/ws/sign` with the mega token → a `sign` blob.
 *   2. WebSocket to `wss://<smart host>/v1/rtc/ws/join?reqtype=nvr`, subprotocols `["v1", <base64url
 *      JSON>]` carrying the cluster region, station serial, token, `gtoken` and the sign. HTTP headers on
 *      the upgrade alone are refused: the JSON subprotocol is what authenticates.
 *   3. `action 1` auth on open; `action 3` session messages after: `scall` (start), `info` (SDP and
 *      trickle ICE), `ack`, `hangup`. Every session message carries an HMAC-SHA256 `account` over
 *      `channelId + adminUserId + ts`, keyed by the token.
 *
 * Region is two values: the HTTP sign request names the account's **country** (`Web-Country`), the
 * WebSocket payload names the **cluster**, the shard prefix uppercased (`ie-pr` → `IE`). The smart host
 * is `security-smart` for `us` and `security-smart-<prefix>` for any other shard.
 *
 * `fetch` and the `WebSocket` constructor are injectable.
 */
import { EventEmitter } from "node:events";
import { type Logger } from "../../core/logger.js";
/** The portal's origin; the sign endpoint and the socket upgrade both check it. */
export declare const PORTAL_ORIGIN = "https://security.eufy.com";
/** The hub drops an idle signalling socket after ~83 s; re-sending auth inside that keeps it. */
export declare const SIGNALING_KEEPALIVE_MS = 25000;
/** How long the socket has to open after the sign. */
export declare const SIGNALING_CONNECT_TIMEOUT_MS = 15000;
/** Outer wire envelope. */
export interface RtcWsEnvelope {
    msgid: string;
    data: string;
}
/** Inner message (the envelope's `data`, JSON-parsed). */
export interface RtcInnerMessage {
    code?: number;
    action?: number;
    sessionId?: string;
    sn?: string;
    subSn?: string;
    channelId?: number;
    isResponse?: number;
    dataType?: string;
    source?: string;
    ts?: number;
    data?: string;
    msgid?: string;
}
/** What a socket event carries; only the fields each event type fills are read. */
export interface SignalingSocketEvent {
    data?: unknown;
    code?: number;
    reason?: string;
}
/** The subset of a `WebSocket` the client uses. */
export interface SignalingSocket {
    readonly readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: "open" | "message" | "close" | "error", listener: (ev: SignalingSocketEvent) => void): void;
}
export interface SignalingSocketInit {
    /** The subprotocols; slot 2 carries the base64url auth JSON. */
    protocols: string[];
    /** The upgrade Origin, which the server checks like the sign call. */
    origin: string;
}
export type SignalingSocketFactory = (url: string, init: SignalingSocketInit) => SignalingSocket;
export interface RtcSignalingOptions {
    /** Full SDP (`call`) or compact SDP (`scall`, the default). */
    signalingMode?: "call" | "scall";
    /** The mega session's auth token. */
    authToken: string;
    /** The `gtoken` header value the mega session's authed HTTP calls carry. */
    gtoken: string;
    stationSn: string;
    /** The station's `member.admin_user_id`, the account the session HMAC names. */
    adminUserId: string;
    /** The mega shard the account lives on; picks the host and the cluster name. */
    shard: string;
    /** The account's ISO country, sent on the sign request (`Web-Country`). */
    country: string;
    fetch?: typeof fetch;
    createSocket?: SignalingSocketFactory;
    logger?: Logger;
    now?: () => number;
    makeMsgId?: () => string;
}
export interface RtcSignalingEvents {
    message: [inner: RtcInnerMessage, envelope: RtcWsEnvelope];
    open: [];
    close: [code: number, reason: string];
    error: [err: Error];
}
/** The portal's `account` field: HMAC-SHA256 of `channelId + adminUserId + ts`, keyed by the token. */
export declare function sessionAccount(channelId: number, adminUserId: string, ts: number, authToken: string): string;
export declare class RtcSignalingClient extends EventEmitter<RtcSignalingEvents> {
    private readonly opts;
    private ws?;
    private sign?;
    private keepalive?;
    private readonly wsUrl;
    private readonly signUrl;
    private readonly wsRegion;
    private readonly fetchImpl;
    private readonly createSocket;
    private readonly logger;
    private readonly now;
    private readonly makeMsgId;
    constructor(opts: RtcSignalingOptions);
    get isOpen(): boolean;
    /** Step 1: the sign blob the socket and every auth message carry. A non-JSON body is reported by status. */
    fetchSign(): Promise<string>;
    /**
     * Step 2: open the socket and send the first auth; resolves on `open`. A socket that closes or errors
     * before it ever opened rejects, so the call always settles.
     */
    connect(): Promise<void>;
    /** `action 1`, also what keeps the socket alive when re-sent. */
    sendAuth(sign?: string): void;
    /**
     * `action 3`, a session message on channel 0, the hub's own session; `scall` opens the negotiation.
     * `subSn` is empty for the hub's session.
     */
    sendSession(dataType: string, payload?: Record<string, unknown>): void;
    sendCall(): void;
    sendAck(): void;
    /** The SDP answer, encoded for the negotiated call format, in an `info`. */
    sendInfoSdp(sdp: string): void;
    /** Trickle a candidate on the session's channel, like its SDP answer. An empty candidate ends them. */
    sendInfoCandidate(candidate: string): void;
    sendHangup(): void;
    close(): void;
    private startKeepalive;
    private stopKeepalive;
    private sendEnvelope;
    private handleWireMessage;
}
