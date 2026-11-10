/**
 * A portal camera live pull: T9000 shares its control session, NVR media owns a dedicated call.
 *
 * Wire, as the portal sends it on the command data channel:
 *
 *  - Start is inner `cmd 1003` in a `1350` SET_PAYLOAD on the station channel `255`. The header byte the
 *    codec names `isResponse` carries the portal's `streamId`, `1` for a live view, and `chn_list` is an
 *    array of `{index, chn, sensor, isUps, isClicked}` objects. Stop is inner `cmd 1004`, the same way.
 *  - Video arrives on the live link as portal packets `1300` on channel `100 + play id`; a single-camera
 *    view is play id `1`, whatever the camera's own channel. Each body is a fixed 22-byte media header,
 *    then the Annex B video it declares. See {@link parseMediaBody}.
 *  - A raw, unframed keepalive (a 20-byte prefix and a bare `XZYH 1139`) goes out every ~29 s; the hub
 *    echoes it.
 *
 * A session serves one live view on that play slot. This is a {@link LiveStreamHandle}:
 * fan-out, backpressure and the start deadline are the
 * shared live source's.
 */
import { EventEmitter } from "node:events";
import type { LiveStreamHandle } from "../../core/contracts.js";
import type { Logger } from "../../core/logger.js";
import type { RtcSession } from "./session.js";
import { type SegmentCounter } from "./portal-packet.js";
/**
 * Read a `1300` body: a 22-byte media header (u32 LE video length at 0, stream type at 5, u16 LE width
 * and height at 10 and 12), then the Annex B video. This is the layout the portal's own HEVC worker
 * parses. Answers `undefined` for a short body, a stream that is not HEVC, or a declared length the body
 * does not hold.
 */
export declare function parseMediaBody(body: Buffer): {
    data: Buffer;
    width: number;
    height: number;
} | undefined;
export interface RtcLiveOptions {
    session: RtcSession;
    /** The session's segment counter, shared with the command router so segments never collide. */
    seg: SegmentCounter;
    stationSn: string;
    /** The camera's `device_channel` on the station. */
    channel: number;
    /** The station's `member.admin_user_id`. */
    accountId: string;
    logger?: Logger;
    /** NVR media owns and connects its session. */
    nvr?: boolean;
    /** Optical view carried by the NVR start request; defaults to 0. */
    view?: number;
}
/**
 * One camera's live pull. `start()` sends the start; a non-zero start ACK or a closed session ends it with
 * `error`, and `stop()` sends the stop. Video is H.265 Annex B, keyframes being IDRs.
 */
export declare class RtcLiveStream extends EventEmitter implements LiveStreamHandle {
    private readonly opts;
    private running;
    private startSegment;
    private readonly onConnected;
    private readonly onError;
    private keepalive?;
    private width;
    private height;
    private readonly onMedia;
    private readonly onCommand;
    private readonly onClose;
    constructor(opts: RtcLiveOptions);
    private get tag();
    start(): this;
    private sendStart;
    stop(): void;
    private teardown;
    private fail;
    /** The start's ACK: a non-zero result code ends the pull. */
    private onCommandFrame;
    private onMediaFrame;
}
