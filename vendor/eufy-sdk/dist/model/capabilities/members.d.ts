/**
 * A capability's surface, declared once per feature.
 *
 * Each entry in a module's `members` table is one thing a device exposes, and everything else is
 * DERIVED from it: the property schema the model consumes, the TYPE of the bound `dev.<cap>()` object,
 * the evidence-gated getter, the setter beside it, the intent name `setProperty` resolves through, and
 * the description published for it.
 *
 * The alternative — a table per concern, joined by name — is how one feature ends up spelled in six
 * places and disagreeing with itself. Here a rename moves everything at once, because there is only one
 * declaration to rename.
 *
 * The surface TYPE is derived from the same table the runtime installs from: `dev.motion()`
 * autocompletes with no hand-written `*Actions`.
 *
 * @module model/capabilities/members
 */
import { type Command, type CommandSink, type Ff09SettingsReader, type MediaProvider, type RawDpCodec } from "../../core/contracts.js";
import type { ActionArgSpec, AvailabilityContext, CapabilityStateReader, CommandContext } from "./types.js";
import type { Capability } from "../types.js";
import type { PropertySpec, PropertyValueType, ValueKind } from "../types.js";
/** A member backed by a device property: a getter, plus a setter when `write` is declared. */
export interface ValueMember {
    /**
     * The wire id carrying this value. Optional only for a {@link writeOnly} member whose write is not a
     * param at all — camera privacy is a frame BURST, and the id that burst is built from belongs to the
     * transport that plays it, not to a capability that would be naming another layer's vocabulary.
     */
    param?: number;
    /**
     * The name this value takes in the device's FLAT property namespace, when the member key would
     * collide there. The key is the accessor and is scoped by its capability (`dev.battery().level`);
     * a property is not — `level` alone is claimed by both `battery` and `suction`, `volume` by three
     * capabilities. Defaults to the key, which is right for the ~70% that do not collide.
     */
    property?: string;
    type: PropertyValueType;
    kind?: ValueKind;
    unit?: string;
    enumValues?: Record<number, string>;
    /**
     * A per-device enum resolved at manifest time from the device context — for a value whose options
     * are real but vary by model, so a single static {@link enumValues} cannot state them (e.g.
     * `workingMode`, whose indices number differently per camera). `mergeProperties` calls this with the
     * device context and stamps the result onto that device's spec. Returning `undefined` leaves the
     * static `enumValues` (or none) in place.
     */
    enumValuesFor?: (ctx: AvailabilityContext) => Record<number, string> | undefined;
    provenance?: PropertySpec["provenance"];
    invert?: boolean;
    /** Per-device read polarity; undefined retains the static default. */
    invertFor?: (ctx: AvailabilityContext) => boolean | undefined;
    description: string;
    /** The wire, or absent for read-only. `undefined` from it = this value is not one we accept. */
    write?: (value: boolean | number | string, ctx: CommandContext) => Command | undefined;
    /** @internal Policy for confirming this write through bounded readback before emitting its transition event. */
    observation?: {
        event: string;
        /**
         * The param this write will be reflected under and the raw value to expect there, resolved together for
         * THIS device — because on some members the family decides both at once.
         *
         * Both, not just the value, because the wire written and the wire reported are not always the same one:
         * camera enablement is written on the enablement param on every family, while the standalone
         * indoor/outdoor cameras report their state under a read alias and never the param that was written.
         * Polling the written param there would never converge, so the readback has to name the param the device
         * actually reports.
         *
         * `undefined` means this device offers no readback to confirm against — it reported no such param, or its
         * write lands on a wire its read does not observe. The command is then dispatched unobserved rather than
         * waiting out a timeout that could never be satisfied.
         */
        reflects(value: boolean | number | string, ctx: CommandContext): {
            param: number;
            expected: boolean | number | string;
            observed?: boolean | number | string;
        } | undefined;
        resetStandaloneSession?: boolean;
        timeoutMs: number;
    };
    /** Setter name when `set` + the key reads wrong (`isOn` → `set`, not `setIsOn`). */
    writeAs?: string;
    /**
     * A setter for this value EXISTS, but is not this member's own {@link write} — so the published
     * schema's `writable` cannot be derived from `write` alone.
     *
     * `writable` means "a setter exists", and one legitimately lives elsewhere when a `method` member
     * drives the value because a single `write` cannot (rtsp's recording mode sends a two-frame pair), or
     * the setter needs per-bind state the table cannot hold (a vacuum's suction level validates against
     * the model's own range). Guarded by `action-specs.spec.ts`,
     * which asserts every `writable` property has a reachable setter — so this cannot drift into a lie.
     */
    writtenElsewhere?: true;
    /** Extra intent verbs routed to `write`, each carrying the value it stands for. */
    aliases?: Record<string, boolean | number | string>;
    /**
     * Install the WRITE only on a device that reported one of these params.
     *
     * Distinct from the getter's own evidence gate: a siren's volume write was captured on a real siren,
     * and the evidence that a device IS one is that it reports a siren param — so handing the write to a
     * camera the name hint gave this capability to would send a frame that family never accepts. A member
     * that declares this lands OPTIONAL on the surface, since whether it exists is a runtime fact.
     *
     * Absent = install on any device with the capability, which is right for a wire the whole family
     * speaks.
     */
    requires?: readonly number[];
    /** Install the write only when this member's family-valid primary param or read alias was reported. */
    requiresRead?: true;
    /** Whether the primary read parameter carries this member on the current device family. */
    readAvailable?: (ctx: AvailabilityContext) => boolean;
    /**
     * Install the write only where this predicate holds — the general form of {@link requires}, for a gate
     * no list of params can express.
     *
     * A lock's rain mode exists on the P2P video lock and not on the MQTT garage door: a TOPOLOGY fact, not
     * a reported param. Audio's controls split the same way on device FAMILY — a HomeBase has an alarm
     * volume, a camera has a microphone, and neither reports the other's params. Like `requires`, a member
     * that declares this lands OPTIONAL on the surface, because whether it exists is a runtime fact.
     *
     * Takes an {@link AvailabilityContext} (not a full CommandContext): the manifest applies the same
     * gate at resolve time, before a live session exists. May read any field the {@link CloudRecord}
     * can supply — `codec`, `model`, `category`, `deviceType`, `capabilities`, `paramIds` — but never
     * transport-only fields (`channel`).
     */
    available?: (ctx: AvailabilityContext) => boolean;
    /**
     * The write wire is NOT confirmed on a real device.
     *
     * A fire-and-forget write that is wrong looks exactly like success, so it must not ship as a callable
     * method: any {@link write} declared beside this is NOT installed, and the setter lands optional on the
     * surface so a caller learns at COMPILE time. Declare it with no `write` at all when the frame shape is
     * unknown — the flag is what states "the device accepts this, we have not captured how", which is the
     * distinction the intent path answers with rather than a generic "not supported".
     */
    unverified?: true;
    /**
     * Extra names the intent path should route here, taking the caller's value as-is. Unlike
     * {@link aliases}, no value is supplied: it is the same write under a second name.
     */
    intentNames?: readonly string[];
    /** Extra wire ids that also carry this value on some families, with their own polarity and family gate. */
    readAliases?: readonly {
        paramType: number;
        invert?: boolean;
        available?: (ctx: AvailabilityContext) => boolean;
    }[];
    /**
     * What the setter accepts, when the member's own kind and bounds do not say it well enough — an
     * argument whose name reads better than the member's, or one the caller may omit.
     */
    args?: readonly ActionArgSpec[];
    /**
     * A value the setter takes BEYOND what the getter answers — declare it with {@link accepts}.
     *
     * A video-quality tier is stored and read as a number, but the write also resolves the resolution
     * NAME it maps to; without this the derived setter would narrow to the stored type and a caller
     * would lose the names it can pass. Only the TYPE is used — nothing reads the value.
     */
    accepts?: unknown;
    /** Numeric bounds the value must fall within — the same constants `write` clamps with. */
    min?: number;
    max?: number;
    /**
     * Install the getter on capability alone, not on having seen the param — for state that only ever
     * arrives over realtime, where "has reported already" is the wrong evidence.
     */
    realtime?: boolean;
    /**
     * Whether this member's READ observes the same wire its write lands on, for a given device. Absent means
     * yes — the ordinary case, where the setter's effect shows up in the getter.
     *
     * Declared only where a family routes the write elsewhere: the read then answers honestly about the param
     * it observes while disagreeing with what the setter did, and a caller has no reason to distrust it. Such a
     * member is named by {@link unreflectedMembers} for the devices where it applies, so the disagreement is
     * stated rather than left to be discovered.
     */
    readReflectsWrite?: (ctx: CommandContext) => boolean;
    /**
     * A setting the device ACCEPTS but never reports back.
     *
     * No getter (it could only ever answer `undefined`) and no entry in the property schema, which
     * describes what a device reports. It still declares its param and type, because that is what the
     * write needs. Camera privacy is one of these.
     */
    writeOnly?: true;
    /**
     * Reported by the device — so it IS in the property schema and reachable through `getProperty` — but
     * given no typed getter, because its value space is not evidenced.
     *
     * The distinction from {@link writeOnly} is which half is missing: there the device says nothing, here
     * WE cannot yet say what the value means. Publishing a typed getter over a meaning we have not
     * confirmed is the same guess the never-ship-a-guessed-param rule forbids.
     */
    unexposed?: true;
    /**
     * Reinterpret the RAW wire value at ingest, for a param the app reads as something other than its face
     * value — a bitfield the device reports as an object, a code that means a flag.
     *
     * Distinct from {@link decode}, and the two are not interchangeable: this runs once when params are
     * applied and REPLACES the default type coercion, so the stored property already holds the corrected
     * value and every reader sees it. `decode` runs per read, inside the getter, where the injected codec
     * is in scope — which is the only way to reach a field inside a payload.
     */
    coerce?: (raw: string | number | boolean) => boolean | number | string;
    /**
     * Derive the getter's value from the stored one, for a param delivered as a payload rather than a
     * scalar. Its return type wins over {@link type} on the surface, since it IS the value a caller gets —
     * and it is kept EXACTLY, so a decode answering a named union (`VacuumActivity`) surfaces that union
     * rather than the `string` it is stored as. Widening the declared return here would quietly erase it.
     *
     * `codec` is the injected {@link RawDpCodec}, `undefined` on an unbound device — the only place a
     * capability gets one, and the reason a structured DP payload can be read without the transport
     * knowing what its fields mean.
     */
    decode?: (raw: unknown, codec: RawDpCodec | undefined, ctx: CommandContext) => boolean | number | string | undefined;
    /**
     * This member's value is also a FIELD of another member's payload.
     *
     * Names the member KEY that owns that payload's `param`. The owner's stored property is what this
     * member's {@link decode} is handed, and the owner's evidence installs this member — so a device that
     * never reported the DP gets neither getter, and one that did gets both.
     *
     * The inverse of {@link readAliases}, which is one value across several wire ids. This is several
     * values inside ONE wire id, which is how the clean line reports most of what it knows: nine
     * consumable counters arrive as nine sub-messages of a single `ConsumableRuntime` on DP 168, and a
     * `CleanParam` on DP 154 carries the carpet strategy and the clean type together.
     *
     * **Two shapes, by whether the member also declares a `param` of its own.**
     *
     * *Derived only* (no `param`): the member contributes NO {@link PropertySpec}. The schema describes
     * what a device REPORTS and the device reports one DP, so a second spec for that id would give
     * `Device` two names for one param — and it stores under only the first, leaving the extra getters
     * answering `undefined` forever. That is exactly the failure the evidence gate exists to prevent.
     *
     * *Second source* (with a `param`): the member keeps its own wire and its own spec, and reaches into
     * the owner's payload only on a device that did not report that wire. This is what lets ONE property
     * span both clean lines when the two report it differently — the legacy Tuya line puts the lifetime
     * cleaned area on its own DP, the AIoT line buries it inside `CleanStatistics` on DP 167. Without it,
     * the same value would need two names and every host would branch on device family to ask for it.
     * The `decode` sees whichever raw value the device actually has, so it discriminates on SHAPE, the way
     * the clean line's cross-family decoders already do.
     *
     * **Watch what the owner was installed BY.** An owner with {@link readAliases} can be present because
     * of an alias, and the value stored under its property is then the ALIAS's — a different wire carrying
     * a different figure. A borrowing member that cannot come from that wire has to screen for it, either
     * with its own {@link available} gate or in its `decode`; `lifetimeCleanCount` does both.
     *
     * Read-only either way. Setting a field inside a shared payload means re-encoding the whole message,
     * which needs an encoder and a captured write this SDK does not have; the owner keeps that wire.
     * Guarded by `property-id-integrity.spec.ts`.
     *
     * **Naming an owner in ANOTHER capability.** A string names a sibling in this table, which covers
     * every payload whose readings all belong to one capability. Some do not: `DeviceInfo` on DP 169
     * carries the robot's MAC, SSID and IP beside the DOCK's firmware version, and the one-owner rule is
     * per product LINE — so one capability must own that id and the other's reading would otherwise have
     * to hang off the wrong object. The `{ property, param }` form says "read the property another module
     * owns, gated on the param that carries it", which works because `Device` keys state by NAME in one
     * flat namespace shared across capabilities. Both halves are stated rather than looked up: a member
     * declaring this cannot see the other module's table, and the guard checks the pair against the
     * line's real owner so a rename cannot leave it pointing at nothing.
     */
    readsFrom?: string | {
        property: string;
        param: number;
    };
    /** What the decoded value means, when it differs from the stored property's own {@link kind}. */
    decodedKind?: ValueKind;
    /**
     * The option set of a decoded `enum` — the counterpart to a property schema's `enumValues`, for a
     * getter whose value that schema cannot express. Legal only alongside {@link decode}, since without
     * one the property's own set is the answer and a second copy could only drift.
     */
    decodedValues?: readonly (string | number)[];
}
/** A member with no readable state: a momentary command. */
export interface ActionMember {
    action: (ctx: CommandContext) => Command;
    description: string;
    /** Install only on a device reporting one of these params — see {@link ValueMember.requires}. */
    requires?: readonly number[];
    /** Install only where this holds — see {@link ValueMember.available}. */
    available?: (ctx: CommandContext) => boolean;
}
/**
 * What a member's binder is handed — the same providers `actions()` receives today, so a member that
 * needs live state or a transport provider is expressible without leaving the table.
 */
export interface MemberDeps {
    ctx: CommandContext;
    sink: CommandSink;
    read: CapabilityStateReader;
    rawDp?: RawDpCodec;
    /**
     * The media provider, when the device is bound to one.
     *
     * Distinct from `provided`("media"), which makes a member EXIST only with a provider. A method
     * that merely uses one when available takes it here instead: a doorbell's quick response plays over an
     * already-open stream with no provider at all, and only needs one to open a stream itself.
     */
    media?: MediaProvider;
    /**
     * The `ff09` settings reader, when the device is bound to one. Named for the frame family it reads,
     * so any device driven by that frame can use it — see {@link Ff09SettingsReader}.
     */
    ff09Settings?: Ff09SettingsReader;
}
/**
 * A method the table cannot derive: its value is not one param's, so it owns its whole signature.
 *
 * The escape hatch that keeps the table honest instead of pretending everything is a property — a
 * sensitivity STEP is resolved across four wire ids and two numeric directions, so it is neither a
 * getter over one param nor a momentary command. Its signature flows through to the surface type.
 */
export interface MethodMember<F> {
    method: (deps: MemberDeps) => F;
    description: string;
    /** Install only where this holds — see {@link ValueMember.available}. */
    available?: (ctx: CommandContext) => boolean;
    /**
     * What the method accepts, for a signature whose arity does not state it: a parameter with a DEFAULT is
     * absent from `Function.length`, so `locate(on = true)` would otherwise be described as taking nothing
     * at all.
     *
     * Only needed for that case. A method taking its arguments plainly is described as existing with its
     * arguments unstated, and a nullary one has them derived (see `describe`).
     */
    args?: readonly ActionArgSpec[];
    /**
     * This member ANSWERS rather than ACTS: a sub-API namespace (`ptz.preset()`) or a live query whose
     * returned value is the whole point (`lock.getAutoLockState()`).
     *
     * Both take no arguments, but that arity says nothing about a control — calling one and discarding the
     * answer is not what it is for. So the empty argument list is NOT derived here, leaving the arguments
     * unstated, which is exactly what keeps it from being auto-offered. It stays described, and callable.
     */
    answers?: true;
}
/**
 * What a `readsFrom` member actually borrows: the property name holding the payload, and the param
 * whose presence is the evidence for it.
 *
 * One resolution for both forms and for every reader of them — `bindMembers` and the three guards that
 * check this mechanism all come through here, so a change to the declaration cannot leave one of them
 * reading the old shape.
 *
 * Answers `undefined` when the member borrows nothing, and for a string that names no sibling: that
 * fallback costs the borrowing member its getter rather than throwing at bind time, which is the
 * failure a guard catches at build time anyway.
 */
export declare function borrowedBy(m: Pick<ValueMember, "readsFrom">, members: Members): {
    property: string;
    param: number;
} | undefined;
/**
 * Declare a `MethodMember` — the wrapper exists so `F` is inferred from the returned function.
 * Pass `available` for a method only some devices have; it then lands optional on the surface.
 */
export declare function method<F>(build: (deps: MemberDeps) => F, description: string): MethodMember<F>;
/**
 * The gate has to survive into the TYPE, which is why passing one widens the return rather than only
 * setting a field: `available` is optional on `MethodMember`, and an optional property never
 * satisfies the `extends { available: unknown }` test that lands a member optional on the surface.
 */
export declare function method<F>(build: (deps: MemberDeps) => F, description: string, available: (ctx: CommandContext) => boolean): MethodMember<F> & {
    available: (ctx: CommandContext) => boolean;
};
/** The injected providers a member may be built from, by the technical job each names. */
export interface Providers {
    media: MediaProvider;
    ff09Settings: Ff09SettingsReader;
}
/**
 * A member only a device bound to a given provider has. Its signature is taken FROM that provider, so
 * the surface cannot claim a shape the provider does not have, and it lands OPTIONAL because an unbound
 * device — or one bound without that provider — genuinely does not have it.
 */
export interface ProvidedMember<P extends keyof Providers, F> {
    needs: P;
    provided: (provider: Providers[P], deps: MemberDeps) => F;
    description: string;
    /** This member ANSWERS rather than ACTS — see {@link MethodMember.answers}. */
    answers?: true;
    /** Additional resolved capability evidence required before this provider method is installed. */
    requiredCapabilities?: readonly Capability[];
}
/**
 * Widen a setter's argument past the value its getter answers — see {@link ValueMember.accepts}.
 * Spread into the member (`...accepts<RecordingQualityName>()`); the carried value is never read.
 */
export declare function accepts<T>(): {
    accepts: T;
};
/** Declare a {@link ProvidedMember} — the wrapper exists so `F` is inferred from the returned function. */
export declare function provided<P extends keyof Providers, F>(needs: P, build: (provider: Providers[P], deps: MemberDeps) => F, description: string, requiredCapabilities?: readonly Capability[]): ProvidedMember<P, F>;
/** Whether the resolved capability set satisfies a provider member's additional evidence gate. */
export declare function hasRequiredCapabilities(member: {
    requiredCapabilities?: readonly Capability[];
}, capabilities: ReadonlySet<Capability> | undefined): boolean;
/**
 * The provider-backed shape as the union sees it. `never` in the provider position is deliberate: a
 * parameter is contravariant, so a member built from ONE provider is only assignable to the union when
 * the union's parameter is the bottom type.
 */
export type AnyProvidedMember = {
    needs: keyof Providers;
    provided: (provider: never, deps: MemberDeps) => unknown;
    description: string;
    answers?: true;
    requiredCapabilities?: readonly Capability[];
};
export type Member = ValueMember | ActionMember | MethodMember<unknown> | AnyProvidedMember;
export type Members = Record<string, Member>;
/** The runtime narrowing (`bool`→boolean, `number`/`enum`→number, `string`→string), at type level. */
export type ValueOf<T> = T extends "bool" ? boolean : T extends "string" ? string : number;
/**
 * The members a getter is derived for: those backed by a device property, minus the two kinds that
 * declare a param but publish no read — a `writeOnly` setting the device never reports back, and an
 * `unexposed` one whose value space is not evidenced yet.
 */
export type ValueKeys<M extends Members> = {
    [K in keyof M]: M[K] extends ValueMember ? M[K] extends {
        writeOnly: true;
    } | {
        unexposed: true;
    } ? never : K : never;
}[keyof M];
/** The members that declare their own write wire, so a setter is derived beside the getter. */
export type WritableKeys<M extends Members> = {
    [K in keyof M]: M[K] extends {
        write: unknown;
    } ? K : never;
}[keyof M];
/** The momentary commands — a member with no readable state to reflect. */
export type ActionKeys<M extends Members> = {
    [K in keyof M]: M[K] extends ActionMember ? K : never;
}[keyof M];
/** The members owning their whole signature, which the table cannot derive from one param. */
export type MethodKeys<M extends Members> = {
    [K in keyof M]: M[K] extends MethodMember<unknown> ? K : never;
}[keyof M];
/** The members that exist only on a device bound to the provider they name. */
export type ProvidedKeys<M extends Members> = {
    [K in keyof M]: M[K] extends {
        needs: unknown;
    } ? K : never;
}[keyof M];
/**
 * Writes whose wire is not confirmed on a real device. Declared here so the capability documents what
 * the device has, but NOT installed — and therefore OPTIONAL on the surface, which is how a caller
 * learns at COMPILE time that it is not settable yet.
 *
 * This is the type-level half of the never-guess rule: a present method means a verified wire. Flipping
 * `unverified` off once a capture lands is the only edit needed to promote one.
 */
export type UnverifiedKeys<M extends Members> = {
    [K in keyof M]: M[K] extends {
        unverified: true;
    } ? K : never;
}[keyof M];
/**
 * Members whose presence is a runtime fact, so the surface must make a caller check: a write installed
 * only on the devices that prove they speak it ({@link ValueMember.requires}), or one whose wire is not
 * captured ({@link ValueMember.unverified}).
 */
export type ConditionalKeys<M extends Members> = UnverifiedKeys<M> | {
    [K in keyof M]: M[K] extends {
        requires: readonly number[];
    } ? K : never;
}[keyof M] | {
    [K in keyof M]: M[K] extends {
        requiresRead: true;
    } ? K : never;
}[keyof M] | {
    [K in keyof M]: M[K] extends {
        available: unknown;
    } ? K : never;
}[keyof M];
/**
 * What a getter answers: a `decode`'s own return type when there is one, otherwise the narrowing of the
 * stored `type`. A decode IS the value a caller receives, so its type has to win — that is exactly the
 * case (`snoozeTime`, a duration lifted out of a config blob) where the stored type is not the answer.
 */
export type ReadValue<T> = T extends {
    decode: (...a: never[]) => infer R;
} ? Exclude<R, undefined> : T extends {
    type: infer P;
} ? ValueOf<P> : never;
/**
 * What a setter takes: the getter's own value, plus anything the member declares it {@link ValueMember.accepts} on
 * top — a name for a value stored as a number. The two are a union because both reach the same wire.
 */
export type WriteValue<T> = T extends {
    accepts: infer A;
} ? ReadValue<T> | A : ReadValue<T>;
/** `brightness` → `setBrightness`, unless the member names its own setter. */
export type SetterName<K extends string, T> = T extends {
    writeAs: infer W extends string;
} ? W : `set${Capitalize<K>}`;
/**
 * The bound `dev.<cap>()` object, derived from the member table.
 *
 * Getters are optional because they are evidence-gated at runtime — the device may never have reported
 * the param. A write is offered on any device with the capability unless the member gates it.
 *
 * Every branch maps over `keyof M` and filters in the `as` clause rather than over a pre-filtered key
 * union. The two describe the same keys, but only the first is HOMOMORPHIC, and a homomorphic mapped type
 * carries each member's JSDoc through to the projection — so hovering `dev.lock().lock()` in an editor
 * shows what the member table says about it. Mapping over `[K in MethodKeys<M>]` silently drops it, which
 * costs the derived surface the one thing a hand-written `*Actions` type still had over it.
 *
 * The provider branch matches STRUCTURALLY on the built function rather than on `ProvidedMember<P, F>`:
 * the provider sits in a contravariant position, so a nominal match against the union's provider type
 * never succeeds. A builder's falsy half is its way of DECLINING, which the optional `?` already says,
 * so it is stripped rather than leaking into what a caller holds after the guard.
 */
export type Surface<M extends Members> = {
    readonly [K in keyof M as K extends ValueKeys<M> ? K : never]?: ReadValue<M[K]>;
} & {
    [K in keyof M as K extends Exclude<WritableKeys<M>, ConditionalKeys<M>> & string ? SetterName<K, M[K]> : never]: (value: WriteValue<M[K]>) => Promise<void>;
} & {
    [K in keyof M as K extends Extract<WritableKeys<M>, ConditionalKeys<M>> & string ? SetterName<K, M[K]> : never]?: (value: WriteValue<M[K]>) => Promise<void>;
} & {
    [K in keyof M as K extends Exclude<ActionKeys<M>, ConditionalKeys<M>> & string ? K : never]: () => Promise<void>;
} & {
    [K in keyof M as K extends Extract<ActionKeys<M>, ConditionalKeys<M>> & string ? K : never]?: () => Promise<void>;
} & {
    [K in keyof M as K extends Exclude<MethodKeys<M>, ConditionalKeys<M>> ? K : never]: M[K] extends MethodMember<infer F> ? F : never;
} & {
    [K in keyof M as K extends Extract<MethodKeys<M>, ConditionalKeys<M>> ? K : never]?: M[K] extends MethodMember<infer F> ? F : never;
} & {
    [K in keyof M as K extends ProvidedKeys<M> ? K : never]?: M[K] extends {
        provided: (...args: never[]) => infer F;
    } ? Exclude<F, false | undefined> : never;
};
/**
 * Resolve a member's enum options for a device, evaluating `enumValuesFor` at most once. Returns the
 * options and whether they came from the device context (`dynamic`), so the option set and the enum
 * `kind` both come from a single result. A context domain (`enumValuesFor(ctx)`) is
 * returned when present; absent that (or with no context) the static `enumValues`; a member with
 * neither yields no options.
 */
export declare function resolvedEnum(m: ValueMember, ctx?: AvailabilityContext): {
    values?: Record<number, string>;
    dynamic: boolean;
};
/**
 * The property schema the rest of the model consumes, derived from the same table.
 *
 * A write-only member contributes nothing: the schema describes what a device REPORTS, and a setting it
 * accepts but never reports back has no state to publish. Its wire still reaches `setProperty` through
 * the member's own `write`.
 *
 * When `ctx` is given, a member's availability gate is applied (a gated-out member contributes no spec)
 * and its enum options are resolved for the device via {@link resolvedEnum}; a context-resolved domain
 * makes the spec's `kind` `"enum"` rather than the member's stored scalar kind. A throwing gate
 * propagates.
 */
export declare function propertiesOf(members: Members, ctx?: AvailabilityContext): PropertySpec[];
/**
 * Build a member's wire for a value, or throw the reason it will not.
 *
 * The ONE write path: the fluent setter and the intent route both come through here, so the declared
 * domain is enforced once and refused with one message. Splitting them would let `setProperty` report an
 * out-of-range value as a device that lacks the feature while the setter beside it named the set the
 * value had to come from.
 * @internal
 */
export declare function memberWrite(name: string, m: ValueMember, value: boolean | number | string, ctx: CommandContext): Command;
/**
 * Narrow a stored property to the member's declared type, answering `undefined` on a mismatch rather
 * than lie-casting — the guard {@link ReadValue} promises a caller at compile time.
 *
 * A stored value is not always the declared type: `coerceByType` keeps a non-numeric wire value as the
 * raw string so the mismatch is visible in the log, and a param the dictionary declares `json`-encoded
 * is stored as a decoded object. Handing either through a getter typed `number` is the one lie this
 * table exists to prevent.
 *
 * Exported so the ONE narrowing the getters use is also the one a property-change announcement carries.
 * A second conversion of the wire value is precisely how a payload comes to disagree with the getter
 * beside it, which would defeat the point of announcing the change at all.
 * @internal
 */
export declare function narrow(type: PropertyValueType, read: CapabilityStateReader, prop: string): boolean | number | string | undefined;
/**
 * Both presence gates at once: the params a member requires, and its own {@link ValueMember.available}.
 *
 * Shared with the intent path, so `setProperty("alarmVolume", …)` is gated by exactly what decides
 * whether the fluent setter exists — one declaration, both entry points. Missing the `available` half
 * here would let the intent path build a HomeBase's station frame for an NVR.
 * @internal
 */
export declare function installs(m: {
    requires?: readonly number[];
    requiresRead?: true;
    available?: (c: CommandContext) => boolean;
    param?: number;
    realtime?: boolean;
    readAvailable?: ValueMember["readAvailable"];
    readAliases?: ValueMember["readAliases"];
}, ctx: CommandContext): boolean;
/**
 * Bind the table: evidence-gated getters, derived setters, momentary actions.
 *
 * Three rules the loop enforces for every member, so no module restates them:
 *
 *  - **One evidence gate for every read, decoded or not.** A `decode` changes how a value is READ, never
 *    whether the device reports it, so gating only the plain branch would publish a getter for a param
 *    the device never sent — one answering `undefined` forever. `realtime` is the opt-out.
 *  - **A provider builder answering nothing DECLINES.** The provider is there but the member is not
 *    available on it (an optional method, or one the device gave no evidence for), so the member is
 *    ABSENT rather than a key holding `undefined` — `"talkback" in cam` has to mean the camera can talk.
 *    Any falsy answer counts, so a builder can guard with `&&` instead of spelling out a ternary.
 *  - **A derived setter never throws synchronously.** A builder may throw (arming's needs the account
 *    identity and says so by throwing) and a method returning `Promise<void>` must not surprise a caller
 *    chaining `.catch()`. Caught here once rather than in each module's own wrapper.
 *
 * A getter is skipped for a `writeOnly` or `unexposed` member, and a setter for an `unverified` one —
 * declared so the capability documents the device, never installed.
 */
export declare function bindMembers<M extends Members>(members: M, deps: MemberDeps): Surface<M>;
/**
 * The members this device can be told to change but will never report back.
 *
 * `cam.privacy === undefined` reads identically for a device that reports the value as unset and one that
 * never reports it, and the two must not be guessed between.
 *
 * Only members whose setter is actually installed for this device are listed. A member whose write is
 * unverified has no setter and its intent path throws, so calling it something the device "accepts" would
 * put exactly the guess the unverified-write rule excludes back into the typed story.
 *
 * `unexposed` members are deliberately absent: the device DOES report those — they are in the property schema
 * and reachable through `getProperty` — what is missing is a confirmed meaning for the value.
 *
 * Empty for any object that is not a bound capability.
 */
export declare const unobservableMembers: (surface: object) => readonly string[];
/**
 * The members this device reports, but whose value does NOT reflect what its own setter writes — because on
 * this device family the write lands on a different wire than the read observes.
 *
 * A readable value that silently disagrees with the write is worse than an unreadable one: a caller has no
 * reason to distrust it. Camera enablement is one on the families whose power rides the privacy envelope —
 * the write goes there while the read still observes the on/off param, so a camera that has been turned off
 * still reads as on.
 *
 * Empty for any object that is not a bound capability.
 */
export declare const unreflectedMembers: (surface: object) => readonly string[];
