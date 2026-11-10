/**
 * A minimal client for the Anker Solix power-station cloud, driven by the SAME account login the
 * eufy client uses.
 *
 * Why this is separate from the eufy device client: Solix shares Anker's `algo_ecdh` passport (so
 * {@link prepareKeyExchange} and the steps in `./passport.ts` are shared with it) but exposes a different device
 * backend — its own `app-name`, host, and bootstrap key (`SOLIX_APP_NAME`, `SOLIX_DEFAULT_API_HOST`,
 * {@link SOLIX_LOCAL_KEY_HEX}) — and its authenticated resource reads are PLAIN JSON, carrying only the auth token
 * and a `gtoken = md5(user_id)`, with no per-request encryption or signature. This client therefore does the
 * encrypted passport handshake to obtain a token, then makes plain authenticated reads.
 *
 * This is the wire client (transport layer): it returns the vendor's typed JSON as received. Building
 * those records into capability-driven `SolixDevice` models is the model layer's job — see
 * `discoverSolixDevices()` — so the two stay decorrelated (transport never imports model).
 */
import { type SessionStore, type SolixDeviceRecord, type SolixPowerCutoffOption, type SolixProductCategory, type SolixSiteRecord, type SolixSiteScene, type SolixSocParams } from "../../core/index.js";
import type { SecureMqttCredentials } from "../mqtt/secure-mqtt.js";
/** An authenticated Solix session — the token + the derived `gtoken` + the resolved API host. */
export interface SolixSession {
    authToken: string;
    userId: string;
    /** `md5(user_id)` — sent as the `gtoken` header on every authenticated read. */
    gtoken: string;
    /** The regional API host the account resolved to (e.g. the EU shard). */
    apiHost: string;
    /** Unix seconds; 0 when the server did not supply one. */
    tokenExpiresAt: number;
}
/**
 * Outcome of {@link SolixClient.login}. `2fa` mirrors the eufy passport: the server sent a code and
 * the client holds a limited token — call {@link SolixClient.submitVerifyCode} to finish.
 */
export type SolixLoginResult = {
    status: "ok";
    session: SolixSession;
} | {
    status: "2fa";
    method: string;
};
/** Options for {@link SolixClient}. */
export interface SolixClientOptions {
    email: string;
    password: string;
    /** ISO-3166 alpha-2; defaults to "US". Sent as `country` and `ab`. */
    countryCode?: string;
    /** Override the API host (skips domain-estimate). Defaults to estimate → `SOLIX_DEFAULT_API_HOST`. */
    apiHost?: string;
    /** App version reported to the cloud. */
    appVersion?: string;
    /**
     * Stable per-install device id (UUID). The auth token is bound to it, and a shifting id looks like
     * a new device each run and re-triggers 2FA. Defaults to a deterministic id derived from the email
     * (stable across runs); a store's saved id wins over this.
     */
    openudid?: string;
    /** Persist the token + device id so a dedicated account logs in once and reuses it until expiry. */
    store?: SolixSessionStore;
    /** Injected fetch (for tests). Defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
}
/** What {@link SolixSessionStore} holds: the stable device id and (once logged in) the session. */
export interface SolixPersisted {
    openudid: string;
    session?: SolixSession;
}
/**
 * A place to persist a Solix session across process runs — the core {@link SessionStore} parameterised on
 * the Solix record shape, so `FileSessionStore` serves it as-is. The device id survives token expiry (so
 * the account keeps seeing the same device and does not re-prompt 2FA), and a live session is reused
 * until it expires.
 */
export type SolixSessionStore = SessionStore<SolixPersisted>;
/**
 * Login + read client for one Anker account's Solix devices. Construct with the account
 * credentials, `await login()`, then read {@link getDevices} / {@link getSites} / {@link
 * getUserMqttInfo}. Not tied to any host runtime.
 */
export declare class SolixClient {
    private readonly email;
    private readonly password;
    private readonly country;
    private readonly appVersion;
    private readonly doFetch;
    private readonly store?;
    private readonly openudid;
    private apiHost;
    private session_?;
    /** Carried between {@link login} and {@link submitVerifyCode} while a 2FA code is outstanding. */
    private pending2fa?;
    /**
     * Resolve the device id (explicit → stored → deterministic from the email, so it is stable and does
     * not re-trigger 2FA) and adopt a stored session that has not expired, so a warm start skips the
     * handshake. An explicit `opts.apiHost` outranks a stored session's host in both cases: it is an
     * override that also skips domain-estimate, and every read goes through `this.apiHost`.
     */
    constructor(opts: SolixClientOptions);
    /** Persist the current device id (+ session, if any) when a store is configured. */
    private persist;
    /** The authenticated session, once {@link login} has resolved to `ok`. */
    get session(): SolixSession | undefined;
    /**
     * Headers for the login/key-exchange path, which carry the device id. Authenticated resource reads
     * must NOT send `openudid` — the gateway rejects a token-bearing read that also carries a device id
     * (`401 token error`) — so those use {@link baseHeaders} directly.
     */
    private authHeaders;
    /** Base headers common to every Solix request. */
    private baseHeaders;
    /** One request path for every Solix call (GET or POST) — always parses through the non-JSON guard. */
    private send;
    /** POST helper for the login/key-exchange path (which builds its own bespoke headers per request). */
    private post;
    /** Resolve the regional API host via domain-estimate (best-effort; keeps the default on failure). */
    private estimateHost;
    /** Do the localKey-bootstrapped ECDH key exchange and return the negotiated session key. */
    private keyExchange;
    /** Build the encrypted, signed `/passport/login` request body + headers for the negotiated key. */
    private postLogin;
    /**
     * Turn a decrypted `/passport/login` payload into an `ok`/`2fa` result, establishing the session on
     * `ok`. The passport marks a pending 2FA with a non-empty `fa_info.info`, and empties it once the code
     * has been satisfied.
     *
     * `gtoken` is hashed from `ap_cloud_user_id` where the reply carries one, `user_id` otherwise. Whether
     * this gateway recomputes the header from `user_id` specifically — as the mega gateway does, rejecting a
     * disagreement with `"gtoken not equal userid error"` — is unverified here: no Solix response has been
     * observed refusing the header, which is consistent with the two ids agreeing on the accounts seen.
     */
    private classifyLogin;
    /** Decrypt a login envelope's `data` (base64 `IV(16)||AES-128-CBC`, keyed by the share key). */
    private decryptLogin;
    /**
     * Authenticate with the account credentials. Resolves to `ok` with a {@link SolixSession}, or `2fa`
     * when the passport sent a code — then call {@link submitVerifyCode}. A session that is already fresh
     * (adopted from a store) is answered without a handshake.
     */
    login(): Promise<SolixLoginResult>;
    /**
     * On a rejected `/passport/login` (non-zero code, so `data` is an error envelope not the encrypted
     * payload), throw a diagnostic that names WHY the passport refused — the throttle (`26161`, "too
     * frequent") vs a challenge it wants the client to satisfy. The passport marks a required captcha with
     * a `captcha_id`/`item`; our headless client cannot answer one, so surfacing it distinguishes "wait
     * out the rate-limit" from "a captcha is required — clear it in the app". No secrets are logged, only
     * the code, message, and which challenge fields are present.
     */
    private assertLoginAccepted;
    /** Complete a `2fa` login with the code the passport sent. */
    submitVerifyCode(code: string): Promise<SolixLoginResult>;
    /**
     * One authenticated PLAIN read for both GET and POST endpoints (no per-request encryption; carries
     * the auth token + `gtoken` only). Routes through {@link send} so every read keeps the non-JSON guard.
     *
     * Self-heals a **displaced session**: Anker allows ~one session per account, so another login (the app,
     * or a second client) invalidates this token and reads then fail with {@link SOLIX_TOKEN_KICKED_CODE}
     * ("token does not exist because it was kicked out"). On that code this re-logs in once and retries, so
     * a running client recovers on its own instead of failing every read until its session store is cleared.
     */
    private authed;
    /**
     * The account's bound Solix devices (flat list; may be empty when devices live under sites). The
     * gateway's JSON is asserted to {@link SolixDeviceRecord} here, at the one trust boundary — every field
     * beyond `device_sn`/`product_code` is optional on the record, so a caller reads them defensively.
     */
    getDevices(): Promise<SolixDeviceRecord[]>;
    /**
     * The account's sites (systems); devices are grouped under a site. Each record carries its
     * `site_device_list` (the member devices), which {@link discoverSolixSites} resolves into a
     * capability-driven `SolixSite`. Asserted to {@link SolixSiteRecord} at this trust boundary — and
     * `site_id` (the one field the model layer keys a `SolixSite` on) is validated here, so a record the
     * cloud returns without a usable id is dropped rather than surfacing a `SolixSite` with `id ===
     * undefined`; every other field is optional and read defensively.
     */
    getSites(): Promise<SolixSiteRecord[]>;
    /** Per-user AWS-IoT MQTT credentials (cert/key/endpoint/thing) for the real-time device plane. */
    getUserMqttInfo(): Promise<SecureMqttCredentials>;
    /**
     * Read a site's "scene" snapshot — the app's dashboard read for a system, a plain authed read. Its
     * battery detail (`solarbank_info.solarbank_list[]`) carries clean, correctly-named fields including
     * `bat_temperature`, which the realtime `ff09` MQTT push does NOT reliably carry (the fast frame's BMS
     * blob is empty, so the decoder withholds temperature). This is therefore a low-rate BACKSTOP for those
     * gap fields — NOT the realtime source: live power/SOC still come from the MQTT push (which is what the
     * app itself refreshes from every ~5 s; there is no clean-JSON scene PUSH). Verified live against the
     * `ff09` floats — the two agree to the watt at the same instant.
     */
    getSiteScene(siteId: string): Promise<SolixSiteScene>;
    /**
     * The pairable-product catalog (categories → products). This is Anker's product registry, not the
     * account's devices — fetch it to label a discovered device's model code with a marketing name and
     * category. Pair with {@link buildModelIndex}. It is a live endpoint, so it stays current without a
     * baked-in table.
     */
    getProductCatalog(): Promise<SolixProductCategory[]>;
    /**
     * Write device attributes — a CONTROL write, e.g. the Solarbank ambient light
     * `{ ambient_light_switch: 0 | 1 }` (0 = on, 1 = off). Unlike the plain authenticated reads, a write
     * must be **encrypted + signed** with a freshly negotiated `algo_ecdh` key: the gateway accepts an
     * unsigned write with `code 0` but the device never applies it. The token-bearing request also must
     * NOT carry the device id (`openudid`), or the gateway answers `401 token error`. Both verified live
     * on an AE103 (the LED-enable bit in the `ba` telemetry flips exactly as commanded).
     */
    setDeviceAttrs(deviceSn: string, attributes: Record<string, unknown>): Promise<void>;
    /**
     * A CONTROL write: `algo_ecdh`-encrypted + signed, token-bearing but WITHOUT `openudid`. Every device
     * control the account performs (set_device_attrs, set_power_cutoff, …) goes through this — the gateway
     * accepts an unsigned/plain write with `code 0` but the device never applies it, and adding `openudid`
     * to the token-bearing request returns `401 token error`. Both verified live on an AE103.
     */
    private encryptedWrite;
    /** Turn the Solarbank's ambient LED on/off — a confirmed `set_device_attrs` write. */
    setAmbientLight(deviceSn: string, on: boolean): Promise<void>;
    /**
     * Read device attributes — a plain authenticated read (unlike the encrypted write). `attributes`
     * names the keys to fetch (e.g. `["screen_off_time"]`); an empty list asks for the device's default
     * set. Returns the gateway's attribute map as-is (values are device-typed — numbers, strings). Used
     * to reflect a control's live state, e.g. the display/light off-timeout.
     */
    getDeviceAttrs(deviceSn: string, attributes?: string[]): Promise<Record<string, unknown>>;
    /**
     * Set the Solarbank display's screen-off timeout, in SECONDS (`screen_off_time`). The app's picker
     * offers 10/20/30 s and 1/5/30 min; the LCD backlight — and with it the ambient LED that the screen
     * gates — turns off after this idle period. This is the raw-seconds write; the caller maps its own UI
     * options to seconds. The "Never" (always-on) sentinel is device-defined and NOT assumed here — pass
     * the exact integer read back from {@link getDeviceAttrs} while the device is in that mode.
     */
    setScreenOffTime(deviceSn: string, seconds: number): Promise<void>;
    /**
     * Read the Solarbank's battery discharge-cutoff (minimum-SOC) options — a plain authed read.
     * The gateway returns a preset list (`power_cutoff_data`): each entry is a selectable minimum
     * state-of-charge `output_cutoff_data` (percent) with its `id` and `is_selected` flag. The caller
     * presents these options and writes the chosen `id` back via {@link setPowerCutoff} — the values and
     * ids come from the device, never assumed. `siteId` is optional (the device knows its own cutoff).
     */
    getPowerCutoff(deviceSn: string, siteId?: string): Promise<SolixPowerCutoffOption[]>;
    /**
     * Select the Solarbank's battery discharge-cutoff (minimum SOC) by option id — a control write.
     * `cutoffDataId` MUST be an `id` returned by {@link getPowerCutoff} for this device (the preset the
     * user picked), never a raw percentage; the gateway maps the id to its cutoff percent.
     */
    setPowerCutoff(deviceSn: string, cutoffDataId: number): Promise<void>;
    /** The `param_type` under which the Solarbank's SOC-limit block lives (verified live on an AE103). */
    private static readonly SOC_PARAM_TYPE;
    /** `cmd` value that scopes the `site/*_site_device_param` family (from the app's request builder). */
    private static readonly SITE_DEVICE_PARAM_CMD;
    /**
     * Read one of a site's "device param" blocks by `param_type` — a plain authenticated read whose
     * `data.param_data` is itself a JSON STRING (the vendor double-encodes it). Returns the parsed inner
     * object, or `{}` when the block is empty (the gateway answers `code 0` with an empty `param_data`
     * for a `param_type` that does not apply to the site's hardware). The caller owns the inner shape.
     */
    private getSiteDeviceParam;
    /**
     * Read the Solarbank's battery SOC-limit settings (`param_type "27"`) — a plain authenticated read.
     * Returns `undefined` when the site carries no SOC block (e.g. non-Solarbank hardware). The realtime
     * `dischargeLowerLimit` also arrives on the MQTT `b5` telemetry blob; this is the authoritative,
     * app-synced source for `chargeUpperLimit`. `backupReserve` (with its enable switch) also has a second
     * source under the same name, the realtime MQTT `b5` frame; whether the two agree while the switch is
     * OFF is not yet verified. Verified live against a known AE103 setting (discharge 20 / charge 80).
     */
    getSafetySocParams(siteId: string): Promise<SolixSocParams | undefined>;
    /**
     * Write the Solarbank's battery SOC limits — an `algo_ecdh`-encrypted + signed control write. This is
     * **read-modify-write**: it first reads the current `param_type "27"` block and overlays only the
     * fields the caller supplies, so changing the discharge limit alone never clobbers the charge limit,
     * backup reserve, or calibration toggle. `changes` values are whole-percent integers. The full block
     * (all five keys) is sent, matching the app's `SocSettingParam.toJson`. Throws if the site has no SOC
     * block to modify. Returns the merged parameters that were written (for an immediate optimistic echo).
     */
    setSafetySocParams(siteId: string, changes: Partial<SolixSocParams>): Promise<SolixSocParams>;
}
