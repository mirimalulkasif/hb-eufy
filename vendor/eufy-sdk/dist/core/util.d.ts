/**
 * Small shared utilities used across the SDK.
 */
/**
 * A restartable single-shot timer — the arm / cancel / re-arm pattern the P2P lifecycle repeats in
 * several places (session idle-detach, stream linger, battery budget + its grace, the warm-up
 * deadline). {@link arm} (re)schedules, replacing any pending fire; {@link cancel} clears it; the
 * handle clears itself right before firing so {@link pending} reads `false` inside the callback. The
 * timer is `unref`'d so a pending fire never keeps the process alive.
 */
export declare class Timer {
    private handle?;
    /** (Re)arm to run `fn` after `ms`, cancelling any already-pending fire. */
    arm(ms: number, fn: () => void): void;
    /** Cancel a pending fire. No-op if not armed. */
    cancel(): void;
    /** Whether a fire is currently scheduled. */
    get pending(): boolean;
}
/**
 * Exhaustiveness guard for discriminated unions. Placed in a `switch` `default` (or the else of an
 * `if`-chain) over every variant: if a new variant is added and left unhandled, the call fails to
 * typecheck (its type is no longer `never`), and at runtime it throws instead of silently falling
 * through.
 */
export declare function assertNever(value: never): never;
/**
 * Coerce a property value to a boolean WITHOUT the `Boolean("false") === true` footgun (every
 * non-empty string — including `"false"` and `"0"` — is truthy under `Boolean()`). Only an explicit
 * `true` / `1` / `"1"` / `"true"` (case-insensitive) enables; everything else is `false`.
 */
export declare function asBool(value: unknown): boolean;
/**
 * Round to an integer and clamp into `[min, max]`. For scalar device params that take a bounded int
 * (volume/brightness/color-temp 0..100, etc.), dispatched fire-and-forget — a non-numeric or
 * out-of-range input must never reach the wire as-is. NaN input (e.g. `Number("x")`) fails safe to
 * `min`: `Math.max`/`Math.min` propagate NaN rather than ignoring it, so that has to be checked
 * explicitly, not relied on implicitly.
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Order-insensitive deep structural equality. Used for change detection over decoded param values
 * (`boolean | number | string | object | array`): a re-serialized param whose object keys come back
 * in a different order must NOT read as "changed" (a `JSON.stringify` compare is key-order sensitive
 * and flaps). Primitives compare with `Object.is` (so `NaN === NaN`, `+0 !== -0`); arrays compare
 * length then elementwise; plain objects compare the same key set recursively; anything else
 * (functions, class instances, Buffers, …) falls back to `Object.is`.
 */
export declare function structuralEqual(a: unknown, b: unknown): boolean;
/**
 * Coerce `value` to one of the numeric values of a fixed enum-object (e.g. `Watermark`,
 * `HubAlarmTone`, `DoorbellRingtone`), or `undefined` if it isn't one. Unlike `clamp` (for a
 * continuous range), an enum has a small fixed set of real options — silently rounding/clamping a bad
 * index to the nearest valid one would send a WRONG-but-plausible value on a fire-and-forget write,
 * not a safe default. Anything outside the set is rejected instead.
 */
export declare function coerceEnumValue(enumObj: Record<string, number>, value: unknown): number | undefined;
/** The valid values of an enum-object, `/`-joined — for the "not a valid option (valid: 0/1/2)" errors. */
export declare function enumValues(enumObj: Record<string, number>): string;
/**
 * Invert an enum-object (`name → wire value`) into the `raw → label` form a published option set
 * takes, so a named set is declared ONCE — as the enum callers write against — and the published
 * domain cannot drift from it.
 */
export declare function enumLabels(enumObj: Readonly<Record<string, number>>): Record<number, string>;
/**
 * Parse `text` as a JSON object, or `undefined` on any failure — never throws. Shared by the MQTT
 * and Tuya transport layers; sits here so each module doesn't define its own copy.
 */
export declare function jsonObject(text: unknown): Record<string, unknown> | undefined;
/** 16-bit unsigned, little-endian. */
export declare function u16le(n: number): Buffer;
/** 16-bit unsigned, big-endian. */
export declare function u16be(n: number): Buffer;
/** 32-bit unsigned, little-endian. */
export declare function u32le(n: number): Buffer;
/** 32-bit unsigned, big-endian. */
export declare function u32be(n: number): Buffer;
