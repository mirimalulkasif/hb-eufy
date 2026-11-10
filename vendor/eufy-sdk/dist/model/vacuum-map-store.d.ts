import type { MapPose, VacuumMapBackup, VacuumMapDescription, VacuumMapPlane, VacuumRestrictedZones, VacuumRoom, VacuumRoomOutline, VacuumRoomParams } from "./vacuum-map.js";
/** Everything the store currently holds about one map. Any piece may be absent until it arrives. */
export interface VacuumMapSnapshot {
    /**
     * Which map these pieces describe, or `undefined` when nothing carrying an id has arrived yet.
     *
     * A robot with several floors saved sends whichever is loaded. When this changes, every piece below
     * is from the new map — the store does not merge across maps.
     */
    readonly mapId: number | undefined;
    readonly plane: VacuumMapPlane | undefined;
    readonly outline: VacuumRoomOutline | undefined;
    readonly rooms: VacuumRoomParams | undefined;
    readonly zones: VacuumRestrictedZones | undefined;
    readonly description: VacuumMapDescription | undefined;
    /**
     * Where the robot was when it last said so.
     *
     * Kept across a map switch, unlike everything else: a pose is a position in the world and does not
     * belong to a map. It may fall outside the new map's bounds, in which case a lookup answers nothing.
     */
    readonly pose: MapPose | undefined;
}
/** A piece the store can be given, tagged by which one it is. */
export type VacuumMapPiece = {
    readonly kind: "plane";
    readonly value: VacuumMapPlane;
} | {
    readonly kind: "outline";
    readonly value: VacuumRoomOutline;
} | {
    readonly kind: "rooms";
    readonly value: VacuumRoomParams;
} | {
    readonly kind: "zones";
    readonly value: VacuumRestrictedZones;
} | {
    readonly kind: "description";
    readonly value: VacuumMapDescription;
} | {
    readonly kind: "pose";
    readonly value: MapPose;
} | {
    readonly kind: "backup";
    readonly value: VacuumMapBackup;
};
/**
 * Holds the current map for one device, and answers questions about it.
 *
 * Created empty and filled by {@link VacuumMapStore.apply}. Every getter answers `undefined` until the
 * pieces it needs have arrived, rather than answering from a partial map.
 */
export declare class VacuumMapStore {
    private current;
    /** The highest revision seen per piece, so an out-of-order repeat cannot overwrite a newer one. */
    private readonly revisions;
    /** What the store holds right now. A new object whenever anything changed, the same one when not. */
    get snapshot(): VacuumMapSnapshot;
    /**
     * Take one piece, and say whether it changed anything.
     *
     * `false` means the piece was stale — an older revision of a map already held — and was dropped. The
     * device repeats its map frequently, so the return is what tells a repeat from a change.
     */
    apply(piece: VacuumMapPiece): boolean;
    /** Forget everything. For a device going away, or a caller starting over. */
    clear(): void;
    /**
     * Which room the robot is standing in, or `undefined`.
     *
     * `undefined` covers every honest reason there is no answer: no pose yet, no room outline yet, no
     * room list yet, a robot outside the mapped area, or a cell belonging to no room. None of those is
     * an error, and none should be reported as a guess.
     */
    get currentRoom(): VacuumRoom | undefined;
    /**
     * Apply a whole `MapBackup` as the several pieces it contains.
     *
     * Each part goes through the same path a lone piece takes, so a backup cannot install something a
     * live frame would have rejected. Parts the device omitted are skipped rather than clearing what is
     * held: a backup carrying only a description is a rename.
     */
    private applyBackup;
    /**
     * Store one stamped piece, dropping it when it is older than the piece of its kind already held.
     *
     * The map-switch check comes first and is the important one: a piece naming a different map is not
     * an update, it is a different map. Everything held describes the old one, and a room outline read
     * with the new map's coordinates gives a wrong answer that looks exactly like a right one.
     */
    private put;
}
