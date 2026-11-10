/**
 * DeviceRegistry — the device list/record/capability-resolution collaborator behind {@link EufyMega}.
 *
 * The facade owns orchestration + event fan-out; this owns the resolution logic: fetching + merging
 * the (house-scoped, quirky) device list, overlaying a fresh param list per device, and resolving which
 * capability set a P2P frame's (station, channel) belongs to (a hot-path cache). Isolated here so the
 * tricky bits are unit-testable with a fake `mega` — the facade stays pure wiring. It never names a
 * capability or a wire; it maps records to the model's `resolveDevice`/`inspectParams`.
 */
import { MegaHttpClient } from "../transport/http/mega-client.js";
import { type Logger } from "../core/logger.js";
import { type EufyDevice } from "../core/types.js";
import { type Capability, type DeviceInspection } from "../model/index.js";
/** The device-record shape {@link EufyMega.getDevice}/`commandContext` resolve a serial to. */
export interface DeviceRecord {
    deviceType?: number;
    model?: string;
    category?: string;
    /**
     * The app-shown device name: `alias_name` first on a vacuum, `device_name` first otherwise;
     * see {@link CloudRecord.name}.
     */
    name?: string;
    /** Parent HomeBase serial when attached (topology signal; see {@link CloudRecord.parentSn}). */
    parentSn?: string;
    params: Record<number, string>;
    /** Per-param `update_time` in **unix seconds** (see {@link EufyDevice.paramUpdatedAt}). */
    paramUpdatedAt: Record<number, number>;
    /**
     * State the device reported over its realtime wire, as ids in its own param namespace.
     *
     * Kept apart from {@link params} rather than merged into it because the two differ in provenance and
     * staleness: cloud params are a slow server-side heartbeat snapshot, these are the device's own live
     * report. Capability detection reads only `params`, so a realtime id can never steer which
     * capabilities a device is judged to have.
     */
    dpParams?: Record<number, string>;
}
/**
 * One param that changed value between two polls — the input the facade turns into a
 * `source:"poll"` inbound signal. Carries the whole post-change param map so a capability that needs
 * sibling params to interpret the change can read them.
 */
export interface ParamChange {
    deviceSn: string;
    paramType: number;
    from: string;
    to: string;
    params: Record<number, string>;
}
/**
 * What one poll pass observed: params whose value moved, devices that joined or left the account, and
 * devices that merely re-reported. All four come from a single device-list fetch.
 */
export interface PollDiff {
    params: ParamChange[];
    added: EufyDevice[];
    removed: EufyDevice[];
    /**
     * Devices whose {@link EufyDevice.lastSeenMs} advanced since the previous pass — fresh proof the
     * device is alive, tracked apart from {@link params} because the cloud can re-stamp a param with an
     * unchanged VALUE. That is no state change to report, but it is a liveness signal. A device seen for
     * the first time is absent here: first sight is discovery, not a transition.
     */
    reported: EufyDevice[];
}
export interface DeviceRegistryDeps {
    mega: MegaHttpClient;
    /** Surface a non-fatal fetch error (a house/body query that failed) without aborting the merge. */
    onError: (e: unknown) => void;
    /** Diagnostics sink for facts that are NOT errors — see the owner-gated overlay note on {@link DeviceRegistry.record}. */
    logger?: Logger;
}
export declare class DeviceRegistry {
    private readonly mega;
    private readonly onError;
    private readonly logger;
    private devices;
    /** Per-(station, channel) capability cache for {@link capabilitiesForFrame}; `null` = negative hit. */
    private readonly frameCapsCache;
    /** {@link stationChannels} of {@link channelMapFor}, the roster it was computed over. */
    private channelMap;
    private channelMapFor?;
    /**
     * Serials whose per-device param overlay has been refused. The call is owner-gated, so on a shared or
     * member account it fails for the whole life of the client — retrying it every refresh spends a request
     * to learn the same thing, and the answer is reported once rather than on every read.
     */
    private readonly overlayRefused;
    /** One in-flight device-list fetch shared by every caller that wants a fresher list. See {@link refreshedList}. */
    private listInFlight?;
    /** When the device list was last fetched, so a burst of per-device reads shares one. See {@link refreshedList}. */
    private listFetchedAtMs;
    /** Whether the owner-gated refusal has been reported. It is one fact about the account, so it is said once. */
    private overlayRefusalReported;
    /** Per-serial capability cache for {@link capabilitiesForDevice}; `null` = negative hit. */
    private readonly deviceCapsCache;
    /** Per-serial cloud data points of an AIoT robot, joined beneath the params in {@link record} — see {@link loadCloudDps}. */
    private readonly cloudDps;
    /** Per-serial realtime state, keyed by param id in the device's own namespace (see {@link DeviceRecord.dpParams}). */
    private readonly dpParams;
    /** Callers blocked in {@link awaitRealtimeState}, released by the device's first report. */
    private readonly stateWaiters;
    /**
     * Whether the last {@link getDevices} lost at least one query. The house-scoped fetch tolerates a
     * failing house/body call so a partial outage still yields devices — but the result is then a
     * SUBSET, so a missing device is not a removal.
     */
    private lastRefreshPartial;
    /**
     * The roster {@link pollChanges} last diffed against, and whether it was complete.
     *
     * Held separately from {@link devices} because that cache is refreshed by anything that needs a
     * device — a host's own `getDevices()`, a command sink resolving a serial before an on-demand P2P
     * open. Diffing the shared cache in place would let any of those silently absorb the delta, and the
     * next poll would then see an unchanged account and emit nothing. `undefined` = never polled.
     *
     * It holds the VALUES the diff reads, never the records themselves. Sharing the records lets anything that
     * updates one in place rewrite the baseline before the next pass can diff against it — and the realtime
     * path does exactly that to `lastSeenMs`: a station's report stamps the record the baseline is holding, so
     * the next pass compares the cloud's older timestamp against a baseline already advanced to now and
     * reports nothing. Every device that reports over realtime loses its poll liveness signal that way.
     *
     * The params are copied for the same reason, against a mutation no current path performs: nothing writes
     * into a record's param map in place today (a realtime report lands in its own map, and a refetch rebuilds
     * the record), so that half is a latent hazard rather than an observed one — copied because the diff
     * cannot tell the difference and the cost is one shallow copy per device per pass.
     */
    private pollSnapshot?;
    constructor(deps: DeviceRegistryDeps);
    /** The current device cache (last {@link getDevices} result). */
    list(): EufyDevice[];
    /**
     * List + classify devices across all houses (mega API). Each device is tagged
     * with its API backend + realtime transport (see classifyDevice). Camera/
     * HomeBase records still appear here for inventory; driving them is P2P.
     *
     * A failing house/body query is tolerated so a partial outage still yields devices — but the result
     * is then a SUBSET, and devices it didn't return are KEPT from the previous list rather than dropped.
     * Replacing wholesale would empty the cache during an outage, breaking every serial lookup the
     * command sink and event fan-out depend on, and would then present the whole account as newly
     * discovered once the next refresh succeeded. {@link lastRefreshPartial} records that this happened.
     *
     * A **rejected session** is the one failure not tolerated that way, because it is not a subset of
     * anything: every query fails identically, so what is left to return is nothing on a fresh client — an
     * empty account that reads exactly like an account with no devices. The transport has already tried to
     * replace the token by logging in again, so reaching here means it could not, and the caller is the one
     * who has to know. It rejects; the devices it already knew stay known.
     */
    getDevices(): Promise<EufyDevice[]>;
    /**
     * Re-fetch the device list once and report what changed: params whose VALUE moved, plus devices that
     * joined or left the account.
     *
     * Diffs the bulk list rather than polling devices one by one — `getDevices()` already refreshes the
     * whole account in one house-scoped pass, so per-device fetching would multiply requests for the same
     * data, and roster changes fall out of the same response for free.
     *
     * A param is a change only if it existed before with a different value. Newly-appeared params and
     * every param of a newly-appeared device are NOT changes: a device showing up for the first time is
     * discovery (reported as `added`), and treating its whole param set as changes would fire a burst of
     * phantom state events on the first poll.
     *
     * Both halves of the roster diff are gated on the baseline being trustworthy, in opposite directions.
     * `removed` is suppressed when THIS refresh was {@link lastRefreshPartial} — a failed house query
     * yields a subset of the account, and reporting those absences as removals would report a device that
     * is simply unqueried as gone. `added` is suppressed when the PREVIOUS snapshot was
     * incomplete, for the mirror-image reason: a device missing from a partial baseline is not new, and
     * announcing it would present a chunk of an existing account as freshly discovered.
     *
     * The very first pass reports no additions at all — the whole account is the baseline, not a
     * pairing burst. {@link getDevices} enumerates what exists.
     */
    pollChanges(): Promise<PollDiff>;
    /** Devices driven over eufy secure-MQTT — named positively (not "everything that isn't P2P"), so a
     * device on another realtime plane (e.g. a printer's `ankermake-mqtt`) is not swept onto this one. */
    mqttDevices(): EufyDevice[];
    /** Devices that require P2P (cameras/HomeBases). */
    p2pDevices(): EufyDevice[];
    /**
     * Resolve a serial to its cached {@link EufyDevice}, **throwing if it isn't loaded** — the loud
     * synchronous lookup the facade's command sink uses before asking a transport stack whether it claims
     * the device (`P2PCommandRouter.claimsDevice` / `MqttCommandRouter.claimsDevice`). A routing decision
     * must never fall back on a missing record (an unknown serial silently routing to the wrong transport
     * would misroute a fire-and-forget command with no error). Registry owns record resolution; the
     * transport stacks own the claim predicate over the record.
     */
    require(sn: string): EufyDevice;
    /**
     * Hold an AIoT robot's cloud data points: the cloud's last-known value of each one it has reported,
     * from `getDeviceRelationList`'s per-device `dps`.
     *
     * The device list carries only some of a robot's data points, so a point the robot publishes on change
     * alone (its scene list, its schedules, its consumables) has no value until it next reports. The
     * relation list holds every one, for an account the robot is shared with as well as its owner.
     *
     * Kept apart from the device list's params rather than merged into them: those are what a poll diffs,
     * and a diff retires the realtime report for that id, so a cloud value lagging the robot's last report
     * would replace it. {@link record} joins this beneath both halves. A failure keeps what was held.
     *
     * Limited to {@link CLOUD_DPS_MODELS}, the models whose relation-list `dps` are checked to carry the
     * DP numbers their realtime reports use.
     */
    private loadCloudDps;
    /**
     * Resolve a serial to a {@link DeviceRecord} with current params: starts from the device-list params, then
     * overlays a fresh `get_device_param_list` when that call is available to this account. An AIoT robot's
     * cloud data points ({@link loadCloudDps}) sit beneath both, filling only ids neither carries.
     *
     * The overlay is **owner-gated** — a shared or member account is refused it for every device, permanently,
     * which {@link OWNER_ONLY_CODE} identifies — so when it is unavailable the device list is the source
     * instead. Any OTHER failure is treated as transient: it falls back for that call but is retried next
     * time, because latching on a timeout would cost an entitled account its freshest source of params.
     *
     * A dead session is the exception: it is not a statement about the overlay's availability, and the fallback
     * runs over the same session, so it propagates rather than degrading to the params this call already held.
     * Serving those as current would report an expired token as a device that simply has not changed.
     *
     * The refusal is **logged, never surfaced as an error**. It is a normal property of a shared or member
     * account, not a fault: nothing failed that the SDK did not immediately handle, and the account holder
     * cannot grant themselves ownership.
     *
     * The list is account-wide, so a re-fetch is NOT per device: resolving a fleet calls this once per device,
     * and each one re-fetching would multiply one burst into N. {@link refreshedList} reuses a list younger
     * than {@link LIST_REUSE_MS} and coalesces concurrent fetches, which keeps resolving N devices at the cost
     * of one list while still letting a later refresh see a new value. That list is not owner-gated and carries the same
     * `{param_type, param_value, update_time}`, which makes it the fallback the overlay's own contract names.
     *
     * Shared by {@link EufyMega.getDevice} / {@link EufyMega.inspectDevice} / `commandContext`.
     */
    record(sn: string): Promise<DeviceRecord>;
    /**
     * Re-fetch the device list, coalescing concurrent callers onto one in-flight fetch and reusing one
     * younger than {@link LIST_REUSE_MS}. Answers with this serial's record from that list, or `undefined`.
     *
     * The list is account-wide (`get_house_list` plus one `get_devs_list` per house), so without this a refresh
     * cycle over N devices would multiply into N of those bursts — and every fetch clears the capability caches,
     * so they would stop working. One fetch serves every device that wants the same answer.
     *
     * This is the ONLY way a caller in a loop should ask for a fresher list. A convergence wait that polls
     * {@link getDevices} directly bypasses both the window and the coalescing, so one write whose param never
     * lands spends a whole account-wide burst per iteration, and concurrent transitions multiply that again.
     *
     * Only a fetch that RESOLVED opens the reuse window. {@link getDevices} tolerates a failing house/body
     * query as a partial and answers anyway, so an outage still holds the window on purpose — retrying per
     * device is how one outage becomes N bursts. What must not hold it is the one failure that rejects: a dead
     * session, which also propagates rather than degrading to `undefined`, because answering "no such device"
     * for an expired token is the same lie {@link getDevices} stopped telling, one level down.
     */
    refreshedList(sn: string): Promise<EufyDevice | undefined>;
    /**
     * Record state a device reported over its realtime wire, merging into whatever it last reported.
     *
     * Merged rather than replaced because a report can be partial — a status frame that omits a field is
     * silent about it, not asserting it went away. Marks the device seen and drops its capability cache,
     * since a newly-reported id can widen the evidence-gated read surface.
     *
     * What lands here outranks the cloud half in {@link record}, and stays there until
     * {@link retireRealtimeParams} says the cloud has moved that id itself.
     */
    applyRealtimeParams(sn: string, params: Record<number, string>): void;
    /**
     * Drop this device's reported value for these param ids, because the CLOUD has since been observed to
     * move them — {@link EufyMega} calls this with the ids of a poll diff.
     *
     * {@link record} joins the two halves by letting the report win, which is right only while the report
     * is the fresher of the two: the cloud list carries a pre-report value long after the device
     * volunteered the new one, so without that precedence an open door reads as closed. A poll diff on the
     * same id is the cloud stating a transition it observed, which ends the lag the report was standing in
     * for. Leaving the report in place would make it outrank the cloud permanently, and every later join
     * would revert that id to a value the cloud has already superseded.
     *
     * Ids alone, never a value: this says the report is out of date, not what replaced it. The replacement
     * is already in the cloud half, and writing it in here would put one value in two maps for the next
     * change to disagree about.
     *
     * The capability cache is deliberately NOT dropped: an id stops being remembered here, but the device
     * did report it, and evidence-gated reads are granted on having reported — retracting that would take
     * a getter away from a `Device` that legitimately earned it. The map itself stays for the same reason
     * even once emptied, since its presence is what {@link hasRealtimeState} answers "this device has
     * reported" from, and a device does not become one that never reported.
     */
    retireRealtimeParams(sn: string, paramTypes: readonly number[]): void;
    /** Whether this device has reported any realtime state yet. */
    hasRealtimeState(sn: string): boolean;
    /**
     * Resolve once this device reports realtime state, or after `timeoutMs` — whichever comes first.
     *
     * Exists because the typed read getters are evidence-gated at BIND time: a device resolved before its
     * first report gets no getters, and would keep none however much state arrived afterwards. Resolving
     * (not rejecting) on timeout keeps a silent device merely read-less rather than unusable.
     */
    awaitRealtimeState(sn: string, timeoutMs: number): Promise<void>;
    /**
     * Inspect one device by serial: resolve its codec/capabilities, cross-reference every reported
     * `param_type` against the param dictionary, and emit a paste-ready `registry.ts` row plus
     * dictionary snippets for anything unknown.
     */
    inspectDevice(sn: string): Promise<DeviceInspection>;
    /**
     * The serial of the device a P2P frame belongs to, resolved by the same `(station, channel)` pair
     * as {@link capabilitiesForFrame} — the identity half of the same question.
     *
     * A frame-sourced semantic event carries the STATION only, which cannot say which attached device
     * reported it: a station fans several same-kind sensors out by channel, so two entry sensors on one
     * hub would emit indistinguishable events. The facade enriches the payload with this.
     */
    serialForFrame(stationSn: string, channel: number): string | undefined;
    /**
     * The device a `(station, channel)` pair refers to — a station fans out to attached devices by
     * `device_channel`, while a standalone device is its own station at channel 0.
     *
     * A device claims a channel only when its record actually STATES one that no other device attached to
     * the same station also states ({@link stationChannels}). Treating a missing `device_channel` as 0, or
     * letting two claimants of one channel both hold it, leaves the winner to cloud list order — which a
     * partial refresh reorders — so the same frame resolves to different devices across refreshes. The resolved
     * serial decides where realtime state is written, not just which decoders may run, so an ambiguous answer
     * writes one device's params onto another.
     *
     * An attached device that names the channel wins over the station itself, which is what a station
     * fanning traffic out by channel means. A channel two attached devices both state belongs to one of them,
     * which cannot be told apart, so it answers nothing rather than the station. The station answers for
     * channel 0 only when nothing attached states it, which is also the standalone case (a device is its own
     * station).
     */
    private deviceForFrame;
    /** {@link stationChannels} over the current roster, recomputed only when the roster itself is replaced. */
    private stationChannelMap;
    /**
     * Resolve the capability set of the device a P2P frame belongs to — the `(station, channel)` pair
     * (a station fans out to attached devices by `device_channel`; a standalone device is its own
     * station at channel 0). Used to gate the p2p-frame escape-hatch decoders.
     *
     * Runs on the P2P data hot path, so it is synchronous over the already-cached device list (no
     * await / network) and memoized per (station, channel). Returns `undefined` when the device can't
     * be resolved yet — the caller then falls back to running every module.
     */
    capabilitiesForFrame(stationSn: string, channel: number): ReadonlySet<Capability> | undefined;
    /**
     * The capability set of a device by serial — the disambiguator for **push / poll** events, whose ids
     * are namespaced per device family and therefore collide across families (a SmartDrop's tamper id is
     * a HomeBase's alarm id). Same role {@link capabilitiesForFrame} plays for P2P frames, keyed by
     * serial because a push carries `deviceSn` rather than a (station, channel).
     *
     * Synchronous over the cached device list and memoized; `undefined` when the serial isn't loaded, so
     * a caller can tell "device has no such capability" from "device unknown" and refuse to guess.
     */
    capabilitiesForDevice(sn: string): ReadonlySet<Capability> | undefined;
    /** Resolve a record's capabilities the way `getDevice` does, so gating matches `device.has()`. */
    private capsOf;
}
