import type { BizChannel, BizMapFrame } from "../transport/mqtt/biz-stream.js";
import type { RawDpCodec } from "../core/contracts.js";
import type { VacuumMapPiece } from "../model/index.js";
/**
 * Which channels are read, named as {@link BIZ_CHANNEL} names them — the key set of
 * {@link READER_BY_CHANNEL}. The `satisfies` on that table constrains every key to a `BizChannel`.
 */
export declare const DECODED_MAP_CHANNELS: readonly BizChannel[];
/**
 * Decode one frame off the map stream into the map piece it carries, or `undefined`.
 *
 * `undefined` is the ordinary answer for a channel nothing reads yet, and for a frame that is not a
 * whole message.
 *
 * **A frame with a non-zero `offset` is skipped without being decoded.** A large map is split across
 * frames, and `offset` locates this one within its channel — so whatever it counts, a non-zero value
 * means this is not the start of a message. Handing a fragment to a protobuf reader is how a decoder
 * produces a confident wrong answer. The reader would in fact reject it anyway, because the frame's
 * own length prefix disagrees with a partial body, but relying on that would make correctness an
 * accident of the framing rather than a decision.
 */
export declare function decodeMapFrame(frame: BizMapFrame, codec: RawDpCodec): VacuumMapPiece | undefined;
