/**
 * Random phone-model + user-agent generation for the account's device identity.
 *
 * The cloud stores a `phone_model` per login and the media CDN wants a real Android `user-agent`. A
 * single hardcoded value (every install reporting the same model/UA) is an obvious fingerprint once
 * more than a handful of people run the SDK. These helpers pick a realistic model instead — SEEDED by
 * the install's `openudid` so it is STABLE across runs (a value that changed each run would look like a
 * new device every launch and trigger a fresh-device 2FA every time). Pass no seed for a one-off random
 * value. An explicitly configured `phoneModel` / `mediaUserAgent` pins the identity and never reaches
 * here.
 */
/**
 * A realistic random Android phone model (e.g. `SM-G998B`, `Pixel 7 Pro`, `Redmi Note 12 Pro`). With a
 * `seed` the result is stable for that seed — pass the install's `openudid` so it stays put across runs.
 */
export declare function randomPhoneModel(seed?: string): string;
/**
 * A realistic Dalvik `user-agent` for the media download path, consistent with `model` (defaults to a
 * fresh {@link randomPhoneModel}). Deterministic for a given `seed`.
 */
export declare function randomUserAgent(seed?: string, model?: string): string;
