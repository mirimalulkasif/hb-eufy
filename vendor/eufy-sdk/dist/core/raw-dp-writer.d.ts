/**
 * Writer for the structured, base64-encoded values some device data points carry in place of a plain
 * scalar — the mirror of the `RawDpCodec` reader in `./contracts.ts`.
 *
 * Hand-rolling a write's bytes is where silent wire bugs come from, and the nesting gets deep fast: a
 * dock command wraps a `oneof` two levels deep, a clean-parameter write nests three, and a room-select
 * carries a repeated sub-message. On a fire-and-forget write, a bad frame is indistinguishable from
 * success.
 *
 * **What this is not.** It is not a protobuf library and does not want to be. There is no schema, no
 * field-name lookup, no wire-type inference from a declared type: the caller states the field number and
 * the shape, exactly as the reader states the field number it wants back. That keeps the model layer
 * free of `protobufjs` (an architecture rule, not a preference — the model layer may not take transport
 * dependencies) and keeps the whole encoder small enough to read in one sitting.
 *
 * **Framing.** {@link RawDpWriter.finish} emits `varint(bodyLength) ++ body`, base64-encoded — the same
 * envelope `RawDpCodec.decode` expects, which is what makes a round-trip through the two a real test.
 *
 * @module core/raw-dp-writer
 */
/**
 * Encode an unsigned integer as a base-128 varint, low group first with the continuation bit set on
 * every group but the last.
 *
 * Takes a `number` and rejects anything that is not a non-negative safe integer, rather than silently
 * truncating: JavaScript's bitwise operators are 32-bit, so a naive shift-based loop wraps above 2³¹
 * and would emit a plausible-looking frame for the wrong value. Division keeps the full safe-integer
 * range available and the guard makes the boundary explicit instead of surprising.
 */
export declare function encodeVarint(value: number): number[];
/**
 * ZigZag-encode a signed integer, mapping small negatives onto small unsigned values so a `sint32`
 * costs one byte rather than ten.
 *
 * The clean line needs this for map coordinates, which are signed centimetres and routinely negative —
 * a robot sent to a point encoded as a plain varint goes somewhere real and wrong. Kept separate from
 * {@link encodeVarint} because the choice belongs to the field's declared type, which only the caller
 * knows: `int32` and `sint32` are the same wire type and encode the same number differently.
 */
export declare function zigzag(value: number): number;
/**
 * Builds one protobuf message body, field by field.
 *
 * A field's number and shape are given at the call site, which is the same contract the reader offers in
 * reverse. Nothing here validates that a field number suits the message being built — this layer does
 * not know what message that is, and the capability that does states it in its own field-number table.
 *
 * **Zero-valued fields are the caller's decision, not this writer's.** proto3 omits them by default and
 * a device reads an absent field as its zero, so emitting `0` explicitly and omitting it usually mean
 * the same thing — but not always, and only the capability knows which. {@link int} therefore writes
 * exactly what it is given, and omitting the call is what leaves the field absent.
 */
export declare class RawDpWriter {
    private readonly body;
    /** A varint-valued field (`int32`, `uint32`, `bool`, an enum member). */
    int(field: number, value: number): this;
    /** A signed varint field (`sint32`, `sint64`), ZigZag-encoded — see {@link zigzag}. */
    sint(field: number, value: number): this;
    /** A boolean field, on protobuf's own terms: `1` or `0` in a varint. */
    bool(field: number, value: boolean): this;
    /** A length-delimited field carrying raw bytes — a string, a blob, or a message built elsewhere. */
    bytes(field: number, value: Uint8Array | readonly number[]): this;
    /**
     * A nested sub-message, built by `build` into a writer of its own.
     *
     * The sub-message is emitted even when `build` writes nothing into it. That is not an oversight: an
     * EMPTY sub-message is how these protocols say "this subsystem exists and is in its zero state", as
     * opposed to saying nothing about it, and the readers on the other side of this file depend on the
     * distinction. Omitting the call is what says nothing about it.
     */
    sub(field: number, build: (w: RawDpWriter) => void): this;
    /** The message body on its own, unframed — for nesting into another writer. */
    toBytes(): readonly number[];
    /**
     * The finished DP value: `varint(bodyLength) ++ body`, base64-encoded.
     *
     * This is the envelope `RawDpCodec.decode` unwraps, so a value produced here and read back through the
     * codec is a genuine round-trip rather than two implementations of the same guess.
     */
    finish(): string;
}
/** Build a DP value in one expression: `rawDp((w) => w.int(1, 6).int(2, seq))`. */
export declare function rawDp(build: (w: RawDpWriter) => void): string;
