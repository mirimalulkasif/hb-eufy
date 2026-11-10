/**
 * Readable egress — mint a `node:stream` Readable over a {@link Consumer} of a {@link SharedLiveSource}.
 *
 * This is the in-process pull surface: the Readable can be piped anywhere a `node:stream` goes, without
 * touching the P2P internals. Backpressure is honored — when the Readable's internal buffer fills, the
 * consumer is paused; the consumer's own bounded queue then applies the V2 drop-to-keyframe policy if
 * the sink stays slow, so one stuck reader never stalls the shared upstream or its peers. Destroying the
 * Readable detaches the consumer (refcount--).
 *
 * Two modes: raw Annex-B **bytes** (default) or **objectMode** {@link LiveVideoFrame}s, which carry the
 * codec/keyframe metadata per access unit.
 *
 * @module p2p/readable-egress
 */
import { Readable } from "node:stream";
import type { Consumer } from "./shared-live-source.js";
export interface ReadableEgressOptions {
    /** Emit {@link LiveVideoFrame} objects instead of raw Annex-B bytes (default false = bytes). */
    objectMode?: boolean;
    /** Yield ReceivedVideoFrame envelopes with original source-arrival times; ignored in raw mode. */
    arrivalTime?: boolean;
    /** Readable highWaterMark (bytes, or object count in objectMode). */
    highWaterMark?: number;
}
/**
 * Wrap a shared-source {@link Consumer} in a fresh Readable. The consumer is detached when the
 * Readable is destroyed/ended, so callers own the lifetime by owning the stream.
 * Frames arrive through onMedia, preserving their source-arrival metadata.
 */
export declare function openReadableFromConsumer(consumer: Consumer, opts?: ReadableEgressOptions): Readable;
