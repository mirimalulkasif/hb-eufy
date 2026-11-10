import type { AvailabilityContext, CapabilityModule } from "./types.js";
import { type Surface } from "./members.js";
/**
 * RoboVac suction Tuya **DP ids** — this capability's own wire vocabulary (clean namespace, from the
 * cloud `get_product_data_point` schema). Named like the P2P feature-command consts so a DP is
 * referenced by meaning rather than a magic number.
 */
export declare const SUCTION_DP: {
    /** Suction level (DP 158, Enum). */
    readonly SUCTION: 158;
    /** BoostIQ auto-suction on/off (DP 159, Bool). */
    readonly BOOST_IQ: 159;
};
/**
 * Suction levels — the app's `SuctionEnum` (`getSuctionEnumByValue`). This is a **fixed** value→label
 * map with **no model argument**: a given int means the same thing on every RoboVac. What varies per
 * model is only **availability** — a device's `get_product_data_point` range may expose a narrower
 * subset (the T2351 catalog lists `Quiet`–`Max`) — so the `suction` property stays a raw int rather than being
 * constrained per device, and {@link suctionLevelName} names a reported level.
 *
 * `BoostIQ` (4) is a real suction level in this scale. The separate `boostIq`
 * boolean (DP 159) is the independent auto-suction toggle — a device may report both, and they don't
 * contradict.
 */
export declare const SuctionLevel: {
    readonly Quiet: 0;
    readonly Standard: 1;
    readonly Turbo: 2;
    readonly Max: 3;
    readonly BoostIQ: 4;
    readonly MaxPro: 5;
};
export type SuctionLevelValue = (typeof SuctionLevel)[keyof typeof SuctionLevel];
/**
 * The label for a raw suction int, per the app's `SuctionEnum`, or `undefined` for a value outside the
 * known scale. The mapping is global (not per-model) — see {@link SuctionLevel}.
 */
export declare function suctionLevelName(value: number): string | undefined;
/**
 * Bound suction reads and controls — the object returned by `dev.suction()`.
 *
 * `setSuctionLevel` is DERIVED from the `level` member entry; `supportedLevels` is the only addition
 * from `actions()` — it names the per-SKU DP 158 range but is not itself a device param.
 */
export type SuctionActions = Surface<typeof SUCTION_MEMBERS> & {
    /**
     * The suction levels this device supports, sourced from the per-SKU `get_product_data_point` catalog
     * range for DP 158. Narrower than the full six {@link SuctionLevel} values on many models — a T2351's
     * catalog lists `Quiet`, `Standard`, `Turbo` and `Max`, which answers `[0, 1, 2, 3]`.
     *
     * `undefined` when the catalog is absent, does not cover DP 158, or lists only members outside the
     * known scale. Only meaningful on devices where `setSuctionLevel` is installed (AIoT vacuums).
     */
    readonly supportedLevels?: readonly SuctionLevelValue[];
};
/**
 * Every `suction` read and write — `setSuctionLevel` (DP 158, via `writeAs`) and `setBoostIq`
 * (DP 159) are both derived from this table.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const SUCTION_MEMBERS: {
    /**
     * Narrowed to the known scale, which is NARROWER THAN THE WIRE: the level
     * arrives as a plain integer and a firmware reporting a value outside {@link SuctionLevel} would be
     * typed as one of these regardless. {@link suctionLevelName} stays total for that reason — it answers
     * `undefined` for an int it does not recognise, so an unexpected level surfaces as unnamed rather than
     * mislabelled.
     */
    readonly level: {
        readonly param: 158;
        readonly property: "suction";
        readonly type: "number";
        readonly kind: "enum";
        readonly enumValues: Record<number, string>;
        readonly provenance: "mega";
        readonly decode: (raw: unknown) => SuctionLevelValue | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly SuctionLevelValue[];
        readonly write: (v: string | number | boolean) => import("../../index.js").Command;
        readonly writeAs: "setSuctionLevel";
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly description: string;
    };
    /**
     * The auto-suction toggle — an independent boolean, NOT the `BoostIQ` entry in the suction scale. A
     * robot may report both at once without contradicting itself: `level` says which power the robot is
     * fixed at, this says whether it may raise it by itself on carpet. Writable straight from the table
     * because DP 159 is a plain bool with no per-model range to validate against, unlike `level`.
     */
    readonly boostIq: {
        readonly param: 159;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly description: "BoostIQ auto-suction (DP 159, Bool).";
        readonly write: (v: string | number | boolean) => import("../../index.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
    };
};
/** `suction` — vacuum suction power level (RoboVac). */
export declare const SUCTION: CapabilityModule;
