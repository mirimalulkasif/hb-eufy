/**
 * FCM/MCS push client — holds a persistent TLS connection to Google's MCS
 * (mtalk.google.com:5228), logs in with the check-in androidId/securityToken,
 * heartbeats, and decodes DataMessageStanza pushes into eufy PushEvents.
 *
 * Implements Google's FCM/MCS push protocol; live-verified against real account pushes.
 */
import { EventEmitter } from "node:events";
import type { FcmCredentials, PushEvent, RawPushMessage } from "./types.js";
import { type Logger } from "../../core/logger.js";
/**
 * Normalises a decoded eufy envelope without consulting device semantics; semantic event names remain unset.
 *
 * The detail (`event_type`, `pic_url`, `cipher`) is read from the deepest level of
 * `payloadLevels`; identity (`device_sn`, `station_sn`) is gathered from every level, deepest
 * first, so a serial is found whichever level the push carries it on.
 * @internal
 */
export declare function normalizePushEvent(raw: RawPushMessage): PushEvent;
export declare class PushClient extends EventEmitter {
    private readonly creds;
    private readonly logger;
    /** Consecutive MCS login rejections tolerated (self-healing propagation) before surfacing an error. */
    private static readonly MAX_LOGIN_FAILURES;
    private socket?;
    private readonly parser;
    private heartbeatTimer?;
    private reconnectTimer?;
    private currentDelay;
    private persistentIds;
    private loggedIn;
    private closing;
    /** Consecutive MCS login rejections — transient ones self-heal via reconnect (see {@link onMessage}). */
    private loginFailures;
    /**
     * How many of {@link persistentIds} the last `LoginRequest` reported; a successful `LoginResponse`
     * acknowledges them, so they are dropped then.
     */
    private reportedIds;
    constructor(creds: FcmCredentials, logger?: Logger);
    /** Persistent ids already seen (set this from storage to avoid re-delivery). */
    setPersistentIds(ids: string[]): void;
    getPersistentIds(): string[];
    /**
     * Open the MCS connection and log in.
     *
     * `servername` is passed explicitly: Node sends SNI only when told to, never deriving it from `host`,
     * and this endpoint answers a connection without SNI with a self-signed certificate naming
     * `invalid2.invalid` — which now fails the handshake rather than being accepted. Verification matters
     * because the login request carries the account's `securityToken`, and an unverified peer could both
     * read it and inject forged pushes into the event path.
     */
    connect(): void;
    private buildLoginRequest;
    private buildHeartbeatPing;
    private buildHeartbeatAck;
    private onMessage;
    /**
     * Handle an MCS `LoginResponse` carrying an error. Google occasionally rejects the FIRST login right
     * after check-in (`wrong_secret`) while the freshly-registered androidId/securityToken propagates —
     * it succeeds on the very next attempt. So a login rejection is treated as **transient**: log it and
     * close the socket to let the existing backoff reconnect retry with the same creds, rather than
     * surfacing a self-healing blip as a host-facing `error`. Only once it persists past
     * {@link MAX_LOGIN_FAILURES} consecutive attempts (creds genuinely stale) is it emitted as `error`.
     */
    private onLoginError;
    /**
     * Decode one MCS `DataMessageStanza` into a {@link RawPushMessage} and the normalised event.
     *
     * `payload` carries the whole app_data envelope, with its `payload` entry (base64 of NUL-terminated
     * JSON) parsed in place: the envelope's own keys, `device_sn` and `station_sn` among them, sit beside
     * that entry.
     */
    private handleDataMessage;
    private startHeartbeat;
    private stopHeartbeat;
    private onClose;
    private scheduleReconnect;
    close(): void;
}
