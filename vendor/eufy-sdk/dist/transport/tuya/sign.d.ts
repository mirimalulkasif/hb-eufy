/**
 * Keys that participate in the signature, in no particular order (the preimage builder sorts).
 * Everything else in the request (bizData, sdkVersion, os-info fields, cp/channel/nd, …) is
 * DELIBERATELY excluded from the sign. Verified against a live preimage (see the spec test).
 */
export declare const SIGN_ALLOWLIST: ReadonlySet<string>;
/**
 * The `postData` sign transform: md5 the body to 32 hex chars, then rotate the four 8-char blocks
 * `[b0 b1 b2 b3]` → `[b1 b0 b3 b2]`. This is the Thingclips SDK 7.5.0 transform; it is applied to
 * the `postData` value before it is joined into the preimage.
 *
 * ✅ Confirmed: the `thing.m.user.uid.token.create` call carries a `postData`, and its
 * sign (computed over this transform) was accepted by `a1.tuyaeu.com` with no SIGN_INVALID — so a
 * postData-bearing preimage IS exercised end-to-end. (The static `smartlife.p.time.get` golden vector
 * separately carries no postData; the two together cover both paths.)
 */
export declare function swapMd5(postData: string): string;
/**
 * Build the exact sign **preimage** from a request param map. Keeps only allowlisted keys with a
 * non-empty value, sorts them ascending, and joins `key=value` pairs with `||`. `postData` is
 * folded via {@link swapMd5} before joining.
 */
export declare function buildSignPreimage(params: Readonly<Record<string, string | undefined>>): string;
/**
 * The native signing seam. Given the {@link buildSignPreimage} output, return the final `sign`
 * value (SHA-256-length hex). Implementations mix in the app secret natively.
 */
export interface TuyaSigner {
    sign(preimage: string): string;
}
/** Test-only {@link TuyaSigner} that throws on every call. */
export declare class StubSigner implements TuyaSigner {
    sign(_preimage: string): string;
}
/**
 * App-wide HMAC-SHA256 signing key **K** (`package_cert_stego_appSecret`), assembled from four
 * public per-build constants (wire-confirmed from the eufy Security/Mega app + native memory dump):
 *   - package name: `com.oceanwing.battery.cam`
 *   - developer signing-cert SHA-256 (colon-hex UPPER, verified from running app memory)
 *   - stego value: extracted from `libthing_security.so + 0x384f0` (keyed BMP steganography)
 *   - manifest app secret (also in {@link TUYA_APP_SECRET} in `request.ts`)
 *
 * All four components are public per-build constants.
 * The env var `TUYA_SIGN_KEY` can override this for non-standard builds.
 */
export declare const TUYA_SIGN_K: string;
/**
 * Resolve the app-wide HMAC key {@link TUYA_SIGN_K}: an explicit `override` wins, then the
 * `TUYA_SIGN_KEY` env var (for custom builds), then the built-in constant. Shared by the request
 * signer ({@link HmacSigner}) and the et=3 body-key derivation, which key off the same `K`.
 * @internal
 */
export declare function resolveSignKey(override?: string): string;
/**
 * The real {@link TuyaSigner}: `sign = HMAC-SHA256(K, preimage)` as lowercase hex.
 *
 * Uses {@link TUYA_SIGN_K} by default — no configuration required. The env var `TUYA_SIGN_KEY`
 * overrides the built-in key (for custom builds); an explicit constructor argument takes precedence
 * over both. Verified: reproduces the captured `smartlife.p.time.get` sign `97a78b35…a7f8c84`.
 */
export declare class HmacSigner implements TuyaSigner {
    private readonly key;
    constructor(key?: string);
    sign(preimage: string): string;
}
/**
 * Channel key sent on every request as `chKey`.
 * Extracted from the eufy Security/Mega app (`com.oceanwing.battery.cam`); present in the sign
 * preimage — confirmed from the live-captured golden vector (`smartlife.p.time.get`).
 */
export declare const TUYA_CHKEY = "7cbfe6d8";
