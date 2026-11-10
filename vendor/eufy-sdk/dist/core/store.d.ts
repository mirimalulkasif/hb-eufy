import type { RegionShard } from "../transport/http/mega-client.js";
/**
 * The persisted session record. Internal shape — a host supplies a `SessionStore`, never builds this.
 * @internal
 */
export interface PersistedSession {
    userId: string;
    /**
     * The eufy account's own `user_id` — the id the `gtoken` header is hashed from, which is not always the
     * `ap_cloud_user_id` that `userId` prefers.
     *
     * Always written, equal to `userId` when the login reply carried only the one id. Absent therefore means a
     * record from before this was tracked, which {@link isSessionValid} refuses rather than restore.
     */
    accountUserId?: string;
    authToken: string;
    geoKey?: string;
    region: RegionShard;
    /** The `countryCode` the session was logged in with; a different configured one logs in again. */
    countryCode?: string;
    /** The host `estimate_domain` answered; it names shards the region classification cannot (`ie`). */
    estimatedDomain?: string;
    openudid: string;
    /** This install's reported device model + media user-agent, generated once and reused. */
    phoneModel?: string;
    mediaUserAgent?: string;
    /** ECDH session: shareKey hex (32 chars) + the bound key-ident. */
    shareKey: string;
    keyIdent: string;
    /** Unix seconds when the auth token expires (0 = unknown). */
    tokenExpiresAt: number;
    savedAt: number;
}
/**
 * A place to persist a session record across runs. Parameterised on the record shape so other Anker
 * lines (e.g. Solix, whose record is not a `PersistedSession`) can reuse the same file/memory
 * stores rather than re-implementing them. Defaults to `PersistedSession` for the eufy path.
 */
export interface SessionStore<T = PersistedSession> {
    load(): T | null;
    save(s: T): void;
    clear(): void;
}
/** In-memory store (no persistence) — the default. */
export declare class MemorySessionStore<T = PersistedSession> implements SessionStore<T> {
    private s;
    load(): T | null;
    save(s: T): void;
    clear(): void;
}
/** JSON-file store, e.g. new FileSessionStore("./.eufy-session.json"). */
export declare class FileSessionStore<T = PersistedSession> implements SessionStore<T> {
    private readonly path;
    constructor(path: string);
    load(): T | null;
    save(s: T): void;
    clear(): void;
}
/**
 * A token is still usable if it has no known expiry, or expires more than `skewSec` from now. The one
 * place the expiry/skew rule lives — reused by {@link isSessionValid} and by other lines' session checks
 * (e.g. Solix) whose session shape differs but whose freshness rule is identical.
 */
export declare function tokenNotExpired(tokenExpiresAt: number | undefined, skewSec?: number): boolean;
/**
 * A persisted session is usable if it carries a complete credential — token, bound ECDH key, and the account
 * id the `gtoken` header is hashed from — whose token isn't (near-)expired.
 *
 * `accountUserId` is part of the credential, not an optional extra: a record without it was written before
 * that id was tracked, so it can only be restored as the other id, which is what the gateway rejects the
 * header on. Nothing in a restored session can recover it either — the id arrives with a login reply. So such
 * a record is refused and one login re-establishes it, rather than reinstating a session whose every
 * authenticated call fails identically.
 */
export declare function isSessionValid(s: PersistedSession | null, skewSec?: number): boolean;
