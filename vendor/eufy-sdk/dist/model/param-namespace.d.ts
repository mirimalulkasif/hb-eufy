/**
 * Param namespaces — which id space a device's reported `paramType`s live in.
 *
 * The three spaces overlap numerically and mean unrelated things, so a lookup MUST be namespaced: id
 * `163` is `battery` as a vacuum Tuya DP and `lightLength` as a `eufy_life` DP tag. Resolving a param
 * without its namespace is how one product line's state silently reads as another's.
 *
 * This lives outside `param-dictionary.ts` so the namespace union and the dispatch stay one small table
 * a reader can hold at once, next to the guard that a codec resolves to exactly one namespace — rather
 * than at the head of two thousand entries.
 *
 * @module model/param-namespace
 */
import type { Codec } from "./types.js";
import { type ParamDef } from "./param-dictionary.js";
/** The param id spaces this SDK models. */
export type ParamNamespace = "security" | "clean" | "mower" | "life" | "print" | "display";
/** Look up a param def in the given namespace. */
export declare function paramDef(ns: ParamNamespace, paramType: number): ParamDef | undefined;
/** The param namespace a device's ids live in, from its codec, via the module-local `NAMESPACE_BY_CODEC` table. */
export declare function namespaceForCodec(codec: Codec): ParamNamespace;
