/**
 * Device model — public barrel.
 *
 * Data-driven, capability-based device model: one {@link Device} class, behaviour resolved from
 * a {@link CloudRecord} via the 3-tier {@link resolveDevice} (model row → codec → inference).
 *
 * @module model
 */
export * from "./types.js";
export { classify, codecForType, codecFromModel } from "./classify.js";
export { inferName } from "./infer.js";
export { MODEL_REGISTRY, resolveDevice } from "./registry.js";
export { Device, UNKNOWN_PARAM_PREFIX, type RawParams } from "./device.js";
export { SECURITY_PARAMS, CLEAN_PARAMS, type ParamDef } from "./param-dictionary.js";
export { LIFE_PARAMS } from "./life-params.js";
export { parseCleanRecords, EMPTY_CLEAN_RECORD_PAGE, type CleanRecord, type CleanRecordPage } from "./clean-records.js";
export { parseCleanRecordDetail, unwrapCleanRecordBlob, CLEAN_FINISH_REASONS, type CleanRecordDetail, type CleanFinishReason, } from "./clean-record-detail.js";
export { decodeVacuumSchedules, decodeVacuumScheduleCount, decodeActiveVacuumScheduleCount, VACUUM_SCHEDULE_ACTIONS, VACUUM_SCHEDULE_WEEKDAYS, type VacuumSchedule, type VacuumScheduleAction, type VacuumScheduleWeekday, } from "./vacuum-schedules.js";
export { decodeVacuumScenes, decodeVacuumSceneCount, decodeUsableVacuumSceneCount, SCENE_TYPES, SCENE_INVALID_REASONS, type VacuumScene, type SceneType, type SceneInvalidReason, } from "./vacuum-scenes.js";
export { decodeVacuumMap, decodeVacuumMapGeometry, decodeVacuumMapBackup, decodeVacuumMapDescription, decodeVacuumPose, decodeVacuumRestrictedZones, decodeVacuumRoomOutline, decodeVacuumRoomParams, DOCK_KINDS, FLOOR_TYPES, MAP_CELL_VALUES, MAP_FRAME_KINDS, MAP_QUALITIES, ROOM_SCENES, ROOM_SUCTIONS, type DockKind, type FloorType, type MapCellValue, type MapDock, type MapFrameKind, type MapLine, type MapPoint, type MapPose, type MapQuad, type MapQuality, type RoomScene, type RoomSuction, type VacuumMapBackup, type VacuumMapDescription, type VacuumMapGeometry, type VacuumMapPlane, type VacuumRestrictedZones, type VacuumRoom, type VacuumRoomOutline, type VacuumRoomParams, type VacuumRoomSettings, } from "./vacuum-map.js";
export { cellAtPoint, mapCellValue, mapCellValueAt, pointAtCell, roomAtPoint, roomIdAt, roomIdAtPoint, type MapCell, type PlacedPlane, } from "./map-pixels.js";
export { VacuumMapStore, type VacuumMapPiece, type VacuumMapSnapshot } from "./vacuum-map-store.js";
export { paramDef, namespaceForCodec, type ParamNamespace } from "./param-namespace.js";
export { inspectParams, type ParamInspection, type DeviceInspection } from "./inspect.js";
export * from "./capabilities/index.js";
/**
 * The evidence a family gate reads, published because a member table's `available` predicate names it —
 * `AUDIO_MEMBERS.alarmTone` gates on being a HomeBase, and that gate's parameter type is this. The
 * DeviceType sets and the predicates themselves stay internal to `device-family.ts`.
 */
export type { FamilyContext } from "./device-family.js";
export { CusPushEvent, CusPushAlarmType, CusPushMode, DoorbellPushEvent, IndoorPushEvent, HB3PairedDevicePushEvent, LockPushEvent, SmartDropPushEvent, NotificationStyle, detectionName, } from "./push-events.js";
export { SolixDevice, discoverSolixDevices, solarbankSceneReadings, type SolixDeviceReader, type SolixDeviceRecord, type SolixIdentity, type SolixConnectivity, type SolixEnergyMeter, type SolixDeviceOptions, } from "./solix-device.js";
export { SOLIX_ENERGY_METER_MEMBERS, type SolixCapability, type SolixEnergyMeterReads } from "./capabilities/solix.js";
export { buildModelIndex, type SolixProduct, type SolixProductCategory } from "./solix-catalog.js";
export { solixProductFamily, isSolixPowerStation, isSolixSolarbank, isSolixSmartMeter, type SolixProductFamily, type SolixFamilyInput, } from "./solix-family.js";
export { SolixSite, discoverSolixSites, type SolixSiteReader, type SolixSiteOptions } from "./solix-site.js";
