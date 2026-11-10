/**
 * Tuya / Thingclips `api.json` request assembly + transport.
 *
 * Every call is a single `POST https://a1.tuyaeu.com/api.json` (EU) whose body is
 * **form-urlencoded params** plus a `sign`. Under `et=3` the `postData` param is an AES-128-GCM blob
 * and the reply `result` is encrypted the same way, with the same per-request key. This module builds
 * that param map for a given action, form-encodes it, POSTs it, and parses Tuya's response envelope.
 * The `sign` digest is delegated to a {@link TuyaSigner}.
 */
/** Injectable POST transport — takes (url, form-body), returns the parsed JSON envelope. Native `fetch` by default. */
export type TuyaHttpPost = (url: string, body: string) => Promise<unknown>;
import { type TuyaSigner } from "./sign.js";
/** EU api.json endpoint. (Other regions swap the `tuyaeu` shard, e.g. `tuyaus`/`tuyacn`.) */
export declare const TUYA_API_ENDPOINT = "https://a1.tuyaeu.com/api.json";
/** Hardcoded public app key (a.k.a. clientId) shipped in the eufy app. */
export declare const TUYA_APP_KEY = "w8x4ppqkdxvqnd73ahj9";
/**
 * Hardcoded app secret. Public only in the sense that it ships in the vendor app; it feeds the NATIVE
 * sign digest (see {@link TuyaSigner}), so it is not used directly in this module.
 */
export declare const TUYA_APP_SECRET = "pt585qhmt75hwcynchnps9dnxh9suhwd";
/** Thingclips SDK version the captured traffic used. */
export declare const TUYA_SDK_VERSION = "7.5.0";
/** App version the client reports (also feeds the sign via `appVersion`). */
export declare const TUYA_APP_VERSION = "6.0.51_26722";
/** A single action to call: the `a` (action) + `v` (version) + optional pre-serialized `postData`. */
export interface TuyaAction {
    /**
     * Action name as it goes on the wire, e.g. `smartlife.m.device.dp.publish`. The vendor SDK names
     * its actions `thing.*` and rewrites a leading `thing` to `smartlife` before sending.
     */
    a: string;
    /** Per-action version, e.g. `"1.0"` / `"2.0"`. */
    v: string;
    /** The `postData` param value — already a JSON STRING (Tuya carries the body as a string param). */
    postData?: string;
}
/** Per-install session identity carried on every request. */
export interface TuyaSession {
    /** Session id from a successful login; empty string pre-login. */
    sid: string;
    /** Per-install device id (44-hex in the capture). See {@link TuyaClient} for generation. */
    deviceId: string;
    /**
     * 8-hex `chKey`. ✅ SOLVED: `getChKey` in `libthing_security.so` is a pure
     * function of the **appId only** (never touches time/session/Context), so it's a per-appId CONSTANT —
     * `"7cbfe6d8"` for this app's appId. Hardcode it.
     */
    chKey: string;
    /**
     * Per-login encryption code (`User.ecode`), read from the decrypted `login.reg` reply. Absent until
     * login completes; it keys et=3 body encryption and reply decryption for every session call.
     */
    ecode?: string;
}
/**
 * The constant / environment fields of a request. All are plaintext and (except the sign-relevant
 * `clientId`/`os`/`ttid`/`lang`/`et`/`appVersion`) do NOT feed the sign. Values marked TODO are
 * cosmetic os-info fields whose exact contents were not pinned from the capture; they do not affect
 * the sign and can be tuned freely.
 */
export interface TuyaEnv {
    /** appKey. */
    clientId: string;
    sdkVersion: string;
    appVersion: string;
    /** "Android". */
    os: string;
    /** "android". */
    ttid: string;
    /** "en_GB". */
    lang: string;
    /** "3". */
    et: string;
    /** "gzip". */
    cp: string;
    /** "sdk". */
    channel: string;
    /** "1". */
    nd: string;
    /** JSON string, e.g. `{"customDomainSupport":"1","sdkInt":"36","nd":"1","brand":"google"}`. */
    bizData: string;
    /** TODO(unknown): device platform string; cosmetic (not in sign). */
    platform: string;
    /** TODO(unknown): OS system version; cosmetic (not in sign). */
    osSystem: string;
    /** IANA time zone id, e.g. "Europe/London". */
    timeZoneId: string;
    /** TODO(unknown): Thingclips device-core version; cosmetic (not in sign). */
    deviceCoreVersion: string;
}
/** Default environment fields (see {@link TuyaEnv} for which are verified vs. TODO/cosmetic). */
export declare const DEFAULT_TUYA_ENV: TuyaEnv;
/** Inputs to {@link buildApiParams} beyond the action itself. */
export interface BuildRequestOptions {
    session: TuyaSession;
    signer: TuyaSigner;
    env?: TuyaEnv;
    /** Override the unix-second `time` (default: now) — for deterministic builds/tests. */
    time?: number;
    /** Override the `requestId` uuid (default: random v4) — for deterministic builds/tests. */
    requestId?: string;
}
/**
 * Build the full form param map for an action: fills the static env + per-install session fields +
 * generated `time`/`requestId`, computes the sign preimage over the allowlisted subset, and appends
 * the `sign` from the signer. Returns a flat `Record<string,string>` ready to form-encode.
 *
 * The sign is the only step that needs a working {@link TuyaSigner}; a {@link StubSigner} throws
 * here. Callers that only want to inspect the param shape can read {@link BuildRequestOptions} with
 * a fake signer.
 */
export declare function buildApiParams(action: TuyaAction, opts: BuildRequestOptions): Record<string, string>;
/** Tuya's standard response envelope. */
export interface TuyaEnvelope<T = unknown> {
    success: boolean;
    /** Server unix-ms timestamp. */
    t?: number;
    /** Decoded result payload (present on success). */
    result?: T;
    errorCode?: string;
    errorMsg?: string;
    /** Occasionally present status string. */
    status?: string;
}
/** Transport knobs for {@link sendApiRequest}. */
export interface SendOptions {
    endpoint?: string;
    /** Inject a POST transport (default: native `fetch`). Used to stub the network in tests. */
    http?: TuyaHttpPost;
}
/**
 * Form-encode a param map and POST it to `api.json`, returning the parsed {@link TuyaEnvelope}.
 * The body is `application/x-www-form-urlencoded` (Tuya rejects JSON here).
 */
export declare function sendApiRequest<T = unknown>(params: Record<string, string>, opts?: SendOptions): Promise<TuyaEnvelope<T>>;
/**
 * CONTROL: publish device data-points. `dps` is `{ "<dpId>": <value> }`; note it is JSON-stringified
 * INSIDE the postData (Tuya nests the dps map as a string). Action `smartlife.m.device.dp.publish` v2.0.
 */
export declare function buildPublishDpsAction(devId: string, gwId: string, dps: Record<string, unknown>): TuyaAction;
/**
 * READ: a device's current data-points. Action `smartlife.m.device.dp.get` v1.0, postData `{ devId }`.
 * The reply `result` is a flat `{ "<dpId>": value }` map.
 */
export declare function buildGetDeviceDpsAction(devId: string): TuyaAction;
/**
 * LOGIN step 1: fetch a pre-login RSA token for a Tuya uid.
 * Wire-confirmed from the eufy Security app (`com.oceanwing.battery.cam`):
 * wire action `smartlife.m.user.username.token.get`, v=2.0.
 * Returns `{ token, publicKey, exponent }` (RSA-2048 modulus + exponent as decimal strings).
 */
export declare function buildUsernameTokenGetAction(countryCode: string, username: string): TuyaAction;
/**
 * LOGIN step 2: uid password login + auto-register.
 * Wire-confirmed from the eufy Security app: wire action
 * `smartlife.m.user.uid.password.login.reg`, v=1.0. `passwd` = hex of RSA-PKCS1-encrypt(MD5hex(aesPassword)).
 * `options` is the JSON string `{"group": 1}`, as the app sends it.
 * On success returns `{ sid, uid }`.
 */
export declare function buildPasswordLoginRegAction(countryCode: string, uid: string, passwd: string, token: string): TuyaAction;
/**
 * Older Tuya API path that auto-creates a shadow account if it does not yet exist.
 * Used only by `tuya-login-diag.mjs` as a last-resort re-provisioning probe — not part of the
 * normal login flow (`smartlife.m.user.username.token.get` is step 1).
 */
export declare function buildUidTokenCreateAction(countryCode: string, uid: string): TuyaAction;
