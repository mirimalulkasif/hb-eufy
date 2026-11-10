/**
 * Minimal eufy P2P (ThroughTek PPCS) UDP session for ONE station.
 *
 * Scope: realtime *device state / sensor events* from a HomeBase — not video.
 * The connect handshake (local + cloud lookup → CHECK_CAM hole-punch → CAM_ID)
 * and PING/PONG heartbeat are full, but command *sending* and video/audio
 * streaming are intentionally omitted. Crucially, HomeBase control-channel
 * notifications (sensor open/close, alarm mode, …) are AES-128-ECB encrypted with
 * the *Level-1* key derived from sn + p2p_did alone — so we decrypt them without
 * the gateway cipher negotiation.
 *
 * Reassembly note: control notifications are small and arrive in a single UDP
 * datagram, so this parses one-frame-per-packet (with multiple frames per packet)
 * and does not reassemble frames that span datagrams.
 */
import { EventEmitter } from "node:events";
import { type Address, type P2PDataFrameHeader } from "./codec.js";
import { type Logger } from "../../core/logger.js";
/**
 * How long a station is given to answer a lookup before the connection gives up on it and closes.
 *
 * The whole deadline for reaching a station: the lookups are re-sent every second until one is answered, and
 * a connection that reaches this closes itself, so nothing addressed to that station can succeed afterwards.
 * Published because it bounds every wait on a session connecting — a second number for the same deadline
 * elsewhere would outlive the connection it waits on and charge the difference to every failure.
 *
 * The relay handshake starts once the lookup server has acknowledged the P2P request for 24 lookup rounds, so
 * about 25 s in. The vendor app's own remote connect has a 30 s budget, which leaves the handshake 3–6 s.
 * Forty-five seconds keeps the vendor's threshold and gives the handshake about 20 s to complete. A station that
 * never acknowledges the request, as an offline one does, takes this long to fail.
 */
export declare const CONNECT_TIMEOUT_MS = 45000;
/**
 * The channel a command addresses the station itself on, rather than one of its cameras, and the value a
 * session's channel-taking methods resolve an omitted channel to.
 */
export declare const STATION_CHANNEL = 255;
/**
 * Transport wiring for a PPCS session — internal to the SDK; a host reaches sessions through the facade.
 * @internal
 */
export interface P2PSessionConfig {
    stationSn: string;
    p2pDid: string;
    /** Cloud lookup servers (decodeP2PCloudIPs of the station's p2p_conn/app_conn). */
    cloudAddresses?: Address[];
    /** DSK key for the cloud-lookup payload. Optional — local lookup needs none. */
    dskKey?: string;
    /** Known LAN address of the station, for a direct (non-broadcast) local lookup. */
    localAddress?: string;
    /** Disable UDP broadcast local lookup (e.g. cloud-only). Default false. */
    noBroadcast?: boolean;
    /**
     * Resolve a station `cipher_id` → its private keys (from cloud `get_ciphers`): `ecc`, the ECC private
     * key hex (`ecc_private_key`), and `rsa`, the RSA private key (`private_key`). A plain string is the ECC key. Called once per
     * negotiation. When provided, the session auto-negotiates the **level-2** session key on connect: it
     * reads the `cipher_id` + envelope from the `CMD_GATEWAYINFO` reply and derives the key. With an ECC
     * key that is the ECIES unwrap and `setLevel2Key()` — so signCode 2/8 frames (camera info, event DB,
     * event images) decrypt live. A cipher with no ECC key carries the key RSA-encrypted instead, and only
     * {@link P2PSession.sendControlLevel2} seals with it.
     */
    resolveCipherKey?: (cipherId: number) => Promise<string | {
        ecc?: string;
        rsa?: string;
    } | undefined>;
    /** Diagnostics sink. Omit for silence. */
    logger?: Logger;
}
/**
 * A decoded P2P data/notification frame.
 *
 * A decoded PPCS frame. Internal wire shape — surfaced on the facade's diagnostic event only.
 * @internal
 */
export interface P2PFrame extends P2PDataFrameHeader {
    stationSn: string;
    /** Resolved command name (e.g. "CMD_NOTIFY_PAYLOAD"), or "CMD_<id>" if unknown. */
    commandName: string;
    dataType: number;
    /** Payload after (attempted) decryption. */
    data: Buffer;
    /** Payload exactly as received, before any decryption (for diagnostics). */
    raw: Buffer;
    /** Parsed JSON when the payload is a NUL-terminated JSON document. */
    json?: {
        cmd?: number;
        payload?: unknown;
    } & Record<string, unknown>;
    /**
     * Device params the frame reported, when its JSON carries a `params` array of
     * `{param_type, param_value}` — the shape a station uses to volunteer an attached device's state.
     *
     * Unwrapped here because it is pure framing: the entries are the SAME `param_type` ids the cloud
     * record uses, so nothing in this payload needs a capability to interpret it, and a caller can land
     * the values as device state without any per-capability decoder.
     */
    params?: Record<number, string>;
}
/**
 * A live PPCS session. Internal transport; a host drives cameras through the capability surface.
 * @internal
 */
export declare class P2PSession extends EventEmitter {
    private readonly cfg;
    private socket?;
    private connected;
    private connecting;
    private closed;
    /** Whether a short receive buffer has been reported, so a reconnect does not repeat the same warning. */
    private receiveBufferReported;
    private connectAddress?;
    private seqNumber;
    /**
     * Sequence counter for frames sent on the **video** data-type channel, which the device tracks
     * separately from the control channel's — today only {@link sendAudioFrame} rides it.
     */
    private videoSeqNumber;
    /**
     * Audio frames sent but not yet acknowledged, keyed by their video-channel sequence number. Holding
     * the datagram (not just the payload) means a retransmit is byte-identical, which is what the
     * device's ordered channel expects.
     */
    private unackedAudio;
    /**
     * Whether the audio channel is currently in a stall — set when a frame is abandoned, cleared by the
     * next acknowledgement of any frame.
     *
     * A stall is an episode, not a per-frame event: once the device stops acknowledging, EVERY later
     * frame is abandoned in turn, so reporting each one turns a single condition into hundreds of
     * identical events. Measured live on a battery camera whose media session was stopped mid-clip by its
     * power budget: 74 consecutive frames, one event each, all saying the same thing. The condition is
     * reported once and again only if the channel recovers and stalls afresh.
     */
    private audioStalled;
    private audioRetransmitTimer?;
    private lastPongData?;
    /** When the selected peer last answered outbound P2P traffic on this connection. */
    private lastPeerAt?;
    /** Whether the silence has already been stated, so it is traced once per connection rather than per read. */
    private pathStaleTraced;
    private lookupTimer?;
    private heartbeatTimer?;
    private connectTimer?;
    /** Extra sockets registered alongside {@link socket} while connecting; see {@link PUNCH_PROBE_SOCKETS}. */
    private probeSockets;
    /** Cloud lookup inputs resolved once for a connection. */
    private cloudLookup?;
    /**
     * Lookup rounds since the lookup server acknowledged this connect's P2P request, or `undefined` while it
     * has not; see {@link RELAY_AFTER_ACKED_ROUNDS}.
     */
    private ackedRounds?;
    /**
     * The relay handshake of a connect that has fallen back to one, by the step it waits on: the relay list
     * (`list`, answering ListReq_DSK), a relay's hello acknowledgement (`hello`), that relay's port (`port`),
     * then the relay-ready the device's registration produces (`request`, re-sending RLY_REQ meanwhile).
     */
    private relay?;
    /** Local outbound IPv4 reported inside LOOKUP_WITH_KEY requests. */
    private selfHost?;
    /**
     * In-flight multi-datagram frame per data channel (see reassemble): the payload gathered so far under its
     * parsed header, or, without a header, the start of a frame header cut by the datagram boundary.
     */
    private readonly pendingByDataType;
    /** Last delivered datagram sequence number per data type. */
    private readonly lastSeqByType;
    /** Held datagrams and their active gap timer, grouped by data type. */
    private readonly reorderByType;
    private tracedDatagramGaps;
    private readonly level1Key;
    /** Negotiated 32-byte level-2/gateway key (AES-256-GCM). Set via setLevel2Key once known. */
    private level2Key?;
    /**
     * Negotiated 16-byte level-2 key of a cipher with no ECC key (RSA-encrypted in `CMD_GATEWAYINFO`). Only
     * {@link sendControlLevel2} seals with it, AES-128-ECB in the level-1 layout at encryption type 2; never
     * held beside {@link level2Key}.
     */
    private level2EcbKey?;
    private level2Seq;
    private rsaPrivateKey?;
    private rsaModulusHex?;
    /** Guards the one-shot level-2 key negotiation kicked off by the GATEWAYINFO reply. */
    private level2Negotiating;
    /**
     * Whether waiting for a level-2 key can still change the answer: `false` once one has been negotiated,
     * once the one-shot negotiation concluded without one, and from the start when nothing can negotiate one.
     */
    private level2Pending;
    /** Waiters parked in {@link awaitLevel2Key}, woken the moment the negotiation settles either way. */
    private readonly level2Waiters;
    /** Whether this connection has already been asked a second time for its gateway info — see {@link repromptLevel2Key}. */
    private level2Reprompted;
    /** When this session connected — the instant the level-2 negotiation had its chance to start. */
    private connectedAtMs?;
    /** Connection generation that owns every asynchronous result derived from its gateway envelope. */
    private connectionGeneration;
    /**
     * Own-session channels with an active live start → the encryption variant of the start frame we
     * last sent (`"l2"` GCM / `"l1"` ECB). A keepalive tick re-issues the start if the variant should
     * change (the level-2 key arrived after an initial level-1 start), otherwise sends the 1139 nudge.
     */
    private readonly liveStartedChannels;
    /** The `cipher_id` this connection's `CMD_GATEWAYINFO` reply named, once its negotiation has read it. */
    private gatewayCipherId?;
    /** The `n` of the last `[0x01, n]` header this connection sent in the clear — see {@link nextClearCommandBytes}. */
    private clearCommandCount;
    private readonly unackedLiveStarts;
    private liveStartRetransmitTimer?;
    private readonly logger;
    constructor(cfg: P2PSessionConfig);
    /**
     * This session's opaque handle for tracing — `station-N` by order of construction in this process.
     *
     * Not the serial: a trace carrying one could not be retained by a host, which is the whole point of the
     * phase vocabulary. It groups one station's records within a run and resolves to nothing outside it.
     */
    readonly traceId: string;
    /**
     * How long this connection's path has been silent, or nothing where it has never answered.
     *
     * PONG and ACK from the selected peer prove the path answers outbound traffic. `undefined` means no such reply
     * has arrived since connection, so silence alone does not establish a stale path.
     */
    get pathSilentMs(): number | undefined;
    /**
     * Whether this path can still be committed to, on the evidence the heartbeat gives.
     *
     * False where selected-peer replies arrived and then stopped for {@link PATH_SILENCE_MS}. A connection with
     * no post-connect reply is not known to be dead, so it answers true.
     *
     * Traces the silence once per connection, on the read that first observes it.
     */
    get pathAnswering(): boolean;
    /** Emit a live trace under this session's handle. */
    private trace;
    /** Provide the negotiated 32-byte session key so level-2 (signCode 2/8) frames can be decrypted. */
    setLevel2Key(key: Buffer): void;
    /** Whether the AES-256-GCM level-2 session key has been negotiated/set. */
    get hasLevel2Key(): boolean;
    /**
     * Whether the held level-2 key can frame for `sender`: every level-2 sender needs the AES-256-GCM key,
     * and `"set-payload"` ({@link sendControlLevel2}) also takes the AES-128-ECB key of an RSA cipher.
     */
    private level2KeyServes;
    /**
     * Resolve with whether a level-2 key is available, waiting only while waiting can still change that.
     * `sender` names who will frame with it: by default every level-2 sender, which needs the AES-256-GCM
     * key; `"set-payload"` is {@link sendControlLevel2} alone, which also takes the AES-128-ECB key of an RSA
     * cipher, so `true` for it does not imply {@link hasLevel2Key}.
     *
     * A `"session"` grace is measured once, not restarted per call. Best-effort media uses it because every
     * egress asks this same session and can proceed without the key on an own-session camera; a per-call
     * budget there makes a station that offers no key charge its full budget on every later stream.
     *
     * A `"call"` grace gives the full wait to a command that cannot be framed without the key. Such a
     * command may arrive on an old session before a delayed `CMD_GATEWAYINFO`, so session age says nothing
     * about whether the key can still arrive during this command.
     *
     * The session grace runs from connect, when the station is prompted for `CMD_GATEWAYINFO`. A negotiation
     * beginning later does not restart it: best-effort media can proceed without the key, and restarting
     * would charge another grace to a source that may already be streaming. A session whose negotiation has
     * settled answers without waiting at all, since being one-shot is what makes that answer final.
     *
     * An own-session camera whose grace expires here is NOT thereby a camera that will fail to stream. Measured
     * on one account: own-session cameras of two device types negotiated a key, three others never did, and
     * cameras from that second group streamed normally at level-1 — including one of the same firmware as an
     * own-session camera that delivered no video at all for a reason of its own. An expired grace therefore
     * separates nothing on this path, and a start failure on such a session is not evidence about it.
     *
     * Every `false` answer carries a `level2-unavailable` trace naming its reason, wherever the wait ended: a
     * `terminal` outcome is the one already stated where the negotiation concluded, since that is where the
     * cipher and the cause are known, and re-stating it here would double every settled negotiation.
     */
    awaitLevel2Key(graceMs: number, graceFrom?: "call" | "session", sender?: "every" | "set-payload"): Promise<boolean>;
    /**
     * Ask the station for its gateway info a second time, re-opening a negotiation that concluded without a key.
     *
     * The negotiation is one-shot per connection: the station is prompted once on connect, and a reply that
     * never lands settles the wait so {@link awaitLevel2Key} answers `false` at once forever after. That is the
     * right answer for best-effort media, which proceeds at level-1 — but an operation whose ONLY wire is
     * level-2 is then refused for the whole life of that connection, while a fresh session over the same
     * device negotiates a key normally. Measured: a session that had settled refused every such operation
     * until it was rebuilt, at which point the station answered with a cipher id straight away.
     *
     * Bounded to one extra ask per connection, so a burst of such operations cannot turn a silent station into a
     * flood, and answers whether it asked — `false` when a key is already held, when nothing can negotiate one,
     * when the ask was already spent, or when there is nowhere to send it. Callers with a level-1 path must not
     * use this: re-prompting on their behalf would be noise for an answer they do not need.
     */
    repromptLevel2Key(): boolean;
    /** Record that the level-2 negotiation has finished, with or without a key, and wake every waiter. */
    private settleLevel2;
    /**
     * Negotiate the level-2 session key from the decrypted CMD_GATEWAYINFO payload: read its
     * `cipher_id`, resolve that cipher's private keys once (cloud `get_ciphers`, via the configured
     * `resolveCipherKey`), run the ECIES unwrap with the ECC key, and `setLevel2Key()`. A cipher with no
     * ECC key uses its RSA key instead and holds the RSA-decrypted 16-byte key as the AES-128-ECB level-2
     * key. One-shot; emits `level2Ready` only when the AES-256-GCM key is negotiated, traces
     * `level2-set-payload-only` instead for the AES-128-ECB key, and emits `error` when the ECC unwrap
     * fails; an RSA unwrap failure is only traced (non-fatal either way — level-1 traffic keeps working).
     *
     * Every outcome settles the wait in {@link awaitLevel2Key}, because being one-shot is what makes a
     * failure final for this connection generation: nothing will retry it there, so a later command must be
     * told at once rather than left to time out against a key that is not coming.
     */
    private negotiateLevel2Key;
    /**
     * Decrypt a level-2 P2P frame payload (AES-256-GCM, key = negotiated session key, AAD
     * "eufy security"). Both signCodes use the SAME key + layout, differing only by a 4-byte
     * cleartext sub-header — reversed from `libmega_media_sdk.so` + verified (GCM tag authenticates):
     *
     *   signCode 8 (app→station commands):  tag(16) ‖ nonce(12) ‖ `[seq,03,02,01]`(4) ‖ ciphertext  → ct@32
     *   signCode 2 (station media/db/notify): tag(16) ‖ nonce(12) ‖ ciphertext                     → ct@28
     *
     * (signCode 2 carries the station's content — `CMD_CAMERA_INFO`, `CMD_DATABASE` responses,
     * `CMD_DATABASE_IMAGE` JPEGs, notify results. signCode 2 and 8 share the one AES-256-GCM session
     * key; only the ciphertext offset differs, by the 4 sub-header bytes present on signCode 8.)
     */
    private decryptLevel2;
    get isConnected(): boolean;
    /**
     * Ask the OS for {@link RECEIVE_BUFFER_BYTES} on a bound socket, and log once per session when it grants
     * less (debug) or refuses (warn).
     *
     * The request is made here rather than through `createSocket`'s `recvBufferSize`: Node applies that option
     * inside the bind callback, where a refusal is thrown out of reach of this session and ends the process.
     */
    private requestReceiveBuffer;
    /** Open the socket and start the lookup → hole-punch handshake. */
    connect(): Promise<void>;
    /** Cached across every `P2PSession` in this process — the local outbound IPv4 doesn't vary by
     * station, so there's no reason to re-probe it per session (e.g. once per station in a fleet). Only
     * a SUCCESSFUL probe is cached (see {@link detectLocalIp}) — a transient failure must not be memoized
     * forever. */
    private static localIpPromise?;
    /** Best-effort local outbound IPv4 (the address the OS would route through to reach the internet) —
     * connects a throwaway UDP socket (no packets sent, just kernel routing) and reads its bound
     * address. Needed to self-report our own host:port inside a LOOKUP_WITH_KEY request. Bounded by its
     * own timeout so a hung probe (sandboxed/offline network) can never block anything indefinitely;
     * resolves to `undefined` on any failure so callers skip the self-report rather than send a bogus
     * `0.0.0.0` wildcard address (unconfirmed whether the cloud lookup server treats that specially).
     *
     * Two failure modes guarded here:
     *  - **Permanent poisoning**: the underlying probe promise always RESOLVES (never rejects), even on
     *    failure — so a naive `if (!cached) probe()` memoizes `undefined` exactly like a real address,
     *    forever, the first time this races (e.g. a transient blip on the very first `connect()` in the
     *    process). Every later session would then be silently stuck on the KEY2 (relay-only) lookup
     *    variant for the process's whole lifetime. Fixed by only caching a successful (non-undefined)
     *    result — a failure clears `localIpPromise` so the NEXT call re-probes.
     *  - **Teardown races**: the timeout, the `connect` callback, and the `error` handler all race to
     *    finish the same probe. Without a `settled` guard, a timeout that fires first (closes + resolves)
     *    can be followed by the `connect` callback still firing on the now-closed socket — `.address()` or
     *    a second `.close()` on an already-closed dgram socket both throw `ERR_SOCKET_DGRAM_NOT_RUNNING`
     *    SYNCHRONOUSLY, off any promise chain, surfacing as an uncaught exception. `settled` + try/catch
     *    around the teardown close that window.
     */
    private static detectLocalIp;
    private sendLookups;
    /** Step {@link ackedRounds} for one lookup round, and start the relay handshake once it passes its threshold. */
    private countAckedRound;
    /**
     * How far this connect got towards a relay: the handshake step it was waiting on (`list` meaning no lookup
     * server named a relay), `not started` where it had not fallen back yet, or `no cloud lookup` where it could
     * not.
     */
    private relayProgress;
    /**
     * Send the relay handshake's message for the step it waits on, from the session's own socket.
     *
     * The order is the vendor client's: ListReq_DSK to the cloud lookup servers, RLY_HELLO to every relay they
     * list, RLY_PORT to the first of those relays that acknowledges, then RLY_REQ to the lookup servers naming
     * that relay's port and mark. The lookup server has the device register with the relay, and the relay
     * answers RLY_RDY.
     */
    private sendRelay;
    /** Advance the relay handshake on one of its answers, arriving on the session's own socket. */
    private onRelayMessage;
    /** Register a bound socket's own port with each configured cloud lookup address. */
    private sendCloudLookup;
    /**
     * Route one inbound UDP datagram by its message type, tracing every non-DATA one and any type this session
     * does not model.
     *
     * An unmodelled type is not by itself evidence about a session that is failing. Correlate one against a
     * WORKING session before reading it as a cause.
     *
     * P2P_REQ_ACK is the lookup server acknowledging this connect's P2P request; the first one carrying result 0
     * starts the round count {@link RELAY_AFTER_ACKED_ROUNDS} measures.
     *
     * CAM_ADDR is recognised and dropped: it names the address the device is already answering from, and the
     * CAM_ID that follows it is what completes the connect. RLY_TO is a relay endpoint, never the device: it is
     * answered with {@link RELAY_PACKET_COPIES} RLY_PKTs carrying its handle, and the RLY_RDY naming this
     * session's device completes the connect with the relay as the peer. The other relay answers advance the
     * handshake {@link sendRelay} drives, and are dropped outside it.
     */
    private onMessage;
    private beginCheckCam;
    /** Bind additional UDP source ports before the first cloud lookup. */
    private startPunchProbes;
    /** Close all lookup sockets except the one that completed the handshake. */
    private stopPunchProbes;
    private onConnected;
    /**
     * Start the realtime media stream for a camera `channel` (the device's `device_channel`; defaults to
     * the station channel). The camera then streams `CMD_VIDEO_FRAME` (1300) + `CMD_AUDIO_FRAME` (1301),
     * surfaced via the `data` event. Two start protocols, selected by runtime topology (never by device
     * family):
     *  - `homeBaseAttached` (the camera rides a HomeBase's session): `CMD_SET_PAYLOAD` (1350) wrapping
     *    `{cmd:1003, mChannel:channel}` at level-2, where `mChannel` picks the camera on the base.
     *  - own-session (the session is the camera itself): `CMD_CONTROL_PAYLOAD` (1700) / inner cmd 1000
     *    START_LIVE, then the 1139 keepalive to hold the stream. A bare 1003 is read as a status query
     *    there, not a stream.
     *
     * An own-session start's encryption follows the session key, not the device family: level-2 GCM once a
     * key is negotiated, level-1 ECB before that. A key that arrives after a level-1 start makes the next
     * keepalive tick re-issue the start at level-2, so a camera that only accepts level-2 recovers from a
     * `live()` that raced ahead of key negotiation.
     *
     * Each start is retained until its DATA acknowledgement and repeated every `LIVE_START_RETRANSMIT_MS` until
     * the device acknowledges one, bounded by `LIVE_START_ACK_DEADLINE_MS` rather than by a send count. Both are
     * internal to this module, so they are named as code: a public comment cannot link to what the reference does
     * not carry. Use the `LiveStream` helper for a managed feed with keepalive.
     *
     * `opts.force` sends a real start on a channel this session already counts as started, and yields to a
     * start still awaiting acknowledgement — that one is already being repeated byte-identically and is
     * abandoned at its own deadline.
     */
    startLiveMedia(channel?: number, accountId?: string, homeBaseAttached?: boolean, opts?: {
        force?: boolean;
    }): void;
    /**
     * The own-session START_LIVE wrapper JSON (`{commandType: 1000, data: {…}}`).
     *
     * Every field is byte-verified against the current app's own start for an own-session camera, decrypted
     * from a level-2 capture: `msg_id` is 1, `extValue` repeats the inner command id 1000, `streamtype` is 2,
     * `video_type` is 12, and `transaction` is the millisecond timestamp as a string. The device answers a
     * start carrying these values with a keyframe; `encryptkey` is the modulus it RSA-wraps each keyframe's
     * AES media key with (unwrapped by {@link decodeVideoFrame}).
     *
     * With `clearMsgId`, the body of a start sent in the clear: `{accountId, encryptkey, msg_id, streamtype: 1}`
     * only, `msg_id` being `clearMsgId`, which changes from one start to the next.
     */
    private startLiveJson;
    /**
     * Send the own-session START_LIVE frame (outer `CMD_CONTROL_PAYLOAD` 1700, inner cmd 1000). Level-2
     * (GCM, signCode 8, frame type 10) when the session has a negotiated key, else level-1 (AES-128-ECB,
     * signCode 1, frame type 11) — chosen by the session key, not the device family. The camera RSA-wraps
     * each keyframe's AES media key with the `encryptkey` modulus (unwrapped by {@link decodeVideoFrame}).
     * A session that {@link sendsInTheClear} sends it unencrypted instead: signCode 0, frame type 0, header
     * bytes `[0x01, n]` from {@link nextClearCommandBytes}, and `n` as the body's `msg_id`.
     */
    private sendStartLiveOwnSession;
    /**
     * Whether this session's own-session start and stop go in the clear: its `CMD_GATEWAYINFO` reply named
     * `cipher_id` 0.
     */
    private sendsInTheClear;
    /**
     * Header bytes 10-11 of this connection's next command sent in the clear: `[0x01, n]`, with `n` counting
     * those commands from 1 and never 0. A retransmit repeats its `n`, and the device's reply echoes it.
     */
    private nextClearCommandBytes;
    /**
     * Repeat unacknowledged own-session live starts until the device takes one. Runs only while a start is
     * outstanding.
     *
     * A start abandoned at {@link LIVE_START_ACK_DEADLINE_MS} is traced as `media-command-unacknowledged` and
     * the channel's started state is forgotten. Both halves matter: the camera was never told to stream, so
     * the warm-up that follows can only ever time out, and the trace is what separates that from a camera that
     * got the start and stayed silent. Forgetting the state is what lets the next keepalive tick issue a real
     * start under a fresh sequence — while the channel still counts as started, every tick sends only the 1139
     * nudge, which holds a stream that was never started and cannot begin one.
     *
     * The abandonment emits `liveStartUnacknowledged` carrying the RESOLVED channel, so a listener matches it
     * against {@link STATION_CHANNEL} where it started one without naming a channel.
     */
    private armLiveStartRetransmit;
    private clearLiveStartRetransmit;
    /**
     * Send a **string-payload control command** (the JSON control wrapper `1700` / media `1350`)
     * over the **level-1** (AES-128-ECB) control channel — the WRITE
     * primitive behind `setProperty`. `value` is the JSON the app wraps (`{commandType, data}`); the
     * device unwraps and applies it. Fire-and-forget today (the device echoes the new state back as a
     * param update); request/response correlation is a later refinement.
     */
    sendStringPayloadCommand(commandType: number, value: string, channel?: number): void;
    /**
     * Send an **int+string control command** over the level-1 (AES-128-ECB) channel — the wire shape
     * the app uses for the floodlight/spotlight switch (`CMD_SET_FLOODLIGHT_MANUAL_SWITCH` 1400) on
     * IndoorOutdoor / SoloCam-spotlight / Cam2C-3 families: `value` (0/1), `valueSub` (channel), and
     * `strValue` (admin `account_id`). See {@link buildIntStringCommandPayload}. Fire-and-forget.
     */
    sendIntStringCommand(commandType: number, value: number, valueSub: number, strValue: string, channel?: number): void;
    /** Send a level-1 {@link buildStringPairCommandPayload} command on `channel`. */
    sendStringPairCommand(commandType: number, strValue: string, strValueSub: string, channel: number): void;
    /**
     * Send a **level-2 (AES-256-GCM, signCode 8) control payload** to a HomeBase-attached device. The
     * target camera is selected by `channel` (= device_channel) + the `mChannel` envelope — the same
     * mechanism proven for camera selection in media start. Use for control commands routed through a
     * HomeBase (where level-1 ECB is rejected). Returns `false` if the level-2 key isn't negotiated
     * yet (caller can fall back to {@link sendStringPayloadCommand}).
     *
     * On a session holding only the AES-128-ECB level-2 key of an RSA cipher, the frame is the level-1
     * layout ({@link sendRawLevel1Bytes}) sealed under that key at encryption type 2: the encryption-type
     * byte names the key the body is sealed with (1 = level-1 key, 2 = the negotiated key).
     */
    sendControlLevel2(cmd: number, channel: number, accountId: string, payload: Record<string, unknown>, mValue3?: number): boolean;
    /**
     * Send a **level-2 (GCM, signCode 8) frame whose plaintext is exactly `json`** — no
     * `{account_id,cmd,mChannel,…}` envelope. The target device is selected by the frame-header
     * `channel`. This is the form the eufy app uses for control commands (confirmed by live capture:
     * floodlight = `{"commandType":1400,"data":{...}}`). Returns `false` if no level-2 key.
     */
    sendRawLevel2(json: string, channel: number, outerCmd?: number): boolean;
    /**
     * Like {@link sendRawLevel2} but the plaintext is a raw byte buffer, not a UTF-8 string. Some
     * "direct" commands (e.g. CAMERA_SWITCH 1035) carry a binary struct, not JSON.
     */
    sendRawLevel2Bytes(payload: Buffer, channel: number, outerCmd?: number, signCode?: number): boolean;
    /**
     * The level-1 twin of {@link sendRawLevel2Bytes}: the plaintext `payload` sealed AES-128-ECB under the
     * level-1 key, signCode 1 — the seal of the level-1 media start. Returns `false` when not connected.
     */
    sendRawLevel1Bytes(payload: Buffer, channel: number, outerCmd: number): boolean;
    /**
     * Stop the realtime media stream (`CMD_STOP_REALTIME_MEDIA`, 1004) on a camera `channel`, in the shape
     * its runtime topology takes, as {@link startLiveMedia} selects its start:
     *  - `homeBaseAttached`: `CMD_SET_PAYLOAD` (1350) wrapping `{cmd:1004, mChannel:channel}` at level-2.
     *  - own-session at level-2: the direct 1004 frame whose entire plaintext is the camera channel as a
     *    `uint32`, the same 4-byte body as the attached talkback frames. The app sends this frame on closing
     *    an own-session camera's live view; the camera stops streaming on it within a second, and keeps
     *    streaming through the 1350-wrapped form.
     *  - own-session on a session that {@link sendsInTheClear}: the same 4-byte body unencrypted, signCode 0,
     *    header bytes from {@link nextClearCommandBytes}.
     *  - without a level-2 key: the bare 1004 command.
     */
    stopLiveMedia(channel?: number, accountId?: string, homeBaseAttached?: boolean): void;
    /**
     * Open the device's talkback (host→device audio) path on a camera `channel`, after which
     * {@link sendAudioFrame} is accepted until {@link stopTalkback}. Two protocols, selected by runtime
     * topology exactly as {@link startLiveMedia} selects its own:
     *  - `homeBaseAttached`: the direct `CMD_START_TALKBACK` (1005) frame at level-2, whose entire
     *    plaintext is the camera channel as a `uint32` — a 4-byte body, no envelope and no account id.
     *  - own-session: `CMD_CONTROL_PAYLOAD` (1700) wrapping `{commandType:1001, data:{transaction}}`,
     *    where `transaction` is a millisecond clock the device only echoes.
     *
     * Returns `false` when the HomeBase path is asked for without a negotiated level-2 key. The device
     * replies with the generic 132-byte acknowledgement rather than a talkback-specific result, and the
     * app does not gate its audio on it, so this is fire-and-forget like the other control sends.
     */
    startTalkback(channel?: number, homeBaseAttached?: boolean): boolean;
    /** Close the talkback path opened by {@link startTalkback} — the `1006` / inner-`1002` counterpart. */
    stopTalkback(channel?: number, homeBaseAttached?: boolean): boolean;
    /**
     * The one place the talkback start/stop frame is built, so the topology branch is stated once.
     * The own-session path picks its encryption from the session key rather than from topology — a
     * standalone camera that negotiated a level-2 key sends GCM, one that never did sends ECB — which
     * is the same rule `sendStartLiveOwnSession` follows.
     */
    private sendTalkbackControl;
    /**
     * Push one **whole ADTS AAC frame** toward the device as `CMD_AUDIO_FRAME` (1301) on the video
     * data-type channel, plaintext (signCode 0) in both topologies — the audio itself is never
     * encrypted, only the start/stop control frames are. The 16-byte header the device expects ahead of
     * the payload is `[uint32 frameLength][uint32 channel][8 zero bytes]`, where `frameLength` repeats
     * the ADTS header's own length field. The trailing 8 bytes were zero across all 418 frames of the
     * 2026-07-31 capture, on three cameras spanning both topologies — the app never populates them.
     *
     * The frames ride their own sequence counter, independent of the control channel's, starting at 0
     * for the session. Fire-and-forget: the device acknowledges the datagram, not the audio.
     */
    sendAudioFrame(channel: number, frame: Buffer): void;
    /**
     * How many audio frames are awaiting acknowledgement — a health signal, NOT a gate. Pacing must
     * stay at the frame rate no matter how many are outstanding: the device plays a continuous stream,
     * so slowing the feed to wait for acknowledgements starves it faster than any loss does.
     */
    get audioInFlight(): number;
    /**
     * Resend audio frames the device has not acknowledged in time, and abandon the ones it never will.
     * Runs only while frames are outstanding.
     *
     * A frame that exhausts {@link AUDIO_MAX_SENDS} emits `audioGap` with its sequence number as it is
     * dropped. The audio channel is ordered, so that hole can stall everything queued behind it; without
     * the event nothing observes it — the map stays bounded because the entry is evicted, so the
     * in-flight count reads healthy while the speaker has gone quiet.
     */
    private armAudioRetransmit;
    /**
     * One retransmission sweep over an acknowledged channel's retained datagrams: resend those past
     * `retransmitMs` byte-identically, abandon those the caller reports spent, and answer whether any datagram
     * is still outstanding — a caller stops its ticker once nothing is.
     *
     * Both acknowledged directions — outbound audio and the own-session live start — repeat on these terms, so
     * the sweep has one implementation. What "spent" means is the caller's, because the two are bounded by
     * different things: audio by a send count, since repeating it more amplifies the loss it is repairing; a
     * live start by elapsed time, since the sends it needs are however many its acknowledgement latency
     * demands. Datagrams are only ever retained by a send, and a send needs a connect address, so the
     * no-address case has nothing retained to sweep and simply reports idle.
     */
    private retransmitUnacked;
    /**
     * Clear acknowledged live starts and audio frames. The device's acknowledgement lists the sequence numbers it has
     * taken on a given data-type channel: `[dataTypeHeader:2][count:2 BE][seq:2 BE]×count`.
     *
     * DATA acknowledgements release retained own-session starts. The video data-type acknowledgements release
     * outbound talkback frames, whose ordered channel stalls on a gap.
     */
    private onAck;
    /**
     * Send a CMD_SET_PAYLOAD(1350) wrapping `{account_id, cmd:<subCmd>, mChannel, mValue3:<subCmd>,
     * payload}`, encrypted level-2 (AES-256-GCM, signCode 8) — the app's media-control path. The
     * camera is selected by `mChannel` (= the device's `device_channel`) AND the frame-header channel.
     */
    private sendMediaPayloadLevel2;
    /**
     * Decode a `CMD_VIDEO_FRAME` (1300) payload into clean Annex-B H.264 (the 22-byte frame header
     * stripped). Reversed from the V6 app + live H.264 captures: the 22-byte header is
     * `[0:4]len [4]keyframe [5]streamType [6:8]seq [8:10]fps [10:12]W [12:14]H [14:20]ts`. When the
     * frame is encrypted (`signCode > 0` and len ≥ 128) the bytes `[22:150]` are the RSA-wrapped AES
     * media key (decrypt with our private key, PKCS#1 v1.5 → AES key) and the video starts at offset
     * 151 with its **first 128 bytes AES-ECB(NoPadding)-encrypted**; the rest is cleartext. Plaintext
     * frames are just `[22 : 22+len]`. Returns undefined if the RSA key is missing/undecryptable.
     */
    decodeVideoFrame(data: Buffer, signCode: number): Buffer | undefined;
    /**
     * Unwrap the RSA-wrapped AES media key from a keyframe. Standard PKCS#1 v1.5 — decrypt with
     * `RSA_PKCS1_PADDING`. This needs Node ≥24.5 (OpenSSL 3.5.1), which re-enabled PKCS1 `privateDecrypt`
     * after the intermediate OpenSSL (3.2–3.4) disabled it as a Marvin/CVE-2023-46809 mitigation — hence
     * the pinned engine. Verified live: the strict path unwraps the 16-byte key on real E2E cameras
     * (T8171 2560×1440, T8210 640×480). Returns `undefined` on failure (frame is skipped).
     */
    private rsaUnwrapKey;
    /**
     * The RSA-1024 public-key modulus (128-byte hex) the station uses to wrap the per-stream media
     * key. Lazily generates a keypair; `rsaPrivateKey` decrypts the media key the station returns.
     */
    private rsaModulus;
    /**
     * Encrypt a level-2 command body (signCode 8): `tag(16) ‖ nonce(12) ‖ seq(4) ‖ ciphertext`,
     * AES-256-GCM under the negotiated session key, AAD "eufy security". Inverse of `decryptLevel2`.
     * The 4-byte sub-header is cleartext (skipped on decrypt); `seq` counts up from {@link LEVEL2_SEQ_BASE}.
     */
    private encryptLevel2;
    /** Send a no-arg command frame (e.g. CMD_GATEWAYINFO) on a channel (default: the station channel). */
    private sendCommand;
    /**
     * Request a stored image (event thumbnail / cover) over P2P. Sends a
     * `CMD_SET_PAYLOAD` wrapping `{cmd: CMD_DATABASE_IMAGE, payload:[{file}]}` — the
     * station replies with a `CMD_DATABASE_IMAGE` frame that this session decodes and
     * emits as an `image` event `{ file, data }` (P2P images come back as plain JPEG,
     * no v1/v2 obfuscation). `filePath` is the on-station path from a push payload
     * (`pic_filepath`/`file_path`/`cover_path`). `accountId` is the admin user id when
     * known (some firmware ignores it). NOTE: needs live-device validation — the
     * control-command send path is exercised here for the first time.
     */
    requestImage(filePath: string, opts?: {
        accountId?: string;
        channel?: number;
    }): void;
    /**
     * Query an on-station database table over P2P (edge-AI face DB, event records, …).
     * Sends `CMD_SET_PAYLOAD{cmd:CMD_DATABASE, payload:{cmd:DB_QUERY.FULL_TABLE, table}}`.
     * The HomeBase streams back `CMD_DATABASE` (1306) frames `{cmd:10000,count,data:[…]}`,
     * level-1-encrypted — decoded and emitted as `dbChunk` (decrypted text) per frame.
     * Tables: `familiar_faces`, `person_basic_info`, `event_person_list`, `history_record_info`.
     *
     * Throws while a {@link readDatabase} is accumulating: every table answers `{data:[…]}` and the
     * frames tie no chunk to its request, so a second query's reply would be assembled into the first
     * one's buffer and answered as its rows.
     */
    queryDatabase(table: string, opts?: {
        accountId?: string;
        channel?: number;
        query?: Record<string, unknown>;
        innerCmd?: number;
    }): void;
    /**
     * Standard "give me the whole table" query params the eufy app uses for a direct
     * `CMD_DATABASE` read (inner `cmd 10000`). `count` bounds the row count.
     */
    private fullTableQuery;
    /**
     * Request the on-device edge-AI **face roster** over P2P — the phone-free path.
     *
     * NOT a dedicated face command (the `1194`/`1195` path never responds on a HomeBase). The
     * app reads the DB directly: a `CMD_DATABASE` (1306) query of `person_basic_info` with inner
     * `cmd 10000` on `mChannel 255`. The HomeBase replies with the level-1 `CMD_DATABASE` response
     * (reassembled by `onData`, surfaced via `dbChunk`) listing every person: `{person_id, name,
     * relation, group_id, …}` — `stranger\d+` names are auto-assigned (unfamiliar). ~10 KB.
     * Verified live against the app's own decrypted request. `account_id` must be the station
     * `admin_user_id` (a wrong/absent id or a camera session answers result `-104`).
     */
    requestFaces(opts?: {
        accountId?: string;
        channel?: number;
    }): void;
    /**
     * Read a date-ranged page of `history_record_info` from the station. The reply's `data` array groups
     * recording rows with companion tables; each group retains its `table_name` and `payload`.
     * `startTime` is `"0"` for the newest page or the oldest row's `yyyyMMddHHmmss` cursor for older rows.
     */
    queryRecordPage(opts: {
        accountId?: string;
        startDate: string;
        endDate: string;
        startTime?: string;
        count?: number;
    }): Promise<unknown[]>;
    /**
     * Query one on-station table and answer its rows, once the reply is whole.
     *
     * The request half of {@link queryDatabase} with its reply assembled: `CMD_DATABASE` arrives as
     * several frames whose decrypted text is a fragment of one document, so the fragments are
     * accumulated here and scanned after each one. Answers that document's `data` rows. Rejects when
     * `signal` aborts, and when `timeoutMs` (default {@link DB_TABLE_TIMEOUT_MS}) elapses with no
     * complete reply, and when the station answers a non-zero `mIntRet`.
     *
     * One read at a time per session: while one is accumulating, every {@link queryDatabase} on the
     * session throws, so a second reply cannot land in this buffer.
     */
    readDatabase(table: string, opts?: {
        accountId?: string;
        innerCmd?: number;
        query?: Record<string, unknown>;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<unknown[]>;
    /** Whether a {@link readDatabase} is accumulating; see {@link queryDatabase} for what it bars. */
    private dbReadInFlight;
    /**
     * Request the **face feature rows** over P2P (`face_feature_info`, inner `cmd 10000`). Each row
     * carries `{person_id, face_name, face_id, face_picture_content, face_feature_file_path}` — where
     * `face_picture_content` is the on-station **path** to that person's enrolled face JPEG (fetch it
     * with `requestImage()` → plain JPEG via the `image` event). Surfaced via `dbChunk`.
     */
    requestFaceFeatures(opts?: {
        accountId?: string;
        channel?: number;
    }): void;
    /**
     * Low-level: send a `CMD_SET_PAYLOAD` (1350) wrapping `{account_id, cmd:<subCmd>, mChannel,
     * payload, transaction}` over the level-1 channel. The reply arrives as a `NOTIFY_PAYLOAD`
     * (1351) frame (level-1 decrypted, surfaced via the `data` event / `frame.json`).
     *
     * `opts.key` makes it a keyed envelope: the sealed per-command key rides ahead of the other fields
     * as the value's `key`, and the value goes out unencrypted, encryption-type 0, with `=` written
     * `=` — the form the vendor app sends one in, and the one form the device reads it in.
     */
    sendSetPayload(subCmd: number, payload?: unknown, opts?: {
        accountId?: string;
        channel?: number;
        omitPayload?: boolean;
        wrapCmd?: number;
        rawValue?: Record<string, unknown>;
        key?: string;
    }): void;
    /**
     * Request the on-device edge-AI face roster over P2P. `COMMAND_GET_LOCAL_FACES` (1194) =
     * familiar/enrolled people; `COMMAND_GET_LOCAL_CANDIDATE_FACES` (1195) = strangers. The
     * HomeBase replies with a `NOTIFY_PAYLOAD` (1351) frame carrying the JSON roster (reassembled
     * + level-1 decrypted; listen on the `data` event for commandId 1351).
     */
    requestLocalFaces(opts?: {
        candidate?: boolean;
        accountId?: string;
        channel?: number;
    }): void;
    /**
     * Acknowledge and reassemble one DATA datagram, sequenced independently per data type.
     *
     * The device numbers each data type's datagrams in its own 16-bit space and repeats what it thinks was
     * lost. A repeat of something already delivered is acknowledged, then ignored. Distance is measured
     * modulo the sequence space and read as backwards beyond {@link SEQUENCE_LOOKBACK}, which is what lets the
     * numbering wrap without the next datagram looking like a jump of nearly a full space.
     *
     * A datagram numbered further back than {@link STALE_RETRANSMIT_DEPTH} is not a repeat the device could
     * still be making: the numbering itself has restarted, which a device does when it begins a fresh stream
     * on a connection that is already up. That resynchronizes — the high-water mark moves to the restarted
     * numbering and the half-assembled frame goes — because ignoring it would freeze the mark, and every
     * datagram of the new numbering would then be read as behind it too, for as long as it took to climb back.
     *
     * A forward gap means a datagram has not arrived YET, which is not the same as lost. The device repeats
     * unacknowledged datagrams, so successors are held for a bounded wait and delivered strictly in sequence
     * if the missing one arrives. A logical frame's payload spans datagrams that carry no header of their
     * own, so reassembling around a hole is impossible; waiting for it is what keeps the frame whole.
     *
     * Only once the data type's reorder wait passes, or {@link REORDER_MAX_DATAGRAMS} pile up, is the datagram
     * treated as lost: a pending frame is discarded and delivery resumes from the earliest held datagram.
     */
    private onData;
    /** Hold a datagram that arrived past a hole, and arm the wait for the missing one to be repeated. */
    private holdForRetransmit;
    /** Start a full wait for the current hole, leaving an existing wait undisturbed. */
    private armReorderTimer;
    /** Deliver held datagrams that now follow directly on from the last one delivered. */
    private drainReorder;
    /**
     * The missing datagram was not repeated in time: report the gap, drop the frame it belonged to, and
     * resume from the earliest datagram still held so the stream keeps moving.
     */
    private abandonHole;
    private clearReorderTimer;
    /**
     * Reassemble one in-sequence datagram body into logical frames.
     *
     * Frames are packed back to back, so a frame header can itself be cut by a datagram boundary. The start
     * of a header left at the end of a datagram is carried into the next one rather than discarded; dropping
     * it would lose that frame and every frame after it until a datagram happened to begin on a header.
     * Payload fragments retain their original slices and are copied once, when the complete frame is delivered.
     */
    private reassemble;
    /**
     * Forget where each data type's sequence numbering had reached, and drop any half-reassembled frame.
     *
     * A device numbers datagrams per connection and starts over on the next one, so carrying the previous
     * connection's high-water mark across would make the new connection's first datagrams look like
     * retransmissions from behind and drop them all. Half a frame from a connection that is gone can never be
     * completed either.
     */
    private resetInboundSequencing;
    private ackTypeHeader;
    private handleFrame;
    private send;
    /** Finish the END send on the current socket before closing it; send completion is not a peer ACK. */
    close(): Promise<void>;
}
