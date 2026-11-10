export interface Address {
    host: string;
    port: number;
}
/** Magic word at the start of every P2P data frame. */
export declare const MAGIC_WORD = "XZYH";
/** UDP message types (1st byte always 0xf1). */
export declare const RequestMessageType: {
    readonly LOCAL_LOOKUP: Buffer<ArrayBuffer>;
    readonly LOOKUP_WITH_KEY: Buffer<ArrayBuffer>;
    /** `ListReq_DSK`: the same body as a variant-2 lookup, answered with {@link ResponseMessageType.LIST_REQ_ACK}. */
    readonly LOOKUP_WITH_KEY2: Buffer<ArrayBuffer>;
    readonly RLY_HELLO: Buffer<ArrayBuffer>;
    readonly RLY_PORT: Buffer<ArrayBuffer>;
    readonly RLY_REQ: Buffer<ArrayBuffer>;
    readonly RLY_PKT: Buffer<ArrayBuffer>;
    readonly CHECK_CAM: Buffer<ArrayBuffer>;
    readonly CHECK_CAM2: Buffer<ArrayBuffer>;
    readonly PING: Buffer<ArrayBuffer>;
    readonly PONG: Buffer<ArrayBuffer>;
    readonly DATA: Buffer<ArrayBuffer>;
    readonly ACK: Buffer<ArrayBuffer>;
    readonly END: Buffer<ArrayBuffer>;
};
export declare const ResponseMessageType: {
    readonly LOCAL_LOOKUP_RESP: Buffer<ArrayBuffer>;
    readonly LOOKUP_ADDR: Buffer<ArrayBuffer>;
    /** The relay servers a cloud lookup server names: `[count:1][pad:3]` then `count` address records. */
    readonly LIST_REQ_ACK: Buffer<ArrayBuffer>;
    readonly RLY_HELLO_ACK: Buffer<ArrayBuffer>;
    /** A relay's answer to RLY_PORT: `[mark:4 BE][port:2 BE][pad:2]`, the port being the one it relays on. */
    readonly RLY_PORT_ACK: Buffer<ArrayBuffer>;
    readonly RLY_REQ_ACK: Buffer<ArrayBuffer>;
    /** A relay endpoint to register with: one address record, then `[handle:4 BE]`. */
    readonly RLY_TO: Buffer<ArrayBuffer>;
    readonly CAM_ID: Buffer<ArrayBuffer>;
    /** A lookup server's answer to a P2P request: `[result:1]` first, 0 when the request is accepted. */
    readonly P2P_REQ_ACK: Buffer<ArrayBuffer>;
    /**
     * The device's own address record, sent in answer to CHECK_CAM ahead of CAM_ID: its 20-byte device id, one
     * record in `encodeAddress`'s shape naming the address it answers from, then 8 zero bytes (44-byte payload).
     */
    readonly CAM_ADDR: Buffer<ArrayBuffer>;
    /** A relay reporting the path to the device ready: the device's 20-byte id, sent from the relay endpoint. */
    readonly RLY_RDY: Buffer<ArrayBuffer>;
    readonly PING: Buffer<ArrayBuffer>;
    readonly PONG: Buffer<ArrayBuffer>;
    readonly DATA: Buffer<ArrayBuffer>;
    readonly ACK: Buffer<ArrayBuffer>;
    readonly END: Buffer<ArrayBuffer>;
};
/** P2P data-channel types (2nd byte of the data-type header). */
export declare const P2PDataType: {
    readonly DATA: 0;
    readonly VIDEO: 1;
    readonly CONTROL: 2;
    readonly BINARY: 3;
};
export declare const P2PDataTypeHeader: {
    readonly DATA: Buffer<ArrayBuffer>;
    readonly VIDEO: Buffer<ArrayBuffer>;
    readonly CONTROL: Buffer<ArrayBuffer>;
    readonly BINARY: Buffer<ArrayBuffer>;
};
/** The fixed-width 16-byte header of every P2P data frame (after "XZYH"). */
export declare const P2P_DATA_HEADER_BYTES = 16;
export interface P2PDataFrameHeader {
    commandId: number;
    bytesToRead: number;
    channel: number;
    signCode: number;
    type: number;
}
/** Frame a UDP packet: `[msgType:2][payloadLen:2 BE][payload]`. */
export declare function frameMessage(msgType: Buffer, payload?: Buffer): Buffer;
/** True if `msg` begins with the given 2-byte message type. */
export declare function hasHeader(msg: Buffer, type: Buffer): boolean;
/** Pad a string into a fixed-width (multiple-of-chunk) zero-filled buffer. */
export declare function stringWithLength(input: string, chunkLength?: number): Buffer;
/** `EUPRCAM-000000-XXXXX` → the 20-byte buffer used in lookup/check payloads. */
export declare function p2pDidToBuffer(p2pDid: string): Buffer;
/**
 * Decode a station's `p2p_conn` / `app_conn` string into the eufy cloud lookup
 * server addresses (port 32100). XOR cipher with a fixed lookup table, seed 0x39.
 */
export declare function decodeP2PCloudIPs(data: string): Address[];
/**
 * The "Level 1" AES-128-ECB key for P2P command/control encryption — derivable
 * from sn + p2p_did alone (no cipher needed). HomeBase control-channel
 * notifications (sensor/alarm events) use exactly this key.
 */
export declare function p2pCommandEncryptionKey(stationSn: string, p2pDid: string): string;
/** AES-128-ECB decrypt of a P2P payload (no padding). */
export declare function decryptP2PData(data: Buffer, key: Buffer): Buffer;
/** The `cipher_id` named in a decrypted `CMD_GATEWAYINFO` (1100) payload (uint16 LE @0). */
export declare function gatewayInfoCipherId(gwPayload: Buffer): number;
/** Options for {@link eciesUnwrap}. */
export interface EciesUnwrapOptions {
    /**
     * When true, the envelope carries a trailing 32-byte HMAC tag over `iv ‖ ct` (the video
     * `CMD_VIDEO_FRAME` envelope, which is `ephPub(33) ‖ iv(16) ‖ ct(48) ‖ HMAC(32)`). The tag is
     * verified with `kdf[16:48]` as the MAC key and a mismatch yields `undefined`. When false (the
     * `CMD_GATEWAYINFO` envelope, `ephPub(33) ‖ iv(16) ‖ ct(48)`) there is no HMAC step.
     */
    verifyHmac?: boolean;
    /** Whether the AES-128-CBC plaintext is PKCS7-padded (video: true). Default false (zero-/no-pad). */
    pkcs7?: boolean;
}
/**
 * The shared ECIES unwrap primitive used by both the gateway and the video paths.
 *
 * `envelope` = `ephemeralPub(33, compressed P-256) ‖ iv(16) ‖ ct(48) [‖ HMAC(32)]`. Derivation:
 * `S = ECDH_X(eccPriv, ephPub)` → `kdf = eufyKDF(S)` → `aesKey = kdf[0:16]`; (optionally verify
 * `HMAC(kdf[16:48], iv‖ct) == tag`) → `AES-128-CBC(aesKey, iv, ct)` → plaintext. Returns the
 * decrypted bytes, or `undefined` on any parse / HMAC / cipher failure (fails closed, never throws).
 */
export declare function eciesUnwrap(envelope: Buffer, eccPrivateKeyHex: string, options?: EciesUnwrapOptions): Buffer | undefined;
/** The two random inputs of {@link eciesWrap}, injectable so a spec can pin an envelope's bytes. */
export interface EciesWrapOptions {
    /** The ephemeral P-256 private key for the exchange (32 bytes); generated fresh when absent. */
    ephemeralPrivateKey?: Buffer;
    /** The AES-128-CBC IV, which the envelope carries (16 bytes); random when absent. */
    iv?: Buffer;
}
/**
 * The sealing counterpart of {@link eciesUnwrap} with `verifyHmac` and `pkcs7` both set.
 *
 * Seals `plaintext` for `peerPublicKey` (a P-256 point, compressed or uncompressed) as
 * `ephemeralPub(33, compressed) ‖ iv(16) ‖ ct ‖ HMAC(32)`: `S = ECDH_X(ephemeral, peer)` →
 * `kdf = eufyKDF(S)` → `ct = AES-128-CBC(kdf[0:16], iv, PKCS7(plaintext))`, tagged
 * `HMAC-SHA256(kdf[16:48], iv ‖ ct)`.
 */
export declare function eciesWrap(plaintext: Buffer, peerPublicKey: Buffer, options?: EciesWrapOptions): Buffer;
/**
 * Derive the P2P **level-2** (signCode 2/8) AES-256-GCM session key from a *decrypted*
 * `CMD_GATEWAYINFO` (1100) payload and the station's ECC private key (from `get_ciphers`).
 *
 * Layout of the decrypted payload: `cipher_id(2 LE) ‖ 0000 ‖ ECIES-envelope(129)`, where the
 * envelope is `ephemeralPub(33, compressed P-256) ‖ iv(16) ‖ ciphertext(48)`. ECIES =
 * ECDH(eccPriv, ephemeralPub) → eufyKDF(SHA-256/HMAC, label "ECIES") → AES-128-CBC decrypt →
 * 32-byte session key. Reversed from `libmega_media_sdk.so`; verified to reproduce the live key.
 * Returns the 32-byte key, or undefined if the inputs don't parse.
 */
export declare function deriveLevel2KeyFromGatewayInfo(gwPayload: Buffer, eccPrivateKeyHex: string): Buffer | undefined;
/**
 * Derive the P2P **level-2** AES-128-ECB session key from a *decrypted* `CMD_GATEWAYINFO` (1100)
 * payload and the RSA private key of a cipher whose `get_ciphers` answer carries no ECC key.
 *
 * Layout of the decrypted payload: `cipher_id(2 LE) ‖ 0000 ‖ RSA ciphertext ‖ …`, the ciphertext as
 * long as the key's modulus. It is the 16-byte session key under PKCS#1 v1.5 encryption padding
 * (`00 02 ‖ ≥8 non-zero bytes ‖ 00 ‖ key`). The padding is checked here over the raw RSA result so a wrong
 * key fails closed: under OpenSSL's implicit rejection, `RSA_PKCS1_PADDING` answers random bytes for it
 * instead of throwing, and those can be 16 bytes long.
 *
 * `rsaPrivateKey` is the `get_ciphers` `private_key`: base64 PKCS#8 DER.
 *
 * Returns the 16-byte key, or `undefined` when the key does not parse, the payload is short, or the
 * padding or key length is wrong (fails closed, never throws).
 */
export declare function deriveLevel2KeyFromRsaGatewayInfo(gwPayload: Buffer, rsaPrivateKey: string): Buffer | undefined;
/** Local-lookup payload: two zero bytes. */
export declare function buildLocalLookupPayload(): Buffer;
/** Cloud-lookup payload (variant 2): `[p2pDid:20][dskKey][0x00000000]`. */
export declare function buildLookupWithKeyPayload2(p2pDid: string, dskKey: string): Buffer;
/**
 * Cloud-lookup payload — the CLASSIC variant (`LOOKUP_WITH_KEY`, 0xf126), reverse-engineered
 * byte-exact against the app's own request (cold-start, phone
 * force-stopped then reopened). Distinct from {@link buildLookupWithKeyPayload2} (`LOOKUP_WITH_KEY2`,
 * 0xf16a) which eufy-sdk already sent: that variant only ever got relay-pool candidates back for a
 * remote (cross-WAN) target; THIS variant is what got the real app a genuine direct-device address.
 *
 * `[p2pDid:20][selfAddr:16][clientVersion:4 = 02 05 01 05][dskKey][0x00000000]`. `selfAddr` is the
 * caller's own observed LAN host:port (the socket's own bound address) — a STUN-like self-report, NOT
 * the target's address. `clientVersion` was `02 05 01 05` in every capture; reproduced verbatim since
 * its exact semantics (and whether it's validated) are unconfirmed.
 */
export declare function buildLookupWithKeyPayload(p2pDid: string, selfHost: string, selfPort: number, dskKey: string): Buffer;
/** RLY_REQ payload: `[p2pDid:20][relay address record:16][mark:4 BE]`, naming the relay port and mark a RLY_PORT_ACK gave. */
export declare function buildRelayRequestPayload(p2pDid: string, relay: Address, mark: number): Buffer;
/** RLY_PKT payload: `[handle:4 BE][p2pDid:20][role:1][pad:3]`; a connecting client's role byte is 0. */
export declare function buildRelayPacketPayload(handle: number, p2pDid: string): Buffer;
/** CHECK_CAM hole-punch payload: `[p2pDid:20][0x000000]`. */
export declare function buildCheckCamPayload(p2pDid: string): Buffer;
/** 10-byte command header: `[dataTypeHeader:2][seq:2 BE]["XZYH"][cmd:2 LE]`. */
export declare function buildCommandHeader(seqNumber: number, commandType: number, dataTypeHeader?: Buffer): Buffer;
/** 10-byte empty command body for the given channel (used by CMD_GATEWAYINFO etc.). */
export declare function buildVoidCommandPayload(channel?: number): Buffer;
/** AES-128-ECB encrypt (no auto-padding) — P2P control payloads. Inverse of decryptP2PData. */
export declare function encryptP2PData(data: Buffer, key: Buffer): Buffer;
/** Zero-pad to a multiple of `blocksize` (eufy P2P pads with 0x00, NOT PKCS7). */
export declare function paddingP2PData(data: Buffer, blocksize?: number): Buffer;
/**
 * Command body carrying a string `value` (e.g. CMD_SET_PAYLOAD JSON). Mirrors the
 * app's `buildCommandWithStringTypePayload`: `[len:2 LE][00 00][01 00][channel,encType][00 00][data]`.
 * When `key` is given the data is zero-padded to 16 and AES-128-ECB encrypted, and
 * `encType` is written in the channel word (level-1 encryption = 1).
 */
export declare function buildStringCommandPayload(value: string, channel?: number, key?: Buffer, encType?: number): Buffer;
/**
 * Build an **int+string** command body: `valueSub(u32 LE) ‖ value(u32 LE) ‖ strValue(len-prefixed)`,
 * AES-128-ECB encrypted (level-1) like {@link buildStringCommandPayload}. This is the wire shape the
 * eufy app uses for the floodlight/spotlight manual switch (`CMD_SET_FLOODLIGHT_MANUAL_SWITCH` 1400)
 * on IndoorOutdoor / SoloCam-spotlight / Cam2C/3 families — where `value` = 0/1, `valueSub` = the
 * device channel, and `strValue` = the admin `account_id`. The `strValue` uses the 128-byte-chunk
 * length prefix ({@link stringWithLength}).
 */
export declare function buildIntStringCommandPayload(value: number, valueSub: number, strValue: string, channel?: number, key?: Buffer, encType?: number): Buffer;
/**
 * Build a **string-pair** command body: five zero bytes, then `strValue` and `strValueSub`, each in the
 * 128-byte-chunk length form ({@link stringWithLength}), AES-128-ECB encrypted (level-1) like
 * {@link buildStringCommandPayload} when `key` is given. `CMD_DOWNLOAD_VIDEO` (1024) takes this shape on a
 * HomeBase 2: `strValue` = the recording's path on the station, `strValueSub` = the station admin
 * `account_id`, on the camera's channel.
 */
export declare function buildStringPairCommandPayload(strValue: string, strValueSub: string, channel?: number, key?: Buffer, encType?: number): Buffer;
/**
 * Build a command body around an ALREADY-encrypted (or plaintext) `data` buffer with an explicit
 * `signCode` — used for level-2 (`signCode 8`, AES-256-GCM) commands like the media-start 1350 the
 * app sends. Same on-wire layout as `buildStringCommandPayload` but the caller supplies the body and
 * the signCode verbatim (no ECB step): `len(u16) ‖ 0000 ‖ 0100 ‖ [channel, signCode] ‖ 0000 ‖ data`.
 */
export declare function buildRawCommandPayload(data: Buffer, channel?: number, signCode?: number, magic?: [number, number], streamId?: number): Buffer;
/** ACK payload for a received DATA frame: `[dataTypeHeader:2][count:2 BE][seqNo:2 BE]`. */
export declare function buildAckPayload(dataTypeHeader: Buffer, seqNo: number): Buffer;
/** Parse the 16-byte data-frame header that follows the "XZYH" magic. */
export declare function parseDataFrameHeader(frame: Buffer): P2PDataFrameHeader;
/** Parse a LOOKUP_ADDR or RLY_TO message's leading address record. */
export declare function parseLookupAddr(msg: Buffer): Address;
/** The relay servers a LIST_REQ_ACK names, in the order listed, without the unspecified address; records past the message's end are dropped. */
export declare function parseRelayList(msg: Buffer): Address[];
/** A RLY_PORT_ACK's mark and relay port, or `undefined` for a message too short to carry them. */
export declare function parseRelayPortAck(msg: Buffer): {
    mark: number;
    port: number;
} | undefined;
/** A RLY_TO's relay endpoint and handle, or `undefined` for a message too short to carry them. */
export declare function parseRelayTo(msg: Buffer): {
    address: Address;
    handle: number;
} | undefined;
/** Read a NUL-terminated UTF-8 string (CMD_NOTIFY_PAYLOAD carries JSON this way). */
export declare function readNullTerminatedString(data: Buffer, encoding?: BufferEncoding): string;
