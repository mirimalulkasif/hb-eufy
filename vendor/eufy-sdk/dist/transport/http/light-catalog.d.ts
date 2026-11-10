/**
 * Light-effect **catalogue** over the vendor's `light` HTTP service — `/app/light/discover/list`,
 * `/app/light/lighteffect/batchget` and `/app/light/aigc/recommend/list`, with their response parsing.
 * `light` here is the service path the vendor publishes, which is why this sits with the rest of the
 * HTTP surface.
 *
 * This module fetches a catalogue definition; `transport/dp-preset.ts` turns one into wire fields, and
 * sits at the transport root because both this and the MQTT router serialize through it.
 *
 * The catalogue is keyed by numeric id throughout and carries no model vocabulary.
 */
import type { MegaHttpClient } from "./mega-client.js";
import type { DpPresetSpec } from "../dp-preset.js";
/**
 * One entry in the light-effect gallery — the browsable catalogue behind {@link listLightEffects}.
 * `buildable` says whether the entry's definition can be turned into wire fields at all: false when it
 * carries no layers, or a layer shape this SDK cannot encode.
 */
export interface LightEffectSummary {
    /** The catalogue id that identifies this effect on the wire. */
    lightId: number;
    /** Display name from the catalogue (e.g. "Presidents Day"), when present. */
    name?: string;
    /** Preview swatch — `"RRGGBB|RRGGBB…"` — when the catalogue entry carries one. */
    colors?: string;
    /** Whether this entry can be serialized to wire fields. */
    buildable: boolean;
}
/**
 * Browse the light-effect gallery — the catalogue of `lightId`s that `setEffect` accepts. Unions every
 * scene/light id found anywhere in the `/app/light/discover/list` carousel (walked recursively) with a
 * scan over the default `LIGHT_EFFECT_ID_WINDOW` (the dense id band holding the app's category tabs) plus any
 * `ids` given, then resolves them via `/app/light/lighteffect/batchget` (which returns an entry only
 * for ids that exist). Pass `idRange` to widen/narrow the scan or `ids` to fetch specific ones.
 *
 * `batchget` is issued in chunks of `BATCHGET_CHUNK` (100) ids — the scanned set runs to the hundreds,
 * so one request does not swallow it whole.
 */
export declare function listLightEffects(mega: MegaHttpClient, opts?: {
    idRange?: [number, number];
    ids?: number[];
}): Promise<LightEffectSummary[]>;
/**
 * List the **AI-generated ambient scenes** ("aigc") — e.g. "Enchanting Starry Night", "Moonlit
 * Serenity". A DIFFERENT resource from {@link listLightEffects}'s id-addressable catalogue:
 * `/app/light/aigc/recommend/list` returns scene **keywords only, with NO `lightId`**, so they can't be
 * driven through `setEffect` — the app turns a chosen keyword into an applied effect via a server-side
 * generate step the SDK hasn't reversed yet. Surfaced for visibility. Needs a `region` (400s
 * without one) and, for some accounts, a device `sn`; `region` defaults to `"eu"` (the endpoint
 * returned an identical list across every shard tried).
 */
export declare function listAiSceneRecommendations(mega: MegaHttpClient, opts?: {
    region?: string;
    sn?: string;
}): Promise<string[]>;
/**
 * Fetch a gallery effect by exact catalog `lightId` and parse it into the {@link DpPresetSpec} the
 * MQTT router serializes — the "Auto inside setEffect" resolution. Matches the EXACT id (never
 * substitutes a neighbour — the DP write is fire-and-forget). Only effects with directly-serializable
 * `params.layer` data are supported; flat/grouped entries throw a clear error rather than emit a guess.
 */
export declare function resolveLightEffect(mega: MegaHttpClient, lightId: number): Promise<DpPresetSpec>;
