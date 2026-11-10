/**
 * The per-run detail blob a {@link CleanRecord} points at — map and statistics for one cleaning run.
 *
 * `get_device_clean_record_list` answers a list of runs, each carrying a `downloadUrl`. The bytes
 * behind that URL are NOT a bare protobuf: they arrive inside the vendor's own container, with a magic
 * header, a length, and a trailing checksum. This owns both halves — unwrapping the container and
 * reading the message inside it — and neither fetches the URL nor decides whether it is safe to.
 *
 * Fetching stays with the caller on purpose: the host these URLs point at is unconfirmed, and this
 * client's binary path is host-allowlisted with SSRF checks by design. Handing the SDK a URL to fetch
 * would route around a control that exists for a reason.
 *
 * @module model/clean-record-detail
 */
import type { RawDpCodec } from "../core/contracts.js";
/** Why a run ended, as the vendor's `finish_reason` reports it. */
export declare const CLEAN_FINISH_REASONS: readonly ["completed", "manual", "lowPower", "exception"];
export type CleanFinishReason = (typeof CLEAN_FINISH_REASONS)[number];
/** One completed run's statistics, decoded from its detail blob. */
export interface CleanRecordDetail {
    /** When the run started, in unix SECONDS. */
    readonly startTime: number;
    /** When the run ended, in unix seconds. */
    readonly endTime: number;
    /** How long the run took, in seconds. */
    readonly duration: number;
    /** Area covered, in the unit the device reports it in (m² on every model seen so far). */
    readonly area: number;
    /** The cleaning type the run used, as the vendor's raw enum index. */
    readonly cleanType: number;
    /** Why the run ended. `undefined` when the device reported a value this version does not name. */
    readonly finishReason: CleanFinishReason | undefined;
}
/**
 * Unwrap the vendor's container and hand back the protobuf inside it, or `undefined`.
 *
 * The container is `0xAA 0x01`, a length, the message, then a two-byte big-endian checksum over every
 * byte before it. **The width of the length field is not documented**, so rather than assume one, this
 * tries the plausible widths and keeps the one whose checksum verifies — the checksum is the oracle,
 * and a wrong guess about the length fails it rather than producing a plausible wrong message.
 *
 * That is the whole reason this validates instead of parsing optimistically: a run's statistics that
 * are quietly wrong are worse than statistics a caller could not read.
 */
export declare function unwrapCleanRecordBlob(blob: Uint8Array): Uint8Array | undefined;
/**
 * Decode one run's detail blob into a {@link CleanRecordDetail}.
 *
 * `codec` is the same {@link RawDpCodec} the capabilities read DP payloads with — passed in rather
 * than imported, because the implementation lives in the transport layer and this one does not reach
 * across that line.
 *
 * Every field defaults to `0` when the message omits it: proto3 omits a zero, so a run that covered no
 * area and one that said nothing about area are the same bytes, and `0` is the honest reading of both.
 * `finishReason` is the exception — an index this version cannot name answers `undefined` rather than
 * being flattened onto a neighbouring reason.
 *
 * Returns `undefined` when the container fails its checksum or the bytes inside are not a message —
 * never throws, and never a partial read.
 *
 * **`Extra` is not decoded.** The message carries a nested `Extra { mode, mus, error_code, prompt_code }`
 * whose own field number within `CleanRecordDesc` is not recorded in any source this SDK can point at.
 * Reading it would mean picking a number, and a wrong one would silently report another field's bytes.
 */
export declare function parseCleanRecordDetail(blob: Uint8Array, codec: RawDpCodec): CleanRecordDetail | undefined;
