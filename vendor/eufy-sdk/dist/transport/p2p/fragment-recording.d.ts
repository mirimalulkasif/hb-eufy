import { EventEmitter } from "node:events";
import type { FragmentRecordingHandle, MediaFragment, StreamBudgetNotice } from "../../core/contracts.js";
import type { SharedLiveSource } from "./shared-live-source.js";
export interface FragmentRecordingOptions {
    fragmentSeconds?: number;
    preBufferSeconds?: number;
}
/**
 * One caller-owned fragmented recording over a shared live source. Buffered and live frames pass
 * through the same timestamp-aware muxer, while budget notices retain the source's `extend()` handle.
 */
export declare class FragmentRecording extends EventEmitter implements FragmentRecordingHandle {
    private readonly opts;
    private readonly mux;
    private readonly queue;
    private consumer?;
    private wake?;
    private failure?;
    private ended;
    private iterated;
    private held;
    private readonly ready;
    constructor(source: Promise<SharedLiveSource>, opts?: FragmentRecordingOptions);
    on(event: "budget", listener: (notice: StreamBudgetNotice) => void): this;
    stop(): void;
    [Symbol.asyncIterator](): AsyncIterator<MediaFragment>;
    private attach;
    private ingest;
    /** Hand over the next fragment, releasing the consumer once the owner is back inside the bound. */
    private take;
    private fail;
    private nudge;
}
