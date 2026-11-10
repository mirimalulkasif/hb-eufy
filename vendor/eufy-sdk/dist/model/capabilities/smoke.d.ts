import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * Every `smoke` feature, declared once — the property schema and the evidence-gated getters derive from here.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const SMOKE_MEMBERS: {
    /**
     * The alarm flag itself — and the reason this capability is detected by model name rather than by a
     * reported param. 1561 is a `guessed` placeholder: nothing captured from a smoke detector confirms the
     * id or which value means alarming, so the evidence gate installs this getter only on a device that
     * happens to report 1561. Promote it once a capture pins the id, not before.
     */
    readonly smokeDetected: {
        readonly param: 1561;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "guessed";
        readonly description: "Smoke detected. UNVERIFIED: placeholder id pending capture verification.";
    };
    /**
     * Unix seconds at which the detector last checked in — param 1551, the same last-seen id the other
     * sensor capabilities read. A `timestamp` kind takes no `unit`: the number is an instant, not a
     * duration, and declaring `unit: "s"` beside it fails the value-kind spec.
     */
    readonly lastSeen: {
        readonly param: 1551;
        readonly type: "number";
        readonly kind: "timestamp";
        readonly provenance: "verified";
        readonly description: "Last-seen unix timestamp, seconds (verified: param 1551).";
    };
};
/** Bound smoke-detector reads — the object returned by `dev.smoke()`. Read-only. */
export type SmokeActions = Surface<typeof SMOKE_MEMBERS>;
/** `smoke` — smoke detector. Alarm flag is a placeholder pending verification. */
export declare const SMOKE: CapabilityModule;
