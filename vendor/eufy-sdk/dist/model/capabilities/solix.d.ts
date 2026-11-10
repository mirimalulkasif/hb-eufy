/**
 * Anker **Solix** capability surface. Solix is a separate ecosystem — its own Anker account, backend
 * and product catalog — so it keeps its own capability id union rather than joining eufy's `Capability`
 * / `Codec` unions, and detection is by Anker catalog CATEGORY + product-code prefix (see
 * {@link detectSolixCapabilities}) rather than eufy param ids.
 *
 * What it shares is the `members` engine: the one feature with a readable wire declares ONE `members`
 * table, and its property schema, evidence gate and typed surface all derive from it through
 * `members.ts` (`bindMembers` / `Surface`), exactly as a eufy capability does.
 *
 * @module model/capabilities/solix
 */
import type { Surface } from "./members.js";
/** Every capability a Solix device may carry. Solix's OWN union (not eufy's `Capability`). */
export type SolixCapability = "identity" | "firmware" | "connectivity" | "energyMeter" | "battery" | "solarInput" | "acOutput" | "evCharger" | "charger" | "cooler";
/**
 * The `energyMeter` surface — the electrical readings the vendor app names, as typed members. Each is
 * read-only and evidence-gated: `bindMembers` installs a getter only once a frame that REPORTS that tag
 * has landed, and answers `undefined` (not a fabricated `0`) before any has. The gate is "reported", not
 * "non-zero": a single-phase / single-CT meter still reports its L2/L3 slots as `0.0`, so those members
 * install and read `0` rather than staying absent — a caller sees `0` for an idle phase, not `undefined`.
 *
 * Provenance splits by what the evidence actually pins. The app's field VOCABULARY (these twelve names)
 * is authoritative. For the tag→field binding, a live single-phase frame confirmed the L1 and total
 * magnitudes (a nominal mains voltage, an equal line/total power pair, the line current), so those four
 * positions are `verified`. The L2/L3 tags are never non-zero on a single-CT install and the app itself
 * receives the meter as named JSON — there is no tag→phase decoder in the app binary — so their phase
 * assignment is inferred from the block ordering and is marked `guessed`, not `apk`. The energy counters (`meterImportEnergy`/`meterExportEnergy`) are named
 * on the wire but are NOT members here: their tag→name is confirmed, but their unit SCALE is not (a live
 * reading is consistent with either Wh or kWh), so they stay raw named values via
 * {@link SOLIX_METER_FIELD_NAMES} until a capture pins the scale, rather than ship a member with a guessed unit.
 *
 * @internal — the declaration `SolixEnergyMeterReads` derives from; exported (like the eufy `*_MEMBERS`
 * tables) so it is a known symbol, but excluded from the rendered API reference.
 */
export declare const SOLIX_ENERGY_METER_MEMBERS: {
    /** Line-1 voltage (V), ff09 tag `0xAC` — confirmed live (a nominal mains voltage). */
    readonly meterVoltageL1: {
        readonly param: 172;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "V";
        readonly provenance: "verified";
        readonly description: "Meter line-1 voltage (V) — ff09 tag 0xAC, confirmed against a live single-phase frame.";
    };
    /** Line-2 voltage (V), ff09 tag `0xAD` — the app's field; reads 0 until a multi-phase frame carries it. */
    readonly meterVoltageL2: {
        readonly param: 173;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "V";
        readonly provenance: "guessed";
        readonly description: "Meter line-2 voltage (V) — ff09 tag 0xAD; phase assignment inferred from block ordering (never observed non-zero), 0 on a single-phase install.";
    };
    /** Line-3 voltage (V), ff09 tag `0xAE` — the app's field; reads 0 until a multi-phase frame carries it. */
    readonly meterVoltageL3: {
        readonly param: 174;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "V";
        readonly provenance: "guessed";
        readonly description: "Meter line-3 voltage (V) — ff09 tag 0xAE; phase assignment inferred from block ordering (never observed non-zero), 0 on a single-phase install.";
    };
    /** Line-1 current (A), ff09 tag `0xAF` — confirmed live (the line's CT current). */
    readonly meterCurrentL1: {
        readonly param: 175;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "A";
        readonly provenance: "verified";
        readonly description: "Meter line-1 current (A) — ff09 tag 0xAF, confirmed against a live single-phase frame.";
    };
    /** Line-2 current (A), ff09 tag `0xB0` — the app's field; reads 0 until a multi-phase frame carries it. */
    readonly meterCurrentL2: {
        readonly param: 176;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "A";
        readonly provenance: "guessed";
        readonly description: "Meter line-2 current (A) — ff09 tag 0xB0; phase assignment inferred from block ordering (never observed non-zero), 0 on a single-phase install.";
    };
    /** Line-3 current (A), ff09 tag `0xB1` — the app's field; reads 0 until a multi-phase frame carries it. */
    readonly meterCurrentL3: {
        readonly param: 177;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "A";
        readonly provenance: "guessed";
        readonly description: "Meter line-3 current (A) — ff09 tag 0xB1; phase assignment inferred from block ordering (never observed non-zero), 0 on a single-phase install.";
    };
    /** Line-1 active power (W), ff09 tag `0xA8` — confirmed live; negative on export. */
    readonly meterPowerL1: {
        readonly param: 168;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "W";
        readonly provenance: "verified";
        readonly description: "Meter line-1 active power (W) — ff09 tag 0xA8, confirmed live; negative on export.";
    };
    /** Line-2 active power (W), ff09 tag `0xA9` — the app's field; reads 0 until a multi-phase frame carries it. */
    readonly meterPowerL2: {
        readonly param: 169;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "W";
        readonly provenance: "guessed";
        readonly description: "Meter line-2 active power (W) — ff09 tag 0xA9; phase assignment inferred from block ordering (never observed non-zero), 0 on a single-phase install.";
    };
    /** Line-3 active power (W), ff09 tag `0xAA` — the app's field; reads 0 until a multi-phase frame carries it. */
    readonly meterPowerL3: {
        readonly param: 170;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "W";
        readonly provenance: "guessed";
        readonly description: "Meter line-3 active power (W) — ff09 tag 0xAA; phase assignment inferred from block ordering (never observed non-zero), 0 on a single-phase install.";
    };
    /** Aggregate active power (W), ff09 tag `0xAB` — confirmed live; equals line-1 on a single phase. */
    readonly meterPowerTotal: {
        readonly param: 171;
        readonly type: "number";
        readonly kind: "scalar";
        readonly unit: "W";
        readonly provenance: "verified";
        readonly description: "Meter total active power (W) — ff09 tag 0xAB, confirmed live; equals L1 on one phase.";
    };
};
/** Bound `energyMeter` reads (the members-derived half of `dev.energyMeter()`). Read-only. */
export type SolixEnergyMeterReads = Surface<typeof SOLIX_ENERGY_METER_MEMBERS>;
/**
 * The capabilities each Anker catalog category implies. Category is a detection SIGNAL (like eufy's
 * `deviceTypes`), not the model's identity — a device still resolves `energyMeter` from its product code
 * even though its category is "Accessory", which is why that category maps to nothing on its own.
 * Unlisted categories contribute nothing here.
 */
export declare const CATEGORY_CAPABILITIES: Readonly<Record<string, readonly SolixCapability[]>>;
/**
 * Product-code prefixes known to be grid/energy meters (detects `energyMeter` regardless of category).
 * Keep in lockstep with `SOLIX_METER_PRODUCT_PREFIXES` in `transport/mqtt/solix-mqtt.ts` (the same meter
 * prefixes, transport-side, that gate the tag→name table): a prefix added here but not there grants
 * `energyMeter` to a device whose frames the decoder then refuses to name. Add a meter prefix to both.
 */
export declare const SOLIX_METER_MODELS: readonly string[];
/**
 * Product-code prefixes for the grid-tie Solarbank / home-battery family (detects `battery` +
 * `solarInput` regardless of category, so a caller that builds a device without the catalog still gets
 * them): `A1790` = Solarbank E1600 gen-1, `A17C*` = Solarbank 2 / 3, `AE10*` = Solarbank 4 E5000 Pro /
 * SOLIX Power Dock.
 *
 * Grounded in the live `product_categories` catalog: `A17C0`–`A17C5` and `AE100` all list under
 * category `"Plug-in Home Battery "`, and `AE103` by the device spec. `AE1X0`/`AE1R0` meters start
 * `AE1X`/`AE1R`, so `AE10` does not catch them.
 *
 * The speculative `A17E` ("Solarbank Max AC") and `AE11` ("Solarbank Max") were dropped: neither is in
 * the catalog, and the only `AE11x` product there — `AE113` "XE 6/8kW" — is a Residential Storage
 * System, a different family whose telemetry is unverified, so granting it `battery`/`solarInput` would
 * be an unevidenced false positive (exactly what this detection is otherwise careful to avoid).
 */
export declare const SOLARBANK_MODELS: readonly string[];
/** The minimum device shape {@link detectSolixCapabilities} reads. */
export interface SolixDetectionInput {
    product_code: string;
    device_sw_version?: string;
    wifi_online?: boolean;
    wifi_name?: string;
    rssi?: string | number;
}
/**
 * Resolve a Solix device's capability set from its record fields, catalog category, and product-code
 * prefix — the Solix analogue of eufy's `detectCapabilities`, kept Solix-scoped so eufy detection is
 * untouched. `identity` is universal; the rest are OR-ed evidence.
 */
export declare function detectSolixCapabilities(rec: SolixDetectionInput, category?: string): Set<SolixCapability>;
