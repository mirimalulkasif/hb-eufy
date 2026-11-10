/**
 * Live view of a T8223 doorbell (Video Doorbell C31) over a portal `call` {@link RtcSession}.
 *
 * The doorbell is its own station and streams no PTCS framing: its video arrives as plain RTP on the
 * offer's H.264 video m-line, which a {@link RtcPeerOptions.mediaTrack} peer hands over as `rtp`. This
 * stream depacketizes it into whole Annex-B access units, one per frame. Each stream owns its session:
 * starting it places the call, stopping it hangs up.
 */
import { EventEmitter } from "node:events";
import type { LiveStreamHandle } from "../../core/contracts.js";
import { type Logger } from "../../core/logger.js";
import type { RtcSession } from "./session.js";
/**
 * H.264 RTP depacketizer (RFC 6184 single NAL / STAP-A / FU-A). Feed whole RTP packets; it calls `onUnit`
 * with each complete Annex-B access unit when the marker bit closes it. A unit with a sequence gap or an
 * unterminated fragment is dropped, never delivered short. RTCP multiplexed on the same transport (PT
 * 200-207, which reads as 72-79 in the RTP payload-type bits) is skipped.
 */
export declare class H264Depacketizer {
    private readonly onUnit;
    private nals;
    private fu;
    private lastSeq;
    private broken;
    constructor(onUnit: (unit: Buffer, timestamp: number) => void);
    push(packet: Buffer): void;
}
/** A `LiveStreamHandle` over one portal `call` to a T8223 doorbell. */
export declare class RtcCallLiveStream extends EventEmitter implements LiveStreamHandle {
    private readonly session;
    private readonly logger;
    private running;
    private readonly depacketizer;
    /** `session` is a session on a {@link RtcPeerOptions.mediaTrack} peer, not yet connected. */
    constructor(session: RtcSession, logger?: Logger);
    start(): this;
    stop(): void;
    private onUnit;
    private fail;
    private teardown;
}
