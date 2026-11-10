/**
 * Camera **media** operations over P2P — live snapshot, live stream, clip recording.
 *
 * These take an already-resolved {@link P2PSession} (the client owns session/channel resolution) and
 * return data. They speak only P2P + ffmpeg — no dependency on the client class — so the client stays
 * thin and this stays the single home for the media protocol. Surfaced to consumers via
 * `device.camera()`.
 *
 * `snapshotLive` / `record` shell out to ffmpeg. The binary is whatever {@link spawnFfmpeg} resolves —
 * the bare name on `PATH` by default, or the executable the caller named (`ffmpegPath`).
 *
 * @module p2p/media
 */
import { P2PSession } from "./p2p-session.js";
import { LiveStream, type LiveStreamOptions } from "./live-stream.js";
import { type FfmpegLevel } from "../ffmpeg.js";
import { type Logger } from "../../core/logger.js";
import type { SharedLiveSource } from "./shared-live-source.js";
/**
 * Open a managed **live stream** on an already-connected session. Returns the {@link LiveStream}
 * already `start()`ed; call `.stop()` when done. (Session/channel/level-2-key resolution is the
 * caller's job — see `EufyMega.resolveSession`.)
 */
export declare function openLiveStream(session: P2PSession, opts?: LiveStreamOptions): Promise<LiveStream>;
/**
 * **Live snapshot off a SHARED source** (V6) — snapshot as just another consumer of the shared live
 * pull. A warm source reuses its upstream session; collection starts from live keyframes rather than
 * a retained picture. A live source captures its next keyframe by default; a cold source skips the
 * first keyframe because its first IDR is frequently partial. Requires `ffmpeg` for the Annex-B → JPEG decode.
 *
 * The returned dimensions are the ENCODED IMAGE's own, read back out of it — never the frame header's.
 * The header states the stream's geometry when the capture started, and a stream that reconfigures
 * mid-burst leaves it describing something the returned bytes contradict; the return value describes an
 * image, so the image is its source of truth.
 *
 * The consumer is detached the moment the collected run is complete, and the decode that follows holds no
 * station: it works on bytes already in memory. One session serves one camera at a time and a still never
 * opens a second one, so a still that kept its pull attached across its own decode would deny
 * that station to every live request for the length of an FFmpeg run — measured on a real base as a live
 * request refused 370ms after the still it was waiting on had already collected everything it needed.
 *
 * `signal` ends the collection itself, not only the wait for it, and rejects with the signal's own reason
 * because the abandonment is the caller's fact and not a failure of the source. It reaches only the
 * collection: past that the station is already free, so there is nothing left for it to release.
 */
export declare function captureSnapshotFromShared(source: SharedLiveSource, opts?: {
    timeoutMs?: number;
    collectMs?: number;
    skipKeyframes?: number;
    signal?: AbortSignal;
    logger?: Logger;
    ffmpegLevel?: FfmpegLevel;
    ffmpegPath?: string;
}): Promise<{
    jpeg: Buffer;
    width: number;
    height: number;
}>;
/**
 * **Record** a clip — collect the live H.264/H.265 stream for `seconds` and mux it to a fragmented
 * MP4 (same source as {@link captureSnapshotFromShared}, kept running and written to a container).
 * Recording starts at the first complete keyframe so the clip is seekable. Requires `ffmpeg`.
 *
 * Opens its OWN {@link LiveStream} over the session rather than joining the device's shared source, so it
 * costs a second pull on a camera already streaming, and the shared path's release of a sibling's lingering
 * pull does not reach it. `recordFragments` is the shared-consumer path.
 *
 * The clip therefore starts at the SECOND keyframe, so parameter sets announced only with the first are
 * dropped along with it — every frame is watched for an announcement, including the skipped ones, and
 * the collected run is primed before muxing. This also settles the codec, which is sniffed from a config NAL:
 * a run of bare slices would otherwise fall back to H.264 and mislabel an H.265 clip.
 *
 * **Bounded in both phases, so it always settles.** The first phase is bounded by `timeoutMs` waiting for the
 * keyframe the clip starts at; the second is bounded by the clip's own window, which is armed as a deadline
 * the moment capture starts rather than being read off the next frame to arrive. A camera that goes quiet
 * mid-clip delivers no further frame to compare a clock against — measured on an own-session camera that
 * stopped 13.6 s into a stream with no `stop` and no `error` — so a clip whose end is decided inside a frame
 * handler has no end at all, and the promise stays pending for the life of the process. The deadline answers
 * with the run collected up to it: the window the caller asked for has elapsed, and frames the camera never
 * sent cannot be waited into existence.
 *
 * A pull whose SESSION goes away before that window elapses fails the clip instead, naming the close. No
 * further frame can arrive on it, so there is nothing left to wait for, and a caller that asked for a clip of
 * a stated length is told the session went away rather than handed a fragment as if it were the clip. A decode
 * failure on the stream fails it the same way.
 *
 * The `error` listener outlives the collection deliberately. An unhandled `error` on an emitter takes the host
 * process down, and the stream is stopped only after the promise settles, so it stays attached and a late
 * failure lands on an already-settled promise as the no-op it is.
 */
export declare function recordClip(session: P2PSession, seconds: number, opts?: {
    timeoutMs?: number;
    skipKeyframes?: number;
    logger?: Logger;
    ffmpegLevel?: FfmpegLevel;
    ffmpegPath?: string;
} & LiveStreamOptions): Promise<Buffer>;
/**
 * The geometry a JPEG declares in its own frame header (`SOFn`), or `undefined` when it carries none.
 *
 * Walks the marker segments from the SOI rather than searching for the marker bytes: a `0xffc0` pair
 * occurs inside quantization tables and entropy-coded data, and the first one found there would answer
 * with two bytes of image content. Every `SOFn` puts precision, then height, then width at the same
 * offset past its length field, so one read serves all of them. Any number of `0xff` fill bytes may
 * precede a marker, and the standalone markers carry no length to skip by — both are what a naive walk
 * gets wrong, and either would make a perfectly good image read as having no geometry.
 *
 * Decoding the image (the `jpeg-js` path the v2 thumbnail decoder needs) would answer the same question,
 * but it is synchronous pure JS over every pixel: this needs a dozen bytes of header, so it reads them.
 */
export declare function jpegGeometry(jpeg: Buffer): {
    width: number;
    height: number;
} | undefined;
