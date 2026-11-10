import { type SessionEntry } from "../../core/crypto.js";
import { type SessionStore } from "../../core/store.js";
import { type Logger } from "../../core/logger.js";
import type { SecureMqttCredentials } from "../mqtt/secure-mqtt.js";
export type RegionShard = "eu-pr" | "us-pr";
/**
 * Construction options for the internal HTTP client.
 * @internal
 */
export interface MegaClientConfig {
    email: string;
    password: string;
    /** Two-letter account country code (e.g. "GB", "US", "DE"). Routes the region. */
    countryCode?: string;
    /** Force a region shard, skipping estimate_domain. */
    region?: RegionShard;
    appName?: string;
    appVersion?: string;
    /**
     * Phone model reported to the cloud as this install's device. Defaults to a realistic, RANDOM model
     * (see {@link randomPhoneModel}) seeded by `openudid` so it is stable across runs — this keeps many
     * SDK installs from all reporting one identical model. An explicit value pins a fixed identity.
     */
    phoneModel?: string;
    /** OS version string reported in headers. */
    osVersion?: string;
    /** Stable per-install device id (the auth token binds to it). Derived from email if absent. */
    openudid?: string;
    /**
     * `user-agent` sent on the push-media download path (`downloadMedia`/`downloadImage`). Defaults to a
     * realistic Android string consistent with `phoneModel` and seeded by `openudid` (stable across runs);
     * an explicit value pins a fixed one. Not the account identity — that's `phoneModel`.
     */
    mediaUserAgent?: string;
    /**
     * Acting name written into the commands that carry an actor field — guard mode and HomeBase alarm
     * output (`user_name`), a lock's acting username. Trimmed, and blank counts as unset: the default
     * is the login email's local-part (the whole string when it has no `@`). Attribution only — the
     * device stores it for its own activity record, and no captured frame shows it being validated
     * against the account.
     */
    accountName?: string;
    /** Persist + reuse the session (token + session key) across runs. Default: in-memory. */
    store?: SessionStore;
    /** Diagnostics sink. Omit for silence; pass a `Logger` (or `new ConsoleLogger()`) to see logs. */
    logger?: Logger;
}
/**
 * A mega API call the server answered with a non-zero envelope code, carrying that code rather than only a
 * message.
 *
 * The retry/auth logic here already decides what to do by NUMBER (4416, 10000, 4404, 26084), so the number is
 * the authoritative fact about which condition was hit. Formatting it into a message and throwing a bare
 * `Error` left every caller that needs to tell one condition from another parsing this module's message
 * format back apart — a decision that belongs to the layer that owns the wire, not to whoever reads it.
 */
export declare class MegaApiError extends Error {
    /** The envelope's `code`, or undefined when the failure produced no envelope. */
    readonly code: number | undefined;
    /** The HTTP status the envelope arrived with. */
    readonly status: number | undefined;
    constructor(message: string, 
    /** The envelope's `code`, or undefined when the failure produced no envelope. */
    code: number | undefined, 
    /** The HTTP status the envelope arrived with. */
    status: number | undefined);
}
/**
 * `get_device_param_list` refuses a shared or member account: only the device's owner may read it. The
 * refusal is permanent for the life of that account's session, so a retry cannot change it — the
 * device-list params carry the same `{param_type, param_value, update_time}` and are not owner-gated.
 */
export declare const OWNER_ONLY_CODE = 20004;
/**
 * Thrown when a persisted/expired session is rejected (401). Re-login to recover.
 *
 * It carries the rate the client has already worked out for replacing a rejected token, because the
 * rejection is where that rate stops being the client's alone: a login driven from here spends the same
 * session the client's own recovery would have, and repeated logins are what makes an account start
 * demanding captchas. {@link retryAfterMs} is how long the next replacement is barred for, and
 * {@link contended} whether this rejection landed inside that bar — the shape repeated displacement has.
 */
export declare class SessionExpiredError extends Error {
    /**
     * How long the next session replacement is barred for, in milliseconds; `0` when nothing bars one now.
     *
     * The remainder of the client's own hold-off, which doubles per consecutive replacement and is capped —
     * and which every replacement extends, whether the client spent it or a login made on this error did.
     */
    readonly retryAfterMs: number;
    /**
     * Whether this rejection landed inside that bar — a token replaced recently and rejected again since.
     *
     * That is the shape displacement by another client signed in on this account has, where replacing the
     * token again only trades one login for another. It is not proof of one, since a cloud refusing to
     * re-issue the session looks the same.
     */
    readonly contended: boolean;
    constructor(message: string, opts?: {
        retryAfterMs?: number;
        contended?: boolean;
    });
}
/**
 * eufy cloud gateway error codes — the numeric `code` carried in a response envelope alongside the
 * HTTP status.
 *
 * PROVENANCE — backend-only. These numbers are NOT hardcoded anywhere in the app: verified absent from
 * the v6 APK's Java sources, resources, every native `.so` (including the Flutter `libapp.so`) and the
 * Hermes bundles. The app reacts to the *condition* via generic logout handling + user-facing strings
 * (e.g. `account_login_log_out_notice` — "logged in on another device"), not by matching the code. So a
 * code here is known only from an observed live response; add new ones the same way.
 *
 * Internal: these are gateway mechanics, not a surface a host acts on — the transport already turns the
 * conditions that matter into a typed outcome (`SessionExpiredError`, `LoginStatus.Captcha`). Exported
 * only so the transport's own specs can name a code instead of repeating the number.
 * @internal
 */
export declare const EufyCloudErrorCode: {
    /**
     * Session kicked out — the account logged in on another device (eufy enforces ~one active session
     * per account). Arrives as HTTP 401 with this `code`; the human message wording varies across
     * endpoints ("...kicked out", "token error", ...), which is why the classifier keys off this code
     * and only falls back to message parsing.
     */
    readonly SESSION_KICKED: 26084;
    /**
     * "get identity error" (usually HTTP 463) — the gateway no longer knows our `x-key-ident`; the ECDH
     * session key was rotated/expired server-side (common after a restored session sits idle for days).
     * The auth token may still be fine, so this triggers a one-shot key re-exchange before the request
     * is treated as a dead session.
     */
    readonly IDENTITY_KEY_STALE: 4404;
    /** Signature invalid — the wrong per-host `content-type` was tried; expected during the content-type
     *  probe and retried on the alternate type (not a real failure). */
    readonly SIGNATURE_INVALID: 4416;
    /** Generic gateway "try again" seen during the same content-type probe; retried, not surfaced. */
    readonly PROBE_RETRY: 10000;
    /** Captcha required before login can proceed — fetch a challenge and solve it. */
    readonly CAPTCHA_REQUIRED: 100032;
    /** Captcha answer was wrong — fetch a fresh challenge and re-solve. */
    readonly CAPTCHA_WRONG: 100033;
};
/**
 * Any one of the gateway error codes above.
 * @internal
 */
export type EufyCloudErrorCode = (typeof EufyCloudErrorCode)[keyof typeof EufyCloudErrorCode];
/**
 * The raw login reply shape — internal; a host reads the `LoginResult` union.
 * @internal
 */
export interface MegaLoginResult {
    userId: string;
    authToken: string;
    geoKey?: string;
    raw: Record<string, unknown>;
}
/**
 * The status discriminant of a {@link LoginResult}. Compare `result.status` against these constants
 * (e.g. `if (r.status === LoginStatus.Captcha)`).
 */
export declare const LoginStatus: {
    /** Authenticated — `result.session` carries the token. */
    readonly Ok: "ok";
    /** Solve `result.image` and call `solveCaptcha(answer)`. */
    readonly Captcha: "captcha";
    /** A code was sent; call `submitVerifyCode(code)`. */
    readonly TwoFactor: "2fa";
};
export type LoginStatus = (typeof LoginStatus)[keyof typeof LoginStatus];
/**
 * Outcome of `login` / continuation steps — a discriminated union so the
 * caller switches on `status` instead of catching thrown errors for the expected captcha/2FA flow.
 * Compare `status` against {@link LoginStatus}:
 *  - `Ok` — authenticated; `session` carries the token.
 *  - `Captcha` — solve `image` (a `data:image/png;base64` 4-char challenge) and call
 *    `solveCaptcha(answer)`. `retry` is true when a prior answer was wrong.
 *  - `TwoFactor` — a code was sent (`method` says how); call `submitVerifyCode(code)`.
 * The `captchaId` / pending-2FA token are held internally, so continuation methods take only the
 * user-supplied answer/code.
 */
export type LoginResult = {
    status: typeof LoginStatus.Ok;
    session: MegaLoginResult;
} | {
    status: typeof LoginStatus.Captcha;
    image: string;
    retry: boolean;
} | {
    status: typeof LoginStatus.TwoFactor;
    method: string;
};
/**
 * {@link MegaHttpClient.postSigned}'s bookkeeping for the two recoveries it performs on itself, so each is
 * attempted once per call rather than once per rejection.
 * @internal
 */
export interface SignedRetry {
    /** The session key has already been re-exchanged for this call. */
    identity?: boolean;
    /** The token has already been replaced by a fresh login for this call. */
    reauth?: boolean;
}
/**
 * The cloud HTTP client. Internal transport, reachable as an escape hatch via `EufyMega.api`.
 * @internal
 */
export declare class MegaHttpClient {
    private readonly cfg;
    private region;
    /** The host `estimate_domain` answered, persisted with the session. */
    private estimatedDomain;
    private bootstrapDomain?;
    private sessionKey?;
    /** Per-host ECDH session keys for non-mega gateways (e.g. eufylife) keyed by host. */
    private readonly sessionKeys;
    /** The in-flight key exchanges, by host and the token they carry — see {@link ensureSessionKey}. */
    private readonly keyExchanges;
    /**
     * The held credential. `userId` is the login reply's `ap_cloud_user_id` where it has one — the Anker
     * Passport cloud's id — while `accountUserId` is the eufy account's own `user_id`.
     *
     * The `gtoken` header is hashed from `accountUserId`: that is the id the gateway recomputes the header
     * from, rejecting a disagreement with `"gtoken not equal userid error"`.
     */
    private auth_?;
    /** captcha_id of an in-flight challenge, held between login() and solveCaptcha(). */
    private pendingCaptchaId?;
    /** True while a 2FA code is outstanding: `auth_` holds only the limited pre-verify token, so the
     *  restored-session short-circuit must NOT treat it as a usable session. Cleared on Ok/reset. */
    private pending2fa;
    /** An autonomous re-login answered captcha/2FA; see {@link canReauthenticate}. */
    private reloginChallenged;
    private tokenExpiresAt;
    /**
     * Stable per-install device id: `openudid` as configured, as restored from the session store, or as
     * derived from the ACCOUNT when neither supplied one — two clients that configure none therefore
     * share it, and are one install as far as everything keyed on this is concerned.
     *
     * Two things are keyed on it, and both fail the same way when it is shared: the auth token is bound
     * to it, so each login displaces the other's session, and the secure-MQTT client id is built from it,
     * so each connection evicts the other's channel.
     */
    readonly openudid: string;
    /** The device model reported to the cloud (explicit `phoneModel`, else a stable random one). */
    private readonly phoneModel;
    /** The `user-agent` for the media-download path (explicit `mediaUserAgent`, else derived from the model). */
    private readonly mediaUserAgent;
    private readonly store;
    private readonly logger;
    /** Remembered working Content-Type per host (the gateway is picky + inconsistent). */
    private readonly contentTypeByHost;
    /** True while a `/passport/login` round trip is in flight — see {@link canReauthenticate}. */
    private loggingIn;
    /** The one in-flight re-login every call rejected on the same dead token waits on. */
    private reauthAttempt?;
    /** Replacements since the held session last proved stable, and when the last one ran — see {@link holdOffRemainingMs}. */
    private recoveries;
    private lastRecoveryAt;
    /** A token of ours has been rejected and not yet replaced — see {@link noteTokenReplacement}. */
    private rejectedTokenPending;
    constructor(cfg: MegaClientConfig);
    /**
     * Install the session the store holds, if it holds a usable one: the token + its bound ECDH key, skipping
     * estimate/key-exchange/login/2FA entirely. Answers the token adopted, or `undefined`. A session logged in
     * with a country other than the configured one is not usable: its shard is the other country's.
     *
     * Read at construction, and again when a rejection is being recovered from — a store SHARED with another
     * client may already hold the session that client obtained, which is cheaper to adopt than to compete with.
     * An adopted session is a complete one, so it ends any 2FA or challenged re-login this client was left with.
     *
     * Note: the device identity (openudid + phone model + media UA) is NOT restored here — it is resolved once
     * in the constructor, where an explicit config wins over the stored value, and must not be re-derived from a
     * session this may adopt from a shared store during recovery.
     */
    private hydrateFromStore;
    get auth(): {
        userId: string;
        authToken: string;
    } | undefined;
    /** The active region shard (e.g. `"eu-pr"`, `"us-pr"`), set after {@link login} or a region override. */
    get regionShard(): RegionShard;
    /**
     * The shard the RTC signalling signs on: the regional prefix of the estimated domain
     * (`…-ie-…`/`…-ie.` → `ie-pr`), else {@link regionShard}. The eu/us classification cannot name shards
     * like `ie-pr`, whose accounts need the IE sign host and cluster.
     */
    get rtcShard(): string;
    /**
     * The credentials the RTC signalling needs; `undefined` while logged out. The sign is refused
     * ("gtoken not equal userid") unless its gtoken is the one every authed HTTP call carries.
     */
    rtcIdentity(): {
        authToken: string;
        userId: string;
        gtoken: string;
    } | undefined;
    /**
     * The name commands attribute themselves to — {@link MegaClientConfig.accountName} when the config
     * pins one (trimmed; blank counts as unset), otherwise the logged-in account's display name, which
     * is the login email's local-part (e.g. `someone+tag` for `someone+tag@example.com`) and falls back
     * to the whole email if it has no `@`.
     *
     * The local-part is the string the app writes into the ff09 command's acting "username" field
     * (verified against a captured T8531 unlock frame), so it is the faithful default. An override is a
     * different LABEL for the same account, not a different identity: the session authenticates on the
     * token and the device record's member ids, neither of which this touches.
     */
    get accountName(): string;
    /**
     * Headers the gateway expects on every call. Note the deliberate
     * dash/underscore duplicates (os-type + os_type, app-version + app_version,
     * …) — the app sends both forms and the gateway reads a mix. `openudid` is
     * REQUIRED: the auth token is bound to it, so login + data calls must use the
     * same value or the gateway 401s with "secret or user_id is empty".
     */
    private baseHeaders;
    /**
     * The id `gtoken` is hashed from — the account's own `user_id`, which is what the gateway recomputes the
     * header from. One place so the two header paths cannot drift on which of the session's ids that is.
     *
     * Call only where `auth_` is already established; every header path guards it.
     */
    private gtokenUserId;
    /**
     * The account-credential headers every authed call carries — `x-auth-token` + `gtoken`.
     * One place so the signed path, the key-exchange and the bearer path can't drift on what "authed" means.
     */
    private authTokenHeaders;
    /**
     * POST returning an axios-shaped `{status, data}` — `data` is JSON-parsed when possible, else the
     * raw text. Never throws on HTTP status (the callers classify the envelope themselves). 20s timeout.
     */
    private httpPost;
    /** Step 1: discover the account's region shard (and the bootstrap host). */
    estimateDomain(): Promise<void>;
    /**
     * Step 2: ensure a key-exchange SessionEntry for the current region. ONE
     * exchange per region; the same shareKey + key-ident signs login AND every
     * data call. The gateway binds user_id to this key-ident when login succeeds,
     * so it MUST be reused (don't re-exchange after login).
     */
    ensureSessionKey(targetHost?: string): Promise<SessionEntry>;
    /** One key exchange against `host`, installed as that host's key. */
    private exchangeSessionKey;
    /**
     * Signed + encrypted POST. Content-type auto-falls-back (text/plain ↔ json).
     *
     * `retry` is this method's own bookkeeping across the two recoveries it performs on itself — a re-exchanged
     * session key, and a re-login — so each is attempted once per call. A caller leaves it out.
     */
    postSigned<T = unknown>(host: string, path: string, body?: unknown, authed?: boolean, retry?: SignedRetry, headerOverrides?: Record<string, string>): Promise<T>;
    /** Authed call to a mega service host: app-{service}-{region}.eufy.com. */
    post<T = unknown>(service: string, path: string, body?: unknown, headerOverrides?: Record<string, string>): Promise<T>;
    /**
     * Fetch the per-station DSK key used in the P2P cloud-lookup payload. Mirrors
     * the legacy `get_dsk_keys` body shape on the mega devicerelation service.
     * The P2P *local* lookup path does not need this; only the cloud path does.
     */
    getDskKeys(stationSns: string[], priorDsks?: Record<string, string>): Promise<Record<string, {
        dskKey: string;
        expiration: number;
    }>>;
    /**
     * Register an FCM push token with the eufy cloud so it pushes this account's
     * events (motion/doorbell/thumbnail) to us. v6 exposes this on the mega push
     * service; body mirrors the legacy `register_push_token` shape.
     */
    /**
     * Fetch the per-SKU **data-point (param) schema** from the mega `things` service. This is
     * the authoritative source for what each `param_type` means on a given product code — the
     * same call the v6 app uses, so its ids are guaranteed accepted by the mega API (unlike the
     * possibly-stale third-party catalogue). Works for ANY SKU code, not just owned devices.
     *
     * Body shape is `{ code: <SKU> }` (e.g. "T8210", "90C0"). Returns the raw response so callers
     * can adapt to the (not-yet-pinned) field layout.
     */
    getProductDataPoint<T = unknown>(code: string): Promise<T>;
    /**
     * Fetch the **live param list** from the mega `devicemanage` service. Body keys off a
     * `device_sns` ARRAY (a bare `device_sn` 400s with "type mismatch"). Each returned entry is
     * `{ param_type, param_value, update_time }` — VALUES ONLY, no name/meaning (the param→meaning
     * mapping is hardcoded in the app, never returned by the API).
     *
     * NOTE: this endpoint is **owner-gated** — a shared/member account gets {@link OWNER_ONLY_CODE}
     * (`"Only the owner can change settings"`), permanently. For those accounts use the `get_devs_list`
     * params instead, which also carry `{param_type, param_value, update_time}` and are not owner-gated.
     */
    getDeviceParamList<T = unknown>(deviceSn: string): Promise<T>;
    /**
     * Fetch the account's devices as the `devicerelation` service lists them, `{attribute: 7, house_id: ""}`.
     *
     * Each entry is `{device: {device_sn, dps, …}}`, and `dps` is the cloud's last-known value of every
     * data point that device has reported, keyed by DP number. Answered for an account a device is shared
     * with as well as for its owner. Sent with `category: eufy_home`, without which the service answers
     * `10000`.
     */
    getDeviceRelationList<T = unknown>(): Promise<T>;
    /**
     * Fetch one page of a device's **cleaning history** from the mega `clean` service.
     *
     * Body is `{ device_sn, num, page }` — `num` is the page SIZE and `page` is 1-based. Returns the raw
     * response so the caller owns the shape; `parseCleanRecords` in `model/` is what reads it.
     *
     * Each record carries a `download_url` to a binary detail blob. That blob is NOT fetched here: the
     * host it points at is unconfirmed, and this client's binary path (`downloadMediaResource`) is
     * host-allowlisted by design.
     */
    getCleanRecords<T = unknown>(deviceSn: string, num?: number, page?: number): Promise<T>;
    /**
     * Fetch one page of a device's stored **map data** from the mega `clean` service.
     *
     * Paginated by both `page` and a byte `last_offset`, because one map is larger than one response: the
     * answer carries `offset`, `last_offset`, `len`, `total` and `is_next_page`.
     *
     * Returns the raw response, `content` included. **The content is not decoded anywhere in this SDK and
     * deliberately so** — the decoder is the vendor's clean-native library, which is absent from the base
     * APK, and the extracted `.so` set contains no clean-native module. Handing over bytes a caller can
     * take elsewhere is the honest surface; a decode here would be invention.
     */
    getDeviceMapList<T = unknown>(deviceSn: string, channelId?: number, num?: number, page?: number, lastOffset?: number): Promise<T>;
    /**
     * Fetch the stored map content for several channels of one device in a single call.
     *
     * The batch counterpart of {@link getDeviceMapList}, answering `content` keyed by channel id. Same
     * standing on the bytes: returned as they arrive, never decoded here.
     */
    getManyDeviceMapContent<T = unknown>(deviceSn: string, channelIds: readonly number[]): Promise<T>;
    /**
     * Generic authed signed POST to `app-{service}-{region}.eufy.com{path}` with an arbitrary body.
     * The typed wrappers above cover the known endpoints; this is the generic escape hatch for one that
     * has none yet — {@link fetchLightCatalog} drives the `things` service through it.
     */
    request<T = unknown>(service: string, path: string, body?: unknown): Promise<T>;
    /**
     * Fetch the per-user secure-MQTT credentials. Pass `appName` to request a specific capability scope
     * on the current session without re-logging in — security devices (locks/garage) need the
     * `eufy_security` scope, which the default scope can't reach.
     */
    getUserMqttInfo(appName?: string): Promise<SecureMqttCredentials>;
    registerPushToken(token: string): Promise<void>;
    /** Download raw bytes from a push-media URL using the active account session. */
    downloadMedia(url: string): Promise<Buffer>;
    /**
     * Download push image bytes and decrypt a recognized v1 wrapper when its device key input is available.
     *
     * A decoder throw is tagged `decode-failed`: to anything downstream, the difference between "the
     * bytes never arrived" and "the bytes arrived and the wrapper would not decrypt" is the difference
     * between a network problem and a key problem, and one of them is this SDK's to fix.
     */
    downloadImage(url: string, p2pDid?: string): Promise<Buffer>;
    /** The security-app data host for this region (face recognition, media, etc.). */
    private securityAppHost;
    /**
     * The device's long-lived P-256 public key, as the cloud publishes it for key-wrapped commands
     * (`type=2`): 64 bytes hex with no `04` prefix. A plain authed GET on the security-app host — the
     * one read here that is neither signed nor body-encrypted, matching how the app fetches it.
     * Cached per serial for the client's lifetime; the key does not rotate in normal operation.
     */
    getDevicePublicKey(deviceSn: string): Promise<string>;
    /** Per-serial cache for {@link getDevicePublicKey}. */
    private readonly devicePublicKeys;
    /**
     * Signed+encrypted POST to the security-app data host (face recognition, etc.).
     * Despite the different host, these endpoints use the SAME algo_ecdh pipeline as
     * the mega hosts (captured header set: `x-encryption-info: algo_ecdh` +
     * x-request-ts/once + ecdh-encrypted body) — NOT a plain JSON POST (that 403s).
     * So we reuse {@link postSigned}, which handles the key exchange, body encryption,
     * signature and response decryption.
     *
     * The `*.eufylife.com` gateway uses a SEPARATE ecdh key from the mega `*.eufy.com` gateway
     * (own bootstrap localKey `118c12c8…`, own `/v3/openapi/oauth/key/exchange` path, and data
     * calls want `Content-Type: text/plain`). {@link ensureSessionKey} keeps a PER-HOST key
     * for eufylife hosts and exchanges against the eufylife host, so `getFaces()`/`getCiphers()` work.
     * Note `getFaces` returns an empty roster for accounts whose faces live on the HomeBase — the P2P
     * database path carries the real roster.
     */
    securityAppPost<T = any>(path: string, body?: Record<string, unknown>): Promise<T>;
    /**
     * List the account's enrolled AI faces (the recognition roster). Each entry is keyed by `ai_user_id` —
     * the id an `IDENTITY_PERSON_DETECTION` push carries as `person_id` — so this is the lookup table for
     * naming a recognised person. Endpoint: `/v3/aiassis/get_faces` on the security-app host.
     *
     * Answers an empty roster for an account whose faces live on the HomeBase; that roster is read over
     * the P2P database path instead.
     */
    getFaces(opts?: {
        aiGroupId?: number;
        num?: number;
        page?: number;
    }): Promise<any>;
    /** Resolve specific AI face ids (e.g. a push `person_id`) → face records. */
    getFacesByIds(aiUserIds: number[]): Promise<any>;
    /**
     * Fetch E2E cipher material for a station's `cipher_id`(s). Returns
     * `[{ cipher_id, ecc_private_key, private_key }]` in cleartext (the algo_ecdh transport
     * is the only wrapping). The `ecc_private_key` is the root of trust for the P2P **level-2**
     * session key: `CMD_GATEWAYINFO(1100)` ships an ECIES envelope decrypted with it
     * (see `deriveLevel2KeyFromGatewayInfo` in `p2p/codec`). `userId` must be the station
     * `member.admin_user_id`. Endpoint: `/v3/app/cipher/get_ciphers` on the eufylife host.
     */
    getCiphers(cipherIds: number[], userId: string, stationSn: string): Promise<Array<{
        cipher_id: number;
        ecc_private_key?: string;
        private_key?: string;
    }>>;
    /** Build the /passport/login body (verify_code empty unless 2FA). */
    private loginBody;
    /** Fetch a fresh captcha challenge: { captchaId, image (data:image/png;base64) }. */
    generateCaptcha(): Promise<{
        captchaId: string;
        image: string;
    }>;
    /**
     * Trigger the 2FA verify code. POST app-push-{region}/app/sendmsg/verify_code
     * with biz_type 1004 (login 2FA). message_type 2 = email, 1 = SMS.
     * Requires the (limited) token from the first login attempt.
     */
    sendVerifyCode(messageType?: number): Promise<void>;
    /**
     * Begin (or resume) login. Returns a {@link LoginResult} discriminated union rather than throwing
     * for the expected captcha/2FA flow — the caller switches on `status`:
     *  - `ok` → authenticated.
     *  - `captcha` → show `image`, then {@link solveCaptcha}(answer).
     *  - `2fa` → a code was sent; {@link submitVerifyCode}(code).
     *
     * A restored session short-circuits to `ok` with no network, so `ok` there states that a session was
     * RESTORED, not that the cloud still honours it — `session.raw.restored` marks that case. Nothing is spent
     * proving it here: the first authenticated call is where the cloud says, and a token it rejects is replaced
     * by a fresh login and the call retried, without the caller seeing anything (see {@link postSigned}). What
     * reaches the caller, as {@link SessionExpiredError}, is a replacement this client cannot complete by
     * itself — one needing a captcha or a 2FA code, one with no credentials to use, one attempted while a login
     * is already part-way through, or a login that failed outright.
     *
     * `messageType` picks the 2FA channel (2 = email, 1 = SMS) for the code that gets sent when 2FA is required.
     */
    login(opts?: {
        messageType?: number;
    }): Promise<LoginResult>;
    /**
     * Whether the session this call was made against has already been replaced.
     *
     * A rejection can arrive after another call's recovery has finished — the request was in flight with the old
     * token, and the answer to it is late news. Such a call needs no recovery of its own, and must not clear the
     * session: doing so discards the token that was just obtained and logs the client out while it is being
     * fixed.
     */
    private sessionReplacedSince;
    /**
     * Deal with a rejection that means the token is finished; answers what the caller may do about it.
     *
     * The cheap answers first. A session already replaced by another call's recovery just needs using, and a
     * recovery already in flight is JOINED rather than duplicated — a device-list refresh fires several calls at
     * once, and each starting its own login would spend N of them to learn one thing. A store SHARED with
     * another client may already hold that client's token, which is both cheaper than a login and the difference
     * between adopting a working session and destroying it.
     *
     * Only then is a login spent, and its rate is bounded — see {@link recoveryDue}. Dropping the dead session
     * first is what keeps the login state machine from short-circuiting on it.
     */
    private recoverRejectedSession;
    /**
     * Whether a token may be replaced now, given how recently the last one was.
     *
     * A client's device identity defaults to one derived from its credentials, so two clients on one account look
     * like the same device — and the cloud keeps one session per device. Each finds its token rejected, replaces
     * it, and evicts the other: an unbounded login war, silent, and repeated logins are exactly what makes an
     * account start demanding captchas. The first replacement is immediate, because a token displaced once is
     * the ordinary case; a second one soon after has the shape of contention rather than expiry, so the wait grows
     * and a caller is told what was seen instead of being served a fight.
     */
    private recoveryDue;
    /**
     * How much longer a token replacement must wait, in milliseconds; `0` when one may run now.
     *
     * The wait doubles per consecutive replacement and is capped, and it is what {@link recoveryDue} gates
     * this client's own recovery on — and what {@link SessionExpiredError.retryAfterMs} hands a host that
     * drives its own. One function so the two cannot disagree about the rate, which they would have to for
     * a host to be told it may retry while this client is still holding off.
     */
    private holdOffRemainingMs;
    /**
     * Count one token replacement against the hold-off, and clear the rejection it answered.
     *
     * Every replacement passes through here, wherever it was spent from: {@link recoverRejectedSession}, and
     * a {@link login} that follows a rejection this client surfaced. A hold-off that counted only its own
     * would be no bound at all — the wait would sit at its first value however many sessions had been spent,
     * and {@link SessionExpiredError.retryAfterMs} would report a minute while logins ran every few seconds.
     * Which of the two counted a given replacement is the flag: the recovery path clears it before logging
     * in, so the login cannot count the same one again.
     */
    private noteTokenReplacement;
    /**
     * Note that the held session is working. A replacement that keeps serving calls for long enough is not
     * contention, so the hold-off is forgotten and the next genuine expiry recovers immediately.
     */
    private noteSessionWorking;
    /**
     * Whether a rejected token is worth trying to replace without asking the host anything.
     *
     * Structural rather than a list of paths: a login round trip is itself an authenticated call while a limited
     * token is held, so re-logging in from inside one would recurse — and a path list would have to be
     * maintained alongside every request the login flow makes. A 2FA code already outstanding is a login a human
     * is part-way through, and restarting it silently would discard it. A re-login that already came back needing
     * a captcha or a 2FA code would need the same again, and each attempt sends the account another code, so
     * none is tried until a login completes or a stored session is adopted. No credentials means nothing to try,
     * so the rejection surfaces instead.
     */
    private canReauthenticate;
    /**
     * Replace a rejected token by running the login state machine again, at most once at a time.
     *
     * Answers whether a usable session was obtained; a login that needs a captcha or a 2FA code answers `false`,
     * because neither can be satisfied from here — the caller then surfaces the rejection so the host can drive
     * the flow it owns. A login that fails outright answers `false` too, with the reason logged.
     *
     * One attempt is SHARED by every call that was in flight against the dead token. A device-list refresh fires
     * several at once, and each starting its own login would spend N of them to learn one thing — worse, on an
     * account that limits concurrent sessions, each login displaces the token the previous one just obtained.
     */
    private reauthenticate;
    /**
     * Continue a login that returned `{status:"captcha"}` — submit the human's answer to the pending
     * challenge. Returns the next {@link LoginResult} (`ok`, another `captcha` if wrong, or `2fa`).
     */
    solveCaptcha(answer: string, opts?: {
        messageType?: number;
    }): Promise<LoginResult>;
    /**
     * Continue a login that returned `{status:"2fa"}` — submit the verify code that was sent. Returns
     * the next {@link LoginResult} (normally `ok`).
     */
    submitVerifyCode(code: string): Promise<LoginResult>;
    /**
     * One `/passport/login` round-trip + outcome classification. Shared by {@link login} /
     * {@link solveCaptcha} / {@link submitVerifyCode}; the caller-facing methods only build the body.
     */
    private attemptLogin;
    /** The round trip itself. Wrapped by {@link attemptLogin}, which marks it in flight. */
    private loginRoundTrip;
    /** Save the current token + session key for reuse across runs. */
    private persist;
    /** Forget the persisted session (e.g. after the token is rejected). */
    clearSession(): void;
    /** True if a usable (restored or fresh) session is held. */
    get loggedIn(): boolean;
}
