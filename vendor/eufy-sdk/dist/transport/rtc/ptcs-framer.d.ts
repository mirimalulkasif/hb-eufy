/**
 * The PTCS packetiser: a clean-room implementation of the framing the portal wraps around every portal
 * packet on `WebrtcDataChannel` (the portal's `libsctp` module). Nothing of that module ships here.
 *
 * Every wire packet is the same size, `28 + payload bytes`, zero-padded. The size is carried per packet,
 * so the receiver accepts any:
 *
 *   0   "PTCS"
 *   4   u8   3              constant
 *   5   u8   channel        the logical channel the frame belongs to: 0 command, 2 notify, 5 live
 *   6   u16  sequence       a frame counter: every packet of a frame carries the same value, and it
 *                           steps once per frame
 *   8   u32  frame id       one value per frame, shared by all its packets — the portal uses a ms clock
 *   12  u32  frame length   total bytes of the frame
 *   16  u16  packet index   0-based position of this packet in the frame
 *   18  u16  0x4000 | (last ? 0x0400 : 0) | payload length      (payload ≤ 1023 fits the low bits)
 *   20  8 × 0
 *   28  payload             `payload length` bytes, then zeros to the packet size
 *
 * The format carries no forward error correction. The receiver completes a frame only when every index
 * up to the `last` one is present and their lengths add up; frames whose packets stop arriving are
 * dropped after {@link PTCS_STALE_MS}.
 */
export declare const PTCS_HEADER_LENGTH = 28;
/** The portal's packet payload size: 1028-byte packets, 1000 bytes of payload after the header. */
export declare const PTCS_DEFAULT_PAYLOAD_BYTES = 1000;
/** SCTP channel ids as the portal numbers them, and the link type each maps to on receive. */
export declare const PtcsChannel: {
    readonly COMMAND: 0;
    readonly NOTIFY: 2;
    readonly LIVE: 5;
};
/** The link type a received frame belongs to: notify and live on their channels, command otherwise. */
export declare function linkTypeForChannel(channel: number): number;
/** How long a partly received frame is kept before it is dropped. */
export declare const PTCS_STALE_MS = 15000;
export interface PtcsHeader {
    channel: number;
    /** The sender's running packet counter — see the header map. */
    sequence: number;
    frameId: number;
    frameLength: number;
    index: number;
    last: boolean;
    payloadLength: number;
}
export declare function parsePtcsHeader(packet: Buffer): PtcsHeader | undefined;
/** Split one frame into wire packets. */
export declare function packetize(frame: Buffer, opts: {
    channel?: number;
    frameId: number;
    payloadBytes?: number;
    sequence?: number;
}): Buffer[];
/** Reassemble frames from wire packets, in any order, one frame at a time per (channel, id). */
export declare class PtcsReassembler {
    private readonly onFrame;
    private readonly now;
    private readonly partials;
    constructor(onFrame: (frame: Buffer, channel: number) => void, now?: () => number);
    push(packet: Buffer): boolean;
    /** Drop frames that stopped arriving; call periodically. */
    expire(): void;
}
/** Frame ids the way the portal draws them — a millisecond clock, nudged forward on a collision. */
export declare function frameIdClock(now?: () => number): () => number;
/**
 * The framer between portal packets and the data channel: PTCS out, PTCS in, with the portal's channel
 * mapping. An inbound bare `XZYH` packet, which the hub sometimes answers with, passes through as a
 * command frame. Frame ids are a millisecond clock and the frame counter starts at 0.
 */
export declare class PtcsFramer {
    private onWire?;
    private onFrame?;
    private reassembler?;
    private sweep?;
    private ready;
    private readonly nextFrameId;
    private sequence;
    /** Arm the two callbacks; `sendFrame` may be called from here on. */
    init(onWirePacket: (packet: Buffer) => void, onFrame: (frame: Buffer, linkType: number) => void): void;
    isReady(): boolean;
    sendFrame(portalPacket: Buffer): void;
    recvPacket(wirePacket: Buffer): void;
    destroy(): void;
}
