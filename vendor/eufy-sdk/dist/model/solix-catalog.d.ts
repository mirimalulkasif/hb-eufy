/**
 * Anker Solix product catalog — the vendor's pairable-product registry (categories → products),
 * used to label a discovered device's model code with a marketing name + category.
 *
 * This is model-layer vocabulary: pure data shapes + a lookup builder, with no wire/transport
 * dependency. The catalog itself is fetched from the cloud by the client layer (`SolixClient`), which
 * feeds it here via {@link buildModelIndex}; keeping the shapes and the index in the model layer lets
 * `SolixDevice` resolve a name/category without reaching across the capability↔transport boundary.
 */
export type { SolixProduct, SolixProductCategory } from "../core/solix-types.js";
import type { SolixProductCategory } from "../core/solix-types.js";
/**
 * Flatten a product catalog into a `product_code → { name, category }` lookup for labelling
 * discovered devices. Every variant code in `p_codes` maps to its parent product too, so a device
 * reporting a sub-model resolves to the same marketing name.
 *
 * The category name is trimmed here, at ingest — the live catalog returns some names with trailing
 * whitespace (e.g. `"Plug-in Home Battery "`), and normalising once at the source means every consumer
 * (a device's `identity().category`, `detectSolixCapabilities`, and any exact-match category test) sees
 * the clean name, rather than each call site having to remember to trim.
 */
export declare function buildModelIndex(categories: SolixProductCategory[]): Map<string, {
    name: string;
    category: string;
}>;
