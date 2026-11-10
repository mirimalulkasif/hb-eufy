import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * Every `co` feature, declared once — the property schema and the evidence-gated getters derive from here.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const CO_MEMBERS: {
    /**
     * The alarm flag itself — and the reason this capability is detected by model name rather than by a
     * reported param. 1562 is a `guessed` placeholder: nothing captured from a CO detector confirms the id
     * or which value means alarming, so the evidence gate installs this getter only on a device that
     * happens to report 1562. Promote it once a capture pins the id, not before.
     */
    readonly coDetected: {
        readonly param: 1562;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "guessed";
        readonly description: "Carbon-monoxide detected. UNVERIFIED: placeholder id pending capture verification.";
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
/** Bound CO-detector reads — the object returned by `dev.co()`. Read-only. */
export type CoActions = Surface<typeof CO_MEMBERS>;
/** `co` — carbon-monoxide detector. Alarm flag is a placeholder pending verification. */
export declare const CO: CapabilityModule;
