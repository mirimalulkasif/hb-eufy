/**
 * What a device exposes, as data — one JSON-safe shape per device, with no branch per capability.
 *
 * A bound device is fully callable but states nothing about ITSELF from outside the package: neither
 * what is installed nor what a value means is readable off it. The member table states both, and this
 * turns that statement into a public, JSON-safe shape: which reads a device actually installed, which
 * of its actions are offerable, and which events it emits.
 *
 * **Derived from the LIVE bound objects, not recomputed from the tables.** The descriptors of the bound
 * object are the only source that cannot disagree with what `bindMembers` installed — evidence
 * gates, provider gates and unverified writes are all already applied there. Recomputing the same answer
 * from the module tables would be a second implementation of the gate, and it would be wrong in exactly
 * the cases that matter: a media method on a device bound without that provider, a read for a param
 * the device never reported. The table is joined in only for SEMANTICS (what the value means), which the
 * bound object does not carry.
 *
 * **Never spread, `Object.entries` or `JSON.stringify` a bound object here.** All three invoke its
 * getters, and a getter with a `decode` calls into the injected codec. Property descriptors only.
 *
 * @module model/capabilities/manifest
 */
import type { Capability, Codec, PropertyValueType, ResolvedDevice, ValueKind } from "../types.js";
import type { ActionSpec, AvailabilityContext, CapabilityModule } from "./types.js";
/** One read installed on a bound capability object — a value the device reports, and what it means. */
export interface ReadDescriptor {
    /** The getter's name on the capability object (`dev.battery()?.level` → `level`). */
    accessor: string;
    /** The name the same value carries in the device's flat property namespace (`getProperty`). */
    property: string;
    /** How the value is stored. */
    type: PropertyValueType;
    /** What the value MEANS, as opposed to how it is stored. See {@link ValueKind}. */
    kind?: ValueKind;
    /** The unit the device reports the value in, when it has one (`"%"`, `"°C"`, `"dBm"`). */
    unit?: string;
    /** The option set, for a value out of a fixed domain. */
    values?: readonly (string | number)[];
    /** Labels for {@link values}, keyed by the raw value as a string. */
    labels?: Readonly<Record<string, string>>;
    /**
     * Whether a setter for this value is installed BESIDE the getter on the same object.
     *
     * Read off the bound object rather than the schema, so it means "a caller can write this on THIS
     * device" — a write the device gave no evidence for, or one whose wire is not confirmed, is not
     * installed and reads `false` here. A value driven by a differently-named method (a pair of frames,
     * a validating setter) is `false` too and appears under the capability's {@link
     * CapabilityDescriptor.actions} instead, which is where its signature is described.
     */
    writable: boolean;
    description?: string;
}
/**
 * One offerable action: an {@link ActionSpec} plus the name it is installed under.
 *
 * The name is taken from the enumeration rather than carried in the spec, so a renamed method takes its
 * description with it and cannot leave one behind pointing at nothing.
 */
export interface ActionDescriptor extends ActionSpec {
    name: string;
}
/** What one capability exposes on a device — the join of its bound object and its own declaration. */
export interface CapabilityDescriptor {
    capability: Capability;
    /**
     * The fluent accessor this capability is reached under: `dev[accessor]()`.
     *
     * Absent for a capability with nothing to bind — one whose whole surface is inbound events, so it
     * declares no members and no `actions()` and therefore has no object to reach. Such a capability is
     * described for its {@link events} alone; every other field is empty.
     */
    accessor?: string;
    /** The reads INSTALLED on this device, never the theoretical set. */
    reads: readonly ReadDescriptor[];
    /** The installed actions that carry a description. */
    actions: readonly ActionDescriptor[];
    /**
     * Installed, callable actions with no description — usable, but not auto-offerable. Published rather
     * than hidden so the gap is visible instead of looking like the action doesn't exist.
     */
    undescribedActions: readonly string[];
    /** The semantic event names this capability emits. */
    events: readonly string[];
}
/**
 * A device's public shape: its identity, its capabilities, and what each of those exposes.
 *
 * `bound` is explicit because an unbound model object (no live client) has no bound objects to
 * enumerate, so its `details` are empty — a caller has to be able to tell "this device exposes nothing"
 * from "ask again once it is bound".
 */
export interface DeviceManifest {
    sn: string;
    /** What the user named the device in the app; falls back to {@link modelName} when unnamed. */
    name: string;
    /** Model / T-code ("T8410"), when the record states one. */
    model?: string;
    /** The model's own display name ("Indoor Cam Pan & Tilt") — the product, not this unit. */
    modelName: string;
    codec: Codec;
    source: ResolvedDevice["source"];
    bound: boolean;
    capabilities: readonly Capability[];
    details: readonly CapabilityDescriptor[];
}
/**
 * Describe the capability objects a device has bound, one descriptor each.
 *
 * Parameterised over the module list; the barrel binds it to the real one. A capability the device did
 * not bind — because it does not have it, or because nothing is bound yet — contributes no descriptor
 * at all.
 *
 * With ONE exception, and it is not a bound object: a capability whose whole surface is inbound events
 * declares no members and no `actions()`, so `buildActions` builds nothing for it and there is no
 * object here to walk. Its events are still device truth, and the resolved set in {@link
 * AvailabilityContext.capabilities} is what says this device has it — so it is described from its own
 * declaration, with no {@link CapabilityDescriptor.accessor} and every other field empty, and only on
 * a device with at least one bound object.
 *
 * Claims resolve against an empty read set there, which is the truthful evidence — a module that binds
 * nothing installs no getter, so a `reads` claim cannot hold. A topology claim still applies.
 * @internal
 */
export declare function describeBound(modules: readonly CapabilityModule[], bound: Readonly<Record<string, unknown>>, ctx?: AvailabilityContext): CapabilityDescriptor[];
