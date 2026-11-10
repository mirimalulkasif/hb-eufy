/**
 * Capability-module barrel — collects every `capabilities/<cap>.ts` module and exposes the
 * fleet-wide helpers (`getCapabilityModule`, `mergeProperties`, `detectCapabilities`,
 * `decodeFrame`, `buildCommand`). Adding a capability = a new file + one import line here.
 *
 * @module model/capabilities
 */
import type { Capability, CloudRecord, Codec, PropertyChange, PropertySpec } from "../types.js";
import { type MemberDeps } from "./members.js";
import { type CapabilityDescriptor } from "./manifest.js";
import type { CapabilityModule, EventMapping, CapabilityEvent, DecodedState, InboundSignal, CommandContext, AvailabilityContext } from "./types.js";
import type { Command } from "../../core/contracts.js";
export { RtspRecordingMode, type RtspRecordingModeValue, type RtspAuthScheme } from "./rtsp.js";
export { EntryAlarmTone, type EntryAlarmToneValue } from "./contact.js";
export { SirenVolume, type SirenVolumeValue, SirenAlarmDuration, type SirenAlarmDurationValue } from "./siren.js";
/**
 * Ask what a bound capability can be told to change but can never report back, and what it reports without
 * that value reflecting its own setter.
 */
export { unobservableMembers, unreflectedMembers } from "./members.js";
export { Watermark, type WatermarkValue, NightVision, type NightVisionValue, RecordingQuality, type RecordingQualityName, RECORDING_QUALITY_TIERS, StreamingQuality, type StreamingQualityName, STREAMING_QUALITY_TIERS, resolveStreamingQuality, resolveStreamingQualityTier, resolveRecordingQuality, resolveRecordingQualityValue, resolveRecordingQualityTier, } from "./camera.js";
export { WorkingMode, PowerSource, resolveWorkingMode, resolveWorkingModeValue, cameraPowerTier, WORKING_MODE_MAPS, type WorkingModeName, type PowerSourceName, } from "./battery.js";
export { type DpCatalog, EMPTY_DP_CATALOG } from "./dp-catalog.js";
import type { PtzActions } from "./ptz.js";
import type { LightActions } from "./light.js";
import type { RgbColor, SmartLightActions } from "./smart-light.js";
import type { CameraActions } from "./camera.js";
import type { AudioActions } from "./audio.js";
import type { BatteryActions } from "./battery.js";
import type { LockActions } from "./lock.js";
import type { SirenActions } from "./siren.js";
import type { ArmingActions } from "./arming.js";
import type { DoorbellActions } from "./doorbell.js";
import type { MotionActions } from "./motion.js";
import type { ContactActions } from "./contact.js";
import type { LeakActions } from "./leak.js";
import type { SmokeActions } from "./smoke.js";
import type { CoActions } from "./co.js";
import type { KeypadActions } from "./keypad.js";
import type { RtspActions } from "./rtsp.js";
import type { VacuumCleanActions } from "./vacuum-clean.js";
import type { VacuumDockActions } from "./vacuum-dock.js";
import type { DisplayActions } from "./display.js";
import type { SuctionActions } from "./suction.js";
import type { MowerActions } from "./mower.js";
import type { LocateActions } from "./locate.js";
import type { SmartDropActions } from "./smart-drop.js";
import type { DeviceInfo } from "./info.js";
import type { CusPushAlarmType } from "../push-events.js";
/**
 * Look up the {@link CapabilityModule} for a capability, or `undefined` if none is registered.
 * @internal
 */
export declare function getCapabilityModule(cap: Capability): CapabilityModule | undefined;
/**
 * The complete capability → module map. Every member of the {@link Capability} union has an entry.
 * @internal
 */
export declare const CAPABILITY_MODULES: Record<Capability, CapabilityModule>;
/**
 * Every param these capabilities declare before any gate — the set a device's schema is a subset of.
 *
 * A param in here that a device's schema does NOT carry is one a gate withheld: the capability resolved,
 * and its member decided the read does not describe this device — a cell reading on a mains model, a mode
 * a family does not carry. Read-aliases count, since a member reads them under its own name.
 * @internal
 */
export declare function claimedParams(caps: Capability[]): Set<number>;
/**
 * Merge the property schemas of several capabilities into one flat, de-duplicated list.
 *
 * Properties are de-duplicated by `PropertySpec.name` with **first-wins** semantics, so the
 * caller controls precedence through the order of `caps`. Capabilities with no registered module
 * are skipped.
 *
 * @param caps - capabilities to combine (order = precedence).
 * @returns the union of all contributed `PropertySpec`s, unique by `name`.
 * @internal
 */
export declare function mergeProperties(caps: Capability[], ctx?: AvailabilityContext): PropertySpec[];
/**
 * Detect the capabilities a device exposes from its cloud record and codec. A capability is added
 * if its product line matches the codec's ({@link lineAllows}, checked first) AND ANY of its
 * {@link import("./types").DetectionSpec} fields match:
 *  - an `evidenceParams` id is present in `rec.params` keys,
 *  - `deviceTypes` includes `rec.deviceType`,
 *  - a `modelHints` regex matches the model/category/name haystack,
 *  - `codecs` includes `codec`,
 *  - `detect(rec, codec)` returns true.
 *
 * An absent `codec` belongs to no line, so only the line-agnostic capabilities can match — the truthful
 * answer for a device outside the eufy families entirely. Never throws. Returns a de-duplicated array.
 * @internal
 */
export declare function detectCapabilities(rec: CloudRecord, codec?: Codec): Capability[];
/**
 * The baseline capabilities a codec grants every device of that family — derived from the modules
 * that declare the codec in their {@link import("./types").DetectionSpec} `codecs`. Each capability
 * file owns "I am part of codec X's baseline", so the codec→caps table is a projection of the modules,
 * not a second source of truth.
 *
 * @param codec the resolved codec.
 * @returns a fresh array of baseline capabilities for that codec (possibly empty).
 * @internal
 */
export declare function codecBaseline(codec: Codec): Capability[];
/**
 * The capabilities only the device that OWNS a group may expose, folded from every module's
 * {@link CapabilityModule.ownedByStation}.
 *
 * A barrel projection like {@link codecBaseline}: it lets `resolveDevice` withhold a group-owned
 * control from an attached device without naming a capability, so the next one that turns out to live
 * on the hub is a flag on its own module rather than another branch in the resolver.
 *
 * @internal
 */
export declare const STATION_OWNED_CAPABILITIES: ReadonlySet<Capability>;
/** @internal */
interface ResolvedEventRefresh {
    param: number;
    property: string;
    timeoutMs: number;
}
/**
 * An index hit: the semantic event name, the capability that claims the id, and any static payload
 * the mapping attached. The capability is what disambiguates a shared id.
 * @internal
 */
export type EventHit = Pick<EventMapping, "payload" | "derive"> & {
    emit: string;
    capability: Capability;
    refresh?: ResolvedEventRefresh;
};
type EventIndex = {
    exact: Map<number, EventHit[]>;
    ranges: Array<{
        lo: number;
        hi: number;
    } & EventHit>;
};
/**
 * Build the inbound-event index from a module list: keyed by source ("push" | "poll"), then exact id →
 * the candidate hits, plus a small list of `[lo,hi]` ranges. Dispatch is a direct lookup — no loop over
 * modules, no per-module decode code for the common case.
 *
 * Each id maps to a LIST because push ids are namespaced **per device family**, not globally: the same
 * integer means different things on different hardware (`SmartDropPushEvent.TAMPERED_WARNING` and
 * `CusPushEvent.ALARM` are both 10; SmartDrop's battery ids 6/7/11 are `CusPushEvent`'s
 * BATTERY_LOW/HOT/FULL). With one entry per id, whichever module happens to be registered last wins for
 * every device — turning a tamper alert into a battery alert. Candidates are resolved against the target
 * device's capabilities at dispatch time ({@link CapabilityModule.decodeEvent}).
 *
 * Parameterised over the modules rather than closing over the registry; the real index is built once
 * from every registered capability module.
 * @internal
 */
export declare function buildEventIndex(modules: readonly CapabilityModule[]): Record<"push" | "poll", EventIndex>;
/**
 * Semantic event name → the payload field carrying its state, folded from every module's
 * {@link CapabilityModule.stateEvents}.
 *
 * A barrel projection like the action/event maps: it lets the facade be edge-triggered on state
 * without naming a capability. An event ABSENT here is a pulse and is always announced.
 */
export declare const STATE_EVENT_FIELDS: Readonly<Record<string, string>>;
/**
 * Pick the mapping that belongs to THIS device when several families claim the same id.
 *
 * With one candidate there is nothing to resolve — emit it, so a device whose capabilities can't be
 * resolved still gets the event. With several, the device's own capability set decides; if
 * that isn't known, the SDK emits NOTHING rather than guessing, because naming the wrong event (a
 * tamper reported as a battery alert) is worse than staying silent about it.
 */
export declare function resolveHits(hits: EventHit[], capabilities?: ReadonlySet<Capability>): EventHit[];
type DecodedCapabilityEvent = CapabilityEvent & {
    refresh?: ResolvedEventRefresh;
};
/**
 * Normalize an inbound {@link InboundSignal} (push / P2P frame / poll) into the semantic
 * {@link CapabilityEvent}s to emit. Push/poll resolve via the declarative index (pure data);
 * P2P frames run the modules' {@link CapabilityModule.decodeEvent} escape hatch (binary parsing).
 * A `deviceSn`/`stationSn` from the signal is folded into each payload.
 *
 * `capabilities`, when supplied, has a different job per source:
 *
 *  - **p2p-frame / mqtt** — an allow-list over the escape-hatch decoders, mirroring `buildCommand`'s
 *    gate on the outbound side. A frame reusing a shared command id (e.g. 1700
 *    `CMD_DOORBELL_SET_PAYLOAD`) would otherwise be fed to every module's binary parser and could
 *    fabricate a semantic event on hardware lacking the capability that owns that parser.
 *  - **push / poll** — a tie-breaker only, between families claiming the SAME id (see
 *    the shared event index). An id with one claimant emits regardless of capabilities: detection is
 *    evidence-based and can under-report, so gating every push on it would silently drop real events.
 *    A contested id with no capability context emits nothing rather than a guess.
 *
 * A mapping's static payload is spread LAST, so the raw push body cannot overwrite it. Push payloads
 * carry short, generic keys straight off the wire, and a discriminator like `phase` is the only thing
 * separating a fired alarm from a countdown — letting the wire win there would silently change an
 * event's meaning.
 *
 * Omitted (undefined) = run all escape-hatch modules and accept any single-claimant id.
 * @internal
 */
export declare function decodeEvent(signal: InboundSignal, capabilities?: ReadonlySet<Capability>): DecodedCapabilityEvent[];
/** Whether any of these capabilities has realtime-init commands to send — checked before the caller
 * pays for a {@link CommandContext}, which costs a device-param fetch. */
export declare function needsRealtimeInit(capabilities: ReadonlySet<Capability>): boolean;
/**
 * The commands to send once a device's realtime channel is up, from every capability it has that asks
 * for one. Empty for a device whose state arrives without being asked.
 */
export declare function buildRealtimeInit(capabilities: ReadonlySet<Capability>, ctx: CommandContext): Command[];
/**
 * Whether any of these capabilities feeds its readable state from realtime rather than from a pollable
 * cloud param — i.e. whether a device is worth waiting on before its reads are meaningful.
 */
export declare function hasRealtimeReads(capabilities: ReadonlySet<Capability>): boolean;
/**
 * Recover device state from an inbound signal — the state-side dual of {@link CapabilityModule.decodeEvent}. Gated by
 * the reporting device's capabilities exactly as events are, so one product line's decoder never runs
 * against another line's traffic. One entry per module that recognised the signal; a module that
 * decoded no fields is dropped.
 */
export declare function decodeState(signal: InboundSignal, capabilities?: ReadonlySet<Capability>): DecodedState[];
/**
 * Resolve a semantic `action` into a transport-neutral {@link Command} for a device, using
 * {@link CommandContext} to pick the right variant. The first module that handles the action wins
 * (module order = precedence). `undefined` if no module has a recipe.
 * @internal
 */
export declare function buildCommand(action: string, value: boolean | number | string, ctx: CommandContext): Command | undefined;
/**
 * Fields every semantic event carries — which device/station it came from. `decodeEvent` always
 * folds these in from the signal.
 */
export interface SemanticEventBase {
    /** Serial of the device the event is about (present for push/poll signals). */
    deviceSn?: string;
    /** Serial of the station that delivered it (present for P2P / HomeBase-relayed signals). */
    stationSn?: string;
}
/** A push-delivered semantic event (motion, doorbell, person, package, lock). */
export interface PushSemanticEvent extends SemanticEventBase {
    /** The raw FCM event-type code that produced this event. */
    eventType?: number;
    /** A thumbnail URL when the push carried one. */
    thumbnailUrl?: string;
}
/** A poll-delivered semantic event — a cloud param that changed between polls. */
export interface PollSemanticEvent extends SemanticEventBase {
    /** The param id that changed. */
    paramType?: number;
    /** Previous raw value. */
    from?: string;
    /** New raw value. */
    to?: string;
}
/**
 * The typed **event** surface, keyed by semantic event name → payload type. THE projection point
 * for events (the sibling of {@link DeviceActionMap}): a capability that emits a new event name adds
 * one line here. `EufyMega`'s typed `on`/`once`/`off`/`emit` overloads are derived from this map, so
 * `eufy.on("motion", e => e.deviceSn)` autocompletes the name and types the payload. Names MUST
 * match the module `emit:` / `decodeEvent` `event:` strings.
 */
export interface DeviceEventMap {
    /** Motion detected (camera / PIR sensor). */
    motion: PushSemanticEvent;
    /** A recognized/known or stranger person detected. */
    personDetected: PushSemanticEvent;
    /** Doorbell button pressed. */
    doorbellPress: PushSemanticEvent;
    /** Pet detected. */
    petDetection: PushSemanticEvent;
    /** A package was delivered (drop/porch). */
    packageDelivered: PushSemanticEvent;
    /** A previously-delivered package was taken. */
    packageTaken: PushSemanticEvent;
    /** A delivered package has been left unattended too long. */
    packageStranded: PushSemanticEvent;
    /** A person the device does NOT recognise (distinct from {@link personDetected}). */
    strangerDetected: PushSemanticEvent;
    /** Sound above the configured threshold. */
    soundDetected: PushSemanticEvent;
    /** Crying detected (indoor/baby-monitor families). */
    cryingDetected: PushSemanticEvent;
    /** A vehicle was detected. */
    vehicleDetected: PushSemanticEvent;
    /** A dog was detected; `kind` distinguishes the licking/fouling sub-events when the device reports one. */
    dogDetected: PushSemanticEvent & {
        kind?: "lick" | "poop";
    };
    /** The guard mode changed. Carries no mode value — re-read the current mode. */
    armingModeChanged: PushSemanticEvent;
    /**
     * A camera's own enablement was confirmed changed, after a write this SDK issued was read back off the
     * device. Carries no value — re-read `enabled`, which has converged by the time this fires.
     *
     * Distinct from {@link propertyChanged}, which reports `enabled` moving for any reason on whichever
     * inbound path saw it. This one says a write LANDED, which is a different fact and the only thing that
     * can be known about a value nothing pushes.
     */
    cameraEnabledChanged: PushSemanticEvent;
    /**
     * Station alarm lifecycle; `phase` says whether it fired, is counting down, or was stopped. `type` is
     * the push's alarm source or stop reason, absent when the push carried none.
     */
    alarm: PushSemanticEvent & {
        phase?: "triggered" | "delayed" | "stopped";
        type?: CusPushAlarmType;
    };
    /** Lock (un)locked or a lock alarm fired. */
    lockState: PushSemanticEvent;
    /**
     * Entry sensor opened/closed. Arrives via push (seconds) or cloud poll (minutes), which carry the
     * state under different raw keys — read `open`, which both normalise to. Absent when the signal
     * carried no contact value, so `undefined` means "not reported here", not "closed".
     */
    contactState: PushSemanticEvent & PollSemanticEvent & {
        open?: boolean;
    };
    /**
     * A property this device reports changed value — the generic announcement, derived from the same
     * `members` table the getters are, for every readable property of every capability.
     *
     * `property` is the name `Device.getProperty` takes and the one a capability getter answers, so a
     * caller can re-read immediately; `Device.describe()` publishes the `{ accessor, property }` pair,
     * which maps the name back to the fluent accessor behind it. `value` is what `getProperty` now serves,
     * narrowed the way the capability getter narrows it and read from the same live state rather than
     * re-converted from the wire. It is absent where no scalar can honestly be given — a property whose
     * stored form is a payload, or one whose stored value does not match its declared type — which means
     * "this moved, re-read it". No wire id travels with it: several ids resolve to one property, which is
     * the point.
     *
     * Announced from the cloud poll, from a realtime report, and from the read-through cache's own
     * background re-read, for a change with any cause — the SDK cannot tell its own write's echo from a
     * change made in the vendor app, and suppressing on a guess would lose a real external change in
     * exchange for one redundant re-read. Not announced on first sight of a device (that is discovery, not
     * a transition), nor inside a write's own confirmation (already reported through that command's
     * outcome).
     *
     * Announced against a `Device` the caller is holding, since the value is read out of that device's own
     * live state and the SDK holds the devices it hands out weakly.
     *
     * Every readable property of every capability, with nothing filtered for being uninteresting. So a
     * sensor's own check-in timestamp is announced too, even though the `deviceState` event already
     * carries that fact.
     *
     * Latency is the inbound path's: seconds for a property a device reports over realtime. For one that
     * only ever arrives as a cloud param — which is most of them — it is whichever comes first of the poll
     * (`EufyMegaOptions.pollMs`, `EufyMega.setPollInterval`) and the cache's re-read
     * (`EufyMegaOptions.cacheTtlMs`), both the caller's to choose.
     */
    propertyChanged: SemanticEventBase & PropertyChange & {
        deviceSn: string;
    };
    /** Battery alert — `state` discriminates low / hot / full. */
    batteryAlert: PushSemanticEvent & {
        state?: "low" | "hot" | "full";
    };
    /** Pan/tilt status streamed while the camera moves. */
    ptzNotify: SemanticEventBase & {
        kind: "rotate" | "zoom" | "position";
        payload?: unknown;
        coords?: Array<[number, number]>;
    };
    /**
     * A eufy_life smart light reported its state (secure-MQTT DP status report). Every field is
     * optional: a report carries only the fields the device sent, and an absent one is silence about
     * that field rather than a change to it.
     */
    smartLightState: SemanticEventBase & {
        power?: boolean;
        brightness?: number;
        lightLength?: number;
        effectId?: number;
        colorGradient?: boolean;
        cloudEffectId?: number;
    };
}
/**
 * The typed action surface, keyed by the **camelCased capability id** (the fluent accessor name).
 *
 * THE projection point for actions: adding a capability with an `actions()` factory = add its
 * typed-actions import above + one line here. `device.ts` and the client stay capability-agnostic —
 * the fluent `dev.ptz()` accessors are derived from this map ({@link CapabilityAccessors}), so
 * nothing outside a capability file names a capability.
 *
 * A key here MUST match `camelCase(module.capability)` for the runtime accessor install to line up
 * with the type. (Only capabilities whose module defines `actions()` appear.)
 */
export interface DeviceActionMap {
    /** Pan/tilt/zoom control: `rotate(dir, step)` + `left`/`right`/`up`/`down`, `zoom`, preset() namespace (goto/preview/save/setDefault/delete/list/image). */
    ptz: PtzActions;
    /** Floodlight/spotlight: `on`/`off`/`set`, `setBrightness`/`setColorTemp`/`setEnabled`, `setAutoSpotlight`. */
    light: LightActions;
    /** eufy_life smart light (T8L0x): `on`/`off`, `setBrightness`, T8L02 `setColor`, `setEffect(lightId)`. */
    smartLight: SmartLightActions;
    /** Camera: `on`/`off`, privacy, status LED; `snapshot`/`live`/`record` when bound to a live client. */
    camera: CameraActions;
    /** Audio/volume (family-gated): mic, speaker + volume, in-video recording, doorbell ringtone, HomeBase alarm/prompt. */
    audio: AudioActions;
    /** Battery/power: power source, working mode, and the custom-mode clip/interval/auto-stop settings. */
    battery: BatteryActions;
    /** Smart lock: `lock()`/`unlock()` + verified `setRainMode`/`setAutoLock`. The 6 source-confirmed-but-uncaptured setting toggles are ABSENT until captured (present method ⇒ wire verified). */
    lock: LockActions;
    /** Siren: reads `active`, `volume`, `alarmDuration`, `doNotDisturb`; writes `setVolume`, `setAlarmDuration`, `test`, `stop` (config setters present when the param is reported). No direct "sound the alarm" wire — a real alarm is driven by the `arming` system; `test` is the on-demand trigger. */
    siren: SirenActions;
    /** Guard mode: `setMode(ArmingMode)` + `setAlarmDelayConfig(mode, config)`. Of the 9 modes a station reports, only `away`/`home`/`custom1`/`disarmed` are confirmed as writes (`ArmingMode`); the alarm-delay write takes the narrower byte-captured `AlarmDelayMode`. */
    arming: ArmingActions;
    /** Doorbell: `playQuickResponse(voiceId)` (the canned voice replies). */
    doorbell: DoorbellActions;
    /** Motion/PIR: `setDetection(on)` (sensitivity is read-only until its write wire is captured). */
    motion: MotionActions;
    /** Entry (door/window) sensor: reads `open`, `lastSeen`, `rssi`, `alarmSoundType`, `alarmVolume`; writes `setAlarmSoundType`, `setAlarmVolume` (present when the sensor reports the alarm params). */
    contact: ContactActions;
    /** Water-leak / freeze sensor reads (read-only): `leakDetected`, `lastSeen`. */
    leak: LeakActions;
    /** Smoke-detector reads (read-only): `smokeDetected`, `lastSeen`. */
    smoke: SmokeActions;
    /** CO-detector reads (read-only): `coDetected`, `lastSeen`. */
    co: CoActions;
    /** Security-keypad reads (read-only): `charging`, `rssi`. */
    keypad: KeypadActions;
    /** RTSP publish for a NAS/NVR: `publish`/`withdraw` + `published`, `requireAuth`/`allowAnonymous`, `recordingMode`/`setRecordingMode`. One camera at a time per station. */
    rtsp: RtspActions;
    /** RoboVac core state and controls: `power`, `activity` (WorkStatus), `volume`, `battery`, `cleanType`; `setPower`, `startCleaning`, `returnToDock`, `pauseCleaning`. */
    vacuumClean: VacuumCleanActions;
    /** RoboVac Omni dock controls: `emptyDust`, `washMops`, `dryMops`; raw `dockState` unexposed until wire confirmed. */
    vacuumDock: VacuumDockActions;
    /** RoboVac suction: `level`, `boostIq`, `supportedLevels`; `setSuctionLevel`, `setBoostIq`. */
    suction: SuctionActions;
    /** Robot mower (read-only): `battery`, `cutHeight`, `network`, `wifiSignal`, wear timers and settings. No write is captured. */
    mower: MowerActions;
    /** RoboVac locate (find-robot beep): `locating`; `locate(on?)`. */
    locate: LocateActions;
    /** SmartDrop parcel box: `openLid()`. */
    smartDrop: SmartDropActions;
    /** Smart Display (read-only): `battery`. No display write is captured. */
    display: DisplayActions;
    /** Identity metadata (read-only): `{ manufacturer, model, serialNumber, name, deviceType?, firmwareVersion?, hardwareVersion? }`. */
    info: DeviceInfo;
}
/**
 * The fluent capability accessors merged onto `Device`: `dev.ptz?.()?.rotate(PtzDirection.left)`.
 *
 * **Each accessor is optional**, because a device carries only the accessors for capabilities it
 * actually has — a smart light has no `camera` at all. Calling one that exists still yields `undefined`
 * until the device is bound to a live transport, so a call site needs `?.` twice: `dev.ptz?.()?.…`,
 * the first for "does this device have it", the second for "is it bound yet".
 */
export type CapabilityAccessors = {
    [K in keyof DeviceActionMap]?: () => DeviceActionMap[K] | undefined;
};
/**
 * Every fluent-accessor name the SDK knows — the camelCased id of every module with a `members` table
 * or an `actions()` factory. A module needs only ONE of the two: `battery` is all members and `ptz` all
 * hand-written actions. The runtime twin of {@link DeviceActionMap}'s keys (types erase at
 * build). A projection of `MODULES`, so `device.ts` stays capability-agnostic. A device installs the
 * subset it has: see {@link accessorNamesFor}.
 * @internal
 */
export declare const ACTION_ACCESSOR_NAMES: readonly (keyof DeviceActionMap)[];
/**
 * The fluent-accessor names a device with THESE capabilities should carry — the subset of
 * {@link ACTION_ACCESSOR_NAMES} it can actually answer for.
 *
 * A device only advertises what it can do: a smart light has no `camera` accessor at all, rather than
 * one that answers `undefined` forever. That makes the object's own shape a truthful description of the
 * device, and it makes `"camera" in dev` mean what a reader expects it to.
 * @internal
 */
export declare function accessorNamesFor(capabilities: ReadonlySet<Capability>): (keyof DeviceActionMap)[];
/** Whether this resolved set owns a provider-backed member with the given action name. */
export declare function hasProvidedAction(capabilities: ReadonlySet<Capability>, action: string): boolean;
/**
 * Build the map of action-objects for the capabilities a device HAS, e.g.
 * `{ light: {on, off, ...}, ptz: {rotate, ...}, camera: {on, snapshot, ...} }`. Keys are
 * camelCased {@link Capability} ids. Only capabilities in `caps` with an `actions` factory appear.
 * Consumed by `Device` to install the fluent `dev.<cap>()` accessors. `media`/`ff09Settings`/`rawDp`
 * are the optional transport-supplied providers — media actions (snapshot/live/record) only appear when
 * a provider is supplied, likewise `dev.lock()?.getAutoLockState()`, and a member declaring a
 * `decode` returns `undefined` without a codec. Each names a technical job — a media session,
 * an `ff09` settings query, a payload shape — never the capability that calls it first; see
 * {@link CapabilityModule.actions}'s doc before adding another.
 * @internal
 */
export declare function buildActions(caps: readonly Capability[], deps: MemberDeps): Partial<DeviceActionMap>;
/**
 * Describe the capability objects a device has bound — the capability half of `Device.describe()`.
 *
 * The projection point for discovery, the way {@link buildActions} is for control: `device.ts` hands
 * over the bound objects it holds and gets back what each exposes, without naming a capability.
 * @internal
 */
export declare function describeCapabilities(bound: Partial<DeviceActionMap>, ctx?: AvailabilityContext): CapabilityDescriptor[];
export type { CommandContext, CapabilityActions, CapabilityStateReader, CapabilityModule, DetectionSpec, CapabilityFrame, CapabilityEvent, InboundSignal, EventClaim, EventMapping, ProductLine, ActionArgSpec, DecodedState, } from "./types.js";
/**
 * The value-kind vocabulary a read is annotated with, re-exported from the barrel that publishes the
 * read itself, so the union a member's `kind` is drawn from is reachable from the same import.
 */
export type { ValueKind, KnownValueKind } from "../types.js";
export { KNOWN_VALUE_KINDS, isKnownValueKind } from "../types.js";
/**
 * The member-table vocabulary a capability's surface is declared in — published because
 * `CapabilityModule.members` is.
 */
export type { Members, Member, ValueMember, ActionMember, MethodMember, ProvidedMember, AnyProvidedMember, MemberDeps, Providers, Surface, } from "./members.js";
/**
 * The type-level parts `Surface` is assembled from — published because `Surface` NAMES them.
 * `ValueKeys` and its
 * siblings select which members each branch of the projection covers; `ReadValue`/`WriteValue` say what
 * a getter answers and a setter takes; `SetterName` gives the setter its name.
 */
export type { ValueKeys, WritableKeys, ActionKeys, MethodKeys, ProvidedKeys, UnverifiedKeys, ConditionalKeys, ValueOf, ReadValue, WriteValue, SetterName, } from "./members.js";
export { CapabilityNotSupportedError } from "./types.js";
/**
 * The shape `Device.describe()` answers with — published from the barrel that publishes the surface it
 * describes.
 */
export type { DeviceManifest, CapabilityDescriptor, ReadDescriptor, ActionDescriptor } from "./manifest.js";
export type { ActionSpec } from "./types.js";
/**
 * Ask ONE method what it accepts, without walking a whole manifest.
 *
 * `Device.describe()` is the discovery entry point; this is the same answer for a method already in
 * hand, read off the function itself rather than carried beside it. Every member
 * kind is wrapped, so it answers for a derived setter, a momentary action and a method alike, and
 * `undefined` for an action nothing describes.
 */
export { actionSpecOf } from "./access.js";
export type { PtzActions, LightActions, SmartLightActions, RgbColor, CameraActions, LockActions, SirenActions, ArmingActions, BatteryActions, MotionActions, ContactActions, LeakActions, SmokeActions, CoActions, KeypadActions, RtspActions, VacuumCleanActions, SuctionActions, MowerActions, LocateActions, SmartDropActions, };
/**
 * The member table each `*Actions` type is DERIVED from (`LockActions = Surface<typeof LOCK_MEMBERS>`),
 * so the type names the table and the table is part of the published surface.
 *
 * It is also the one declaration of what a capability exposes: per feature its wire id, value type,
 * `kind`, domain (`min`/`max`/`enumValues`), presence gate and the description published for it.
 * `Surface` and the runtime install from the same entry, so there is no second table to disagree with it.
 */
export { ARMING_MEMBERS } from "./arming.js";
export { AUDIO_MEMBERS } from "./audio.js";
export { BATTERY_MEMBERS } from "./battery.js";
export { CAMERA_MEMBERS } from "./camera.js";
export { CO_MEMBERS } from "./co.js";
export { CONTACT_MEMBERS } from "./contact.js";
export { DOORBELL_MEMBERS } from "./doorbell.js";
export { KEYPAD_MEMBERS } from "./keypad.js";
export { LEAK_MEMBERS } from "./leak.js";
export { LIGHT_MEMBERS } from "./light.js";
export { LOCATE_MEMBERS } from "./locate.js";
export { LOCK_MEMBERS } from "./lock.js";
export { MOTION_MEMBERS } from "./motion.js";
export { PTZ_MEMBERS } from "./ptz.js";
export { RTSP_MEMBERS } from "./rtsp.js";
export { SIREN_MEMBERS } from "./siren.js";
export { SMART_DROP_MEMBERS } from "./smart-drop.js";
export { SMART_LIGHT_MEMBERS } from "./smart-light.js";
export { SMOKE_MEMBERS } from "./smoke.js";
export { DISPLAY_MEMBERS, type DisplayActions } from "./display.js";
export { SUCTION_MEMBERS } from "./suction.js";
export { MOWER_MEMBERS } from "./mower.js";
export { VACUUM_CLEAN_MEMBERS } from "./vacuum-clean.js";
export type { DeviceInfo } from "./info.js";
export type { AutoSpotlightOptions } from "./light.js";
export type { DoorbellActions, QuickResponse } from "./doorbell.js";
export { parseQuickResponses } from "./doorbell.js";
export { DoorbellRingtone, type DoorbellRingtoneValue } from "./doorbell.js";
export type { AudioActions } from "./audio.js";
export { VACUUM_DOCK_MEMBERS } from "./vacuum-dock.js";
export type { VacuumDockActions } from "./vacuum-dock.js";
/**
 * The dock's activity is the declared return of the public `dev.vacuumDock()?.dockState` getter, so the
 * union is published — and the list it is taken from, since it names its own.
 */
export type { DockActivity } from "./vacuum-dock.js";
export { DOCK_ACTIVITIES } from "./vacuum-dock.js";
export { HubAlarmTone, type HubAlarmToneValue } from "./siren.js";
/**
 * RoboVac activity and clean type are the declared returns of the public `dev.vacuumClean()` getters,
 * so both unions are published.
 */
export type { VacuumActivity, VacuumCleanType, CarpetStrategy, CleanExtent, VacuumRoomTarget, VacuumZoneTarget, } from "./vacuum-clean.js";
/** The lists those unions are taken from — published because each union names its own. */
export { VACUUM_ACTIVITIES, VACUUM_CLEAN_TYPES, CARPET_STRATEGIES, CLEAN_EXTENTS, MOP_LEVELS } from "./vacuum-clean.js";
export { SuctionLevel, suctionLevelName, type SuctionLevelValue } from "./suction.js";
export type { PtzPresetActions, ZoomRegion, PtzPreset, PtzPresetImage } from "./ptz.js";
export { AlarmDelayMode, ArmingMode } from "./arming.js";
export type { AlarmDelayConfig, AlarmDelayCountdown, AlarmDelayDeviceAction, AlarmDelaySeconds } from "./arming.js";
export { PtzDirection } from "./ptz.js";
export { AiDetectType, encodeAiDetectType, decodeAiDetectType, type AiDetectFlags } from "./motion.js";
