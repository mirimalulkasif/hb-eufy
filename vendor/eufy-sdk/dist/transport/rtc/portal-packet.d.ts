/**
 * The command framing a HomeBase S1 Pro (T9000) speaks over its WebRTC data channel — the wire the
 * security.eufy.com web client builds, reproduced byte-exact.
 *
 * A packet is a 16-byte header behind the ASCII magic `XZYH`, then a JSON body, sent in the clear (the
 * DTLS channel is the encryption). Replies come back with `isResponse = 1`, the same `segment` the
 * request carried, and a body whose first four bytes are a little-endian result code.
 *
 * Every offset is the portal bundle's header builder and parser (`Gr()` / `Qr()`) and its
 * `worker_sctp_send`.
 */
export declare const PORTAL_HEADER_LENGTH = 16;
/** The SET_PAYLOAD envelope. */
export declare const PORTAL_CMD_SET_PAYLOAD = 1350;
/** The channel a station-wide command is addressed to. */
export declare const PORTAL_STATION_CHANNEL = 255;
/** Portal link types — which logical channel a frame belongs to (`worker_sctp_send`). */
export declare const PortalLinkType: {
    /** Command channel: requests out, acknowledgements back. */
    readonly COMMAND: 1;
    /** Station-originated frames: pushes, notify payloads, control results. */
    readonly NOTIFY: 3;
    /** Live video. */
    readonly LIVE: 5;
};
export interface PortalHeader {
    commandId: number;
    paramLength: number;
    segment: number;
    channel: number;
    isResponse: number;
    devType: number;
}
export interface PortalRequest {
    commandId: number;
    channel: number;
    /** 1..255, wraps; echoed by the reply so it can be matched. */
    segment: number;
    payload: Record<string, unknown>;
    isResponse?: number;
    devType?: number;
}
export interface PortalResponse {
    commandId: number;
    channel: number;
    segment: number;
    isResponse: number;
    linkType: number;
    /** Command-channel replies only: the int32 result code (0 = ok). */
    errCode?: number;
    /** Notify frames: the nested `cmd` the JSON body carries. */
    cmd?: number;
    data?: unknown;
}
/** The 16-byte header (portal `Gr()`). */
export declare function buildPortalHeader(commandId: number, paramLength: number, channel: number, segment: number, isResponse?: number, devType?: number): Buffer;
/** Parse the header (portal `Qr()`); `undefined` when the magic is missing or the buffer is short. */
export declare function parsePortalHeader(buf: Buffer): PortalHeader | undefined;
/** Whether a buffer starts a portal packet. */
export declare function isPortalPacket(buf: Buffer): boolean;
/** A complete request packet: header + body. */
export declare function buildPortalPacket(req: PortalRequest): Buffer;
/**
 * Parse an inbound packet. On the command channel the body opens with the int32 result code and may
 * carry JSON after it; on the notify channel the whole body is JSON with a nested `cmd`.
 */
export declare function parsePortalPacket(buf: Buffer, linkType?: number): PortalResponse | undefined;
/** A 1..255 segment counter that never yields 0 (the portal reserves it). */
export declare class SegmentCounter {
    private current;
    next(): number;
}
