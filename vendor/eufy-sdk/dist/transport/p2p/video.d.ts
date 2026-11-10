/** AAD used for the AES-256-GCM body cipher of every video frame, and of a recording's audio. */
export declare const VIDEO_GCM_AAD: Buffer<ArrayBuffer>;
/** Parsed fields of a `CMD_VIDEO_FRAME` 22-byte header. */
export interface VideoFrameHeader {
    /**
     * Length of the body THIS frame carries, from u32 LE @ 0x00 — not the length of the access unit it
     * belongs to.
     *
     * A station serves a unit larger than {@link STATION_CHUNK_BYTES} as several frames, and each one
     * declares only its own share: measured on two models, a 70190-byte unit arrived as `64000` then
     * `6190`, and a 104451-byte keyframe as `64000` then `40451`. A frame that carries a whole unit
     * declares the whole unit, however large — a captured keyframe declares 0x3b323.
     */
    payloadLength: number;
    /** True when flag@0x04 bit0 is set: a keyframe carrying the ECIES envelope. */
    keyframe: boolean;
    /** Raw flag byte at 0x04. */
    flags: number;
    /**
     * u16 LE @ 0x06 — repeated across every frame of ONE access unit, which is what makes it usable as
     * part of a unit's identity. What it counts differs by model (one increments it per unit, another
     * leaves it 0 for the whole stream), so it is never read as a count on its own.
     */
    sequence: number;
    /** Frame width (s16 LE @ 0x0a). */
    width: number;
    /** Frame height (s16 LE @ 0x0c). */
    height: number;
    /** Timestamp word (u32 LE @ 0x0e). */
    timestamp: number;
}
/** A successfully decoded video frame. */
export interface DecodedVideoFrame {
    /** True if this was a keyframe (IDR) — its envelope re-keyed the decoder. */
    keyframe: boolean;
    /** Decrypted H.264 elementary-stream bytes. */
    h264: Buffer;
    /** Frame width in pixels. */
    width: number;
    /** Frame height in pixels. */
    height: number;
}
/**
 * Parse the 22-byte `CMD_VIDEO_FRAME` header. Does not validate lengths beyond the header itself,
 * so it is safe to call on a (sufficiently long) buffer to inspect frame metadata without keys.
 */
export declare function parseVideoFrameHeader(payload: Buffer): VideoFrameHeader | undefined;
/**
 * Decodes a single P2P video stream into H.264. Construct one per stream with the camera's 32-byte
 * ECC private key; feed it `CMD_VIDEO_FRAME` payloads in order. Keyframes re-key the decoder via
 * their ECIES envelope; P/B-frames reuse the cached media key. All failure modes (short/garbage
 * frame, wrong key, tampered HMAC, GCM auth failure) return `undefined` — the decoder never throws.
 */
export declare class VideoFrameDecoder {
    private readonly eccPrivateKeyHex;
    private mediaKey?;
    /** @param eccPrivateKey the camera's 32-byte ECC private key (P-256 scalar). */
    constructor(eccPrivateKey: Buffer);
    /** The media key recovered from the most recent keyframe, if any. */
    get currentMediaKey(): Buffer | undefined;
    /**
     * Recover the per-stream media key from a keyframe's 129-byte ECIES envelope: ECIES unwrap
     * (ECDH → eufyKDF → AES-128-CBC, with the trailing HMAC verified) → 32-byte AES-256-GCM key.
     */
    private unwrapMediaKey;
    /**
     * Decode one video frame. Returns the keyframe flag and decrypted H.264 bytes, or `undefined`
     * if the frame is malformed, the envelope/key is wrong, or GCM authentication fails.
     */
    decodeFrame(payload: Buffer): DecodedVideoFrame | undefined;
}
/** One whole access unit recovered from the frame (or frames) the station sent it in. */
export interface AssembledAccessUnit {
    /** Unsigned 32-bit header timestamp from the first frame of this access unit. */
    sourceTimestamp: number;
    /** True when the unit's own header flagged it a keyframe — a point a consumer may begin decoding at. */
    keyframe: boolean;
    /** Frame width the unit's header declared. */
    width: number;
    /** Frame height the unit's header declared. */
    height: number;
    /** The complete payload, as long as the header said it would be. */
    data: Buffer;
}
/**
 * The payload size a station fills a `CMD_VIDEO_FRAME` to before splitting an access unit across
 * several of them.
 *
 * Verified on two independent camera models on one account: every frame of a split unit declared
 * EXACTLY this, and the unit's last frame declared less.
 *
 * Matched by equality, never as a floor. Stations that do not split deliver whole units in one frame far
 * above this — measured at 148057, 231954 and 234670 bytes on three other models — and treating "at least
 * this big" as "more is coming" holds those units back and then discards them as truncated, which costs
 * exactly the keyframes a decoder cannot start without.
 */
export declare const STATION_CHUNK_BYTES = 64000;
/**
 * Reassembles a `CMD_VIDEO_FRAME` access unit the station split across several frames.
 *
 * Each frame declares only the payload IT carries ({@link VideoFrameHeader.payloadLength}), so the unit's
 * total length is nowhere on the wire and cannot be waited for. What the wire does carry, verified on two
 * models:
 *
 *  - the frames of one unit **repeat its header** — same timestamp, same {@link VideoFrameHeader.sequence} —
 *    while consecutive units differ in both;
 *  - every frame of a split unit is filled to {@link STATION_CHUNK_BYTES} except the last;
 *  - a frame that STARTS a unit begins with an Annex-B start code once decoded, and a continuation begins
 *    mid-NAL, so it does not.
 *
 * A unit is therefore held only while its latest frame is full, and completed the moment a shorter one
 * arrives — no delivery latency for the overwhelming majority of units, which arrive in one frame below
 * the threshold. The identity match and the missing start code are required TOGETHER before appending:
 * either alone would let two decodable units merge, and a merge is invisible to a consumer that trusts
 * the contract.
 *
 * **A unit is delivered only when it is complete.** A lost datagram makes the P2P layer discard the frame
 * it was reassembling, so a unit whose tail never arrives is ended by the next unit's first frame while
 * still full — that one is dropped and reported, never handed on short. Truncated bytes are worse than
 * none: a decoder given an access unit shorter than its own slice headers promise reports bitstream
 * truncation and produces no picture at all.
 *
 * Two consequences worth stating. A unit that is exactly the threshold long, or an exact multiple of it,
 * ends on a full frame and is dropped as truncated — one frame in ~64000, reported, and the alternative is
 * handing a decoder bytes that may genuinely be short. And a station that fills to some OTHER size is not
 * recognised: its units stay exactly as they arrive rather than being mis-joined.
 */
export declare class AccessUnitAssembler {
    private readonly onDropped?;
    private open?;
    private droppedUnits;
    /**
     * @param onDropped called for each incomplete unit discarded, with what had arrived, how many frames it
     * arrived in, and how many this assembler has dropped in total — a running count, so no caller keeps
     * its own.
     */
    constructor(onDropped?: ((drop: {
        carried: number;
        chunks: number;
        count: number;
    }) => void) | undefined);
    /**
     * Feed one raw `CMD_VIDEO_FRAME` payload; returns the access units it completed — none while a unit is
     * still being filled, one in the ordinary case.
     *
     * `decode` extracts the payload of a frame, whatever the stream's encryption: it is called for EVERY
     * frame, including a continuation, because a continuation carries its own wrapped key ahead of its share
     * of the payload (measured: 129 bytes beyond what its header declares, exactly as a unit's first frame
     * carries). A continuation without its matching open unit has no Annex-B start code and cannot be emitted
     * as a complete unit, even if its repeated header says keyframe.
     */
    push(payload: Buffer, decode: (payload: Buffer) => Buffer | undefined): AssembledAccessUnit[];
    /** Forget an incomplete unit, counting and reporting it. */
    discard(): void;
}
