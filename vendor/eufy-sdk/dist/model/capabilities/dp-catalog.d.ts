/**
 * Per-SKU DP capability catalog — the parsed result of a `get_product_data_point` API call.
 *
 * The response carries one entry per data point, each declaring `dp_id`, a stable `code`, a
 * human `name`, an access `mode`, a `data_type` and a `property` blob. Only the enum ranges are
 * read here; the names and writability that same call reports are already resolved offline into
 * `CLEAN_PARAMS`, so what this adds is the per-SKU narrowing a shared dictionary cannot carry —
 * two products with the same DP can offer different value sets.
 *
 * Still defensive at every step: a missing key or a mismatched shape yields an empty catalog and
 * capabilities fall back to their safe defaults, because a wrong range is worse than none.
 *
 * @module model/capabilities/dp-catalog
 */
/** The parsed DP capability catalog for one product SKU. */
export interface DpCatalog {
    /**
     * For enum-type DPs: the range members exactly as the catalog lists them, as strings — value names
     * (`"Quiet"`) or numeric strings (`"0"`), whichever the SKU's catalog uses. What a member means is
     * the reading capability's to decide. Absent for non-enum DPs (bool, raw, integer, string).
     */
    readonly enumRanges: ReadonlyMap<number, readonly string[]>;
}
/** Returned whenever the API call fails or the response shape is not recognised. */
export declare const EMPTY_DP_CATALOG: DpCatalog;
/**
 * Parse a `get_product_data_point` response into a {@link DpCatalog}.
 *
 * `raw` is the response's `data` object, already unwrapped by the transport — so the entry array
 * sits at the top level under `data_point_list`.
 *
 * An entry's declared type is `data_type` and its constraint blob is `property`; a range is read
 * only from an enum entry, since that is the only type whose `property` states a closed set.
 * `data_type` is matched case-insensitively — its casing is the server's to choose and nothing
 * here should depend on it.
 *
 * Returns {@link EMPTY_DP_CATALOG} on any shape mismatch — never throws.
 */
export declare function parseDpCatalog(raw: unknown): DpCatalog;
