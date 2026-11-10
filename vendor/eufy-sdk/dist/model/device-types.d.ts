/**
 * eufy **DeviceType** numbers — the single named definition of the vendor's product-type space.
 *
 * A `device_type` is an immutable vendor fact (like a command id), NOT capability logic. It is
 * defined ONCE here and referenced wherever a numeric type would otherwise be a magic number:
 * codec routing (`classify.ts`) and each capability's detection/wire tables (e.g. `pan-tilt.ts`
 * `detection.deviceTypes`, `light.ts` switch-format tables). Capability *rules* stay in the
 * modules; only the number→name mapping lives here.
 *
 * This is the **eufy security** DeviceType space (P2P). The RoboVac / clean line is a separate
 * Tuya ecosystem with no eufy device_type — it's classified by category + T2xxx model code, not by
 * a number here (see `classify.ts`). Light-cams live here (e.g. WALL_LIGHT_CAM); a hypothetical
 * pure Tuya bulb would sit outside this space like the vacuum.
 *
 * Merged from a third-party reverse-engineering project's device enum + the app's own
 * `DeviceTypeConstants` — the app is the authority wherever the two disagree.
 * A `const` object (not a TS `enum`) to match the codebase's `CommandType`/`P2P_CMD` style.
 *
 * @module model/device-types
 */
export declare const DeviceType: {
    readonly STATION: 0;
    readonly CAMERA: 1;
    readonly SENSOR: 2;
    readonly FLOODLIGHT: 3;
    readonly CAMERA_E: 4;
    readonly DOORBELL: 5;
    readonly BATTERY_DOORBELL: 7;
    readonly CAMERA2C: 8;
    readonly CAMERA2: 9;
    readonly MOTION_SENSOR: 10;
    readonly KEYPAD: 11;
    readonly CAMERA2_PRO: 14;
    readonly CAMERA2C_PRO: 15;
    readonly BATTERY_DOORBELL_2: 16;
    readonly HB3: 18;
    readonly CAMERA3: 19;
    readonly WATER_FREEZE_SENSOR_8920: 20;
    readonly SIREN_SENSOR: 21;
    readonly SMOKE_SENSOR: 22;
    readonly CAMERA3C: 23;
    readonly PROFESSIONAL_247: 24;
    readonly MINIBASE_CHIME: 25;
    readonly CAMERA3_PRO: 26;
    readonly STATION_9000: 27;
    readonly HOMEBASE_MINI: 28;
    readonly INDOOR_CAMERA: 30;
    readonly INDOOR_PT_CAMERA: 31;
    readonly SOLO_CAMERA: 32;
    readonly SOLO_CAMERA_PRO: 33;
    readonly INDOOR_CAMERA_1080: 34;
    readonly INDOOR_PT_CAMERA_1080: 35;
    readonly FLOODLIGHT_CAMERA_8422: 37;
    readonly FLOODLIGHT_CAMERA_8423: 38;
    readonly FLOODLIGHT_CAMERA_8424: 39;
    readonly INDOOR_OUTDOOR_CAMERA_1080P_NO_LIGHT: 44;
    readonly INDOOR_OUTDOOR_CAMERA_2K: 45;
    readonly INDOOR_OUTDOOR_CAMERA_1080P: 46;
    readonly FLOODLIGHT_CAMERA_8425: 47;
    readonly OUTDOOR_PT_CAMERA: 48;
    readonly CAMERA_E40: 49;
    readonly LOCK_BLE: 50;
    readonly LOCK_WIFI: 51;
    readonly LOCK_BLE_NO_FINGER: 52;
    readonly LOCK_WIFI_NO_FINGER: 53;
    readonly LOCK_8503: 54;
    readonly LOCK_8530: 55;
    readonly LOCK_85A3: 56;
    readonly LOCK_8592: 57;
    readonly LOCK_8504: 58;
    readonly SOLO_CAMERA_SPOTLIGHT_1080: 60;
    readonly SOLO_CAMERA_SPOTLIGHT_2K: 61;
    readonly SOLO_CAMERA_SPOTLIGHT_SOLAR: 62;
    readonly SOLO_CAMERA_SOLAR: 63;
    readonly SOLO_CAMERA_C210: 64;
    readonly FLOODLIGHT_CAMERA_8426: 87;
    readonly SOLO_CAMERA_E30: 88;
    readonly CAMERA_S4: 89;
    readonly SMART_DROP: 90;
    readonly BATTERY_DOORBELL_PLUS: 91;
    readonly DOORBELL_SOLO: 93;
    readonly BATTERY_DOORBELL_PLUS_E340: 94;
    readonly BATTERY_DOORBELL_C30: 95;
    readonly BATTERY_DOORBELL_C31: 96;
    readonly SOLOCAM_E42: 98;
    readonly INDOOR_COST_DOWN_CAMERA: 100;
    readonly CAMERA_GUN: 101;
    readonly CAMERA_SNAIL: 102;
    readonly INDOOR_PT_CAMERA_S350: 104;
    readonly INDOOR_PT_CAMERA_E30: 105;
    readonly CAMERA_FG: 110;
    readonly CAMERA_4G_S330: 111;
    readonly SIREN_SENSOR_E20: 123;
    readonly ENTRY_SENSOR_E20: 126;
    readonly PIR_SENSOR_E20: 127;
    readonly CAMERA_GARAGE_T8453_COMMON: 131;
    readonly CAMERA_GARAGE_T8452: 132;
    readonly CAMERA_GARAGE_T8453: 133;
    readonly SMART_SAFE_7400: 140;
    readonly SMART_SAFE_7401: 141;
    readonly SMART_SAFE_7402: 142;
    readonly SMART_SAFE_7403: 143;
    readonly WALL_LIGHT_CAM: 151;
    readonly SMART_TRACK_LINK: 157;
    readonly SMART_TRACK_CARD: 159;
    readonly TRACKER_87B4: 161;
    readonly TRACKER_87B5: 162;
    readonly LOCK_8502: 180;
    readonly LOCK_8506: 184;
    readonly LOCK_8531: 189;
    readonly LOCK_85L0: 201;
    readonly LOCK_85D0: 202;
    readonly LOCK_85V0: 203;
    readonly LOCK_85P0: 209;
    readonly NVR_S4_MAX: 300;
    readonly CAMERA_POE_S4: 301;
    readonly WALL_LIGHT_CAM_81A0: 10005;
    readonly INDOOR_8W11: 10006;
    readonly INDOOR_PT_CAMERA_C220: 10008;
    readonly INDOOR_PT_CAMERA_C210: 10009;
    readonly INDOOR_PT_CAMERA_C220_V2: 10010;
    readonly INDOOR_PT_CAMERA_C220_V3: 10011;
    readonly CAMERA_C35: 10035;
};
