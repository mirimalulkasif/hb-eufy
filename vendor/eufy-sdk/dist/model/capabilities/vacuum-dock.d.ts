import type { RawDpCodec } from "../../core/contracts.js";
import type { ParamValue } from "../types.js";
import { type Surface } from "./members.js";
import type { AvailabilityContext, CapabilityModule } from "./types.js";
/**
 * The DP 169 property name the ROBOT's own readings borrow, and the id carrying it.
 *
 * `DeviceInfo` is one message spanning two capabilities: the dock's firmware sits at field 11 and the
 * robot's MAC, SSID and IP sit beside it. The one-owner rule is per product line, so one of the two has
 * to own the id — this capability does, because it claimed it first and because moving it would break a
 * shipped surface. The clean capability names this pair to read the rest. Exported so the far side
 * cites a constant rather than retyping a string and a number that must agree.
 */
export declare const VACUUM_DOCK_INFO_SOURCE: {
    readonly property: "dockFirmwareVersion";
    readonly param: 169;
};
/**
 * Decode the DOCK's firmware version from `DeviceInfo` (DP 169).
 *
 * `undefined` covers every way it is not stated: no codec, a payload that does not decode, a robot not
 * currently docked (no `station` block), or a dock that reports the block without a version. A
 * length-delimited `string` arrives as bytes, so the value is read back as UTF-8.
 * @internal
 */
export declare function decodeDockFirmware(raw: ParamValue | undefined, codec: RawDpCodec | undefined): string | undefined;
/**
 * Every value {@link DockActivity} can take — the read's declared domain, so the schema a caller reads
 * and the type it compiles against are the same list rather than two that can drift.
 *
 * Published alongside {@link DockActivity} so the members are reachable as data at runtime, not only
 * at compile time.
 */
export declare const DOCK_ACTIVITIES: readonly ["idle", "washing", "drying", "descaling", "emptyingDust", "addingWater", "recyclingWater", "makingDisinfectant", "cuttingHair", "unknown"];
/**
 * What the dock is doing — what `dev.vacuumDock()?.dockState` reports.
 *
 * A dock services several subsystems, so more than one can be busy at once; this answers the single
 * most specific one — a subsystem that is running beats the mop system's own mode. `"unknown"` covers
 * a state value outside the set the dock's own status message declares.
 */
export type DockActivity = (typeof DOCK_ACTIVITIES)[number];
/**
 * Decode a `StationResponse` (DP 173) Raw-DP value to the {@link DockActivity} the dock reports.
 *
 * Answers `undefined` for every way the dock has not stated an activity — an unbound device (no
 * codec), a payload that does not decode, or one carrying no `status` message at all. That is distinct
 * from `"idle"`, which is the dock actively saying it has nothing running, and from `"unknown"`, which
 * is a state value this does not have a name for.
 * @internal
 */
export declare function decodeDockActivity(raw: ParamValue | undefined, codec: RawDpCodec | undefined): DockActivity | undefined;
/**
 * Build a `StationRequest` carrying one manual dock command.
 *
 * Every one of these is the same two-level frame with a different inner field, so one builder serves
 * them all and each member names only its command.
 *
 * **Reversed from the vendor's `station.proto`, NOT confirmed on a device.** Every member built on this
 * carries `unverified`, so no setter is installed and the frame ships as documentation rather than as a
 * callable control. An AIoT DP write is not refused by a router guard — it reaches the robot — and a
 * fire-and-forget write that is wrong looks exactly like success, so the frame being plausible is not
 * the bar. One `publishDps` capture per verb is what flips it.
 * @internal
 */
export declare function encodeStationCommand(command: number): string;
/**
 * Every `vacuum_dock` feature, declared once.
 *
 * DP 173 is confirmed in the `get_product_data_point` catalog (raw, rw) as `baseStation`. The read
 * side answers a typed {@link DockActivity} through {@link decodeDockActivity}. The write side
 * (`StationRequest`) is a different message on the same DP and is not confirmed on a device — those
 * members carry `unverified` with no `write` field, so no setter is installed and the intent path
 * throws rather than guessing a frame.
 * @internal
 */
export declare const VACUUM_DOCK_MEMBERS: {
    /**
     * The DOCK's firmware version (DP 169, `DeviceInfo.station.software`) — distinct from
     * `info.firmwareVersion`, which is the robot's and comes off the cloud device record.
     *
     * `undefined` while the robot is not docked: the vendor only fills the station block when the robot
     * is powered on at the dock, so an absent value is normal rather than a fault.
     */
    readonly dockFirmwareVersion: {
        readonly param: 169;
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => string | undefined;
        readonly decodedKind: "text";
        readonly description: string;
    };
    /**
     * What the dock is doing (DP 173, `StationResponse`) — washing or drying mops, emptying the bin,
     * moving water, or idle.
     *
     * `undefined` means the dock has not stated an activity: the payload carried no `status` message, or
     * the device is not bound to a codec. That is not the same as `"idle"`, which is the dock saying it
     * has nothing running.
     */
    readonly dockState: {
        readonly param: 173;
        readonly type: "string";
        readonly provenance: "mega";
        readonly decode: (raw: unknown, codec: RawDpCodec | undefined) => "addingWater" | "cuttingHair" | "descaling" | "drying" | "emptyingDust" | "idle" | "makingDisinfectant" | "recyclingWater" | "unknown" | "washing" | undefined;
        readonly decodedKind: "enum";
        readonly decodedValues: readonly ["idle", "washing", "drying", "descaling", "emptyingDust", "addingWater", "recyclingWater", "makingDisinfectant", "cuttingHair", "unknown"];
        readonly description: string;
    };
    /**
     * Empty the dust bin into the dock. Write side of DP 173 — `StationRequest.manual_cmd.go_collect_dust`.
     *
     * The frame is built and reviewable; the member stays `unverified`, so no setter is installed and
     * the intent path refuses it. What is missing is a capture, not the message shape.
     */
    readonly emptyDust: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Empty the dust bin (DP 173 StationRequest.manual_cmd.go_collect_dust). Frame reversed from the vendor proto; unverified until captured on a device.";
    };
    /**
     * Wash the mops in the dock — `StationRequest.manual_cmd.go_selfcleaning`. Same standing as
     * {@link VACUUM_DOCK_MEMBERS.emptyDust}: frame built, not yet captured, so no setter is installed.
     */
    readonly washMops: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Wash the mops (DP 173 StationRequest.manual_cmd.go_selfcleaning). Frame reversed from the vendor proto; unverified until captured on a device.";
    };
    /**
     * Dry the mops in the dock — `StationRequest.manual_cmd.go_dry`. Frame built, not yet captured.
     */
    readonly dryMops: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Dry the mops (DP 173 StationRequest.manual_cmd.go_dry). Frame reversed from the vendor proto; unverified until captured on a device.";
    };
    /**
     * Run the dock's full deep self-clean cycle — `StationRequest.manual_cmd.self_maintain`.
     *
     * The longest-running of these — it occupies the dock for a while.
     */
    readonly selfMaintain: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Run the dock's full self-maintenance cycle (DP 173 StationRequest.manual_cmd.self_maintain). Frame reversed from the vendor proto; unverified until captured on a device.";
    };
    /**
     * Run the descaling cycle — `StationRequest.manual_cmd.go_remove_scale`. Only docks that make their
     * own cleaning solution have this; the `available` gate is family-wide, so a device without it will
     * simply ignore the frame.
     */
    readonly removeScale: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Run the descaling cycle (DP 173 StationRequest.manual_cmd.go_remove_scale). Frame reversed from the vendor proto; unverified until captured on a device.";
    };
    /**
     * Run the hair-cutting cycle on the brush — `StationRequest.manual_cmd.go_cut_hair`.
     */
    readonly cutHair: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly write: () => import("../../core/contracts.js").Command;
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly provenance: "mega";
        readonly description: "Run the hair-cutting cycle (DP 173 StationRequest.manual_cmd.go_cut_hair). Frame reversed from the vendor proto; unverified until captured on a device.";
    };
};
/**
 * Bound Omni dock controls — the object returned by `dev.vacuumDock()`.
 *
 * `dockState` reads as a typed {@link DockActivity}. All write members (`emptyDust`, `washMops`,
 * `dryMops`) are `unverified` with no `write` field: the `StationRequest` wire is not confirmed on a
 * device, so no setter appears on the surface until it is. The surface will fill out as writes are
 * confirmed.
 */
export type VacuumDockActions = Surface<typeof VACUUM_DOCK_MEMBERS>;
/** `vacuum_dock` — Omni dock controls (auto-empty, mop wash, mop dry) for the RoboVac X10 Pro Omni (T2351). */
export declare const VACUUM_DOCK: CapabilityModule;
