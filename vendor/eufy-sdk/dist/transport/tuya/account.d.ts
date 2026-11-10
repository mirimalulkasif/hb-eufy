/**
 * Username/plaintext prefix the app prepends to the eufy user id. The production app uses `eh-`;
 * `eufyhome-` is the prefix of its QA environment only.
 */
export declare const TUYA_USERNAME_PREFIX = "eh-";
/** AES-128-CBC key used to derive the Tuya password (16 bytes). */
export declare const TUYA_PASSWORD_KEY: Buffer<ArrayBuffer>;
/** AES-128-CBC IV used to derive the Tuya password (16 bytes). */
export declare const TUYA_PASSWORD_IV: Buffer<ArrayBuffer>;
/** The Tuya username for a eufy user id (`"eh-" + eufyUserId`). */
export declare function tuyaUsername(eufyUserId: string): string;
/**
 * Derive the Tuya password for a eufy user id:
 * `UPPERCASE-HEX( AES-128-CBC-NoPadding( pad16("eh-"+eufyUserId), KEY, IV ) )`.
 * Deterministic (fixed KEY/IV) — the same user id always yields the same password.
 */
export declare function deriveTuyaPassword(eufyUserId: string): string;
/**
 * Map an ISO 3166-1 alpha-2 country code (e.g. `"GB"`, `"DE"`) to its E.164 numeric dial code.
 * Covers the main eufy device markets. Returns `undefined` for unlisted codes — callers fall back
 * to the region-based heuristic.
 */
export declare function isoToDialCode(iso: string): string | undefined;
/**
 * Resolve the Tuya `countryCode` login field. Priority:
 *  1. `phoneCode` — an explicit numeric dial code (e.g. `"49"`) when the caller already has one.
 *  2. `isoCode` — an ISO 3166-1 alpha-2 code (e.g. `"DE"` from `MegaClientConfig.countryCode`) looked up
 *     via {@link isoToDialCode}. Covers the full eufy market range, so a German user on the EU
 *     shard correctly receives `"49"` rather than the coarse region fallback's `"44"`.
 *  3. `region` — coarse mega shard prefix fallback: `"EU"`→`"44"`, `"CN"`→`"86"`, else `"1"`.
 */
export declare function resolveCountryCode(phoneCode?: string, region?: string, isoCode?: string): string;
/** A derived Tuya login identity — everything needed to call the uid token/password login actions. */
export interface TuyaAccount {
    /** `"eh-" + eufyUserId`. */
    username: string;
    /** AES-derived password (uppercase hex). See {@link deriveTuyaPassword}. */
    password: string;
    /** Tuya `countryCode` field. See {@link resolveCountryCode}. */
    countryCode: string;
}
/**
 * Derive the full {@link TuyaAccount} (username + password + countryCode) for a eufy user id.
 * `phoneCode` is the eufy account's phone country code; when omitted the countryCode defaults to
 * "1" (see {@link resolveCountryCode} for the region-based fallback).
 */
export declare function deriveTuyaAccount(eufyUserId: string, phoneCode?: string): TuyaAccount;
