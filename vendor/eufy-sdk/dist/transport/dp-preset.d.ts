/**
 * `0x020D` light-effect payload serializer for the `eufy_life` smart-light line: the catalog effect
 * definition ({@link DpPresetSpec}) → the command-specific DP fields, including the per-layer
 * header/colour/trailer encoding and the RGBCW colour approximation.
 *
 * Lives at the transport root, not under one transport folder, because two consumers need it and they
 * sit in different subfolders: `mqtt/command-router.ts` serializes an effect to send it, and
 * `http/light-catalog.ts` trial-serializes one to report whether the catalog entry is drivable at all.
 * Same reason `ff09.ts` sits here. It builds FIELDS, not a frame — the DP framing + envelope stay in
 * `mqtt/dp-codec.ts`, and nothing here names a capability or a transport.
 *
 * Header + trailer are byte-exact vs. real captures; colours run through {@link rgbcwBlock}, a
 * physically-grounded approximation of the device's on-device 5-channel (R,G,B,WarmWhite,ColdWhite)
 * mixing engine — EXACT on pure red and blue, ~18/255 mean on mixed colours, because the engine's
 * nonlinear gamut expansion isn't fully reversed.
 */
import type { DpField } from "./mqtt/dp-codec.js";
/** One layer of a gallery light effect, as the cloud catalog `params.layer[]` describes it. */
export interface DpPresetLayer {
    current_layer_type: number;
    colors?: string;
    layer_priority?: number;
    layer_speed?: number;
    layer_range?: number | [number, number];
    interval_type?: number;
    interval_value?: number;
    layer_execution_parameter?: number;
    light_effect_post_cycle_status?: number;
    color_pick_mode?: number;
    gradient_value?: number;
    flow_direction?: number;
    direction_change_mode?: number;
    length_range?: number;
    color_fill_mode?: number;
    insert_block_mode?: number;
    insert_block_range?: number | [number, number];
    insert_black_block_mode?: number;
    insert_black_block_range?: number | [number, number];
    brightness_variation_type?: number;
    brightness_range?: number | [number, number];
    light_effect_cycle_method?: number;
    execution_parameter?: number;
    is_lights_move_with_people?: number;
    brightness_value?: number;
    display_mode?: number;
    color_quantity_range?: number;
    transition_mode?: number;
    unit_transition_duration?: number;
    color_switch_mode?: number;
    switch_count?: number;
    color_pick_sequence?: number;
    blink_cycle_count?: number;
    blink_position_mode?: number;
    blink_interval?: number | [number, number];
    blink_quantity?: number;
    blink_asynchrony?: number;
    blink_color_switch_mode?: number;
}
/** A resolved gallery effect, produced by the client (from the HTTP catalog) and serialized here. */
export interface DpPresetSpec {
    lightId: number;
    speed: number;
    layerExecutionMode: number;
    layers: DpPresetLayer[];
    /** The catalog's own overall brightness (0-100), sent as a companion `0x0201` frame. */
    brightness?: number;
}
/** "RRGGBB" → the 5-byte wire block `[R,G,B,WarmWhite,ColdWhite]` via the RGBCW approximation. */
export declare function rgbcwBlock(hex: string): Buffer | null;
/**
 * A single scalar byte. THROWS on an array: several catalog fields are scalar in the shapes the
 * reverse-engineering validated, but some nature/moods effects carry a `[min,max]` pair in one of
 * these slots (e.g. `interval_value: [1,1]`), and how the app packs that into the fixed-width header
 * is NOT reversed. Silently collapsing the pair to a byte would ship a mis-packed frame that the light
 * ignores while the fire-and-forget write reports success — worse than failing. Refuse it, exactly as
 * {@link layerTrailer} bails on an unknown layer type, until a capture pins the packing down.
 */
export declare const b8: (v: unknown) => number;
/**
 * Whether {@link dpPresetFields} would succeed on this spec, decided WITHOUT building the frame.
 * An effect is drivable only if it has at least one layer, every top-level scalar fits a byte, and
 * every layer has a known `current_layer_type`, byte-sized fields, and RGB-hex colours — the same set
 * {@link dpPresetFields} accepts, checked field-for-field.
 *
 * Deliberately does not call {@link layerBlob}: a trial build runs {@link rgbcwBlock}'s gamut search
 * per colour and allocates a buffer per layer, and the catalogue runs this over every entry of a
 * many-hundred-id scan. `layerHeader`/`layerTrailer` raise every relevant throw on plain numbers, and
 * a colour only has to satisfy the same hex test `rgbcwBlock` gates on.
 */
export declare function specIsSerializable(spec: {
    speed?: unknown;
    layerExecutionMode?: unknown;
    layers: readonly DpPresetLayer[];
}): boolean;
/**
 * Build the `0x020D` light-effect frame's command-specific fields (`0xa3` onward — the header
 * `a3`-`a8` plus one `0xa9+idx` layer blob each). `a1`/`a2` are prepended by {@link buildDpFrame}.
 * `a7` is deliberately absent (an empty slot in every real capture).
 */
export declare function dpPresetFields(spec: DpPresetSpec): DpField[];
/** The `0xa4`-brightness `0x0201` device-info fields for the companion brightness write. */
export declare function dpLevelFields(level: number): DpField[];
