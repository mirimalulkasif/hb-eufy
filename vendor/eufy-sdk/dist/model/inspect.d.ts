/**
 * Device inspection — turn a real device's reported params into an enrichment report.
 *
 * Given a cloud record (model/deviceType/params), this produces:
 *  - the resolved `{ codec, capabilities, name }`,
 *  - a per-param table cross-referenced against the param dictionary (known/unknown, name,
 *    provenance, inferred type, live value),
 *  - a **paste-ready `registry.ts` row** for the device's model, and
 *  - **paste-ready param-dictionary snippets** for every param we don't yet know.
 *
 * Pure + offline (no network) so it is unit-testable; the live wrapper that fetches a device by
 * serial lives on `EufyMega.inspectDevice`.
 *
 * @module model/inspect
 */
import type { CloudRecord, PropertySource, PropertyValueType, RegistryEntry, ResolvedDevice } from "./types.js";
import { type ParamNamespace } from "./param-namespace.js";
/** One reported param, cross-referenced against our dictionary. */
export interface ParamInspection {
    paramType: number;
    /** Raw reported value (as delivered). */
    value: string;
    /** True when the param is in our dictionary for this namespace. */
    known: boolean;
    /** Our dictionary name, or `param<pt>` when unknown. */
    name: string;
    /** Trust of the dictionary mapping (absent ⇒ not in dictionary). */
    provenance?: PropertySource;
    /** Type inferred from the live value (bool/number/string). */
    inferredType: PropertyValueType;
}
/** Full inspection report for one device. */
export interface DeviceInspection {
    sn?: string;
    model?: string;
    deviceType?: number;
    namespace: ParamNamespace;
    resolved: ResolvedDevice;
    params: ParamInspection[];
    counts: {
        total: number;
        known: number;
        unknown: number;
        unconfirmed: number;
    };
    /** Suggested curated registry row (codec + extra caps + name). */
    suggestedRegistry: {
        model: string;
        entry: RegistryEntry;
        exists: boolean;
    };
    /** Paste-ready `registry.ts` line. */
    registrySnippet: string;
    /** Paste-ready param-dictionary lines for the unknown params. */
    dictionarySnippet: string;
}
/**
 * Inspect a cloud device record and produce the enrichment report. `rec.params` should be the
 * device's reported `param_type → value` map (e.g. from the device list / get_device_param_list).
 */
export declare function inspectParams(rec: CloudRecord, sn?: string): DeviceInspection;
