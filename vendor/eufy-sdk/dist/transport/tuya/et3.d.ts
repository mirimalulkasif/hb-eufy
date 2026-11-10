/**
 * The per-request AES-128 key, `getEncryptoKey(requestId, ecode)`: take the lowercase hex of
 * `HMAC-SHA256(key = requestId, msg = K[+ "_" + ecode])`, keep the first 16 hex characters, and use
 * those characters as 16 ASCII bytes. `K` is the app HMAC key ({@link resolveSignKey}).
 *
 * `ecode` is the session's per-login encryption code (`User.ecode`, read from the decrypted
 * `login.reg` reply). `ecode === null` selects the pre-session variant `msg = K` used to open the
 * `token.get` and `login.reg` replies themselves, before any `ecode` is known.
 */
export declare function deriveBodyKey(requestId: string, ecode: string | null): Buffer;
/**
 * Encrypt an `et=3` request `postData`: AES-128-GCM under a random 12-byte nonce, laid out
 * `nonce(12) ‖ ciphertext ‖ tag(16)` then base64 — the inverse of {@link decryptReply}, keyed by the
 * same {@link deriveBodyKey}. No AAD. The request is signed over this blob.
 */
export declare function encryptBody(key: Buffer, json: string): string;
/**
 * Decrypt an `et=3` reply `result`: base64 → AES-128-GCM-decrypt-verify (`nonce = blob[0:12]`,
 * `tag = blob[-16:]`, ciphertext between), gunzip when the plaintext is gzip-framed, and return the
 * plaintext JSON string. Throws when the blob is too short or the GCM tag fails to authenticate.
 */
export declare function decryptReply(key: Buffer, resultB64: string): string;
