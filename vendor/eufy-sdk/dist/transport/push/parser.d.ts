/**
 * MCS wire-stream parser. The TLS stream is framed as:
 *   first packet:  [version:1][tag:1][varint length][protobuf]
 *   then each msg: [tag:1][varint length][protobuf]
 * Chunks arrive arbitrarily split, so we accumulate and re-enter as data lands.
 * Implements Google's MCS (mtalk) stream framing.
 */
import { EventEmitter } from "node:events";
export declare class McsParser extends EventEmitter {
    private data;
    private state;
    private messageTag;
    private messageSize;
    private sizePacketSoFar;
    /** Reset for a fresh connection. */
    reset(): void;
    /** Feed a chunk of TLS bytes. */
    handleData(chunk: Buffer): void;
    private minBytesNeeded;
    private waitForData;
    private onVersion;
    private onTag;
    private onSize;
    private onBytes;
    private next;
    private emitMessage;
}
