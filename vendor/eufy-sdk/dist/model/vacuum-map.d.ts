/**
 * The robot's map, as `stream.proto` describes it — the messages that arrive on the `biz/…/res` leg.
 *
 * Six message types carry everything about a map: its size and where it sits in
 * the world, which cell is floor and which is wall, which room each cell belongs to, what those rooms
 * are called and how they are cleaned, and where the user drew a line the robot must not cross. This
 * decodes all six. It does not draw anything: what it hands back is dimensions, coordinates, names and
 * two pixel planes.
 *
 * **Units, once, because every coordinate here shares them.** Distances are centimetres — the vendor
 * writes them as "m × 100" throughout — and `resolution` is the width of one cell in those same
 * centimetres, so a cell at `(col, row)` covers world position `origin + (col, row) × resolution`. An
 * angle is radians × 100. Nothing is converted on the way through: a value the device sent as an
 * integer stays one, because dividing it here would make every caller guess whether it had been.
 *
 * **What is deliberately not read.** `RestrictedZone.suggestion` carries zones the robot has *proposed*
 * and the user has not accepted. Merging them into the real lists would report restrictions the robot
 * is not enforcing, and reporting them as fact is worse than not reporting them at all.
 *
 * @module model/vacuum-map
 */
import type { RawDpCodec } from "../core/contracts.js";
import type { CleanExtent, MopLevel, VacuumCleanType } from "./capabilities/vacuum-clean.js";
/** A position on the map, in centimetres from the map's own origin. */
export interface MapPoint {
    readonly x: number;
    readonly y: number;
}
/** A position with a heading. `theta` is radians × 100, as the device sends it. */
export interface MapPose extends MapPoint {
    readonly theta: number;
}
/** A virtual wall: the segment between two points that the robot will not cross. */
export interface MapLine {
    readonly from: MapPoint;
    readonly to: MapPoint;
}
/**
 * A four-cornered zone, corners in the order the device sent them.
 *
 * Not necessarily a rectangle — the vendor's type is `Quadrangle`, and the app lets a zone be rotated
 * — so the corners describe a polygon and not a bounding box.
 */
export interface MapQuad {
    readonly corners: readonly [MapPoint, MapPoint, MapPoint, MapPoint];
}
/** What a dock is: a bare charging base, or a full station with water and dust handling. */
export declare const DOCK_KINDS: readonly ["charger", "station"];
export type DockKind = (typeof DOCK_KINDS)[number];
/** Where a dock stands, and which kind it is. */
export interface MapDock {
    readonly kind: DockKind;
    readonly pose: MapPose;
}
/**
 * How complete the device considers this map.
 *
 * `"listFull"` is not a quality at all but a notice: the robot has nowhere left to store a new map and
 * is telling the app to replace one or discard this. It shares the field, so it is named here.
 */
export declare const MAP_QUALITIES: readonly ["incomplete", "rough", "effective", "listFull"];
export type MapQuality = (typeof MAP_QUALITIES)[number];
/** Size, placement and quality of a map — the vendor's `MapInfo`. */
export interface VacuumMapGeometry {
    /** Cells across and down. Both are non-zero: a plane without dimensions cannot be indexed. */
    readonly width: number;
    readonly height: number;
    /**
     * The width of one cell in centimetres, or `undefined` when the device omitted it.
     *
     * No default is invented for the absent case. The reference integration substitutes 5 without saying
     * why, and a guessed scale silently misplaces every zone and every room label on the map.
     */
    readonly resolution: number | undefined;
    /** Where cell `(0, 0)` sits, in centimetres. Signed, and routinely negative. */
    readonly origin: MapPoint;
    /** Clockwise rotation the app applies when drawing, in degrees. */
    readonly angle: number;
    readonly quality: MapQuality;
    /** Every dock the device knows about. Empty until the robot has seen one. */
    readonly docks: readonly MapDock[];
}
/** Whether a map frame replaces what came before it, or amends it. */
export declare const MAP_FRAME_KINDS: readonly ["full", "incremental"];
export type MapFrameKind = (typeof MAP_FRAME_KINDS)[number];
/**
 * What one cell of {@link VacuumMapPlane.cells} means, by its two-bit value.
 *
 * Indexed by the value itself, so `MAP_CELL_VALUES[2]` is `"free"`.
 */
export declare const MAP_CELL_VALUES: readonly ["unknown", "obstacle", "free", "carpet"];
export type MapCellValue = (typeof MAP_CELL_VALUES)[number];
/** A map frame — the vendor's `Map`, with its pixel plane decompressed. */
export interface VacuumMapPlane {
    /**
     * Whether this frame is the whole map or an amendment to the last one.
     *
     * **How an `"incremental"` frame is applied is not known.** Nothing states whether it replaces a
     * region, carries its own origin, or assumes the previous frame's geometry. A stale-but-correct map
     * beats one assembled by a guessed rule.
     */
    readonly frame: MapFrameKind;
    /** The device's id for this map. `undefined` when it sent none. */
    readonly mapId: number | undefined;
    /** The map's name, as the user set it. `undefined` when unnamed. */
    readonly name: string | undefined;
    /** The map's revision counter. It advances whenever the map is edited. */
    readonly releases: number;
    /** The frame's position in a sequence, as the device counts it. Zero on a lone frame. */
    readonly index: number;
    readonly geometry: VacuumMapGeometry;
    /**
     * The cell plane, decompressed: **four cells per byte, two bits each, low bits first**, in one run
     * with no row padding. The cell at `(col, row)` is at bit `(i & 3) * 2` of byte `i >> 2`, where
     * `i = row * width + col`, and its value indexes {@link MAP_CELL_VALUES}.
     *
     * Handed over packed rather than expanded. A large map is a megabyte once every cell is its own
     * byte.
     */
    readonly cells: Buffer;
}
/** Which room each cell belongs to — the vendor's `RoomOutline`, with its plane decompressed. */
export interface VacuumRoomOutline {
    readonly mapId: number | undefined;
    readonly releases: number;
    readonly width: number;
    readonly height: number;
    readonly resolution: number | undefined;
    /**
     * Where this plane's cell `(0, 0)` sits, in centimetres.
     *
     * **Its own origin, not the map's.** The two planes are not guaranteed to start at the same world
     * position, so a room lookup under a map cell must convert through world coordinates rather than
     * reusing the index.
     */
    readonly origin: MapPoint;
    /**
     * The room plane: **one byte per cell**, `row * width + col`, no padding — a different packing from
     * {@link VacuumMapPlane.cells}, which the vendor states separately for each.
     *
     * The byte is not the room id on its own. Its low two bits carry a sub-type and the id is the
     * remaining bits, so the room at a cell is `cells[i] >> 2`.
     */
    readonly cells: Buffer;
}
/** What kind of floor a room has, by the vendor's `Floor.Type`. */
export declare const FLOOR_TYPES: readonly ["unknown", "carpet", "wood", "tile"];
export type FloorType = (typeof FLOOR_TYPES)[number];
/** What kind of room this is, by the vendor's `RoomScene.Type`. */
export declare const ROOM_SCENES: readonly ["unknown", "study", "bedroom", "bathroom", "kitchen", "livingRoom", "diningRoom", "corridor"];
export type RoomScene = (typeof ROOM_SCENES)[number];
/**
 * Suction, on the scale the vendor declares for a room's `Fan.suction`.
 *
 * **Not the `SuctionLevel` scale DP 158 uses, and the two must not be unified.** DP 158 reports suction on a six-value
 * scale where 4 is BoostIQ and 5 is Max Pro; `clean_param.proto` declares this field's enum with five
 * values ending at `MAX_PLUS = 4`. They agree from 0 to 3 and disagree at 4, so naming a room's
 * `Fan.suction` through the DP scale would report "BoostIQ" for a room the user set to Max+.
 *
 * A live capture showed DP 158 and `clean_param.fan` moving together, which is why the clean-parameter
 * read treats them as one scale — but that capture only covered 0 and 2, where both scales agree. The
 * divergence above is declared by the vendor, not contradicted by anything observed, so this follows
 * the proto the field is actually declared in.
 */
export declare const ROOM_SUCTIONS: readonly ["quiet", "standard", "turbo", "max", "maxPlus"];
export type RoomSuction = (typeof ROOM_SUCTIONS)[number];
/** The per-room clean settings, when the user has set any. */
export interface VacuumRoomSettings {
    readonly cleanType: VacuumCleanType | undefined;
    readonly suction: RoomSuction | undefined;
    readonly mopLevel: MopLevel | undefined;
    readonly cleanExtent: CleanExtent | undefined;
    /** How many passes this room gets. `undefined` for the vendor's zero, which means "not set". */
    readonly cleanTimes: number | undefined;
}
/** One room on the map. */
export interface VacuumRoom {
    /** The room's id — what the byte in {@link VacuumRoomOutline.cells} resolves to, and what a room-select frame names. */
    readonly id: number;
    /**
     * The name the user gave this room, or `undefined`.
     *
     * `undefined` is common and is not a decode failure: the vendor's own comment says an unnamed room
     * is labelled by the app from {@link VacuumRoom.scene} and {@link VacuumRoom.sceneIndex} — "Kitchen 1",
     * "Bedroom 2" — in the user's language. A host wanting the same label builds it the same way, which
     * it can only do if the absence is reported rather than papered over.
     */
    readonly name: string | undefined;
    readonly scene: RoomScene;
    /** Which room of its kind this is, counting from 1. Pairs with {@link VacuumRoom.scene} to name it. */
    readonly sceneIndex: number;
    readonly floor: FloorType;
    /** Where the room sits in the order the app lists them. */
    readonly order: number;
    /** This room's own clean settings. Only in force while {@link VacuumRoomParams.customEnabled}. */
    readonly settings: VacuumRoomSettings;
}
/** The room list for a map — the vendor's `RoomParams`. */
export interface VacuumRoomParams {
    readonly mapId: number | undefined;
    readonly releases: number;
    /**
     * Whether the per-room settings are in force.
     *
     * When `false` the device cleans every room with the global parameters and each room's
     * {@link VacuumRoom.settings} is inert. The settings are still reported, because they are what the
     * user last chose and what turning this on would restore.
     */
    readonly customEnabled: boolean;
    /** The device's "smart mode" switch, which it reports alongside the rooms. */
    readonly smartMode: boolean;
    readonly rooms: readonly VacuumRoom[];
}
/** Everywhere the user has told the robot not to go — the vendor's `RestrictedZone`. */
export interface VacuumRestrictedZones {
    readonly mapId: number | undefined;
    readonly releases: number;
    /** Lines the robot will not cross. */
    readonly virtualWalls: readonly MapLine[];
    /** Areas the robot will not enter at all. */
    readonly noGoZones: readonly MapQuad[];
    /** Areas the robot may sweep but will not mop. */
    readonly noMopZones: readonly MapQuad[];
}
/** A map's identity, without its pixels — the vendor's `MapDescription`. */
export interface VacuumMapDescription {
    readonly mapId: number | undefined;
    readonly releases: number;
    readonly name: string | undefined;
    /**
     * Why the map exists, as the device's own code. Not translated to names: the vendor ships this as a
     * bare `uint32` with no enum beside it, so any name here would be invented.
     */
    readonly createCause: number;
    /**
     * When the map was made, and when it was last used, as the device sent them.
     *
     * **The unit is not stated.** The field is a `uint64` and could be seconds or milliseconds; both are
     * used elsewhere on this line. A consumer can tell them apart by magnitude far more safely than this
     * decoder can assume one. `undefined` for the vendor's zero, which is "never".
     */
    readonly createdAt: number | undefined;
    /** See {@link VacuumMapDescription.createdAt}. */
    readonly lastUsedAt: number | undefined;
}
/**
 * A whole map in one message — the vendor's `MapBackup`, sent when a map is switched or edited.
 *
 * Every part is optional because the device sends what changed. A backup with only `description` set
 * is a rename, and reading its absent `map` as an empty one would erase a map already held.
 */
export interface VacuumMapBackup {
    readonly description: VacuumMapDescription | undefined;
    readonly map: VacuumMapPlane | undefined;
    readonly outline: VacuumRoomOutline | undefined;
    readonly rooms: VacuumRoomParams | undefined;
    readonly zones: VacuumRestrictedZones | undefined;
}
/** Decode a `MapInfo` message — size, placement and docks, with no pixels attached. */
export declare function decodeVacuumMapGeometry(raw: unknown, codec: RawDpCodec | undefined): VacuumMapGeometry | undefined;
/** Decode a `DynamicData` message — where the robot is, right now. */
export declare function decodeVacuumPose(raw: unknown, codec: RawDpCodec | undefined): MapPose | undefined;
/**
 * Decode a `Map` message — a frame of the cell plane with the geometry that places it.
 *
 * `undefined` when the frame cannot be used rather than when it cannot be parsed: no geometry, no
 * pixels, a plane that failed to decompress, or one too short for the grid it claims. Each of those
 * yields a map that would draw, and draw wrongly.
 */
export declare function decodeVacuumMap(raw: unknown, codec: RawDpCodec | undefined): VacuumMapPlane | undefined;
/** Decode a `RoomOutline` message — one byte per cell saying which room it belongs to. */
export declare function decodeVacuumRoomOutline(raw: unknown, codec: RawDpCodec | undefined): VacuumRoomOutline | undefined;
/** Decode a `RoomParams` message — the room list, their names, and how each is cleaned. */
export declare function decodeVacuumRoomParams(raw: unknown, codec: RawDpCodec | undefined): VacuumRoomParams | undefined;
/** Decode a `RestrictedZone` message — virtual walls, no-go zones and no-mop zones. */
export declare function decodeVacuumRestrictedZones(raw: unknown, codec: RawDpCodec | undefined): VacuumRestrictedZones | undefined;
/** Decode a `MapDescription` message — a map's identity, without its pixels. */
export declare function decodeVacuumMapDescription(raw: unknown, codec: RawDpCodec | undefined): VacuumMapDescription | undefined;
/**
 * Decode a `MapBackup` message — the five-part snapshot sent when a map is switched or edited.
 *
 * Each part is decoded from its own bytes through the same decoder that reads it standing alone, so a
 * backup and a live frame cannot drift apart. A part the device did not send stays `undefined` rather
 * than becoming an empty one: an absent `map` in a rename is not a map with no cells.
 */
export declare function decodeVacuumMapBackup(raw: unknown, codec: RawDpCodec | undefined): VacuumMapBackup | undefined;
