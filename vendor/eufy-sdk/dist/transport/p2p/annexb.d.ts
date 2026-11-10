/**
 * Annex-B elementary-stream helpers — the single NAL-sniffing source of truth for the P2P media
 * pipeline. Both the live source (codec tag on every frame) and the fMP4 muxer (parameter sets for
 * the init segment) read the stream through here, so the start-code scan + NAL-type decode lives in
 * exactly one place.
 *
 * H.264 (Annex-B): NAL type = `byte & 0x1f`; SPS = 7, PPS = 8, IDR = 5.
 * H.265/HEVC (Annex-B): NAL type = `(byte >> 1) & 0x3f`; VPS = 32, SPS = 33, PPS = 34, IDR = 19/20.
 *
 * @module p2p/annexb
 */
import type { VideoCodec } from "../../core/contracts.js";
/** Split an Annex-B access unit into its individual NAL bodies (start codes stripped). */
export declare function splitAnnexbNals(buf: Buffer): Buffer[];
/**
 * Sniff the codec of an Annex-B access unit by its parameter-set NAL units. Returns `undefined` when
 * the buffer carries no config NAL (a plain delta frame) — the caller should carry the last-known
 * codec rather than guess. Only the first 64 bytes are scanned (config NALs lead the access unit).
 */
export declare function sniffAnnexbCodec(buf: Buffer): VideoCodec | undefined;
/** Parameter sets extracted from a keyframe access unit — the input to an fMP4 init segment. */
export interface ParamSets {
    codec: VideoCodec;
    /** H.264 SPS / H.265 SPS NAL bodies (start-code stripped), in stream order. */
    sps: Buffer[];
    /** H.264 PPS / H.265 PPS NAL bodies. */
    pps: Buffer[];
    /** H.265 VPS NAL bodies (empty for H.264). */
    vps: Buffer[];
}
/**
 * Extract the SPS/PPS (and, for H.265, VPS) parameter-set NAL bodies from a keyframe access unit.
 * Each returned buffer is the raw NAL (start-code stripped), ready to embed in an `avcC` / `hvcC`
 * decoder-config record. Returns `undefined` if no parameter sets are present.
 */
export declare function extractParamSets(buf: Buffer): ParamSets | undefined;
/**
 * The parameter sets in force after `buf`, folding what it announces into `current`.
 *
 * A camera commonly announces SPS/PPS ONCE, with the first keyframe of a stream, so anything that will
 * later hand a burst to a decoder has to watch EVERY unit go past — including ones it discards.
 *
 * Folds per kind rather than replacing wholesale, because a decoder retains the last set it was given of
 * EACH kind: a unit announcing an SPS alone re-states that SPS and says nothing about the PPS, so
 * replacing the whole record would drop a PPS that is still in force. A codec change replaces
 * everything — sets from another codec describe a different bitstream.
 *
 * Cheap on the overwhelmingly common case: {@link extractParamSets} answers from a bounded head scan when
 * a unit carries no config NAL, so an ordinary delta frame costs no full-buffer walk.
 */
export declare function updatedParamSets(buf: Buffer, current: ParamSets | undefined): ParamSets | undefined;
/**
 * Re-emit `sets` as Annex-B NALs immediately ahead of `annexb`, so a unit whose parameter sets were
 * sent earlier in the stream becomes decodable on its own.
 *
 * A decoder reads parameter sets in stream order, so they are emitted VPS → SPS → PPS: a PPS ahead of
 * the SPS it references is as useless as none at all. Sets carrying no NALs return the input unchanged
 * rather than an equal copy.
 *
 * Emitting a duplicate set is harmless — a decoder overwrites the entry with the same id — which is why
 * this needs no knowledge of what the unit already carries; {@link extractParamSets} answers what a
 * unit carries already.
 */
export declare function prefixParamSets(annexb: Buffer, sets: ParamSets): Buffer;
/**
 * Whether an Annex-B access unit contains an IDR (keyframe) NAL. Cheap scan used to key-align the
 * ring buffer / fragment boundaries when the frame header's keyframe flag isn't authoritative.
 */
export declare function hasIdr(buf: Buffer, codec: VideoCodec): boolean;
/** A width/height pair in luma samples. */
export interface Size {
    width: number;
    height: number;
}
/**
 * What a parameter set says a picture's dimensions are — both of them.
 *
 * A stream states TWO sizes and a consumer needs whichever matches what it holds. {@link CodedGeometry.width}
 * and `height` are the DISPLAY size, the picture as a viewer should see it. {@link CodedGeometry.coded} is the
 * size it is actually coded at, rounded up to the macroblock (H.264) or CTU (H.265) grid, and
 * {@link CodedGeometry.crop} is the window between them, already scaled from the chroma units the syntax
 * states them in into luma samples.
 *
 * The distinction is not a refinement: 1080 is not a multiple of 16, so the commonest geometry there is codes
 * 1088 rows and crops 8 away. A caller that muxes or measures wants the display size; a caller DECODING frames
 * itself gets the coded size back from its decoder and needs the window to crop with — one that assumes the two
 * are the same emits eight rows of encoder padding and calls the result 1088 tall.
 */
export interface CodedGeometry extends Size {
    /** The size the picture is coded at — macroblock- or CTU-aligned, and never smaller than the display size. */
    coded: Size;
    /** The crop (H.264) or conformance (H.265) window, in LUMA samples. */
    crop: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
}
/**
 * Profiles whose SPS carries the chroma, bit-depth and scaling-matrix fields (H.264 Annex A).
 *
 * `144` is the 2005-edition High 4:4:4 that `244` replaced. It is absent from the current standard's list but
 * present in streams, and a set read without its branch lands mid-element — so it is carried here rather
 * than left to misparse into a plausible geometry.
 */
export declare const H264_CHROMA_PROFILES: Set<number>;
/**
 * The picture geometry a decoder will produce from the parameter sets in force, or `undefined` when no
 * SPS could be read.
 *
 * This is the authority on a live stream's geometry. A frame header states the geometry at capture start,
 * and a source that reconfigures mid-session leaves it contradicting the bytes it is sending — so a
 * consumer that rebuilt a decoder from the header would size it for a picture the stream is not carrying.
 * The SPS is what the picture actually is.
 *
 * The crop and conformance offsets are part of the answer rather than a refinement of it: 1080 is not a
 * multiple of the 16-sample macroblock, so a 1080p H.264 stream codes 1088 rows and crops 8 away. A read
 * that stopped at the coded size would be wrong by exactly that on the commonest geometry there is.
 *
 * Answers from the LAST SPS of the set, which is the one in force. AV1 is not parsed — the SDK decodes no
 * AV1 sequence header, and a size from another codec's syntax would be a fabrication.
 */
export declare function codedGeometry(sets: ParamSets): CodedGeometry | undefined;
