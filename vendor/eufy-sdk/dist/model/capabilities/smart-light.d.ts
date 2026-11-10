import type { CapabilityModule } from "./types.js";
import type { Command } from "../../core/contracts.js";
import { type Surface } from "./members.js";
/** Integer RGB input for `SmartLightActions.setColor`; each channel must be in 0..255. */
export interface RgbColor {
    red: number;
    green: number;
    blue: number;
}
/**
 * Bound `smart_light` controls — the object returned by `dev.smartLight()`.
 *
 * The reads, their setters, the state request and the effect write are DERIVED from
 * `SMART_LIGHT_MEMBERS`: one declaration per feature gives the getter, the setter, its argument
 * type and its description. Only the no-argument power verbs are written out below.
 */
export type SmartLightActions = Surface<typeof SMART_LIGHT_MEMBERS> & {
    /** Turn the light on. */
    on(): Promise<void>;
    /** Turn the light off. */
    off(): Promise<void>;
};
/**
 * Every `smart_light` feature, declared once. The property schema, the typed getters, the derived
 * setters, the intent routes and the descriptions all come out of this table.
 *
 * Every read is `realtime`: this line has no pollable cloud param to gate a getter on — state arrives
 * only over the light's own MQTT wire — so the capability's own detection is the evidence, and each
 * getter reads `undefined` until the first report lands.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const SMART_LIGHT_MEMBERS: {
    /**
     * On/off for the whole run of lights. `writeAs` names the setter `set` rather than `setPower`, and the
     * `on`/`off` verbs beside it in `actions()` reach the same frame. `realtime` like every read here:
     * there is no pollable cloud param, so the getter answers `undefined` until the first MQTT report —
     * `refreshState` is how a caller populates it on demand. Note the READ tag (0xa1) and the WRITE tag
     * (0xa3) differ; the two legs' tag maps are unrelated.
     */
    readonly power: {
        readonly param: 161;
        readonly property: "lightPower";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly realtime: true;
        readonly description: "Power state, DP tag 0xa1. ✅ Source-confirmed in the app's own report parser, then live-decoded off a T8L02 status report.";
        readonly write: (v: string | number | boolean) => Command;
        readonly writeAs: "set";
        readonly aliases: {
            readonly on: true;
            readonly off: false;
        };
    };
    /**
     * The CONFIGURED level, not the live output: it persists across an off, so reading a non-zero
     * brightness says nothing about whether the lights are lit — pair it with `power`. 0 is a legal level
     * here (unlike the camera spotlight's 1-100), and the write clamps into 0-100 rather than refusing.
     * `realtime`, so `undefined` until the first report.
     */
    readonly brightness: {
        readonly param: 162;
        readonly property: "lightBrightness";
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "verified";
        readonly realtime: true;
        readonly min: 0;
        readonly max: 100;
        readonly description: string;
        readonly write: (v: string | number | boolean) => Command;
    };
    /**
     * How many individually addressable segments the installed run has — a physical fact of the strip,
     * which is why it is read-only. A bare `scalar` with no unit: the wire says how many, not how long.
     * `realtime`, so `undefined` until the first report.
     */
    readonly lightLength: {
        readonly param: 163;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly realtime: true;
        readonly description: "Addressable segment count, DP tag 0xa3.";
    };
    /**
     * The gallery effect SELECTED — an `identifier`, not an enum, because it names an entry in a catalog
     * that only exists at runtime, so there is no option set to publish. Distinct from `cloudEffectId`,
     * which is the one actually running. Written by `setEffect`, whose gate is the model rather than a
     * value. `realtime`, so `undefined` until the first report.
     */
    readonly effectId: {
        readonly param: 164;
        readonly property: "lightEffectId";
        readonly type: "number";
        readonly kind: "identifier";
        readonly provenance: "verified";
        readonly realtime: true;
        readonly description: "Selected gallery effect id, DP tag 0xa4.";
    };
    /**
     * Whether the run blends between an effect's colours rather than stepping between them. Read-only:
     * the report parser establishes the flag, but no write frame for it has been reversed, so no setter
     * is offered. One of the two params surfaced as `"1"`/`"0"` so the `bool` narrowing reads it.
     * `realtime`, so `undefined` until the first report.
     */
    readonly colorGradient: {
        readonly param: 165;
        readonly property: "lightColorGradient";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly realtime: true;
        readonly description: "Colour-gradient switch, DP tag 0xa5.";
    };
    /**
     * The effect actually RUNNING, `0` when none is — so this, not `effectId`, is the read that answers
     * "is an effect playing". An `identifier` for the same reason as its sibling: the catalog it indexes
     * is fetched at runtime. Read-only; `setEffect` drives the selection. `realtime`, so `undefined`
     * until the first report.
     */
    readonly cloudEffectId: {
        readonly param: 166;
        readonly property: "lightCloudEffectId";
        readonly type: "number";
        readonly kind: "identifier";
        readonly provenance: "verified";
        readonly realtime: true;
        readonly description: "Running gallery effect id (0 when off), DP tag 0xa6.";
    };
    /**
     * Reported in every status frame, so it belongs in the schema and answers through `getProperty` — but
     * given no typed getter: the app's own parser reads 0xa7 differently on the notify and on the
     * get-reply, and no capture settles which value means what.
     */
    readonly lightEffectMode: {
        readonly param: 167;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "apk";
        readonly unexposed: true;
        readonly description: string;
    };
    /**
     * A request, not a state: reports are pushed on change with no periodic heartbeat, so this is how a
     * caller populates the getters on demand. The reply arrives asynchronously and does not resolve here.
     */
    readonly refreshState: {
        readonly action: () => Command;
        readonly description: "Ask the device to report its current state; the reply refreshes the reads.";
    };
    /**
     * Gated on the MODEL, not on a value, and carrying no description: it refuses off the confirmed list
     * for a reason a generated message cannot give, and its id names an entry in a catalog that only
     * exists at runtime, so a generated control would have no domain to offer. Neither is a property
     * write, so it keeps its own signature.
     */
    readonly setEffect: import("./members.js").MethodMember<(lightId: number) => Promise<void>>;
    /**
     * Plain custom colour, distinct from the gallery-effect wire. The frame addresses every reported
     * segment, so a current positive segment count is mandatory and no family-wide length is guessed.
     * Completion acknowledges transport publication only; the device reports no authoritative RGB.
     */
    readonly setColor: import("./members.js").MethodMember<(color: RgbColor) => Promise<void>> & {
        available: (ctx: import("./types.js").CommandContext) => boolean;
    };
};
export declare const SMART_LIGHT: CapabilityModule;
