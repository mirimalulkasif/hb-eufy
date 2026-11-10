import { type TuyaSigner } from "./sign.js";
import { type TuyaAction, type TuyaEnv, type TuyaEnvelope, type TuyaSession, type TuyaHttpPost } from "./request.js";
/** Result of a successful {@link TuyaClient.login}. */
export interface TuyaLoginResult {
    sid: string;
    /** Tuya user id (`uid`) from the login response. */
    uid: string;
}
export interface TuyaClientConfig {
    /**
     * The native sign seam. Defaults to {@link HmacSigner} with the built-in app key — no config
     * needed. Override only for tests (pass a {@link StubSigner} or custom impl).
     */
    signer?: TuyaSigner;
    /**
     * Channel key — defaults to {@link TUYA_CHKEY} (`"7cbfe6d8"`), the constant extracted from
     * the eufy Security/Mega app. Override only for non-standard builds.
     */
    chKey?: string;
    /** Per-install device id; a random 44-hex one is generated if omitted (see {@link genDeviceId}). */
    deviceId?: string;
    /** Restore a prior session id (skip login). */
    sid?: string;
    /** Override the environment/static fields (see {@link TuyaEnv}). */
    env?: TuyaEnv;
    /** api.json endpoint override (region shard). */
    endpoint?: string;
    /** Inject a POST transport (test stub); default = native fetch. */
    http?: TuyaHttpPost;
}
/**
 * Generate a per-install `deviceId` (44 hex chars). The app derives it deterministically per
 * install from device fingerprints, but the scheme is not reversed — we mint a random id instead.
 * TODO(scheme): replace with the app's real derivation once known.
 */
export declare function genDeviceId(): string;
export declare class TuyaClient {
    private readonly signer;
    private readonly env;
    private readonly endpoint?;
    private readonly http?;
    private session;
    constructor(config?: TuyaClientConfig);
    /** The current per-install session identity (sid empty until {@link login}). */
    getSession(): Readonly<TuyaSession>;
    /** True once a login has populated a session id. */
    get loggedIn(): boolean;
    /**
     * Build the full signed param map for an action against the current session. Does not send.
     * Requires a working signer (the sign step).
     */
    buildRequest(action: TuyaAction): Record<string, string>;
    /**
     * Build + POST an action, returning the parsed envelope. Requires a working signer.
     *
     * On an `et=3` reply the envelope's `result` is a base64 AES-128-GCM blob, not an object; this
     * decrypts it (keyed off the request's `requestId` and the session's `ecode`) and returns the
     * decrypted inner envelope, so callers read `result` as an object regardless. A non-string `result`
     * (an error, or an already-plain reply) passes through untouched.
     */
    call<T = unknown>(action: TuyaAction): Promise<TuyaEnvelope<T>>;
    /**
     * Decode an et=3 reply. When `result` is a non-empty string it is the encrypted blob: decrypt and
     * parse it (a wrong key or tampered blob fails the GCM tag in {@link decryptReply} and throws). The
     * plaintext is itself the standard `{success, t, result}` envelope, which becomes the returned one.
     */
    private decodeReply;
    /**
     * Log into the Tuya cloud from a eufy user id (wire-confirmed from the eufy Security app).
     *
     * Flow:
     *  1. `smartlife.m.user.username.token.get` → `{ token, publicKey, exponent }` (RSA-2048 key).
     *     If this returns USER_NOT_EXIST the shadow account has never been provisioned — the vacuum
     *     must be added via the eufy Security app (`com.oceanwing.battery.cam`) at least once.
     *  2. Derive password: RSA/PKCS1-encrypt( MD5hex(aesPassword), serverKey ) → hex.
     *  3. `smartlife.m.user.uid.password.login.reg` → `{ sid, uid }`.
     *     On USER_PASSWD_WRONG: re-fetch a token and retry once with the hardcoded fallback
     *     password `"12345678"` (wire-confirmed from the eufy Security app).
     *     ⚠️ Two failed attempts in a row can contribute to Tuya-side rate-limiting or lockout — do not
     *     add further retry loops on top of this one.
     */
    login(eufyUserId: string, phoneCode?: string): Promise<TuyaLoginResult>;
    /**
     * READ a device's current data-points (`smartlife.m.device.dp.get`). The envelope's `result` is a
     * flat `{ "<dpId>": value }` map. Builds the request without needing a working signer; the signer is
     * only exercised on send.
     */
    getDeviceDps<T = unknown>(devId: string): Promise<TuyaEnvelope<T>>;
    /**
     * CONTROL: publish data-points to a device (`smartlife.m.device.dp.publish`). `dps` is
     * `{ "<dpId>": <value> }`. `gwId` is the gateway/parent id (equals `devId` for a standalone gw).
     *
     * ⚠️ UNVERIFIED write — refuses to send by default. The `dp.publish` param shape
     * ({@link buildPublishDpsAction}) is derived, NOT pinned against a confirmed exchange,
     * and the login round-trip that yields a real `sid` is unproven too. A wrong shape comes back as a
     * generic Tuya error indistinguishable from a real device rejection, so blindly sending would hide
     * that ambiguity. Pass `{ allowUnverified: true }` to send anyway; the gate drops when the write is
     * captured + confirmed against a device.
     */
    publishDps<T = unknown>(devId: string, gwId: string, dps: Record<string, unknown>, opts?: {
        allowUnverified?: boolean;
    }): Promise<TuyaEnvelope<T>>;
}
