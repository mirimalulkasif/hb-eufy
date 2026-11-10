import { isTuyaVacuum } from "../device-family.js";
import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * Every `locate` feature, declared once.
 *
 * `locate()` is a `method` rather than a derived setter because its argument is OPTIONAL — the
 * common call is a bare `locate()` meaning "start beeping" — and a derived setter always takes its
 * value. Dispatches DP 103 (legacy Tuya) or DP 160 (AIoT) based on which DP the device has reported.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const LOCATE_MEMBERS: {
    /**
     * The find-robot DP read back. `writtenElsewhere` rather than carrying its own `write`, because the
     * setter is the `locate` method below — its argument is optional, which a derived setter cannot be.
     * Expect this to read `undefined` on most robots: DP 160 is a momentary trigger, so a device that has
     * never been asked to beep has no value to report and the evidence gate skips the getter entirely.
     */
    readonly locating: {
        readonly param: 160;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "mega";
        readonly writtenElsewhere: true;
        readonly readAliases: readonly [{
            readonly paramType: 103;
            readonly available: typeof isTuyaVacuum;
        }];
        readonly description: string;
    };
    /**
     * Writes DP 160 (AIoT) — `true` starts the beep, `false` cancels one already sounding. AIoT only:
     * the legacy Tuya DP 103 is read as an alias above, but its WRITE direction is unconfirmed, so no
     * Tuya dispatch is offered. The default
     * argument is what makes this a `method`: a bare `locate()` is the call that matters, and a derived
     * setter always demands its value.
     *
     * That default is also why the argument is named here: it is absent from the function's arity, so the
     * description would otherwise derive as taking NO arguments and leave the cancel form undeclared.
     */
    readonly locate: {
        readonly method: (deps: import("./members.js").MemberDeps) => (on?: boolean) => Promise<void>;
        readonly description: string;
        readonly available: ((ctx: import("./types.js").CommandContext) => boolean) & ((ctx: import("./types.js").CommandContext) => boolean);
        readonly answers?: true;
        readonly args: readonly [{
            readonly name: "on";
            readonly kind: "boolean";
            readonly optional: true;
            readonly description: "False cancels a beep in progress.";
        }];
    };
};
/**
 * Bound locate reads and controls — the object returned by `dev.locate()`. The `locating` read is
 * present only when the device has reported DP 160; `locate()` is always present on a bound device.
 */
export type LocateActions = Surface<typeof LOCATE_MEMBERS>;
/** `locate` — make the robot beep to find it. */
export declare const LOCATE: CapabilityModule;
