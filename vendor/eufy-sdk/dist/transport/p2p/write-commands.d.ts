/**
 * Direct-binary write helpers.
 *
 * The capability-driven command recipes live in the capability modules
 * (`src/model/capabilities/*`): each module owns its own `buildCommand`, and the barrel's
 * `buildCommand()` resolves across them. This file keeps ONLY the **direct-binary** body builder
 * — a packed struct, not a JSON recipe — used by `EufyMega.sendDirectBinary` for camera on/off +
 * spotlight brightness/color-temp/enable. No dependency on the capability barrel (avoids a cycle).
 */
/**
 * Build a level-2 direct-binary control body: `[u32 channel?][u32 value][account_id ASCII pad→128]`.
 * Omit `channel` for the channel-less station form (e.g. HomeBase alarm volume). See the struct note above.
 */
export declare function buildDirectBinaryBody(value: number, accountId: string, channel?: number): Buffer;
/**
 * Body for the device/hub rename command (`SET_DEVICE_NAME` 1217 / `SET_HUB_NAME` 1216). A 261-byte
 * struct confirmed against the app: `[u32 = 0][u8 device_channel][name → 128B, null-padded]
 * [account_id → 128B, null-padded]`. Sent signCode 8 on the station channel (255). The name is UTF-8
 * (matching the app), truncated to fit 127 bytes so the field stays null-terminated.
 */
export declare function buildDeviceNameBody(channel: number, name: string, accountId: string): Buffer;
