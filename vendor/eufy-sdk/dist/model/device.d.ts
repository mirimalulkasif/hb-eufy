/**
 * The single, concrete {@link Device} class.
 *
 * There are **no subclasses**. A device's behaviour is entirely determined by its resolved
 * `{ codec, capabilities, properties }` (see `resolveDevice`). Code asks
 * `device.has("light")` / `device.getProperty("battery")` — never `instanceof FloodlightCamera`.
 *
 * Live state is held as a flat map of `PropertyValue`, updated by feeding raw param maps
 * (from the cloud record or P2P notifications) into {@link Device.applyParams}. Params the model
 * doesn't recognise are **not dropped** — they are kept as `unknown_<paramType>` passthrough, so
 * coverage can grow later without losing data today (the graceful-unknown rule, applied to params).
 *
 * @module model/device
 */
import type { Capability, CloudRecord, CommandContext, PropertyChange, PropertySpec, PropertyValue, ResolvedDevice } from "./types.js";
import type { CommandSink, MediaProvider, Ff09SettingsReader, RawDpCodec } from "../core/contracts.js";
import { type Logger } from "../core/logger.js";
import { type CapabilityAccessors, type DeviceManifest } from "./capabilities/index.js";
/** Prefix used for params that have no `PropertySpec` mapping yet. */
export declare const UNKNOWN_PARAM_PREFIX = "unknown_";
/** A raw param map as delivered by the cloud / P2P: param_type → raw value. */
export type RawParams = Record<number | string, string | number | boolean>;
/**
 * A eufy device: one class, capability-driven. Construct from a resolved record (or a raw
 * `CloudRecord` via {@link Device.fromRecord}), then feed it param updates.
 */
export declare class Device {
    /** Serial number (station/device SN). */
    readonly sn: string;
    /**
     * The station this device's traffic belongs to: its parent HomeBase, or its own {@link sn} when it has none.
     *
     * Set from the record's `parentSn`, which is present only for a device that hangs off a base. A record that
     * states none leaves the last known value, as every other identity field here does, so it starts at this
     * device's own serial and every device therefore has a station.
     */
    stationSn: string;
    /** Resolved command-codec family. */
    codec: ResolvedDevice["codec"];
    /** Resolved capability set. Widens if the device later reports evidence for more. */
    capabilities: readonly Capability[];
    /** Merged property schema (one entry per known property this device exposes). */
    properties: readonly PropertySpec[];
    /**
     * What the user named this device in the app (`device_name`), falling back to {@link modelName} when
     * the record carries none.
     */
    name: string;
    /** Model / T-code from the record ("T8410"), when known. */
    model?: string;
    /** The model's display name ("Indoor Cam Pan & Tilt") — the product this unit is one of. */
    modelName: string;
    /** Which resolver tier produced the codec/caps. */
    source: ResolvedDevice["source"];
    /** Fast capability lookup. */
    private capSet;
    /** propertyName → spec, for applyParams. */
    private specByName;
    /**
     * paramType → { spec, invert } for applyParams. Includes each spec's own `paramType` (invert
     * from the spec) plus any `readAliases` (invert from the alias) so a property that rides
     * different wire ids across device families still resolves to one named value.
     */
    private specByParam;
    /**
     * Params a resolved capability declares that this device's schema does not carry — withheld by a
     * member's gate, so not named from the param dictionary either. See {@link Device.applyParams}.
     */
    private withheld;
    /** Which param namespace this device's ids live in (clean DPs vs security P2P). */
    private namespace;
    /** The record's `device_name` as stated, before the {@link modelName} fallback is applied. */
    private deviceName?;
    /** Live property values, keyed by property name (or `unknown_<pt>`). */
    private readonly state;
    /**
     * Bound action objects per capability the device HAS, keyed by camelCased capability id
     * (`light`, `ptz`, `camera`). Empty until {@link bindActions} runs — a bare model object
     * (no network) has no actions. Populated by `EufyMega.getDevice`; surfaced through the fluent
     * `dev.<cap>()` accessors ({@link CapabilityAccessors}).
     */
    private actionMap;
    /**
     * Whether {@link bindActions} has run — published through {@link describe} because an unbound device
     * has no bound objects to enumerate, and "exposes nothing" and "not wired up yet" are different
     * answers a caller has to be able to tell apart.
     */
    private bound;
    /**
     * Read-through freshness policy (injected by the facade via {@link setFreshnessPolicy}; the model
     * stays transport-free — it only calls the supplied `refresh`). Default: caching OFF
     * (`staleAfterMs = Infinity`), so a bare model object never triggers a fetch and existing behaviour
     * is unchanged until the client wires a policy.
     */
    private staleAfterMs;
    private refresher?;
    /** Guards against firing more than one background refresh at a time (coalesces rapid stale reads). */
    private refreshInFlight;
    /**
     * Host-supplied diagnostics sink. Defaults to {@link noopLogger} (silent) so a bare model object
     * stays quiet; the facade passes its own `logger` through {@link fromRecord}. Used to WARN when a
     * wire value doesn't match its declared `PropertySpec.type` (see {@link coerceByType}).
     */
    private readonly logger;
    constructor(sn: string, resolved: ResolvedDevice, logger?: Logger);
    /**
     * Adopt a resolution: the capability set, the property schema, and everything derived from them.
     *
     * Shared by the constructor and {@link reresolve} so a widened device is indistinguishable from one
     * that resolved that way to begin with — a second derivation path here would be a slow-drifting bug,
     * since only the re-resolve case would exercise it.
     */
    private resolveInto;
    /**
     * Re-resolve against a fresher record and adopt the result if the capability set grew.
     *
     * A capability is granted on evidence the device reports, so a device that hadn't reported a param
     * when it was first resolved lacks the capability that param proves — and would keep lacking it for
     * the object's whole lifetime, even as the value itself started arriving. Re-resolving on fresh
     * evidence closes that: the accessor appears, already bound if the device is bound.
     *
     * Only ever widens. A param the device stops reporting does not retract a capability, because the
     * cloud record is a snapshot that can lose a field for reasons that have nothing to do with the
     * hardware, and revoking an accessor a caller already holds is worse than keeping a quiet one.
     *
     * Returns the capabilities gained, empty when nothing changed — so a caller can skip re-binding.
     */
    reresolve(rec: CloudRecord): Capability[];
    /**
     * Wire this device to a {@link CommandSink} so its semantic action objects become live
     * (`device.light?.on()`). `ctx` carries the evidence a capability uses to resolve the right
     * command variant. Called by `EufyMega.getDevice`; a raw model object left unbound simply has
     * no action objects (all accessors return `undefined`). `ff09Settings` reads that frame family's
     * settings over whichever transport the device has; `rawDp` reads the structured payloads a few params
     * carry in place of a scalar. Both are optional and both are named for the job, not the caller — a
     * read needing one returns `undefined` without it. See `CapabilityModule.actions`'s doc before
     * threading a third. The final `buildActions` arg is the live-state reader backing the capabilities' typed
     * read getters (`dev.battery()?.level`): it closes over `this.getProperty`, so a getter built once
     * here stays current as realtime/poll updates land in `this.state`.
     */
    bindActions(ctx: CommandContext, sink: CommandSink, media?: MediaProvider, ff09Settings?: Ff09SettingsReader, rawDp?: RawDpCodec): void;
    /**
     * Install the fluent capability accessors (`dev.ptz()`, `dev.light()`, …) once, for EVERY
     * known accessor name — each reads `this.actionMap` live, so an accessor returns `undefined`
     * (never "not a function") on an unbound device or one lacking the capability, and starts
     * returning the action object after {@link bindActions}. Capability-agnostic: the names come
     * from the barrel projection {@link accessorNamesFor}, so `device.ts` never names a
     * capability. The single cast here is the only place the {@link CapabilityAccessors} types erase.
     */
    private installAccessors;
    /** Build a Device from a raw cloud record (runs the 3-tier resolver). */
    static fromRecord(sn: string, rec: CloudRecord, logger?: Logger): Device;
    /**
     * Take the unit's own identity — its name and model code — from the record.
     *
     * Separate from {@link resolveInto} because the resolver answers about the PRODUCT: it has no
     * `device_name` to give, and re-running it must not replace "Dining room" with "Indoor Cam Pan &
     * Tilt". Re-applied on every {@link reresolve} so a rename in the app lands on the next refresh.
     *
     * A record that omits a field is silent about it rather than asserting it went away — the same
     * reasoning that keeps {@link reresolve} from retracting a capability — so an omission keeps the last
     * known value and only a stated one replaces it.
     */
    private adoptIdentity;
    /** Does this device have the given capability? */
    has(cap: Capability): boolean;
    /** Is the given property name part of this device's schema? */
    hasProperty(name: string): boolean;
    /**
     * Wire a read-through freshness policy. When a cached property is older than `staleAfterMs`, a
     * `getProperty`/`getProperties` read schedules ONE coalesced background `refresh()` (the facade
     * supplies it, choosing the cheapest live transport) and returns the last-known value immediately —
     * reads never block. Push / P2P realtime updates refresh `ts` themselves via {@link applyParams}, so
     * a device kept fresh by realtime never re-fetches (a fresh entry is never stale). Keeps `model/`
     * transport-free: the device only calls the injected callback.
     */
    setFreshnessPolicy(policy: {
        staleAfterMs: number;
        refresh: () => Promise<void>;
    }): void;
    /**
     * Low-level property read by name — the untyped escape hatch. The typed fluent capability getters
     * (`dev.battery()?.level`, `dev.contact()?.open`) answer the value already narrowed to its declared
     * type where the property is exposed by a capability; this answers the loose `PropertyValue.value`
     * (`boolean|number|string|object`). It is the only read for an unbound model object (no live client →
     * no `dev.<cap>()`) and for a param not yet surfaced on a capability. Returns `undefined` if never
     * observed.
     */
    getProperty(name: string): PropertyValue | undefined;
    /**
     * Snapshot of all current property values (named + unknown passthrough) — the untyped bulk read, for
     * diagnostics / discovery. The typed fluent capability getters (`dev.battery()?.level`, …) answer one
     * specific known property; this loose map answers every observed value at once. Under a freshness
     * policy, schedules a background refresh when the OLDEST observed value is stale (one fetch covers
     * every param) and returns the current snapshot immediately.
     */
    getProperties(): Record<string, PropertyValue>;
    /**
     * Fire the injected background refresh at most once at a time (coalescing rapid stale reads). The
     * refresh calls {@link applyParams}, which updates each value's `ts` — so subsequent reads see fresh
     * entries and stop re-triggering until the next staleness window. Fire-and-forget; never throws to
     * the reader (a failed refresh just leaves the last-known value in place).
     */
    private scheduleRefresh;
    /**
     * Apply a raw param map (cloud record or P2P notification). Known params update their named
     * property; unrecognised params are retained as `unknown_<paramType>` so nothing is lost.
     *
     * Naming precedence: this device's own `PropertySpec` (curated), then the param dictionary for its
     * namespace, then the `unknown_<paramType>` passthrough. The dictionary def is consulted even where a
     * spec exists, because `encoding` lives there.
     *
     * A param a resolved capability's gate WITHHELD takes the passthrough instead of its dictionary name.
     * The gate decided the read does not describe this device, the dictionary names it what the member
     * would have, and republishing it there hands a caller a reading indistinguishable from one the device
     * really answered. A capability that never resolved withholds nothing: a param arriving before its
     * capability is still the device's own, and keeps its dictionary name.
     *
     * @param params param_type → raw value.
     * @param ts observation time (epoch ms); defaults to `Date.now()`.
     * @returns the list of property names whose value changed.
     */
    applyParams(params: RawParams, ts?: number): string[];
    /**
     * Which of these changed property names are worth ANNOUNCING, each with the value
     * {@link getProperty} now serves for it — the second half of an {@link applyParams} call, and the input
     * a facade turns into a property-change event.
     *
     * Only a name in this device's own schema survives, and EVERY name in it does. The schema is what the
     * SDK published and {@link getProperty} serves every entry of, so announcing one is honest; a
     * dictionary-named param and an `unknown_<paramType>` passthrough are things the SDK makes no claim
     * about, and announcing either would promise a value it never agreed to serve. Diagnostics reach those
     * through `inspectParams`.
     *
     * Nothing is withheld for being uninteresting, here or in a capability's own table. Which of a device's
     * truths a host acts on is the host's call: a withheld value cannot be recovered, where an unwanted one
     * costs a caller one comparison on the name.
     *
     * The value comes out of live state — written microseconds earlier by the same call that produced
     * `changed` — through the same `narrow` the capability getters use, which is what makes an announcement
     * and the getter beside it one answer rather than two. Not from the raw wire value: that is a second
     * conversion and a second answer, which is exactly how a payload comes to disagree with its getter. And
     * not by invoking the installed getter, which has read side effects (a scheduled background refresh, a
     * codec call) an announcement must not trigger — and which an `unexposed` schema property does not have
     * at all.
     *
     * Kept beside the state and the schema rather than in a caller, because both are here; a caller doing
     * the join would be re-deriving what this object already holds. Says nothing about the previous value:
     * a caller that needs the delta already holds it, because it was told last time.
     */
    announcements(changed: readonly string[]): PropertyChange[];
    /**
     * What this device exposes, as data — every installed read with what its value MEANS, every offerable
     * action with what it accepts, and every event each capability emits.
     *
     * Beside {@link toJSON} rather than folded into it, because the two answer different questions and
     * `toJSON` fires on every implicit `JSON.stringify` (an event payload, a log line) where the shape is
     * not wanted. This one carries **shape only** — no values; read those through the capability getters
     * it names.
     *
     * The reads and actions are the ones this device actually installed, so a caller can offer everything
     * listed: a write the device gave no evidence for, or one whose wire is not confirmed, is absent
     * rather than described. An unbound device (no live client) has nothing bound to enumerate and answers
     * `bound: false` with empty `details`. `details` is resolved against this device's own facts (codec,
     * model, capabilities), so a per-device enum domain (e.g. `workingMode`) carries the same options the
     * property schema does.
     */
    describe(): DeviceManifest;
    /** Plain-object view: serial, name, resolved codec/source, capabilities, and every current property value. */
    toJSON(): Record<string, unknown>;
}
/**
 * Declaration merge: give {@link Device} the fluent capability accessors (`dev.ptz()`,
 * `dev.light()`, `dev.camera()`, …) with full IDE typing, WITHOUT `device.ts` naming a single
 * capability. The accessor names + return types come from {@link CapabilityAccessors} (a projection
 * of the capability modules in the barrel); `bindActions` installs the matching closures at runtime.
 * Adding a capability adds an accessor here automatically — no edit to this file.
 */
export interface Device extends CapabilityAccessors {
}
