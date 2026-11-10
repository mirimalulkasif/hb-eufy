import { type Surface } from "./members.js";
import type { CapabilityModule, CommandContext } from "./types.js";
import type { Command } from "../../core/contracts.js";
/**
 * The P2P **feature-command ids** this pan-tilt capability drives. Capability-owned wire vocabulary
 * (transport forwards `cmd.param` opaquely; full id→name catalog in the generated
 * `transport/p2p/commands.ts`). Distinct from the {@link PTZ_ROTATE} direction map below (which is
 * `rotate_type` 1..4, not a command id).
 *
 * Ids + envelopes are taken from the V6 app's own command builders (the `Set*Parser`/`*PositionsParser`
 * classes in the decompiled JS), which is this project's wire ground truth — NOT a third-party
 * catalogue, whose PTZ labels are known-wrong here (one labels 6038 a rotate; the app sends it as a
 * span-cruise preview).
 */
export declare const PTZ_CMD: {
    /** Rotate. App `SetPtz…`/`INDOOR_ROTATE`: 1700 wrapper, `{cmd_type,rotate_type,zoom}`. */
    readonly PTZ_ROTATE: 6030;
    /** Digital zoom. App `SetPictureZoomParser` (`COMMAND_DUAL_CAMERA_ZOOM`): 1350 SET_PAYLOAD sub-command,
     * payload `{x,y,w,h,offset,orgZoom,dstZoom}`. Also the inbound `1351` zoom-notify `cmd`. */
    readonly PTZ_ZOOM: 6203;
    /** Go to a stored preset — AND the save-preset frame (identical bytes; the camera moves vs creates
     * by whether the slot is occupied). App `SetPresetPositionsParser` (`COMMAND_INDOOR_SPAN_CRUISE_POINT`):
     * 1700 wrapper, `{settingstate:0, value:<presetId>}`. */
    readonly PTZ_PRESET_GOTO: 6032;
    /** Capture the camera's current frame as a preset's thumbnail. App `COMMAND_APP_SPAN_PTZ_PIC`: 1700
     * wrapper, `{value:<presetId>}`. The app sends this right before the 6032 save when creating a preset. */
    readonly PTZ_PRESET_PIC: 6097;
    /** Delete a stored preset. App `DeletePresetPositionsParser` (`COMMAND_INDOOR_SPAN_CRUISE_DELETE`):
     * 1700 wrapper, `{value:<presetId>}`. */
    readonly PTZ_PRESET_DELETE: 6033;
    /** List stored presets. App `QueryPresetPositionsParser` (`COMMAND_INDOOR_SPAN_CRUISE_QUERY`): 1700
     * request whose reply is a `1351` notify carrying `{points:[…]}`. */
    readonly PTZ_PRESET_QUERY: 6034;
    /** Preview a stored preset — move to it transiently (the app uses this to show a preset before
     * committing a default). App `COMMAND_INDOOR_SPAN_CRUISE_PREVIEW`: 1700 wrapper, `{value:<presetId>}`. */
    readonly PTZ_PRESET_PREVIEW: 6035;
    /** Mark a stored preset as the default/home position. App `DefaultPresetPositionsParser`
     * (`COMMAND_APP_SET_DEFAULT_POSITION`): 1350 SET_PAYLOAD, payload `{index:<presetId>, settingstate}`.
     * A compound builder — the app follows it with PREVIEW (6035) + PTZ_PIC (6097) to refresh the
     * thumbnail; the default-set itself is this frame. */
    readonly PTZ_SET_DEFAULT_POSITION: 6242;
    /** How fast a rotate STEP travels. 1700 wrapper, `{value:1|3|5}`. Observed live: the app's
     * Slow/Mid/Fast control on an indoor pan-tilt writes 1 / 3 / 5 and nothing else moves. The id sits
     * inside the smart lock's `601x` block, so the shared param dictionary labels it `lockParam` — an id
     * reused across product lines, and the camera's meaning is the observed one. */
    readonly PTZ_ROTATE_SPEED: 6015;
};
/**
 * Optional digital-zoom crop window for `zoom`. The app's `SetPictureZoomParser`
 * carries a region alongside the target factor; when `offset` is false the region is ignored and the
 * zoom is centred (x/y/w/h sent as 0). Coordinates are the app's own normalised values — pass them
 * through only when mirroring a captured region.
 */
export type ZoomRegion = {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    /** When true, the x/y/w/h crop is applied; when false (default) the zoom is centred. */
    offset?: boolean;
    /** The zoom factor the region is relative to (app default 0). */
    orgZoom?: number;
};
/** One stored PTZ preset, as returned by `list`. Shape follows the app's
 * `query_preset_positions` reply `points[]`; fields beyond `id` vary by model, so the raw entry is
 * preserved. */
export type PtzPreset = {
    /** The preset id used by `goto` / `delete`. */
    id: number;
    /** The raw reply entry, for fields (name/thumbnail/coordinates) that vary by model. */
    raw: Record<string, unknown>;
};
/** A preset's thumbnail, as returned by `image`. Follows the app's
 * `get_preset_position_pic` reply `{data, index}`. */
export type PtzPresetImage = {
    /** The preset id the image belongs to (`-1` if the reply omitted it). */
    index: number;
    /** The thumbnail image payload as the camera delivers it (a base64-encoded JPEG). */
    data: string;
};
/**
 * The preset sub-API — everything that acts on a stored PTZ preset, grouped under `dev.ptz().preset()`.
 * The write verbs are always present; the read verbs (`list`/`image`) are request/reply over P2P and so
 * present only when the device is bound to a live client — call them with `?.`.
 *
 * The `id`-taking write verbs are **fire-and-forget** (P2P sends no ack): referencing an empty slot is
 * a **silent no-op** — the camera ignores it and no error surfaces here. Only `save(id)` populates a
 * slot; `goto`/`preview`/`setDefault`/`delete` on an unpopulated `id` do nothing. Check `list?()` first
 * if the id might not exist.
 */
export type PtzPresetActions = {
    /** Move to the stored preset `id`. No-op if `id` isn't a saved preset (see the type note). */
    goto(id: number): Promise<void>;
    /** Preview the stored preset `id` — move to it transiently (the app's pre-default preview). No-op if
     * `id` isn't a saved preset. */
    preview(id: number): Promise<void>;
    /** Save the camera's current position into preset `id` (thumbnail + save). Creates the preset when
     * the slot is empty, overwrites it when occupied. */
    save(id: number): Promise<void>;
    /** Promote a preset to the default/home position. Sets the default to the preset the camera is
     * **currently parked on**, so the sequence is `preview(id)` → wait for the pan to finish →
     * `setDefault(id)`; sent with the camera elsewhere it has no effect. */
    setDefault(id: number): Promise<void>;
    /** Delete the stored preset `id`. No-op if `id` isn't a saved preset. */
    delete(id: number): Promise<void>;
    /** List the stored presets. Present only when the device is bound to a live client, so call with `?.`. */
    list?(opts?: {
        timeoutMs?: number;
    }): Promise<PtzPreset[]>;
    /** Fetch preset `id`'s thumbnail. Present only when the device is bound to a live client, so call with
     * `?.`. Resolves `undefined` when the reply carried no image data — typically nothing stored for that
     * preset. A reply that never arrives rejects instead. */
    image?(id: number, opts?: {
        timeoutMs?: number;
    }): Promise<PtzPresetImage | undefined>;
};
/**
 * Bound pan/tilt/zoom (PTZ) controls — the object returned by `dev.ptz()`. Movement is
 * command-driven (the camera has no "go to angle X" write; it steps in a direction). Preset operations
 * are grouped under {@link PtzPresetActions} via `preset()` (e.g. `dev.ptz().preset().goto(3)`).
 */
export type PtzActions = Surface<typeof PTZ_MEMBERS>;
/**
 * Rotate direction. `PtzDirection` is both the const value-object (`PtzDirection.left`) and the
 * union type of its values, so callers use the named constant: `rotate(PtzDirection.left)`.
 */
export declare const PtzDirection: {
    /** Pan left (one step). */
    readonly left: "left";
    /** Pan right (one step). */
    readonly right: "right";
    /** Tilt up (one step). */
    readonly up: "up";
    /** Tilt down (one step). */
    readonly down: "down";
};
export type PtzDirection = (typeof PtzDirection)[keyof typeof PtzDirection];
/** Pan-tilt rotate direction → `rotate_type` (the on-wire code). Not re-exported by the barrel —
 * stays internal to the capability. Confirmed on hardware (T8425): 1=left, 2=right, 3=up, 4=down. */
export declare const PTZ_ROTATE: {
    readonly left: 1;
    readonly right: 2;
    readonly up: 3;
    readonly down: 4;
};
/**
 * Pan-tilt rotate as a transport-neutral {@link Command}. CONFIRMED wire command (captured on
 * T8425 ch3 during live-view): `{"commandType":6030,"data":{"cmd_type":1,"rotate_type":1..4,
 * "zoom":1.0}}` under the generic control wrapper `1700` on the camera channel. `cmd_type:1` =
 * move; `zoom` defaults to 1.0.
 *
 * Emitted as a `set-json` intent — the capability names only the param + payload; the transport
 * resolver picks the encryption level by topology (standalone → L1, HomeBase → L2). A PT cam can be
 * either, so the level is NOT fixed here.
 */
export declare function rotateCommand(direction: PtzDirection, ctx: CommandContext, zoom?: number): Command;
/**
 * Digital-zoom as a transport-neutral {@link Command}. The V6 app's `SetPictureZoomParser` builds a
 * `SET_PAYLOAD` (1350) sub-command `COMMAND_DUAL_CAMERA_ZOOM` with the crop-window payload
 * `{x,y,w,h,offset,orgZoom,dstZoom}`; the region collapses to zeros unless `offset` is set. `dstZoom`
 * is the target factor. `mValue3:0` — verified byte-exact against a live capture of the real app's own
 * pinch-zoom gesture; NOT `mValue3:cmd` like the general `SET_PAYLOAD` default (see `setPayload`'s doc).
 */
export declare function zoomCommand(dstZoom: number, ctx: CommandContext, region?: ZoomRegion): Command;
/**
 * Go-to-preset as a transport-neutral {@link Command}. The V6 app's `SetPresetPositionsParser` builds
 * a 1700-wrapper sub-command `COMMAND_INDOOR_SPAN_CRUISE_POINT` with `{settingstate:0, value:<id>}`
 * (the app follows it with a query + thumbnail fetch; the move itself is this frame).
 */
export declare function gotoPresetCommand(id: number, ctx: CommandContext): Command;
/**
 * Delete-preset as a transport-neutral {@link Command}. The V6 app's `DeletePresetPositionsParser`
 * builds a 1700-wrapper sub-command `COMMAND_INDOOR_SPAN_CRUISE_DELETE` with `{value:<id>}`.
 */
export declare function deletePresetCommand(id: number, ctx: CommandContext): Command;
/**
 * Preview-preset as a transport-neutral {@link Command}. The V6 app's `COMMAND_INDOOR_SPAN_CRUISE_PREVIEW`
 * sub-command carries `{value:<id>}`; the app moves the camera to preset `id` to preview it (decoded on
 * a T8170 SoloCam: `{"commandType":6035,"data":{"value":3}}`).
 */
export declare function previewPresetCommand(id: number, ctx: CommandContext): Command;
/**
 * Capture-current-frame-as-thumbnail as a transport-neutral {@link Command}. The V6 app's
 * `COMMAND_APP_SPAN_PTZ_PIC` sub-command carries `{value:<id>}`; the app emits it immediately before
 * the 6032 save when creating a preset (see {@link savePresetCommand}).
 */
export declare function presetPicCommand(id: number, ctx: CommandContext): Command;
/**
 * Save the camera's CURRENT position into preset `id`, as the two frames the V6 app emits to create a
 * preset (decoded on a T8170 SoloCam): `COMMAND_APP_SPAN_PTZ_PIC {value:id}` (thumbnail) then
 * `COMMAND_INDOOR_SPAN_CRUISE_POINT {settingstate:0, value:id}` (save). The save frame is byte-identical
 * to {@link gotoPresetCommand}; the camera creates vs moves by whether slot `id` is occupied.
 */
export declare function savePresetCommand(id: number, ctx: CommandContext): [Command, Command];
/**
 * Promote a stored preset to the default/home position, as a transport-neutral {@link Command}. The V6
 * app's `DefaultPresetPositionsParser` builds a 1350 SET_PAYLOAD `COMMAND_APP_SET_DEFAULT_POSITION`
 * `{index:<presetId>, settingstate:0}`.
 *
 * 6242 sets the default to the preset the camera is **currently parked on**. To move the default, park
 * the camera on `presetId` first — `preview(presetId)`, let the pan finish, then `setDefault(presetId)`.
 * Sent while the camera is elsewhere, it has no effect.
 *
 * Level-2 only, unlike `zoom` beside it: this frame carries the envelope's DEFAULT `mValue3` (the
 * sub-command), which the level-1 form cannot express — it writes 0. Downgrading it would send an
 * object nothing has captured, so it stays pinned and is unreachable on a keyless standalone camera
 * until one is. See `setPayload`'s two conditions.
 */
export declare function setDefaultPositionCommand(presetId: number, ctx: CommandContext): Command;
/**
 * Parse a `query_preset_positions` reply (`{points:[…]}`) into {@link PtzPreset}s. Mirrors the app's
 * `query_preset_positions_parse_payload`, which reads the reply's `points` array. The id field is
 * `index` — confirmed live on a T8171 SoloCam, whose reply entries are
 * `{index, enable, zoom, isdefault}` (8 slots, `enable:0` = empty). `id`/`value` are accepted as
 * fallbacks for other models; the full entry is preserved as `raw`.
 */
export declare function parsePresetPoints(reply: Record<string, unknown> | undefined): PtzPreset[];
/**
 * Parse a `get_preset_position_pic` reply into a {@link PtzPresetImage}. Mirrors the app's
 * `get_preset_position_pic_parse_payload`, which reads `{data, index}` off the notify (`data` = the
 * thumbnail, `index` defaults to `-1`). Returns `undefined` when the reply carries no image.
 */
export declare function parsePresetImage(reply: Record<string, unknown> | undefined): PtzPresetImage | undefined;
/**
 * Every `ptz` feature, declared once.
 *
 * Movement is command-driven, so almost every entry is a `method`: `rotate` takes a direction plus an
 * optional speed, the four compass verbs take nothing, `preset()` returns a whole sub-API, and `zoom`
 * is gated on the device having a second lens. `rotationSpeed` is the one value member — the camera's
 * own step speed, which it stores. There is no position member: no device reports where it is pointed
 * as a parameter. Position arrives only while the camera moves, as the `ptzNotify` event {@link PTZ}
 * decodes from a live frame.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const PTZ_MEMBERS: {
    /**
     * How fast a rotate STEP travels, on the app's own three-position control: `1` slow, `3` mid, `5`
     * fast. A `scalar` rather than an enum — the endpoints and the midpoint are observed, so 2 and 4 are
     * a prediction of the scale's shape and the wire is not known to reject them.
     *
     * Not the same thing as `rotate`'s `zoom` argument, which scales one step's SIZE rather than its
     * speed.
     *
     * The parameter is **absent until first written**: a camera whose speed has never been set reports
     * no `6015` at all, so the getter is installed only once the value exists — an absent reading is "not
     * configured", never "unsupported".
     */
    readonly rotationSpeed: {
        readonly param: 6015;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /** Rotate a step in a direction; `zoom` scales the step size (1.0 = the default step). */
    readonly rotate: import("./members.js").MethodMember<(direction: PtzDirection, zoom?: number) => Promise<void>>;
    /** Rotate one step left. */
    readonly left: import("./members.js").MethodMember<() => Promise<void>>;
    /** Rotate one step right. */
    readonly right: import("./members.js").MethodMember<() => Promise<void>>;
    /** Rotate one step up. */
    readonly up: import("./members.js").MethodMember<() => Promise<void>>;
    /** Rotate one step down. */
    readonly down: import("./members.js").MethodMember<() => Promise<void>>;
    /**
     * Zoom rides a SECOND (telephoto) lens, so it is offered only where the device shows zoom evidence —
     * otherwise `dev.ptz()?.zoom` would be a silent no-op on a single-lens pan-tilt camera.
     */
    readonly zoom: import("./members.js").MethodMember<(dstZoom: number, region?: ZoomRegion) => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
    /**
     * The preset sub-API. Write verbs dispatch through the sink; the READ verbs (`list`/`image`) are P2P
     * request/reply and exist only when bound to a media provider — the transport stays
     * capability-agnostic (it runs a generic control-payload query and resolves the correlated notify)
     * while this module owns the sub-command id and the reply parsing.
     *
     * `answers` because calling it performs nothing: it hands back the namespace the verbs live on. Offering
     * it as a control would produce one that returns an object and does nothing.
     */
    readonly preset: {
        readonly method: (deps: import("./members.js").MemberDeps) => () => PtzPresetActions;
        readonly description: string;
        readonly available?: (ctx: CommandContext) => boolean;
        readonly args?: readonly import("./types.js").ActionArgSpec[];
        readonly answers: true;
    };
};
export declare const PTZ: CapabilityModule;
