import { type RecordingDownload } from "../../core/contracts.js";
import type { P2PSession } from "./p2p-session.js";
/** Data type a station sends a recording's frames on: the binary channel (`0xd1 0x03`), not live video's. */
export declare const RECORDING_DATA_TYPE = 3;
/**
 * Most frame bytes a transfer holds. The station sends faster than real time, so the time bounds alone do
 * not bound memory; an event recording is far below this.
 */
export declare const MAX_TRANSFER_BYTES: number;
/** One recording frame as received, in arrival order. */
export interface RecordingFrame {
    commandId: number;
    signCode: number;
    raw: Buffer;
}
/**
 * The path a HomeBase 2 stores a camera's recording under: the camera's channel, two digits, and the
 * recording name the event push carries. Answers `undefined` for a name that is not the station's
 * fourteen-digit `yyyyMMddHHmmss` form. The name comes from a push, so the test stays anchored and
 * digits-only: no `..`, slash or other character that could reach another path on the station gets through.
 */
export declare function homeBase2RecordingPath(channel: number, recording: string): string | undefined;
/** One recording transfer on a station session. */
export interface RecordingTransfer {
    /** The recording's frames, in arrival order. Rejects as {@link receiveRecording} describes. */
    frames: Promise<RecordingFrame[]>;
    /** Resolves once the station has stopped sending this recording, which can be after `frames` rejected. */
    drained: Promise<void>;
}
/**
 * Request one recording and collect its frames until `CMD_DOWNLOAD_FINISH`. Only frames on
 * {@link RECORDING_DATA_TYPE} tagged with the camera's channel belong to it, so a live stream open on the same
 * station is never mixed in. The finish frame is taken on the camera's channel or channel 0.
 *
 * `frames` rejects with {@link RecordingDownloadError}: `no-data` when nothing arrives within
 * {@link FIRST_FRAME_WAIT_MS}, and `incomplete` when the transfer ends without its finish frame, on a
 * {@link IDLE_END_MS} silence, on `timeoutMs` or on {@link MAX_TRANSFER_BYTES}. An abort rejects it at once
 * with the signal's reason. After a time bound, the byte ceiling or an abort, the transfer stops collecting
 * but keeps listening until the station finishes or goes quiet, and only then resolves `drained`.
 */
export declare function receiveRecording(session: P2PSession, request: {
    path: string;
    accountId: string;
    channel: number;
    timeoutMs?: number;
    signal?: AbortSignal;
}): RecordingTransfer;
/**
 * Decode a recording's frames, in arrival order, into elementary streams. Split pictures are assembled
 * before they enter the output; an orphan continuation cannot become its own picture. Keyframes go
 * through one {@link VideoFrameDecoder}, whose media key then opens the audio; a keyframe that does not
 * open under `eccPrivateKeyHex`, and every audio frame before the first media key, are dropped. Rejects with
 * {@link RecordingDownloadError} `undecodable` when no video frame decodes.
 */
export declare function decodeRecording(frames: readonly RecordingFrame[], eccPrivateKeyHex: string): RecordingDownload;
