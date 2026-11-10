import { type Surface } from "./members.js";
import type { AvailabilityContext, CapabilityModule, CommandContext } from "./types.js";
import type { Command, AutoLockSnapshot, MediaProvider } from "../../core/contracts.js";
/**
 * Setting-id selectors for the compact `ff09-setting-toggle` write — this capability's OWN wire
 * vocabulary, named not inlined per the capability wire-id convention, so `setRainMode`
 * below references `LOCK_SETTING_ID.RAIN_MODE` and this module's own spec can import it too, instead
 * of a bare `7` at either call site.
 *
 * Unlike a normal capability id (owned by exactly one layer, crossing into `transport/` only as an
 * opaque number), this value is a GENUINE duplicate of `transport/ff09.ts`'s `FF09_SETTING_ID.RAIN_MODE`
 * — the capability↔transport decorrelation rule (`model/` never imports `transport/`) leaves no way to
 * share one source of truth across the boundary, and no test can cross-check them without violating
 * that same rule (`guard:decorrelation` forbids any `transport/` import under `src/model`, including
 * tests). If a future capture revises this id, BOTH copies must be updated by hand.
 */
export declare const LOCK_SETTING_ID: {
    /** One-touch lock toggle. Structurally confirmed via the app's own JS (2026-07-18) — see the module doc. */
    readonly ONE_TOUCH_LOCK: 1;
    /** Scramble-passcode toggle. Structurally confirmed via the app's own JS (2026-07-18) — see the module doc. */
    readonly SCRAMBLE_PASSCODE: 3;
    /** Wifi-status toggle. Structurally confirmed via the app's own JS (2026-07-18) — see the module doc. */
    readonly WIFI_STATUS: 5;
    /** Event-log-enable toggle. Structurally confirmed via the app's own JS (2026-07-18) — see the module doc. */
    readonly ENABLE_LOG: 6;
    /** Rain Mode toggle on the T8531 video lock. Verified live 2026-07-18. */
    readonly RAIN_MODE: 7;
    /** Privacy-mode toggle. Structurally confirmed via the app's own JS (2026-07-18) — see the module doc. */
    readonly PRIVACY_MODE: 9;
    /** One-touch rear-lock toggle. Structurally confirmed via the app's own JS (2026-07-18) — see the module doc. */
    readonly ONE_TOUCH_REAR_LOCK: 11;
};
/**
 * Bound lock controls — the object returned by `dev.lock()`.
 *
 * Everything is DERIVED from `LOCK_MEMBERS`. `lock`/`unlock` drive every lock-family actuator over the
 * wire its family takes: the shared `ff09` frame on the T8531 video smart lock and the T85D0 garage door,
 * the T8530 video lock's own `set-payload`, and the keyed-payload envelope on the classic Wi-Fi lock (the
 * `T8520`-range unit that never negotiates a session key). The setting toggles ride `ff09` only. This
 * module emits ONE transport-neutral intent per wire (identity fields only, no wire bytes, no cipher, no
 * routing key) and names no transport: the command sink routes P2P vs MQTT by the device's topology, and
 * the chosen transport's command router builds the frame + envelope and re-resolves its own routing tail.
 * Which pipe it is does not reach `dev.lock()` — its surface is identical either way, the same way
 * P2P-vs-cloud is hidden for live media.
 *
 * Classic Wi-Fi lock: `lock()` and `unlock()` are both confirmed on hardware — the bolt moved each way, the
 * device answered result code 0, and the cloud status followed. That device answers every command, so on it
 * the two reject on a refusal or an unanswered command as well as on missing identity.
 */
export type LockActions = Surface<typeof LOCK_MEMBERS>;
/**
 * Whether the device is reachable over P2P — the topology fact that decides which lock settings exist.
 * The compact toggles are only known on the P2P video lock; the MQTT garage door does not expose them in
 * the app, so offering them there would guess a frame shape that likely does not exist.
 */
declare const overP2p: (ctx: AvailabilityContext) => boolean;
/**
 * Every `lock` feature, declared once.
 *
 * The six toggles after `setRainMode` share its confirmed frame SHAPE and are grounded in the app's own
 * JS, but none has been captured against a real device — so each is `unverified`: DECLARED, so the
 * capability documents what the lock has, and NOT installed, because a fire-and-forget write that is
 * wrong looks exactly like success. A caller sees them as optional and learns at compile time that they
 * are not settable yet; promoting one is a single edit once a capture lands.
 *
 * They carry no `param`: a setting id is not a param id, nothing reports these back, and declaring one
 * would put a wire number where the schema expects a reported value.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const LOCK_MEMBERS: {
    /**
     * The lock's own state, verified on param 6000: "4" = locked, "3" = unlocked.
     * `writtenElsewhere` points at the `lock`/`unlock` methods — a single `write` cannot express two
     * verbs that carry no value.
     */
    readonly locked: {
        readonly param: 6000;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly writtenElsewhere: true;
        readonly coerce: (raw: string | number | boolean) => boolean;
        readonly description: "Lock state, true=locked (verified: param 6000, 4=locked, 3=unlocked).";
    };
    /**
     * Cell charge as a percentage, on param 1101 or smart-lock param 6001. Named `battery`
     * within this capability rather than deferring to the `battery` capability: a lock resolves as a lock,
     * so the accessor is `dev.lock().battery`.
     */
    readonly battery: {
        readonly param: 1101;
        readonly readAliases: readonly [{
            readonly paramType: 6001;
        }];
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "verified";
        readonly description: "Lock battery level 0-100 (verified: param 1101, alias 6001).";
    };
    /**
     * Link quality in dBm as the lock measures it, on the shared param 1141. On the `ff09` wire the
     * actuations are fire-and-forget, so a weak link is silent rather than an error.
     */
    readonly rssi: {
        readonly param: 1141;
        readonly type: "number";
        readonly unit: "dBm";
        readonly kind: "dbm";
        readonly provenance: "verified";
        readonly description: "Lock signal strength (verified: param 1141 = RSSI).";
    };
    /**
     * Lock the deadbolt/door. Resolves after sending, without confirming physical state — except on the
     * classic Wi-Fi lock, which answers: there it rejects on a device refusal or no reply as well.
     */
    readonly lock: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
    /**
     * Unlock the deadbolt/door. Resolves after sending, without confirming physical state — except on the
     * classic Wi-Fi lock, which answers: there it rejects on a device refusal or no reply as well.
     */
    readonly unlock: import("./members.js").MethodMember<() => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
    /**
     * Read-modify-write the auto-lock setting: the transport GETs the device's current settings, changes
     * only `enabled` (+ `delaySeconds` if given — otherwise the current delay is preserved), and writes the
     * rest back verbatim. Works on both the T8531 video lock and the T85D0 garage/lock, which share the
     * identical settings frame; confirmed on-device in both directions on both families.
     *
     * **Unlike `lock`/`unlock` this can reject on a device TIMEOUT**, not just missing identity — the GET
     * step is a genuine precondition, so this one is not fire-and-forget.
     */
    readonly setAutoLock: import("./members.js").MethodMember<(enabled: boolean, delaySeconds?: number) => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
    /**
     * Toggle Rain Mode — a pure blind write, unlike `setAutoLock`: the compact frame carries only this one
     * field, so there is no GET pass and it is fire-and-forget. Confirmed on-device end-to-end in both
     * directions, with the app UI reflecting the new state afterward. P2P video lock only.
     */
    readonly setRainMode: import("./members.js").MethodMember<(enabled: boolean) => Promise<void>> & {
        available: (ctx: CommandContext) => boolean;
    };
    /**
     * Lock the door by a single touch on the pad, with no code. First of the six compact toggles: all
     * `unverified` (frame shape read out of the app's JS, never captured), so no setter is installed and
     * `setOneTouchLock` lands optional on the surface — a caller learns at compile time. `writeOnly` too:
     * nothing reports the setting back, so there is no getter either.
     */
    readonly oneTouchLock: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly available: typeof overP2p;
        readonly provenance: "apk";
        readonly description: "One-touch locking (setting-id 1). Wire shape confirmed in the app's own JS, NOT captured.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * Pad anti-shoulder-surfing: the lock asks for extra random digits around the real code so a watcher
     * cannot read it off worn keys. Same `unverified` + `writeOnly` + P2P-only standing as its five
     * siblings — declared so the capability documents the lock, not installed.
     */
    readonly scramblePasscode: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly available: typeof overP2p;
        readonly provenance: "apk";
        readonly description: "Scramble the passcode entry pad (setting-id 3). Wire shape confirmed in the app's own JS, NOT captured.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * Whether the lock reports its Wi-Fi status — a reporting toggle, not the radio itself, on the app's
     * own naming. Same `unverified` + `writeOnly` + P2P-only standing as its five siblings; treat the
     * meaning as the app's label until a capture pins the behaviour.
     */
    readonly wifiStatus: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly available: typeof overP2p;
        readonly provenance: "apk";
        readonly description: "Wi-Fi status reporting (setting-id 5). Wire shape confirmed in the app's own JS, NOT captured.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * Whether the lock records its own event history on-device. Same `unverified` + `writeOnly` +
     * P2P-only standing as its five siblings — the frame shape comes from the app's JS and has never been
     * driven against hardware.
     */
    readonly logEnabled: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly available: typeof overP2p;
        readonly provenance: "apk";
        readonly description: "Event-log recording (setting-id 6). Wire shape confirmed in the app's own JS, NOT captured.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The lock's own privacy mode — unrelated to the camera capability's privacy burst, which is a
     * different device, a different wire and a different meaning. Same `unverified` + `writeOnly` +
     * P2P-only standing as its five siblings.
     */
    readonly privacyMode: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly available: typeof overP2p;
        readonly provenance: "apk";
        readonly description: "Lock privacy mode (setting-id 9). Wire shape confirmed in the app's own JS, NOT captured.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The rear-deadbolt counterpart to `oneTouchLock`, on a lock that has a second bolt — so a model with
     * one bolt has nothing for it to drive. Last of the six compact toggles and shares their standing
     * exactly: `unverified`, `writeOnly`, P2P-only, no setter installed.
     */
    readonly oneTouchRearLock: {
        readonly type: "bool";
        readonly kind: "boolean";
        readonly writeOnly: true;
        readonly unverified: true;
        readonly available: typeof overP2p;
        readonly provenance: "apk";
        readonly description: "One-touch rear locking (setting-id 11). Wire shape confirmed in the app's own JS, NOT captured.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /** Read the current device-reported state; undefined means no settled locked/unlocked state. */
    readonly refreshStatus: {
        readonly needs: "media";
        readonly provided: (provider: MediaProvider, deps: import("./members.js").MemberDeps) => (() => Promise<boolean | undefined>) | undefined;
        readonly description: string;
        readonly requiredCapabilities?: readonly import("../types.js").Capability[];
        readonly answers: true;
    };
    /**
     * Read the device's current auto-lock settings via a live `GET_SETTINGS` round-trip — the SAME read
     * `setAutoLock` does internally, exposed standalone with no write attached. Works over BOTH transports.
     * A genuine request/reply query, not a passive property, so it always talks to the device.
     *
     * `answers` for that reason: the returned snapshot IS the point, so it is not a control to offer even
     * though it takes no arguments — offering it as one would run a round-trip and discard the answer.
     */
    readonly getAutoLockState: {
        readonly needs: "ff09Settings";
        readonly provided: (provider: import("../../core/contracts.js").Ff09SettingsReader, deps: import("./members.js").MemberDeps) => (() => Promise<AutoLockSnapshot>) | undefined;
        readonly description: string;
        readonly requiredCapabilities?: readonly import("../types.js").Capability[];
        readonly answers: true;
    };
};
/**
 * `lock` — smart lock. `locked` reports lock state via verified param 6000 (4=locked, 3=unlocked);
 * a device that reports no stable state param carries its transitions on the `lockState` event instead,
 * whose payload names the decoded `locked`.
 */
export declare const LOCK: CapabilityModule;
export {};
