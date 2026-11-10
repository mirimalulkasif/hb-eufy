/**
 * LAN-address resolution for a P2P station from its cloud device record.
 *
 * Pure helpers (no session state) — used when opening a P2P session to prefer a direct on-LAN
 * lookup over the cloud relay (works when broadcast is blocked by AP isolation / macOS, even if
 * the record's pairing `ip_addr` went stale).
 */
/** True for an RFC-1918 private IPv4 (a routable LAN address, not a WAN/public one). */
export declare function isPrivateIpv4(s: string): boolean;
/**
 * Resolve the freshest LAN IP for a station from its cloud record.
 *
 * The record carries the device IP in several places of differing trust:
 *  - **params** (`{param_type, param_value, update_time}`) — self-reported by the device on each
 *    heartbeat, so a private-IP param value is timestamped and updates when the device roams.
 *  - **`ip_addr`** (top-level) — frozen at pairing, no timestamp; goes stale if the device moved
 *    to another subnet since (observed live: a SoloCam still advertising a 192.168.86.x pairing
 *    address while actually on 192.168.1.x).
 *  - **`local_ip`** — often empty, or the public WAN address.
 *
 * Strategy: collect every param whose value is a private IPv4, take the one with the newest
 * `update_time`, and only fall back to `ip_addr` / `local_ip` when no param IP exists. This
 * prefers the most recent evidence over a fixed field-priority order.
 */
export declare function freshestLanIp(raw: unknown): string | undefined;
