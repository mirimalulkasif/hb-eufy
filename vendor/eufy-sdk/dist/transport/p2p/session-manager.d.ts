import { type Logger } from "../../core/logger.js";
import type { P2PSession } from "./p2p-session.js";
/** A station's power tier — governs its idle window. */
export type PowerTier = "wired" | "battery";
/**
 * A station open was abandoned because its entry was closed or superseded while the factory ran.
 *
 * Distinct from a connect failure: nothing is wrong with the device, the caller's reason to open it
 * simply stopped applying. A speculative caller treats this as a non-event; anyone who asked for the
 * session on a caller's behalf must still surface it.
 */
export declare class SessionSupersededError extends Error {
}
/** Default idle window for a battery station before its session is closed to let the device sleep. */
export declare const BATTERY_IDLE_MS = 300000;
/** How long a single control command holds a session warm after dispatch (a burst keeps re-holding). */
export declare const COMMAND_KEEPALIVE_MS = 15000;
/**
 * Default window a speculative pre-warm (e.g. after a doorbell ring) holds its user for. Expiring
 * releases that user; it does not close the session — the station's own idle window then runs, so an
 * unattended pre-warm on a battery station costs this plus {@link BATTERY_IDLE_MS}.
 */
export declare const PREWARM_MS = 28000;
export interface SessionManagerOpts {
    /** Idle window for battery stations (ms). Default {@link BATTERY_IDLE_MS}. */
    batteryIdleMs?: number;
    /** Keepalive a single command holds after dispatch (ms). Default {@link COMMAND_KEEPALIVE_MS}. */
    commandKeepAliveMs?: number;
    /**
     * Power tier per station serial — injected by the facade (no model import). Default: everything
     * `wired`. Asked about the STATION a session connects to, never the key it is filed under, so every
     * session to one station gets that station's idle window.
     */
    poweredFor?: (parentSn: string) => PowerTier;
    /**
     * Called with the KEY of a session the manager closed on its OWN initiative — an elapsed idle window,
     * or a deferred reset falling due. The key, not the station: several sessions can share a station and
     * only the one that closed is stale, so an owner told the station would tear down connections that are
     * still serving.
     *
     * Those two are the only closes with no caller to follow up: everything riding the session is stale the
     * moment it goes, and only the owner knows what that is. A close a caller asked for is that caller's to
     * clean up after, which is why this does not fire for {@link SessionManager.close},
     * {@link SessionManager.closeAll}, or a superseded open.
     */
    onAutoClose?: (key: string) => void;
    /** Diagnostics sink for the lifecycle transitions (open / idle-arm / detach). Omit for silence. */
    logger?: Logger;
}
/**
 * Manages P2P sessions by **key**, each recording the station it connects to. The router builds and
 * wires the actual `P2PSession` (it owns the socket and event fan-out); this decides open/close timing.
 *
 * A key is the station's serial for the one session that carries its control traffic and its events.
 * Where a station has to serve more than one camera at once it also holds a session per camera, filed
 * under a key of the router's choosing and recording the same station — so each has its own refcount and
 * its own idle window, and releasing one never disturbs another.
 */
export declare class SessionManager {
    private readonly opts;
    private readonly entries;
    /** Invalidates station factories that finish after {@link closeAll}. */
    private generation;
    private readonly logger;
    constructor(opts?: SessionManagerOpts);
    /** The live session for a station, or `undefined` if not open. */
    get(key: string): P2PSession | undefined;
    /** Keys of the open sessions. */
    keys(): string[];
    /** A plain `Map<key, P2PSession>` snapshot of the open sessions (for `getSessions()` / tests). */
    liveSessions(): Map<string, P2PSession>;
    /**
     * Get or create the lifecycle entry under `key`, recording which station it connects to. An existing
     * entry keeps the station it was opened with — the key owns one connection for its lifetime, and a
     * later caller passing a different station would otherwise re-point a live entry's power tier.
     */
    private entry;
    /**
     * Register an already-built session for test seeding or an externally assembled connection.
     *
     * `station` defaults to the key, which is safe HERE and nowhere else in this class: the paths that open a
     * session under a key that is not a station serial all go through {@link acquire}, which requires it. A
     * caller seeding one under such a key must pass it.
     */
    register(key: string, session: P2PSession, station?: string): void;
    /**
     * Ensure a session to `key` is open, building it via `factory` if cold. Concurrent calls for the
     * same cold station share ONE connect (the `connecting` promise); `factory` builds + wires + awaits
     * `connect()` and resolves the connected session.
     */
    acquire(key: string, factory: (register: (session: P2PSession) => void) => Promise<P2PSession>, station: string): Promise<P2PSession>;
    /**
     * Add a reason to stay connected; cancels a pending idle-close.
     *
     * Refused when nothing is open under `key`, for the reason {@link release} gives in the other direction: a
     * retain names a session that was acquired, and one that names nothing would file an entry with no
     * connection behind it. {@link hold} is the path that legitimately creates one, and it opens the entry
     * itself before retaining it.
     */
    retain(key: string): void;
    /**
     * Release a reason; arm the idle-close when the last one goes.
     *
     * A release with nothing retained is REFUSED rather than clamped to zero. Such a release was never
     * earned on this entry, and letting it proceed would either restart a battery station's idle window
     * from scratch or complete a deferred reset a real viewer has not yet earned. Clamping to zero did
     * both silently.
     */
    release(key: string): void;
    /**
     * Hold a session warm for `commandKeepAliveMs` after a control command, then release. A burst of
     * commands each re-holds before the previous release fires, so the session never idles mid-burst.
     */
    bumpCommand(key: string, station: string): void;
    /**
     * Retain a session and release it again after `ms` — the primitive behind command-keepalive and event
     * pre-warm, and the only way to hold one open without an attachment to release it.
     *
     * `station` is required rather than defaulted from the key, because this is the one path that can
     * CREATE an entry: a pre-warm takes its hold before the open. An entry filed under a media key with
     * that key as its own station would be asked for the power tier of a serial that does not exist, be
     * answered `wired`, and never idle-detach — which on a battery station is the drain this class exists
     * to prevent, and is invisible until the battery is flat.
     *
     * The timer is owned by the entry, so {@link discard} cancels it. That ownership is the point: keyed
     * only by serial, an expiring hold would otherwise outlive the entry it was taken on and release a
     * retain counted by the SUCCESSOR entry — dropping a live viewer's count and arming an idle-detach
     * underneath it.
     */
    hold(key: string, ms: number, station: string): void;
    /**
     * Arm the idle-close timer for a station whose retain count just reached zero. A wired station with
     * an infinite window is left persistent (no timer). Any subsequent {@link retain} cancels it.
     */
    private armIdle;
    /**
     * Close a station's session once its idle window elapses with nothing retained, letting the device sleep.
     * Re-checks the count first (activity between the timer firing and now re-arms instead). Dropping the
     * entry here and the session's own `close` → {@link remove} are both idempotent.
     */
    private onIdle;
    /**
     * Close a station the manager itself decided to close, and announce it.
     *
     * The announcement is the whole point: {@link SessionManagerOpts.onAutoClose} is how the owner learns
     * about a teardown it did not request, and so the only way anything riding the session — a lingering
     * live source, a talkback — gets dropped rather than handed out again over a dead connection.
     *
     * It fires the moment the entry is discarded, BEFORE the socket teardown and before any deferred reset
     * settles. That is deliberate on both counts: from the instant the entry is gone a fresh acquisition
     * resolves a new session while a cached source still points at the old one, so announcing later leaves
     * a window in which a viewer can attach to a stale source; and a caller awaiting a reset should find
     * the station's riders already dropped when it resumes.
     *
     * An entry that never carried a session is still torn down, but silently: a pre-warm whose open failed
     * leaves one behind, and announcing it would report a station closed that was never reported open.
     */
    private autoClose;
    /** Drop a station's entry + timer (called from the session's `close` handler). Idempotent. */
    remove(key: string): void;
    /** Close one station now and discard its lifecycle entry. */
    close(key: string): Promise<void>;
    /**
     * Reset once every viewer detaches, ignoring only expiring holds.
     *
     * Every caller that arrives while one is already pending gets the SAME promise: the outcome is a
     * property of the station's teardown, not of who asked, so one deferred per entry is the whole
     * mechanism — and it cannot grow with the number of callers.
     *
     * Both branches close through {@link autoClose}: the caller asked for a recycle, not for the station's
     * live sources to be dropped, so it does not clean up after one — exactly like the idle path.
     */
    resetWhenUnused(key: string): Promise<void>;
    /** Settle a discarded entry's reset callers with the same outcome as its session close. */
    private settleReset;
    /** Close one discarded entry and settle only its own reset callers before preserving any failure. */
    private closeEntry;
    /**
     * Discard one lifecycle entry and return it for bounded close/reset completion.
     *
     * Every timer the entry owns dies with it — the idle window and any hold still counting down. A
     * discarded entry owns no live timer, which is what stops a deferred release from landing on whatever
     * entry next occupies this serial.
     */
    private discard;
    /** Close every session and clear all timers. */
    closeAll(): Promise<void>;
}
