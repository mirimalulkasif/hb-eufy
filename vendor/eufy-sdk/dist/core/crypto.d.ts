/**
 * Eufy "mega" (Anker AIoT) cloud crypto — algo_ecdh.
 *
 * The full request scheme, reverse-engineered + verified against live traffic
 * (2026-06). Three layers:
 *
 *  A. Key exchange (bootstrap, per region):
 *       client_public_key = base64( IV(16) || AES-128-CBC(pubkeyHex, localKey) )
 *       signed with HMAC-SHA256(localKey-hex-utf8, `${ts}+${once}+${encPubKey}`),
 *       sending a client-generated X-Key-Ident. The server replies with its
 *       public key, AES-CBC-encrypted the same way; ECDH(P-256) → shareKey
 *       (first 32 hex chars of the shared secret).
 *
 *  B. Per-request body: base64( IV(16) || AES-128-CBC-PKCS7(plaintext) ),
 *       key = shareKey[:16 bytes]. Response `data` decrypts the same way.
 *
 *  C. x-signature = HMAC-SHA256( shareKey-hex-utf8,
 *                               [ts, once, encBody?].join("+") )  (hex).
 *
 * Layers B and C are verified byte-exact against a captured request
 * (src/__tests__/crypto.spec.ts).
 */
import { type ECDH } from "node:crypto";
export declare const P256 = "prime256v1";
/**
 * The eufy_mega app localKey — a single AES-128 key (hex) used to bootstrap the
 * ECDH key exchange across the whole mega host stack (openapi + passport + app-*).
 * Extracted from the iOS Mega app bundle.
 */
export declare const EUFY_MEGA_LOCAL_KEY_HEX = "2500a7d5617812f9d52515b2c8f20a3d";
/**
 * The **eufylife** data-host localKey — a SEPARATE AES-128 bootstrap key for the
 * `security-app-{shard}.eufylife.com` gateway (faces, get_ciphers, commerce, geofence).
 * That host runs its own ECDH key exchange at `/v3/openapi/oauth/key/exchange` and rejects
 * the mega localKey. Identified by HMAC-matching a captured eufylife key-exchange signature.
 */
export declare const EUFYLIFE_LOCAL_KEY_HEX = "118c12c81e211149304bd70a0c071d01";
/**
 * The **Anker Solix** passport localKey — the AES-128 bootstrap key for the `anker_power` app-line
 * (power stations / smart meter). Solix runs the SAME `algo_ecdh` passport as the eufy_mega stack,
 * re-skinned under a different `app-name` + API host, so the login key-exchange wraps the ephemeral
 * client public key with this key; distinct from {@link EUFY_MEGA_LOCAL_KEY_HEX}. Authenticated Solix
 * reads carry only the token + `gtoken` (no per-request encryption).
 */
export declare const SOLIX_LOCAL_KEY_HEX = "e8ad18f61bbd3fbd52d5ed12d14d3b9c";
/**
 * Hardcoded server P-256 public key (uncompressed 0x04||X||Y) used to encrypt
 * the LOGIN password via a one-shot ECDH (separate from the per-session key).
 */
export declare const SERVER_STATIC_PUBLIC_KEY_HEX = "04c5c00c4f8d1197cc7c3167c52bf7acb054d722f0ef08dcd7e0883236e0d72a3868d9750cb47fa4619248f3d83f0f662671dadc6e2d31c2f41db0161651c7c076";
/** 32-hex random id (uuid-without-dashes), for X-Key-Ident / X-Request-Once. */
export declare function genId(): string;
/** Unix seconds as a string (X-Request-Ts). */
export declare function nowSec(): string;
/** md5 hex digest — the one place this derivation lives (gtoken, openudid seeds, …). */
export declare function md5Hex(input: string): string;
/** gtoken header = md5(user_id) hex. */
export declare function gtoken(userId: string): string;
/** 16-byte AES key = first half of the shared secret hex (shareKey[:16 bytes]). */
export declare function aesKey(shareKeyHex: string): Buffer;
/** HMAC sign key = the shareKey hex string itself, as UTF-8 bytes. */
export declare function signKey(shareKeyHex: string): Buffer;
/** Encrypt a body: base64( IV(16) || AES-128-CBC-PKCS7(plaintext) ). */
export declare function encryptBody(plaintext: string | Buffer, shareKeyHex: string): string;
/** Decrypt a base64( IV(16) || AES-128-CBC-PKCS7 ) body. */
export declare function decryptBody(b64: string, shareKeyHex: string): Buffer;
/**
 * x-signature = HMAC-SHA256(signKey(shareKey), [ts, once, encBody?].join("+")).
 * `encBody` is the ENCRYPTED body actually sent; omit for empty-body requests.
 */
export declare function signRequest(shareKeyHex: string, ts: string, once: string, encBodyB64?: string): string;
/** A negotiated session: shareKey + the X-Key-Ident the client minted for it. */
export interface SessionEntry {
    keyIdent: string;
    shareKey: string;
    clientPublicKeyHex: string;
    clientPrivateKeyHex: string;
    createdAt: number;
}
export interface KeyExchangePrep {
    ecdh: ECDH;
    localKey: Buffer;
    keyIdent: string;
    /** base64 body to POST as { client_public_key }. */
    encryptedClientPublicKey: string;
    /** algo_ecdh headers for the key-exchange POST. */
    headers: Record<string, string>;
    clientPublicKeyHex: string;
}
/**
 * Build a key-exchange request: an ephemeral P-256 keypair whose public hex is
 * AES-128-CBC(localKey)-encrypted, signed with the localKey-hex as UTF-8.
 */
export declare function prepareKeyExchange(localKeyHex?: string): KeyExchangePrep;
/**
 * Finish the exchange: decrypt the server's AES-CBC-wrapped public key with the
 * localKey, ECDH-derive, and take the first 32 hex chars as the shareKey.
 */
export declare function finishKeyExchange(prep: KeyExchangePrep, serverPublicKeyB64: string): SessionEntry;
/**
 * Encrypt the login password against the hardcoded server static public key.
 * AES-256-CBC, key = full 32-byte ECDH secret, IV = its first 16 bytes.
 * Returns the client pubkey hex (for client_secret_info.public_key) + b64 ct.
 */
export declare function encryptLoginPassword(password: string): {
    clientPublicKeyHex: string;
    encryptedPassword: string;
};
