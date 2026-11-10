/**
 * The `algo_ecdh` passport steps the eufy and Solix clients share byte for byte. Hosts, header sets, key
 * caching, 2FA delivery and the `gtoken` id differ per app line and stay in each client.
 */
import { type SessionEntry } from "../../core/index.js";
/** The credential fields every `/passport/login` body starts with; each client adds its own challenge fields. */
export declare function loginCredentials(email: string, password: string, country: string): Record<string, unknown>;
/**
 * Read a decrypted `/passport/login` reply; `undefined` when it carries no id or no token. `twoFactorPending`
 * is true while `fa_info.info` is non-empty and false once 2FA is satisfied.
 */
export declare function readLoginReply(data: Record<string, unknown>): {
    userId: string;
    accountUserId: string | undefined;
    authToken: string;
    geoKey: string | undefined;
    tokenExpiresAt: number;
    twoFactorPending: boolean;
} | undefined;
/** The headers that mark `encBody` as `algo_ecdh`-encrypted under `entry` and sign it. */
export declare function signedHeaders(entry: SessionEntry, encBody: string): Record<string, string>;
