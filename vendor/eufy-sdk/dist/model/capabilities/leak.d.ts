import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * Every `leak` feature, declared once — the property schema and the evidence-gated getters derive from here.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const LEAK_MEMBERS: {
    /**
     * The alarm flag, modelled as state even though the sensor announces a leak as a PUSH EVENT rather
     * than by holding a param — so 1560 is a `guessed` placeholder and the evidence gate will normally
     * leave this getter uninstalled. The push event is the reliable channel for a leak; this read is
     * here so the flag has a home once a capture pins a real id.
     */
    readonly leakDetected: {
        readonly param: 1560;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "guessed";
        readonly description: string;
    };
    /**
     * Unix seconds at which the sensor last checked in — param 1551, the same last-seen id the other
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
/** Bound leak-sensor reads — the object returned by `dev.leak()`. Read-only. */
export type LeakActions = Surface<typeof LEAK_MEMBERS>;
/**
 * `leak` — water/leak (and freeze) sensor. Alarm flag is a placeholder — the T8920 Water & Freeze
 * sensor reports leak via a push event, not a stable param id.
 */
export declare const LEAK: CapabilityModule;
