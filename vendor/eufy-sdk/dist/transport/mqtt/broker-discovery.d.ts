export interface BrokerCredentials {
    /** Broker hostname — used as the TLS SNI + cert-CN check target, NOT the socket connect target. */
    hostname: string;
    port?: number;
    certificate_pem: string;
    private_key: string;
    aws_root_ca1_pem: string;
}
export interface ProbeResult {
    ip: string;
    /** True iff SUBSCRIBE to the target topic was granted (qos 0/1/2). */
    granted: boolean;
    /** The SUBACK return code for the topic, the 0x80 deny code included. */
    grantedQos?: number;
    error?: string;
    ms: number;
}
/** Resolve current A records for the broker hostname. An NLB typically returns one IP per AZ, so this
 * is normally a short list (2-3), not the dozen the DNS-round-robin theory implied. */
export declare function resolveBrokerIps(hostname: string): Promise<string[]>;
/** Merge freshly-resolved DNS candidates with any previously-seen-good IPs, de-duplicated, DNS-first
 * (the DNS results are current; the extras are a fallback in case this resolver returns fewer targets
 * than have been seen historically). Pure/no I/O — kept separate so it's unit-testable. */
export declare function mergeCandidateIps(dnsIps: string[], extraIps?: string[]): string[];
/** Rank probe results with granted instances first (stable order otherwise). Pure — unit-testable
 * without a real network connection. */
export declare function rankResults(results: ProbeResult[]): ProbeResult[];
/**
 * Probe ONE candidate IP: connect, SUBSCRIBE to `topic`, record whether it was granted, then
 * disconnect. Never publishes anything — this function cannot actuate a device.
 *
 * The probe presents the account's client certificate, so it verifies the instance it dials: the TLS
 * options come from `./bare-ip-tls.ts`, which checks the presented certificate against
 * `creds.hostname` rather than the IP.
 */
export declare function probeBrokerInstance(ip: string, creds: BrokerCredentials, opts: {
    clientId: string;
    topic: string;
    timeoutMs?: number;
}): Promise<ProbeResult>;
export interface DiscoverOptions {
    /** Build a fresh client_id per attempt (the real client_id includes a connect timestamp). */
    clientIdFor: (ip: string) => string;
    /** The device's `.../res` topic to subscribe (never a `/req` topic — this module doesn't publish). */
    topic: string;
    /** Previously-seen-good IPs to probe alongside a fresh DNS resolution. */
    candidateIps?: string[];
    perAttemptTimeoutMs?: number;
    /** Stop at the first granted SUBSCRIBE instead of probing every candidate. */
    stopOnFirstGrant?: boolean;
}
/**
 * Probe every candidate instance (fresh DNS + any known extras), in sequence, SUBSCRIBE-only. Returns
 * every result, granted ones first, rather than only the first hit.
 */
export declare function discoverReachableInstance(creds: BrokerCredentials, opts: DiscoverOptions): Promise<ProbeResult[]>;
