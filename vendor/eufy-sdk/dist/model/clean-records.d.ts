/**
 * Cleaning-history records — the parsed result of a `get_device_clean_record_list` call.
 *
 * The vendor keeps one record per completed run: when it started, and a URL to a binary detail blob
 * holding the run's map and statistics. This parses the LIST; the blob behind `downloadUrl` is not
 * fetched here, because the host it points at has not been confirmed and the SDK's binary download
 * path is host-allowlisted.
 *
 * Mirrors `capabilities/dp-catalog.ts`: the transport fetches the raw response and this owns the shape,
 * so `model/` never learns how the call is signed and `transport/` never learns what a record means.
 *
 * @module model/clean-records
 */
/** One completed cleaning run, as the cloud lists it. */
export interface CleanRecord {
    /** The vendor's record id — what a delete call would name. */
    readonly id: number;
    /** When the run was recorded, in unix SECONDS (not milliseconds). */
    readonly createTime: number;
    /** When the record was last modified, in unix seconds. */
    readonly updateTime: number;
    /**
     * URL of the run's binary detail blob — map and per-run statistics.
     *
     * Handed over rather than fetched: its host is unconfirmed, and the blob is a framed container
     * rather than a bare protobuf, so decoding it needs evidence this SDK does not have yet.
     */
    readonly downloadUrl: string;
    /** The vendor's storage path for the same blob. Empty when the response omits it. */
    readonly filePath: string;
    /**
     * The vendor's opaque `extend` string, passed through verbatim.
     *
     * Its contents are not specified anywhere this SDK can point at, so it is deliberately NOT parsed —
     * a guessed shape here would be a wire claim with no evidence behind it.
     */
    readonly extend: string;
}
/** A page of cleaning history, plus how many records exist in total. */
export interface CleanRecordPage {
    /** The page as the cloud ordered it. Nothing here re-sorts, so the order is the gateway's contract. */
    readonly records: readonly CleanRecord[];
    /**
     * Total records the account holds for this device — page through with `page` until it is reached.
     *
     * Falls back to this page's own record count when the response states no total, which can UNDERSTATE
     * if a malformed record was skipped. That is the safe direction: a caller pages until it reaches the
     * total, so a low figure ends the walk early rather than looping for records that never arrive.
     */
    readonly total: number;
}
/** Returned whenever the call fails or the response shape is not recognised. */
export declare const EMPTY_CLEAN_RECORD_PAGE: CleanRecordPage;
/**
 * Parse a `get_device_clean_record_list` response into a {@link CleanRecordPage}.
 *
 * `raw` is the response's `data` object, already unwrapped by the transport — so the array sits at the
 * top level under `clean_record_list`, beside `total`.
 *
 * A record without a usable `id` is skipped rather than admitted with a fabricated one: the id is what
 * identifies the run, and a record that cannot be named is not a record a caller can act on. Every
 * other field degrades to a default, so one odd entry never costs the whole page.
 *
 * `user_id` and `device_sn` are present in the response and deliberately not surfaced — the caller
 * already knows which device it asked about, and the account id is not this type's business.
 *
 * Returns {@link EMPTY_CLEAN_RECORD_PAGE} on any shape mismatch — never throws.
 */
export declare function parseCleanRecords(raw: unknown): CleanRecordPage;
