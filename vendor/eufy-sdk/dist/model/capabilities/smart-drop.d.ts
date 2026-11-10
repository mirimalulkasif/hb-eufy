import { type Surface } from "./members.js";
import type { CapabilityModule } from "./types.js";
/**
 * Every `smart_drop` feature, declared once.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const SMART_DROP_MEMBERS: {
    /**
     * Opens the lid with `SET_PAYLOAD` 2100 at level 2. Verified on a standalone T8790, whose cipher has
     * only an RSA key: the frame sealed AES-128-ECB opened the lid, the same frame at level 1 did not.
     */
    readonly openLid: import("./members.js").MethodMember<() => Promise<void>>;
};
/** Bound SmartDrop controls — the object returned by `dev.smartDrop()`. */
export type SmartDropActions = Surface<typeof SMART_DROP_MEMBERS>;
/** `smart_drop` — a standalone SmartDrop (T8790) parcel box: open the lid. */
export declare const SMART_DROP: CapabilityModule;
