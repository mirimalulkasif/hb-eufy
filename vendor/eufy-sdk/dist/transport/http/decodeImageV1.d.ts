export declare const V1_PREFIX = "eufysecurity";
/** Derive the numeric id-suffix from the station `p2p_did` — a digit-mixing seed used by the key derivation. */
export declare function getIdSuffix(p2pDid: string): number;
/** Derive the image "base code" from the camera serial + `p2p_did` — first input to {@link getImageKey}. */
export declare function getImageBaseCode(serialNumber: string, p2pDid: string): string;
/** Derive the per-image seed from the `p2p_did` + the image's own code — second input to {@link getImageKey}. */
export declare function getImageSeed(p2pDid: string, code: string): string;
/** Derive the AES-128-ECB key for a v1 thumbnail: SHA-256 over the base code + seed, rotated by a hash byte. */
export declare function getImageKey(serialNumber: string, p2pDid: string, code: string): string;
/** True if the blob is a legacy v1 `eufysecurity:` image (NOT the v2 variant). */
export declare function isV1Image(data: Buffer): boolean;
/**
 * Decode a v1 `eufysecurity:` blob to a plain JPEG buffer using the station's
 * `p2p_did`. Returns null if the blob isn't v1. Mirrors the legacy decode: parse
 * SERIAL + CODE, derive the key, AES-128-ECB-decrypt the first 256 bytes, splice
 * the decrypted head back in front of the plaintext tail.
 */
export declare function decodeImageV1(data: Buffer, p2pDid: string): Buffer | null;
/** Decode a recognized v1 (device-key) or v2 (keyless) wrapper; leave other media unchanged. */
export declare function normalizePushImage(data: Buffer, p2pDid?: string): Buffer;
