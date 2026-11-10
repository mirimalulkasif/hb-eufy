/**
 * eufy-sdk — one client for every eufy device class.
 *
 * Cloud APIs:  the eufy v6 cloud (+ legacy, planned)
 * Realtime:    secure MQTT (appliances)  +  P2P (cameras/HomeBases)
 *
 *   const eufy = new EufyMega({ email, password, region: "eu-pr" });
 *   await eufy.login(); // → LoginResult; on success the SDK auto-starts realtime (push/MQTT/wired P2P)
 *   eufy.on("motion", (e) => console.log(e.deviceSn)); // typed semantic events — flowing already
 *   const dev = await eufy.getDevice((await eufy.getDevices())[0].sn);
 *   await dev.camera?.()?.snapshotStored?.();
 *
 * Connectivity is SDK-managed: the host calls no `connect*`. P2P to a battery camera is opened only
 * when a command/stream/doorbell-ring needs it and closed when idle, so the camera can sleep.
 */
import { EventEmitter } from "node:events";
import { MegaHttpClient, type LoginResult } from "../transport/http/mega-client.js";
import { type SecureMqttCredentials } from "../transport/mqtt/secure-mqtt.js";
import { type P2PSession } from "../transport/p2p/p2p-session.js";
import { type CleanRecordPage } from "../model/clean-records.js";
import { type AvailabilityObservation, type EufyDevice } from "../core/types.js";
import { Device, type DeviceInspection } from "../model/index.js";
import type { EufyMegaOptions, EufyMegaEvent, EufyMegaEventMap, DeviceState, RealtimeReadiness, StationFace, StationFacesOptions, WaitForRealtimeOptions } from "./types.js";
export type { EufyMegaOptions, EufyMegaEvent, EufyMegaEventMap, AnyDeviceEvent, DeviceState, RealtimePlaneReadiness, RealtimeReadiness, StationFace, StationFacesOptions, WaitForRealtimeOptions, } from "./types.js";
export interface EufyMega {
    on<E extends EufyMegaEvent>(event: E, listener: (...args: EufyMegaEventMap[E]) => void): this;
    once<E extends EufyMegaEvent>(event: E, listener: (...args: EufyMegaEventMap[E]) => void): this;
    off<E extends EufyMegaEvent>(event: E, listener: (...args: EufyMegaEventMap[E]) => void): this;
    emit<E extends EufyMegaEvent>(event: E, ...args: EufyMegaEventMap[E]): boolean;
}
/**
 * The package entry point — one client per Anker eufy account. Handles the {@link login} state machine
 * (captcha/2FA/persistence), resolves the account's devices ({@link getDevices}/{@link getDevice}
 * → capability-driven {@link Device}s), **auto-manages** the realtime channels (FCM push + secure MQTT
 * start on login; P2P opens on demand per station and idle-detaches battery cameras), and fans every
 * transport's traffic into one typed semantic event stream (`eufy.on("motion", …)`). Construct it with
 * an {@link EufyMegaOptions} (email/password + optional session/push stores), then drive `login()` to
 * completion — no `connect*` call needed (set `autoRealtime:false` to opt out). Call {@link disconnect}
 * to tear the realtime channels down.
 */
export declare class EufyMega extends EventEmitter {
    private readonly opts;
    private readonly mega;
    /**
     * The installed secure-MQTT transports, one per credential scope.
     *
     * There is more than one because `get_user_mqtt_info` issues a DIFFERENT certificate per `app-name`
     * and the broker's policy grants each line's topic space to its own cert — a `eufy_life` light's
     * topics are silently denied to the default credential. A device's
     * scope is a pure function of its record, so the set of live connections follows the roster with no
     * extra state to keep in sync, and a scope with no devices is never connected.
     */
    private readonly transports;
    /** Shared in-flight/settled `startMqtt()` promise PER SCOPE — so realtime bring-up and an on-demand
     * publish await the SAME fully-connected transport instead of racing (and never open two). */
    private readonly mqttReady;
    /** Device list/record/capability resolution + the frame→caps cache. */
    private readonly registry;
    private pushClient?;
    /** Push-fed passive image store; absent when the caller disables acquisition. */
    private readonly storedImages?;
    /** Account whose retained images are currently held. */
    private storedImageAccount?;
    /**
     * Which bring-up generation is current. Bumped by every {@link disconnect}, so an in-flight
     * {@link ensureRealtime} can tell on completion whether it is still the live one.
     *
     * The bring-up is fire-and-forget, so a caller that disconnects while it is still running would
     * otherwise leave behind whatever opened after teardown had already passed. A single "closing" flag
     * is not enough: `disconnect()` followed by `login()` clears it, and the stale bring-up then finishes,
     * sees nothing amiss, and overwrites the live channels with its own — stranding the sockets it was
     * meant to release. Comparing generations makes each bring-up responsible for exactly its own epoch.
     */
    private realtimeEpoch;
    /** Shared startup state for the current epoch; caller timeouts never replace or cancel it. */
    private realtimeGeneration?;
    /**
     * Devices already handed to a caller, so a realtime report refreshes the object they are holding
     * rather than only the registry. Weak so a caller dropping a `Device` still lets it be collected —
     * this map must never be what keeps one alive.
     */
    private readonly liveDevices;
    /** Serialized state-transition transactions keyed by device and reflected member. */
    private readonly stateTransitions;
    /** Local writes already awaiting the same semantic transition, counted per reflected member. */
    private readonly commandRefreshes;
    /**
     * The param ids each bound device's read getters were built from — the evidence the gate saw at bind
     * time. Compared against an incoming report to notice when one carries an id the getters do not cover
     * yet, which is the signal to rebuild them (see {@link rebindReads}).
     */
    private readonly boundParamIds;
    /** Per-SKU DP catalog cache — keyed on model/T-code, fetched lazily via `get_product_data_point`. */
    private readonly dpCatalogCache;
    /** Semantic event names that speculatively pre-warm P2P (resolved once from the options; empty = off). */
    private readonly prewarmEvents;
    /** Station power tiers a pre-warm may open (resolved once from the options). */
    private readonly prewarmTiers;
    /** Transport-side owner of the P2P sessions + all wire senders. */
    private readonly p2p;
    /** Transport-side owner of the T9000 station sessions (sibling of {@link p2p}). */
    private readonly rtc;
    /** Transport-side owner of the secure-MQTT ff09 lock/garage command path (sibling of {@link p2p}). */
    private readonly mqtt;
    /** Transport-side owner of the legacy Tuya REST command path for non-AIoT vacuums (G-series). */
    private readonly tuya;
    private readonly tuyaDpRouter;
    /**
     * Last state value announced per `deviceSn:event`, for the edge-trigger in {@link isRepeatState}.
     * Realtime-only: the poll path deliberately bypasses it so an unchanged state is still re-asserted.
     */
    private readonly lastStateAnnounced;
    /** Latest authoritative availability observation per device; no heuristic path writes this map. */
    private readonly availabilityObservations;
    /**
     * One map per clean-line device, assembled from the pieces its `biz/…/res` frames carry.
     *
     * Created on the first frame that decodes rather than per device: a store for a robot that has never
     * sent a map would answer `undefined` to everything, so allocating one buys nothing.
     */
    private readonly mapStores;
    /** Re-armed after each cloud-param poll; cancelled by {@link disconnect}. */
    private readonly pollTimer;
    /** Armed while a failed push bring-up waits to be retried; cancelled by {@link disconnect}. */
    private readonly pushRetryTimer;
    constructor(opts: EufyMegaOptions);
    /**
     * Builds the inbound listener that converts ThingClips DP maps to realtime capability state.
     * DP values arrive as booleans, numbers, or strings; they are normalised to the string form
     * the param store uses, then applied through the standard realtime-report path.
     */
    private makeTuyaDpInbound;
    /**
     * Reports what became of a command already acknowledged to its caller.
     *
     * A write whose declared observation never converged is not a fault of this client, so it does not reach
     * the generic error bus: it is the answer to a question `dispatch` deliberately does not wait for, and it
     * gets its own channel for exactly the reason `commandAck` has one. Anything else that goes wrong after
     * the acknowledgement is a genuine fault and is reported as one.
     */
    private reportUnacknowledged;
    /**
     * Route an internal error to the host, without being able to kill it.
     *
     * A {@link SessionExpiredError} — a kicked/expired token, the transport having already cleared the
     * session — is emitted as the dedicated `sessionExpired` event; it is NOT also sent to `error`. Every
     * other error goes to `error`.
     *
     * Either way it falls back to a logged warning when nothing listens, because `error` on an
     * `EventEmitter` THROWS when it has no listener, and most of these failures reach us from a
     * fire-and-forget path (a transport callback, an un-awaited re-bind) where that throw would land as an
     * unhandled rejection and abort the process.
     *
     * Only reported-error paths reach here — an error thrown straight out of a direct call is the caller's
     * to handle.
     */
    private reportError;
    /**
     * The single entry point that installs the persistent secure-MQTT transport for one credential
     * scope — used by BOTH the auto-realtime bring-up ({@link ensureRealtime}) and an on-demand light-DP
     * publish (the router's `publishSecure`, wired in the constructor). Memoised per scope on
     * {@link mqttReady} so the two can't race into two connections: whoever calls first starts it, the
     * other awaits the same promise. Resolves only once {@link startMqtt} has `connect()`-ed, the
     * transport is installed, and every device on that scope is subscribed — so a publish that awaits it
     * always hits a live, subscribed client (never the silent no-op of firing into an unconnected
     * transport). Epoch-guarded: if a {@link disconnect} lands mid bring-up, the freshly-connected
     * transport is torn down instead of stranded. On failure the memo is cleared so a later call retries
     * — but only if it is still THIS attempt's memo: a `disconnect()` clears the map and a later call can
     * install a second bring-up, so an abandoned attempt that rejects afterwards must not wipe its
     * successor (that would let two `connect()`s run concurrently and strand whichever installed first,
     * still subscribed and double-emitting).
     */
    private ensureMqttStarted;
    /**
     * Give a realtime-only device a bounded chance to report before its actions are bound.
     *
     * The typed read getters are evidence-gated on the ids a device has reported, resolved once at bind
     * time. A device whose state exists ONLY on its realtime wire therefore has no readable state at all
     * if it is resolved before its first report. Waiting here is the cheap path: the returned `Device`
     * already carries its reads, so a caller never has to watch for them appearing.
     *
     * It is a head start, not the mechanism — {@link rebindReads} installs reads that arrive later, which
     * is what covers a device too slow (or too idle) to answer inside the window. A docked robot is
     * exactly that.
     *
     * Skipped entirely for a device with a pollable cloud record, for an already-reporting device, and
     * when realtime is off — so the common path adds nothing. Resolving on timeout leaves a silent device
     * read-less rather than failing the lookup. A Tuya clean-line device waits on the Tuya cloud read the
     * bring-up started, so no broker is brought up for it.
     */
    private awaitFirstRealtimeState;
    /**
     * Feed one map-stream frame to the device's map, and announce it if anything changed.
     *
     * Silent about a frame it cannot use. Most of them are: channels nothing reads yet, and fragments of
     * a split message. Neither is a fault, and logging either would log on every frame of every clean.
     */
    private applyMapFrame;
    private applyRealtimeReport;
    /**
     * Land state a capability recovered from a realtime signal: into the registry (so the next
     * {@link getDevice} sees it) AND into any `Device` already handed out (so a caller holding one sees
     * the new value without re-fetching). Announces every property whose value moved, then `deviceState`.
     *
     * Both writes matter: the registry alone would leave an existing `Device` stale until its freshness
     * window expired, and that refresh re-reads the CLOUD record — which for a realtime-only line does
     * not carry this state at all.
     *
     * This is three of the four inbound paths the security line has, and the ONLY one the clean and life
     * lines have — a robot's cloud record carries none of its data points — so it is what brings those
     * lines into scope for a property announcement at all. The announcement is edge-triggered for free:
     * {@link Device.applyParams} names only the properties whose value actually moved, so a device
     * re-reporting the same state is silent with no dedupe table to keep.
     *
     * The reported ids are recorded as evidence BEFORE the re-bind is fired, not after it lands. One
     * report fans out to one call per capability that decoded it, and the re-bind is a cloud round-trip:
     * advancing the set here is what stops the second call from firing a duplicate, and what stops a
     * failed re-bind from re-triggering on every subsequent report.
     */
    private applyRealtimeState;
    /**
     * Re-install a bound device's read getters after a report widened the evidence.
     *
     * The getters are built ONCE, and only for params the device had already reported — so a line whose
     * state arrives only over realtime binds with NO getters at all and would never grow them, no matter
     * how much state landed afterwards. A robot vacuum is exactly that: its cloud record carries none of
     * its data points, so the first report is what makes the reads exist.
     *
     * Re-binding is how the capability-gain path handles the same problem, and it is idempotent — the
     * getters read live state through a closure over `getProperty`, so rebuilding them keeps every value
     * a caller can already see. Only widening triggers it, so a device reporting the same ids repeatedly
     * rebinds once.
     *
     * `deviceState` is re-emitted once the getters exist. The report that creates them is announced before
     * they are installed, so the same event fires again when the reads are actually there, which is what
     * makes "re-read on `deviceState`" true on the first report rather than only from the second.
     * `bindActions` replaces the action objects, so the live ones are reached through the accessor
     * (`dev.vacuumClean()`) and never through a bag cached earlier.
     *
     * The evidence set is widened, never replaced: the ids come back through the cloud record, and a
     * record that omits a realtime-only id would otherwise un-know it and re-trigger on the next report.
     *
     * The device is re-resolved against the fresh record before binding. A property gated on a
     * realtime-only param enters the schema only once that param is evidence, and the value that made it
     * evidence was stored before the property existed, so the record's realtime params are applied again
     * to land it under the property's name.
     */
    private rebindReads;
    /**
     * The distinct credential scopes the current MQTT roster needs — no devices on a scope, no connection.
     * A Tuya clean-line device (`eufy_home_tuya`) needs none: the broker refuses its topics, and its state
     * is read from the Tuya cloud.
     */
    private mqttScopesInUse;
    /**
     * Read every Tuya clean-line device's DPs from the Tuya cloud and deliver them as realtime state,
     * concurrently. A failed read is reported, not fatal, and leaves that device's state as it was.
     */
    private readTuyaDevices;
    /**
     * Emit a semantic capability event whose name is only known at runtime (`decodeCapabilityEvent`
     * returns a plain-string `event` + `payload`). The typed `emit` overload requires a literal event
     * key, so this is the ONE place that bridges the dynamic name to the typed surface — every
     * `emit:` string in a capability module is a member of {@link DeviceEventMap}, so the cast is
     * sound. Keeping it here means the four dispatch loops stay a single call, not a scattered cast.
     *
     * `edge` asks for a state-carrying event to be suppressed when it only repeats what was last
     * announced. The state is noted either way: the poll re-announces an unchanged value on purpose,
     * and must still update what is known, or the next realtime signal carrying that same value would
     * read as a change and be announced a second time.
     */
    private emitSemantic;
    /**
     * Await one capability-declared reflected param before publishing its valueless transition event.
     *
     * The state already on hand is consulted BEFORE fetching, but only where the observation carries a concrete
     * value to compare against: a device that reports the written param on its own session lands it through
     * {@link applyRealtimeState} within seconds, and polling the account device list to learn what the device has
     * already said costs a dozen requests to reach the same answer. Without an expectation, "converged" means
     * only "differs from what was read before", which state already on hand can satisfy spuriously — and the
     * caller that has no expectation is the push path, where the signal itself is the news that a re-read is owed.
     *
     * Only a write's observation throws at the deadline; a push with nothing moved answers `false`.
     *
     * The cloud half is asked for through {@link DeviceRegistry.refreshedList}, never by fetching the account
     * list outright. The fetch is account-wide — one house list plus one device list per house — so a param that
     * never converges would otherwise spend a whole burst of those every iteration of this loop, and concurrent
     * transitions would multiply it by however many are in flight. The registry's reuse window and its
     * single in-flight fetch collapse all of that to one list per window, shared across every waiter. The loop
     * still turns on its own cadence: each pass re-reads what is known, so a value the device volunteers over
     * its own session settles the wait between two cloud reads rather than after them.
     */
    private refreshEventState;
    /** Serialize one complete state-transition transaction behind its keyed predecessor. */
    private enqueueStateTransition;
    /**
     * Recycle a standalone device's P2P session after a write that needs one, waiting only
     * {@link SESSION_RECYCLE_WAIT_MS} for it.
     *
     * The recycle itself waits for every viewer to detach, so that a write does not drop a live stream.
     * That wait is unbounded by design — a viewer may watch indefinitely — and it happens INSIDE the keyed
     * transaction, so the next write to the same member queues behind it. Racing it decouples the two: the
     * losing recycle stays pending and still runs when the station falls idle, it just stops gating an
     * unrelated write.
     *
     * A failure reported before the bound propagates; one arriving after it survives only as the session
     * manager's own log, since by then nothing is waiting to receive it.
     */
    private recycleStandaloneSession;
    /** Reopen a wired station that {@link recycleStandaloneSession} closed, while the generation that warmed it is current. */
    private reopenWiredStation;
    /**
     * Whether the DECODED property now reads what the write asked for.
     *
     * Compared against {@link CommandObservation.observed} where the property's decode is not the identity, and
     * against the raw expectation only where the two coincide. A disable-bit param reports `0` for a property
     * that reads `true`, so comparing the decoded value against the raw expectation would reject a write that
     * had landed — the value converged and the transition event never fired.
     */
    private matchesObservation;
    private eventRefreshKey;
    /** Limit waiting on an unabortable dependency operation to the remaining semantic-event refresh window. */
    private beforeDeadline;
    /**
     * Fan one inbound P2P frame out: raw escape hatch, device state, then semantic events.
     *
     * The frame is decoded against the capabilities of the device it came FROM, resolved from the
     * `(station, channel)` pair — a shared command id (1700 serves pan-tilt, spotlight and privacy)
     * would otherwise let an unrelated module's parser fabricate an event. The decode is a model
     * concern kept on this side of the boundary, so the router never imports model.
     *
     * Frame events carry the station, which cannot say WHICH attached device reported when a station
     * fans same-kind sensors out by channel, so the resolved serial is folded in; a payload's own
     * fields still win on conflict.
     *
     * Params the station volunteered land as device state first. They arrive in the cloud record's own
     * `param_type → value` shape, so no capability has to claim an id it does not own, and the reads
     * they back stop waiting for the next cloud poll. A capability decode follows for the frames that
     * report a bare value rather than that array, which the generic unwrap cannot recognise. Semantic
     * events are edge-triggered: the same change also arrives as a push seconds later, and is announced
     * once.
     */
    private onP2PFrame;
    /**
     * Record the state this signal reports, and say whether it merely repeats the last one announced.
     *
     * One physical change reaches the SDK on several transports — an entry sensor's contact arrives as
     * a station notify ~2 s before the identical FCM push — and is announced once. The comparison is
     * edge-triggered on the field a capability declared
     * ({@link CapabilityModule.stateEvents}) rather than time-windowed: a genuine open→close→open burst
     * differs from the last value at every step and passes intact, where any window wide enough to
     * cover the transport spread would have swallowed the second open.
     *
     * Returns `false` — never a repeat — in the three cases where suppressing would lose information:
     * an event no module declared as state-carrying (a pulse: motion, a doorbell press, whose
     * consecutive occurrences are all real), a signal carrying no value for the field (it says nothing
     * about the state, so it can neither duplicate nor overwrite it), and one that can't be attributed
     * to a device (announcing twice beats suppressing a different device's change).
     */
    private noteState;
    /**
     * Begin (or resume) login. Returns a `LoginResult` — switch on `status`:
     *  - `ok` → authenticated (`result.session`).
     *  - `captcha` → show `result.image`, then {@link solveCaptcha}(answer).
     *  - `2fa` → a code was sent; {@link submitVerifyCode}(code).
     *
     * A restored session resolves straight to `ok`. No exceptions for the expected captcha/2FA flow.
     *
     * @example
     * ```ts
     * const res = await eufy.login();
     * if (res.status === "captcha") await eufy.solveCaptcha(await promptUser(res.image));
     * else if (res.status === "2fa") await eufy.submitVerifyCode(await promptUser());
     * ```
     */
    login(opts?: {
        messageType?: number;
    }): Promise<LoginResult>;
    /** Continue a `{status:"captcha"}` login with the solved answer. See {@link login}. */
    solveCaptcha(answer: string, opts?: {
        messageType?: number;
    }): Promise<LoginResult>;
    /** Continue a `{status:"2fa"}` login with the verify code that was sent. See {@link login}. */
    submitVerifyCode(code: string): Promise<LoginResult>;
    /**
     * On a successful login, kick off auto-realtime (unless `autoRealtime:false`). Fire-and-forget so
     * `login()` returns as soon as the session is ready — realtime channels come up in the background and
     * surface failures via `error`. Idempotent through the retained generation promise.
     */
    private afterLogin;
    /**
     * Wait for the auto-managed realtime startup begun by the current successful {@link login}.
     *
     * A caller-specific timeout does not cancel startup. Calls made before successful login reject with
     * `login() first`; clients configured with `autoRealtime:false` resolve as `disabled` without opening
     * a transport.
     */
    waitForRealtime(options?: WaitForRealtimeOptions): Promise<RealtimeReadiness>;
    /** Raw mega HTTP client, for endpoints not yet wrapped. */
    get api(): MegaHttpClient;
    /**
     * Fetch the per-user secure-MQTT credentials for realtime appliance control. Pass `appName` to
     * request a specific capability scope on the current session without re-logging in — security
     * devices (locks/garage) need the `eufy_security` scope, which the default scope can't reach.
     */
    getUserMqttInfo(appName?: string): Promise<SecureMqttCredentials>;
    /**
     * A {@link CommandSink} bound to one device serial. This is the one place a device's commands fan out
     * to whichever transport it actually has — so capability modules and `getDevice` callers never need to
     * know which, and this facade names no capability and builds no wire bytes itself. The `ff09-*` kinds
     * ride ONE shared frame over BOTH P2P and secure-MQTT, so they're routed by the device's topology
     * (`p2p_did` present → P2P, else MQTT); the chosen router re-resolves its own routing tail. Every
     * other kind is P2P.
     */
    private commandSinkFor;
    /**
     * The station a device's commands go through: the device itself, or the HomeBase the registry links it
     * to. Answers the target record, the station record and serial, the station's `device_type`, and the
     * `t9000` / `t8n00` / `callDoorbell` family flags.
     */
    private stationOf;
    /** The vendor DeviceType of the station a device hangs off; `undefined` for a station itself. */
    private stationDeviceTypeOf;
    /**
     * Combine explicit P2P media with the optional passive push-thumbnail provider.
     *
     * The retained still also becomes the answer for a live still that could not be captured. One session
     * serves one camera at a time and a live view outranks a tile — a still does not open a connection of its
     * own — so a still asked for while a sibling is being watched is refused at the transport. Answering the retained bytes answers the read rather than
     * failing it, marked {@link MediaProvider.snapshotLive} `retained` so the caller knows they are not
     * current. With nothing retained the refusal stands.
     */
    private mediaProviderFor;
    /**
     * Choose the transport stack for one command — the routing half of {@link commandSinkFor}.
     *
     * The `ff09-*` kinds share ONE frame that rides either transport, so each stack is asked whether it
     * drives this device (`claimsDevice`) rather than inferring from the kind; `keyed-payload-actuate` (the
     * classic Wi-Fi lock) is routed the same way, a channel-less actuation claimed by the stack that drives
     * the lock. `registry.require` throws on an unloaded serial, so a routing decision never silently falls
     * through to the wrong transport.
     * The `eufy_life` DP writes (smart lights) are secure-MQTT-only. `aiot-dp` routes to either the
     * Anker AIoT MQTT stack or the legacy Tuya REST router depending on the device's category
     * (`eufy_home_tuya` → Tuya, everything else → MQTT). The capability layer emits a single `aiot-dp`
     * kind and stays transport-agnostic; only the facade sees both sides and decides here. A T9000 or T8N00
     * station and the devices attached to it go over RTC, with an attached device's command refused
     * unless its channel resolves back to it on the station. T8N00 uses full SDP and admits direct and
     * relay candidates; T9000 retains compact SDP and relay-only candidates. A call doorbell's route serves
     * media only, and the RTC router refuses a command on it. Everything else is P2P.
     */
    private routeCommand;
    /**
     * The RTC route for a T9000 or T8N00 station or a device attached to one, or a call doorbell that is its
     * own station, decided by the station's model classification; `undefined` for any other device. A T8N00
     * route carries its native `call` signalling; a doorbell route does too, and streams its video on a media
     * track. The admin id is the station's `member.admin_user_id`, else the logged-in user.
     */
    private rtcRouteFor;
    /**
     * The RTC media provider for a station on a media-track route, or a camera attached to a T9000 whose
     * `device_channel` resolves back to it on the station; `undefined` otherwise, unless an NVR camera has its own dedicated media call.
     */
    private rtcMediaFor;
    /**
     * List + classify devices across all houses (mega API). Each device is tagged with its API backend
     * + realtime transport. Camera/HomeBase records still appear here for inventory; driving them is
     * P2P. Delegates to `DeviceRegistry` (the house-scoped merge/dedupe lives there).
     *
     * Side-effect: registers `eufy_home_tuya` devices with the Tuya command router so
     * the command dispatcher can resolve a eufy SN → Tuya devId without a separate lookup.
     * The Tuya id is the first non-empty `tuya_uuid`, `tuya_virtual_id`, `tuya_device_id` or
     * `virtualId` on the raw cloud record, else the device's serial: the app keys its Tuya device by
     * the eufy device id, and a record that carries none of those fields is read under its serial.
     *
     * A partial cloud outage still resolves, with the devices that answered plus the ones already known — but a
     * session the cloud has rejected REJECTS, with {@link SessionExpiredError}. An empty list would be
     * indistinguishable from an account with no devices.
     */
    getDevices(): Promise<EufyDevice[]>;
    /** Devices that this client drives over MQTT (transport ≠ p2p). */
    getMqttDevices(): EufyDevice[];
    /**
     * One page of a robot vacuum's **cleaning history**, in whatever order the cloud returns it —
     * newest first in practice, but that is the gateway's contract and the SDK does not re-sort.
     *
     * `pageSize` is how many records to return and `page` is 1-based; page through until the returned
     * `total` is reached. Answers an empty page rather than throwing when the account has no history for
     * the device or the response cannot be read.
     *
     * Each record carries a `downloadUrl` for the run's binary detail blob (map and per-run statistics).
     * The SDK hands that URL over rather than fetching it — the host is unconfirmed and the blob's format
     * is not evidenced yet.
     */
    getCleanRecords(deviceSn: string, pageSize?: number, page?: number): Promise<CleanRecordPage>;
    /**
     * Inspect one device by serial: resolve its codec/capabilities, cross-reference every reported
     * `param_type` against the param dictionary, and emit a paste-ready `registry.ts` row plus
     * dictionary snippets for anything unknown. Loads the device list if needed; prefers
     * the live `get_device_param_list` for freshest params, falling back to the device-list params.
     */
    inspectDevice(sn: string): Promise<DeviceInspection>;
    /**
     * The device's LIVE, authoritative `rtsp://` URL — host, path, and the credentials it is
     * enforcing right now — or `undefined` when none is pushed within the read window.
     *
     * A thin public door onto the P2P transport (which stays internal otherwise): opens the
     * station's session on demand, so a viewer adopting a tile can call this directly without one
     * already existing. It writes only the publish switch and the test-stream provoke, never the
     * credentials, so a stream a NAS/NVR already consumes keeps its own pair.
     *
     * This is the CANONICAL way to fetch the URL: it provokes and returns it. The `rtsp` capability's
     * `url` member surfaces the SAME value as inbound state for code that already holds a `dev.rtsp()`
     * and reacts to `propertyChanged` — not a second way to fetch it.
     *
     * Every failure — no route, no account id, level-2 not ready, no push before the deadline — collapses
     * to `undefined`. The distinction the caller might want (terminal "no RTSP" vs a transient "session
     * not warm yet") is not drawn here yet; a caller that retries on `undefined` recovers from the
     * transient case. The read window is a fixed 12 s — long enough for a cold HomeBase to wake and
     * answer, and about the ceiling a UI adopting a tile will wait — deliberately not caller-tunable.
     */
    reportedRtspUrl(sn: string): Promise<string | undefined>;
    /**
     * Build a live {@link Device} model object for one serial: the resolved codec/capabilities with
     * its current param values applied (named via the param dictionary; unknown ids kept as
     * `unknown_<pt>`). This is the device primitive — `dev.getProperties()`, `dev.has(cap)`, etc.
     * Prefers fresh `get_device_param_list`, falls back to the device-list params.
     * Under auto-realtime the returned Device is wired with a read-through freshness cache (see
     * {@link Device.setFreshnessPolicy}), so repeat reads are served from cache instead of re-fetching,
     * and realtime updates keep values fresh.
     *
     * That refresh ANNOUNCES what it lands, like the other two inbound paths. Under frequent reads it
     * fires every `cacheTtlMs` where the poll fires every ten minutes, so it is where most fresh cloud values
     * arrive — and each announcing path is edge-triggered on the same live state, so whichever sees a change
     * first announces it and the others stay silent. Its timing says only when a caller happened to read; the
     * value is the news. It applies what the device volunteered over realtime on top of the cloud half, which
     * the registry keeps apart, so it can neither revert nor announce a revert of a report already landed.
     *
     * The `Device` returned is held WEAKLY: it is what the inbound paths announce against, so a caller that
     * wants property changes for a serial keeps its own reference. Dropping it stops the announcements, not
     * the device.
     *
     * @example
     * ```ts
     * const dev = await eufy.getDevice(sn);
     * if (dev.has("camera")) await dev.camera?.()?.snapshotStored?.();
     * console.log(dev.getProperty("battery"));
     * ```
     */
    getDevice(sn: string): Promise<Device>;
    /**
     * The {@link Ff09SettingsReader} behind `dev.lock()?.getAutoLockState()` — picks P2P vs MQTT the same
     * way {@link commandSinkFor} does for writes, so `lock.ts` never has to know which transport this
     * device has. `undefined` when `ctx.adminUserId` is missing (not a lock-family device — mirrors
     * `CommandContext.adminUserId`'s own doc: "present on lock-family devices, absent elsewhere").
     *
     * It earns its own boundary because `GET_SETTINGS` is a request/reply query that neither
     * `CommandSink` (write-only) nor `MediaProvider.p2pQuery` (P2P-only, no decrypt) fits. Named for the
     * frame family rather than the capability, so this facade stays capability-neutral like the layers
     * below it — see `CapabilityModule.actions`'s doc before adding another.
     */
    private ff09SettingsReaderFor;
    /**
     * Auto-realtime bring-up — the SDK owns connectivity so the host calls no `connect*`. Runs once per
     * session after a successful login (unless `autoRealtime:false`). Starts the **always-on, battery-safe**
     * channels — FCM push (account-wide events) + secure MQTT (iff appliances present) — and eagerly warms
     * P2P **only for wired stations** (HomeBases / mains cameras, which don't drain). Battery cameras are
     * left detached: their P2P opens on demand (command / stream, or an opted-in event pre-warm) and
     * idle-detaches. All channels start concurrently; a single failure surfaces via `error` without
     * aborting the rest.
     */
    private ensureRealtime;
    /** Create or join the one transport bring-up owned by the current realtime epoch. */
    private ensureRealtimeGeneration;
    /** Start all selected transports concurrently and settle their owning generation once. */
    private startRealtimeGeneration;
    /**
     * Bring push up again after the generation's startup attempt failed, backing off between attempts
     * until one connects, the generation is superseded, or it is aborted by {@link disconnect}.
     *
     * The MCS socket reconnects on its own only once it has connected. The settled
     * {@link RealtimeReadiness} is a startup snapshot and is not revised when a retry connects.
     */
    private retryPush;
    /** Resolve a generation with an immutable count snapshot; later transport completions are ignored. */
    private settleRealtimeGeneration;
    /**
     * Arm the next cloud-param poll. Re-arms from the END of each run rather than on a fixed interval,
     * so a slow list fetch can never stack overlapping polls, and re-arms in `finally` so a failed poll
     * (a transient cloud error) doesn't silently kill the loop for the session's remaining life.
     *
     * Disabled by `pollMs: 0`, and never started when `autoRealtime:false` — a host that opted out of
     * SDK-managed connectivity gets no background traffic. Also declines to re-arm once the bring-up
     * that armed it has been superseded, so a poll that fires as the client shuts down can't resurrect
     * the loop after teardown.
     */
    private schedulePoll;
    /** The effective cloud poll interval in ms — the configured {@link EufyMegaOptions.pollMs} or the default. */
    get pollIntervalMs(): number;
    /**
     * Change the cloud poll interval at runtime; `ms` is the gap between polls, `0` disables polling.
     *
     * Takes effect immediately: the pending tick is cancelled and the loop re-armed at the new interval
     * (or left cancelled for `0`). Unlike the constructor {@link EufyMegaOptions.pollMs}, this can be
     * changed after login.
     */
    setPollInterval(ms: number): void;
    /**
     * One poll pass: re-read the device list, land what moved on the live devices, announce every property
     * whose value changed, and emit a semantic event for every param that changed value since the last pass.
     *
     * `propertyChanged` is the generic channel this exists for: most readable members arrive only as a
     * cloud param and no push carries them, so re-reading was the only way a caller could learn one had
     * moved and re-reading cannot say WHEN. A capability's own `source:"poll"` mapping is beside it, for a
     * state that carries something a bare property change cannot (`contact.ts` maps the contact param as a
     * third transport for a state its push and its station notify also report).
     *
     * Each change is decoded against the reporting device's capabilities, the same argument the push path
     * passes: a param id claimed by more than one capability cannot be resolved without it, so a poll
     * event declared on a contested id would be declared and then silently never emitted.
     *
     * Also emits `deviceState` for each device the diff reports as having re-reported. That is tracked
     * apart from the param diff because the two are different facts: the cloud can re-stamp a param with
     * an unchanged VALUE, which is no state change to report but is fresh proof the device is alive. A
     * device absent from the previous pass is skipped — first sight is discovery, not a transition;
     * {@link deviceState} answers an initial reading.
     *
     * Then re-reads every Tuya clean-line robot from the Tuya cloud ({@link readTuyaDevices}): its state
     * is not in the cloud record this pass diffs and no live channel carries it, so the poll is where it
     * stays fresh. That read runs after the `try`, not inside it, so a cloud error on the list diff does
     * not skip it; it reports its own failures and never rejects.
     */
    private pollOnce;
    /**
     * Land a poll pass's CHANGES on every live {@link Device} and announce what moved, BEFORE anything
     * else derived from them is emitted.
     *
     * Ordered that way because live state is the map every capability getter reads: a listener reading a
     * getter inside a poll event handler has to see the value that event is about. The read-through
     * freshness policy cannot stand in for this — it fires on a READ of a stale value and hands that read
     * the stale one, so a value nothing happens to read is never refreshed by it.
     *
     * The CHANGES, not the whole post-change map {@link ParamChange} also carries. That map is there so an
     * event decode can read sibling params; applying it would revert every id a realtime report made
     * fresher, because {@link DeviceRegistry.applyRealtimeParams} keeps a report apart from the cloud
     * record's params — the cloud list carries the pre-report value long after the device volunteered the
     * new one, so an open door reads as closed on the next pass that sees anything on that device move.
     *
     * That precedence is the reason a moved id is also RETIRED from the report map
     * ({@link DeviceRegistry.retireRealtimeParams}). The report outranks the cloud only while it is the
     * fresher half, and a diff on that id is the cloud stating a transition of its own — so left in place
     * the report would outrank it forever, and the next join of the two halves would revert this pass's
     * value and announce the revert. Retired for EVERY device the diff touched, not only a live one: the
     * join also feeds the `Device` a later {@link getDevice} builds, which no live entry exists for yet.
     */
    private applyPolledParams;
    /**
     * The live {@link Device} for a serial, for a path that is about to ANNOUNCE against it — reporting
     * once when one the caller asked for has since been collected.
     *
     * An announcement carries the value read out of that device's own live state, so a collected device
     * cannot be announced for, and the caller is the only thing keeping one alive — {@link liveDevices} is
     * weak by contract. Losing announcements that way fails in the three worst ways at once: it is
     * non-deterministic (it turns on when the collector runs, so it holds in development and stops under
     * memory pressure), silent (no error, the events simply cease), and non-local (the obligation is on
     * {@link getDevice}, the symptom shows on `propertyChanged`).
     *
     * Neither alternative is available: re-deriving the value outside live state is two answers for one
     * reading, which is the disagreement the announcement exists to remove, and keeping every device alive
     * here reverses this map's own invariant. So it is LOUD.
     *
     * Reported only for a serial the caller DID ask for, since one never fetched has no object by definition
     * and was never owed an announcement — reporting those would name most of the account on every pass. The
     * dead entry is dropped as it is reported, which is what makes it once: a device let go on purpose must
     * not narrate every inbound signal for the rest of the session, and a later {@link getDevice} re-registers
     * the serial and resumes announcing.
     *
     * Deliberately not routed through {@link reportError}: nothing in this SDK failed, so it must not reach a
     * host's `error` handling. It is a usage fact, reported at `warn`.
     */
    private liveDeviceToAnnounce;
    /**
     * Apply a param map to one live {@link Device} and announce every property it moved, one
     * `propertyChanged` each. The one place the two halves are joined, shared by all three inbound paths
     * that reach live state.
     *
     * The device decides which of the changed names it will stand behind and what value each carries
     * ({@link Device.announcements}), so this stays a fan-out: no capability name, no member id, and no
     * second conversion of a wire value that could disagree with the getter beside it.
     *
     * Only a device a caller is HOLDING is announced for, because the announced value is read out of that
     * device's own live state and a serial nobody asked for has none. Resolving one on demand could not
     * help: a device built from the already-updated record has nothing to diff against, so the pass that
     * created it could never be the pass it announces. Such a device's liveness still reaches a host as
     * `deviceState`.
     *
     * Echoes of the SDK's own writes are announced rather than suppressed. An inbound path cannot tell a
     * change it caused from one an external actor caused, and suppressing on that guess is unsound, not
     * merely conservative: if a user also changes the value in the vendor app inside the window, the real
     * external change is the one lost — a wrong state held indefinitely, against one redundant idempotent
     * re-read.
     */
    private applyAndAnnounce;
    /**
     * Re-resolve a device a caller is holding, in case fresher evidence granted it a capability.
     *
     * A capability is granted on evidence the device reports, so one resolved before it had reported a
     * param lacks the capability that param proves — permanently, for that object, even once the value
     * starts arriving. This closes the gap for the `Device` instances already handed out: on new
     * evidence they gain the accessor, bound, without the caller re-fetching.
     *
     * Only widens, never retracts, and re-binds only when something was actually gained, so the common
     * poll costs one set comparison. Best-effort: a device that has been dropped, or a re-bind that
     * fails, must not break the poll loop for every other device.
     *
     * The whole record goes in, never a field-by-field copy of it: since this path only ever ADDS, a
     * field left behind here re-grants what the first resolution deliberately withheld — an attached
     * camera would take back the hub's guard mode on the first param change the poll saw.
     */
    private widenCapabilities;
    /**
     * Open the P2P session for ONE device's station, and nothing else.
     *
     * Auto-realtime warms every wired station on the account, which is what a host driving a
     * fleet wants. A caller that needs exactly one station does not: an unreachable station broadcasts a
     * local lookup to `255.255.255.255` **once a second for the full connect timeout** and sends a PPCS
     * lookup to every cloud address in the same tick, so warming a fleet to talk to one camera is a
     * burst of broadcast and NAT churn on the user's network for stations nobody asked about. Pair this
     * with `autoRealtime: false` to open only what is being used.
     *
     * Resolves when the station is connected; rejects on its connect timeout. Best-effort and idempotent
     * — an already-open session resolves immediately.
     */
    connectStation(deviceSn: string, signal?: AbortSignal): Promise<void>;
    /**
     * Keep a T9000 station's RTC command session open and warm, so a command fires without a cold reconnect.
     * Answers the hold's disposer; throws for any other station, and while logged out.
     */
    keepStationWarm(stationSn: string): () => void;
    /** Eagerly open P2P sessions for WIRED stations only (persistent — they don't drain). Battery
     *  stations stay closed until an on-demand open. Best-effort per station. */
    private warmWiredP2P;
    /**
     * A station's power tier for the P2P lifecycle: a HomeBase/station is `"wired"` (persistent); a
     * standalone device is `"battery"` iff its resolved capabilities include `battery` and it is not a
     * confirmed mains-only camera model, else `"wired"`.
     * Keyed on the STATION's own power, never a child's (a battery cam attached to a wired HomeBase draws
     * from the base's persistent session). Reads capabilities on the client side — no model type leaks to
     * transport (the router only ever sees the `"wired"|"battery"` string).
     */
    private stationPower;
    /**
     * Speculatively open the P2P session of the station behind `deviceSn`, if the caller opted this
     * semantic event in — so a stream or talkback opened right after a doorbell ring or a detection starts
     * warm instead of paying a cold open.
     *
     * Four gates. `autoRealtime: false` means the SDK opens nothing on its own initiative at all;
     * {@link EufyMegaOptions.prewarmEvents} must name the event, and it names none by default, which is
     * what makes pre-warm opt-in; the station must be one the account actually reports; and its power tier
     * must be one {@link EufyMegaOptions.prewarmTiers} allows.
     *
     * The tier is resolved for the STATION whose session would open, which is why an attached camera is
     * judged by its base — {@link P2PCommandRouter.stationKeyOf} is the single source of that mapping, and
     * {@link stationPower} of the tier. A station with no record of its own is declined rather than
     * pre-warmed: {@link stationPower} answers `"wired"` for one it cannot find, because the tier it feeds
     * the session lifecycle must always be an answer — and taking that answer here is how a battery camera
     * gets pre-warmed under a `"wired"`-only opt-in.
     *
     * Best-effort and unawaited: a pre-warm nobody uses must cost the caller nothing, so a failed open
     * surfaces on `error` like any other background transport failure.
     */
    private prewarmForEvent;
    /**
     * Connect a secure-MQTT transport for one credential scope (appliances: vacuum, light, plug,
     * display) using credentials fetched from the cloud, and return it **connected but not installed**:
     * {@link ensureMqttStarted} owns installing it, subscribing devices, and the epoch check, so that
     * lifecycle lives in exactly one place. Only ever called through {@link ensureMqttStarted}.
     *
     * Identified by a client id built from this client's `openudid`, not by the certificate's name:
     * that name is `{user_id}-{app_name}`, which every client on the account shares per line, and a
     * duplicate client id is a takeover the broker resolves by evicting the incumbent. The id shape is
     * the app's own (`android-{app_name}-{uid}-{uuid}-{ts}`, see {@link buildAppShapedClientId}), which
     * the broker grants on the `eufy_security` credential.
     *
     * It separates two clients exactly as far as their `openudid` does: a caller that supplies none
     * gets the value derived from the account, which every such client shares — the same condition
     * under which their logins already displace each other (`MegaClientConfig.openudid`).
     *
     * A client id the broker REFUSES falls back to the certificate's name, since a shared channel beats
     * none, and that transport then keeps that name until {@link disconnect}. Only a refusal: a connect
     * that fails for any other reason rejects the bring-up, which clears its memo in
     * {@link ensureMqttStarted} so the next one asks under this client's own id again — a dropped
     * socket must not be what moves a process onto the shared name for good.
     */
    private startMqtt;
    /**
     * Connect one secure-MQTT transport under `clientId`, or under the certificate's own name when it is
     * omitted, and wire its decode and fan-out. See {@link startMqtt} for which id is used and why.
     *
     * The fan-out is wired once the connection stands, so an attempt that is discarded — a client id the
     * broker refuses, a socket that dies mid-handshake — never reports a connection a consumer never had;
     * the connect it just completed is announced here instead. Errors raised while connecting are held
     * only to keep an emitter without an `error` listener from throwing, and are reported once the
     * transport is one a consumer owns.
     *
     * The inbound decode is gated by the reporting device's own capabilities, so one line's decoder never
     * runs against another's traffic, and the DP frame is unwrapped here — the layer that may import the
     * transport — so a capability reads tags without owning any framing.
     */
    private connectMqtt;
    /**
     * Subscribe the devices on one credential scope; a failing subscribe is reported, not fatal (one
     * unreachable device must not stop the rest of the roster from coming up).
     *
     * A Tuya clean-line device (`eufy_home_tuya`) is not subscribed: its state lives on the Tuya cloud,
     * and the broker refuses its `eufy_home` topics on every credential.
     */
    private subscribeMqttDevices;
    /**
     * Send whatever a device's capabilities want sent once its realtime channel is up — for a line whose
     * state is pushed on change with no heartbeat, the request that makes its state readable before the
     * first write. Best-effort: reported, never fatal, since a device that ignores it is only left with
     * the state it would have had anyway.
     */
    private sendRealtimeInit;
    /**
     * The open P2P sessions, by key. P2P is auto-managed: wired stations are warmed at login, battery
     * stations open on demand (command / stream, or an opted-in event pre-warm) and idle-detach — so this
     * map grows and shrinks over time.
     *
     * A station's own session is keyed by its serial, and `p2pConnect(stationSn)` / `p2pClose(stationSn)`
     * track those. A station serving more than one camera at once also holds a session per extra camera,
     * keyed `<stationSn>#live:<channel>` — these carry media alone and raise no connection events, because
     * a station announces its state to every client that connects and reporting each copy would double
     * every event the station's own session already delivers.
     */
    getP2pSessions(): Map<string, P2PSession>;
    /**
     * The people enrolled on a station, read from its own `person_basic_info` table over P2P.
     *
     * The cloud roster (`api.getFaces()`) answers empty for an account that keeps its faces on the
     * station, because they were never uploaded — the station holds them.
     *
     * Resolves with the rows the station returned. Rejects on a station that cannot be reached, on a
     * record stating no `admin_user_id`, and on the reply not arriving whole in time. Assembling that
     * reply is `P2PSession.readDatabase`'s; this resolves which station and which account id.
     *
     * `stranger<n>` names are the station's own placeholders for a face nobody has named, and are
     * returned as they arrive; a caller that wants only named people filters them.
     */
    getStationFaces(stationSn: string, opts?: StationFacesOptions): Promise<StationFace[]>;
    /** The station's own `admin_user_id`, which its database refuses the query without. */
    private adminUserIdOf;
    /**
     * The liveness facts for one device — see {@link DeviceState}. Facts, not an `online` verdict: "how
     * long is too long" is a threshold that belongs to the caller, and it differs per device class.
     *
     * The `deviceState` event announces when a device reports in.
     */
    deviceState(sn: string): DeviceState;
    /**
     * Return the latest explicit availability observation for `sn`, or `undefined` when no verified
     * vendor signal has been observed. This never derives a state from {@link DeviceState.lastSeenMs},
     * connection silence, P2P lifecycle, operation failures or caller-selected timeouts.
     */
    deviceAvailability(sn: string): AvailabilityObservation | undefined;
    /** Decode a verified wire signal, then assign its device-availability semantics at the client seam. */
    private processAvailabilityMessage;
    /**
     * Retain one authoritative observation per device and emit only state transitions. When both the
     * previous and incoming envelopes supply ordering evidence, an older message cannot overwrite newer
     * device truth. Exact duplicate ordering cannot reverse state. If comparable vendor ordering is
     * absent, handler arrival order defines which explicit observation is later. A same-state observation
     * still refreshes the retained evidence without re-emitting.
     */
    private applyAvailabilityObservation;
    /**
     * The {@link DeviceState} for a device record already in hand — the shape {@link deviceState} returns
     * once it has resolved the serial, reused by the poll loop so emitting for a batch of devices doesn't
     * re-scan the roster per device.
     */
    private stateOf;
    /**
     * The capability set to disambiguate an inbound push/poll id with, or `undefined` when the serial is
     * unknown. Push ids are namespaced per device family, so the same integer means different things on
     * different hardware; `decodeEvent` needs the device's capabilities to pick the right mapping and
     * deliberately stays silent rather than guessing when it can't.
     */
    private capsForEvent;
    /**
     * **Write** a device property. Asks the capability modules to build the command for this
     * `(name, value)` — the module owns how THIS device applies it. No `(name, value)` recipe → the
     * device doesn't support the property, so we throw {@link CapabilityNotSupportedError} rather than
     * a silent no-op. On success the device echoes the new state back as a param update — read it with
     * {@link getDevice} to confirm.
     *
     * @param sn device serial.
     * @param name property name (e.g. "light", "brightness", "enabled").
     * @param value desired value.
     *
     * @example
     * ```ts
     * await eufy.setProperty(sn, "brightness", 50);
     * await eufy.setProperty(sn, "light", true);
     * ```
     */
    setProperty(sn: string, name: string, value: boolean | number | string): Promise<void>;
    /**
     * Restart a station: a HomeBase, or a camera-family device that is its own station.
     *
     * The restart is `RESTART_HUB` on the station's broadcast channel, so it reaches whatever owns the
     * P2P session. A standalone camera or doorbell owns its own session and is the station it restarts.
     * A camera attached to a HomeBase is not — the same frame would restart its HomeBase — so its serial
     * throws, as does any non-camera serial, rather than doing nothing. The device drops its connection
     * and returns after a minute or two; a HomeBase takes everything behind it offline meanwhile.
     * Verified on real hardware against a HomeBase and a standalone indoor camera.
     */
    reboot(sn: string): Promise<void>;
    /**
     * Build the {@link CommandContext} for a device: the evidence a capability uses to resolve a
     * command variant (channel, codec, deviceType, model, reported param/DP ids) plus the RESOLVED
     * capability set that gates command building.
     *
     * Resolves from the same fresh `DeviceRegistry.record` (`get_device_param_list` overlay +
     * category) and `resolveDevice` that {@link getDevice} uses, so the capability set here is byte-for-byte
     * what `device.has(cap)` / `buildActions` saw — a command is never rejected for a capability the
     * device model advertises.
     *
     * `paramIds` is cloud params UNION whatever the device reported over realtime — it is the evidence
     * gate behind the typed read getters, so a line whose state only ever arrives live still advertises
     * exactly the reads it has.
     */
    private fetchDpCatalog;
    /** The {@link CommandContext} for a device, built from `known` when that record is already in hand. */
    private commandContext;
    /**
     * **Generic P2P request/reply query** — sends a `SET_PAYLOAD` sub-command and resolves with the
     * reply frame's `payload`. Transport-only escape hatch (the router owns the wire); the caller owns
     * the sub-command id and the reply shape (e.g. the doorbell's 6237 quick-response list).
     * @internal
     */
    p2pQuery(sn: string, subCmd: number, opts?: {
        timeoutMs?: number;
    }): Promise<Record<string, unknown>>;
    /**
     * Connect FCM push — the always-on, server-initiated channel that delivers event + **thumbnail**
     * notifications (motion/person/doorbell/package, each with a thumbnail URL). Independent of
     * MQTT/P2P. On first run it registers a push token, tells the eufy cloud to push to it, then holds
     * the socket. With a `pushStore`, the token + seen ids persist so later runs just reconnect. Emits:
     *   - `push(event)` — normalised `PushEvent` (deviceSn, eventType, eventName,
     *     thumbnailUrl, cipher, payload, raw)
     *   - `pushRaw(raw)` — the raw `RawPushMessage`
     *   - `pushConnect` / `pushDisconnect`
     *
     * Started automatically by {@link ensureRealtime} after login. A semantic event the caller opted into
     * via {@link EufyMegaOptions.prewarmEvents} — none by default — also speculatively pre-warms that
     * camera's P2P session, so a following stream or talkback starts warm; {@link prewarmForEvent} owns that
     * decision, and the router stays event-agnostic.
     *
     * Returns the connected client rather than installing it. Registration can outlive a `disconnect()`,
     * and {@link ensureRealtime} owns the decision of whether a finished bring-up is still the current
     * one — so this never overwrites a channel a later login already brought up.
     */
    private startPush;
    /**
     * Admit only exact, account-known devices with resolved snapshot evidence into the passive store; a
     * station-only candidate is admitted under the event's device serial.
     */
    private observeStoredImage;
    /**
     * Tear down every realtime channel: close the secure-MQTT transport, all P2P sessions, and the FCM
     * push socket. Idempotent — safe to call when nothing is connected. Leaves the login session intact
     * (call {@link login} again to reconnect without re-authenticating).
     */
    disconnect(): Promise<void>;
    /**
     * Disconnect and forget every installed secure-MQTT transport.
     *
     * Clearing both installed transports and their in-flight memos lets the next successful login own a
     * fresh set. Individual stale attempts retain their epoch guard and close only the transport they
     * created, so they cannot clear a successor generation's map.
     */
    private closeMqttTransports;
    /**
     * Close every realtime channel and stop the poll loop.
     *
     * Safe to run twice: each channel is cleared as it closes. The edge-trigger's memory of announced
     * states goes with them: it describes what was announced over a connection that no longer exists,
     * and keeping it would suppress the first report after a reconnect as a duplicate — leaving nothing
     * announced until the state next physically changes.
     */
    private teardownRealtime;
    /** True if a usable session (restored from store or freshly logged in) is held. */
    get loggedIn(): boolean;
    /** Tear down realtime, clear passive media, and forget the persisted login session. */
    logout(): Promise<void>;
    /** Forget the persisted session (forces a fresh login + 2FA next time) and clear account-owned media. */
    clearSession(): void;
}
