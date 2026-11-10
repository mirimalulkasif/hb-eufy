/**
 * `TuyaCommandRouter` — the transport-side command router for eufy Home/Clean Tuya vacuums (X8,
 * G-series and other `eufy_home_tuya` category devices).
 *
 * Usage: call {@link bind} after a successful mega login, then {@link registerDevice} for each
 * `eufy_home_tuya` device (the facade does both). On the first {@link dispatchCommand} the router
 * logs into the Tuya cloud lazily (once, shared across all subsequent sends). The dp.publish write
 * is sent via `TuyaClient.publishDps` — note the `dp.publish` param shape is not yet confirmed from
 * a live eufy Home/Clean capture (gated by {@link TuyaCommandRouterConfig.allowUnverified}, default `false`).
 *
 * Layering: imports `../../core` only — no `model/` import, consistent with the capability↔transport
 * decorrelation invariant. Sibling tuya/* imports are same-layer (transport).
 */
import type { Command } from "../../core/contracts.js";
import type { TuyaHttpPost } from "./request.js";
export interface TuyaCommandRouterConfig {
    /**
     * Opt-in to unverified Tuya DP writes. Defaults to `false` — {@link dispatchCommand} will throw
     * until a live `publishDps` capture confirms the dp.publish round-trip. Set `true` only after that
     * confirmation and remove the gate when the write is shipped as verified.
     */
    allowUnverified?: boolean;
    /** Inject a POST transport (test stub); default = native fetch. Forwarded to the internal TuyaClient. */
    http?: TuyaHttpPost;
}
export declare class TuyaCommandRouter {
    private readonly allowUnverified;
    private readonly http;
    private userId;
    private dialCode;
    private client;
    /** Promise that resolves once Tuya login has completed. Reset by {@link bind}. */
    private loginOnce;
    /**
     * eufy SN → Tuya device ids, populated via {@link registerDevice} once the device list loads.
     * The Tuya id is the record's first non-empty `tuya_uuid` / `tuya_virtual_id` / `tuya_device_id` /
     * `virtualId`, or the device's serial when the record carries none of them.
     */
    private readonly snMap;
    constructor(config?: TuyaCommandRouterConfig);
    /**
     * Supply credentials for lazy Tuya login. Called by the facade after a successful mega login.
     * The router logs into Tuya on the first {@link dispatchCommand}, not immediately.
     *
     * `regionShard` is the mega shard string (`"eu-pr"`, `"us-pr"`, …) used as a coarse fallback;
     * `isoCode` is the ISO 3166-1 alpha-2 country code from {@link MegaClientConfig} (e.g. `"DE"`)
     * and takes precedence — a German user on the EU shard gets dial code `"49"`, not `"44"`.
     */
    bind(userId: string, regionShard?: string, isoCode?: string): void;
    /**
     * Register a eufy SN → Tuya devId mapping for an `eufy_home_tuya` device. `devId` is the record's
     * first non-empty `tuya_uuid` / `tuya_virtual_id` / `tuya_device_id` / `virtualId`, or the device's
     * serial when the record carries none of them. `gwId` defaults to `devId` — standalone devices
     * share the two.
     */
    registerDevice(sn: string, devId: string, gwId?: string): void;
    private ensureLoggedIn;
    /**
     * Read a device's current DPs from the Tuya cloud (`smartlife.m.device.dp.get`) and answer the DP
     * map: the reply's flat `result`, kept to integer DP keys with scalar values. Answers `null` for an
     * unregistered device, a failed reply, or a reply with no DPs.
     */
    fetchDps(sn: string): Promise<Record<string, unknown> | null>;
    /**
     * Route an `aiot-dp` {@link Command} to the Tuya REST API.
     *
     * Logs in lazily on first call. The eufy SN must have been registered via {@link registerDevice}
     * before dispatch — the facade does this when the device list is loaded.
     *
     * ⚠️ `dp.publish` is unverified — see {@link TuyaCommandRouterConfig.allowUnverified}. By default
     * this throws. Pass `allowUnverified: true` in the router config only after a live capture
     * confirms the full round-trip, then remove the gate.
     */
    dispatchCommand(sn: string, cmd: Command): Promise<void>;
}
