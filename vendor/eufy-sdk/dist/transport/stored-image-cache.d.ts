import type { Logger } from "../core/logger.js";
/** In-memory state for push thumbnails acquired before a caller passively reads them. */
export declare class StoredImageCache {
    private readonly downloader;
    private readonly logger;
    private readonly clock;
    private readonly isLifecycleError;
    private readonly devices;
    private readonly activeDevices;
    private activeDownloads;
    private generation;
    constructor(downloader: (url: string, deviceKey: string) => Promise<Buffer>, logger: Logger, clock?: () => number, isLifecycleError?: (error: unknown) => boolean);
    /**
     * Observe a normalized thumbnail URL and start acquisition eagerly.
     *
     * A URL already inside this device's window of recent attempts is ignored, so one event arriving as
     * several pushes downloads one thumbnail. The window is a `Set`, which iterates in insertion order,
     * so the entry evicted once it is full is the oldest attempt.
     */
    observe(deviceKey: string, url: string): void;
    /** Return retained bytes without starting or awaiting network work. */
    snapshotStored(deviceKey: string): Promise<Buffer>;
    /** Invalidate all retained and candidate state. */
    clear(): void;
    private pump;
    private complete;
    /** Schedule the next attempt after a 404; answers whether one was scheduled. */
    private retryLater;
    private isValidJpeg;
    private diagnose;
}
