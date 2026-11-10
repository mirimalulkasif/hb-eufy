export interface AppClientIdInput {
    /** Topic scope, e.g. "eufy_security". */
    appName: string;
    /** The logged-in user id (40-hex) — NOT necessarily the device owner if it's a shared device. */
    uid: string;
    /** Stable per-install identifier (`AIOTDeviceSdk.getMqttUUID()` on the real app). Any stable 16-hex
     * string works for our purposes — generate once and persist it, don't re-randomize per connect. */
    mqttUuid: string;
    /** Connect-time unix SECONDS. Defaults to now; inject for deterministic tests. */
    timestamp?: number;
}
/** Build a client_id shaped like `android-{appName}-{uid}-{mqttUuid}-{timestamp}`. */
export declare function buildAppShapedClientId(input: AppClientIdInput): string;
/**
 * The `mqttUuid` segment for a client bound to `installId`, hashed to the 16-hex shape
 * {@link buildAppShapedClientId} expects. Deterministic, so a client keeps its id across restarts and
 * takes its own stale session over rather than doubling up beside it; one-way, so the id it is derived
 * from is not recoverable from a client_id that travels the wire in clear.
 *
 * Two clients are distinguished exactly as far as their `installId` is: equal ids in, equal ids out.
 */
export declare function mqttUuidFrom(installId: string): string;
