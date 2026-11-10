/**
 * Anker secure-MQTT topic vocabulary + the per-line credential scope.
 *
 * Two facts about this broker drive everything here, both CONFIRMED live (2026-07-28) against a real
 * `eufy_life` light and cross-read from the disassembled V6 app
 * (`com.anker.esiotkit.security_device.mqtt.SecurityMqttConstant`, `mqtt_serve.dart`):
 *
 *  - **The device→app leg is not `/res` for every line.** `eufy_life` reports land on `/app/res`;
 *    the app subscribes four topics per light device and `/res` carries nothing. Other lines use
 *    `/res` alone.
 *  - **The topic space is partitioned by credential.** `get_user_mqtt_info` returns a DIFFERENT
 *    certificate per `app-name`, and the AWS IoT policy granting `eufy_life/...` is attached only to
 *    the `eufy_life` cert. Subscribing to a light's topics with the default credential is *silently*
 *    denied — the broker answers SUBACK with a 128 grant rather than rejecting, which is why this
 *    produced total silence instead of an error.
 *
 * Scope is derived from `EufyDevice.category` — a device-record field, not a capability — so this
 * stays on the transport side of the capability↔transport boundary.
 */
import type { EufyDevice } from "../../core/types.js";
/**
 * Which `get_user_mqtt_info` credential a device's realtime traffic rides on. `"default"` is the
 * headerless credential (observed `eufy_mega`-scoped) that serves every non-life MQTT device.
 *
 * A scope exists only where a DISTINCT credential does. `eufy_life` is one because its topic space is
 * denied to the default credential. The Clean line (`eufy_home`) is NOT: its
 * `cmd/eufy_home/<model>/<sn>/res` subscribe is confirmed against a T2351 on the
 * default credential, which is the only one `get_user_mqtt_info` was ever asked for. Giving it a scope
 * of its own would open a second connection under the SAME `thing_name` — AWS IoT treats a duplicate
 * client id as a takeover and evicts the incumbent, so both lines would flap.
 */
export type MqttScope = "default" | "eufy_life";
/**
 * The credential scope a device's topics are granted under. Derived from `EufyDevice.category` — a
 * device record field, not a capability — so this stays on the transport side of the boundary.
 */
export declare function mqttScopeFor(device: EufyDevice): MqttScope;
/**
 * The `app-name` request header value for a scope, or `undefined` for the default (headerless)
 * credential — matching the optional argument of `getUserMqttInfo`.
 */
export declare function mqttAppName(scope: MqttScope): string | undefined;
/**
 * Build a topic for a device: `cmd/<prefix>/<model>/<sn>/<req|res>`. `leg` is required — the two
 * directions are one word apart and publishing to the wrong one fails silently. The prefix is
 * derived by the module-local `topicPrefix` — `eufy_home` for clean-line devices, `device.category` elsewhere.
 */
export declare function secureTopic(device: EufyDevice, leg: "req" | "res"): string;
/**
 * Every topic to subscribe for a device's inbound traffic.
 *
 * `eufy_life` (smart lights) gets the app's full four-topic set: `/app/res` (the state channel),
 * `/res` (present in the app's subscribe list but observed to carry nothing on this line),
 * `synq/…/state_info` (online/offline), and `/app/ota/res` (OTA progress).
 *
 * Clean-line devices (vacuum/mower) subscribe four topics on the `eufy_home` prefix:
 *   - `cmd/…/res` — device→app DP reports and command replies (confirmed live on T2351)
 *   - `biz/…/res` — cloud→app business-layer responses (TopicManager.getBizReqTopic())
 *   - `biz/…/req` — cloud ACKs for app→cloud business requests (subscribe for ACKs)
 *   - `dt/…/param_info` — device-twin parameter push
 *
 * Every other line subscribes `/res` alone.
 */
export declare function subscribeTopics(device: EufyDevice): readonly string[];
/** A parsed inbound topic. `tail` is everything after the serial (`res`, `app/res`, `state_info`, …). */
export interface ParsedTopic {
    root: string;
    category: string;
    model: string;
    sn: string;
    tail: string;
}
/**
 * Split an inbound topic into its parts. All roots this broker uses (`cmd/…`, `synq/…`, `biz/…`,
 * `dt/…`) put the serial at index 3 regardless of how deep the tail runs, so the serial is read
 * positionally rather than from the end — `…/<sn>/app/res` and `…/<sn>/app/ota/res` would otherwise
 * yield the tail segment as the device id. Returns `undefined` on any shape this doesn't recognise,
 * so an unparsed topic leaves `deviceSn` unset instead of carrying a guess.
 */
export declare function parseSecureTopic(topic: string): ParsedTopic | undefined;
/** The per-device Solix topics for `{appName, productCode, deviceSn}`. */
export interface SolixDeviceTopics {
    /** Telemetry the device pushes (SUBSCRIBE) — ff09 `param_info` frames (live measurements). */
    paramInfo: string;
    /**
     * Settings/state the device pushes (SUBSCRIBE) — ff09 `state_info` frames. Same ff09 framing as
     * `param_info` but the TAGS carry SETTINGS/targets (mode export limit, SOC limits, max_load, toggles),
     * NOT live measurements — so it needs its own tag→name table, not the param_info one.
     */
    stateInfo: string;
    /** This device's command replies (SUBSCRIBE). */
    cmdRes: string;
    /**
     * The device's requestDeviceInfo channel (cmd 17). PUBLISH to arm reporting; also SUBSCRIBE — the
     * broker copies the APP's publishes here to any co-subscriber, which is the only way to observe a
     * control the app changed that `param_info` does not reflect (ambient light, display timeout).
     */
    req: string;
}
/** Build the per-device Solix topics. `param_info` is the telemetry we decode; `req` is arm + read-back. */
export declare function solixDeviceTopics(appName: string, productCode: string, deviceSn: string): SolixDeviceTopics;
/** The per-account Solix topics keyed by `user_id`. */
export interface SolixUserTopics {
    /** Account-level command replies (SUBSCRIBE). */
    cmdRes: string;
    /** The `power_site` heartbeat channel (PUBLISH only). */
    powerSite: string;
}
/** Build the per-account Solix topics. Note: the account `…/req` channel is publish-side and NOT subscribed. */
export declare function solixUserTopics(appName: string, userId: string): SolixUserTopics;
