/**
 * A Solix device's product family — the normalized "what kind of thing is this" answer, decorrelated
 * from the Anker catalog's marketing category strings. `unknown` when neither the product code nor the
 * category identifies a family (never a guess).
 */
export type SolixProductFamily = "powerStation" | "solarbank" | "smartMeter" | "powerBank" | "cooler" | "evCharger" | "charger" | "unknown";
/** The pure evidence a family decision reads: the product code, and the catalog category when resolved. */
export interface SolixFamilyInput {
    /** SKU / model code, e.g. `A1782`, `AE103`, `AE1X0`. */
    product_code: string;
    /** Anker catalog category, when a catalog resolved one (e.g. `"Portable Power Station"`). */
    category?: string;
}
/** Grid-tie Solarbank / plug-in home battery family (by product code, catalog-independent). */
export declare const isSolixSolarbank: (input: SolixFamilyInput) => boolean;
/** Smart energy meter / grid-CT family (by product code, catalog-independent). */
export declare const isSolixSmartMeter: (input: SolixFamilyInput) => boolean;
/** Portable Power Station (SOLIX F-series) family — resolved from the catalog category. */
export declare const isSolixPowerStation: (input: SolixFamilyInput) => boolean;
/**
 * Resolve a Solix device's {@link SolixProductFamily} by consulting the family predicates first (they are
 * catalog-independent, so a device classifies even before a catalog is fetched), then the catalog
 * category for the families that have no prefix set yet. Returns `"unknown"` when neither identifies one —
 * never a guess, mirroring `device-family.ts` returning `false` on an unknown device type.
 *
 * The meter is checked before the Solarbank: both can present a battery-ish catalog category, but the
 * meter's `AE1X0` prefix is unambiguous and a meter is never a Solarbank. The Solarbank case reuses
 * {@link isSolixSolarbank} (prefix OR the home-battery category) rather than re-testing the prefix here,
 * so the two never drift.
 */
export declare function solixProductFamily(input: SolixFamilyInput): SolixProductFamily;
