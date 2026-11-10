import type { EufyDevice } from "../../core/types.js";
import type { Command, AutoLockSnapshot } from "../../core/contracts.js";
import { type Logger } from "../../core/logger.js";
import type { MegaHttpClient } from "../http/mega-client.js";
import { type Ff09FrameInput, type Ff09TransferPayload } from "../ff09.js";
import { type DpPresetSpec } from "../dp-preset.js";
/**
 * The ff09 command topic — always the `eufy_security` scope, regardless of the device's own category
 * (garage/standalone lock records aren't necessarily `eufy_security`-categorized, but this is the one
 * topic that's live-verified to accept `head.cmd:9` commands).
 */
export declare function ff09MqttTopic(pn: string, sn: string): string;
/**
 * The MQTT `ff09-actuate` builder input — the same fields as {@link Ff09FrameInput} minus `omitUserFields`
 * (the actuate path always carries full user attribution), with `username`/`shortUserId` made **required**
 * (the frame builder allows omitting them only under `omitUserFields`, which this path never sets).
 * Derived from `Ff09FrameInput` so the shared fields (`engage`/`adminUserId`/`deviceSn`/`unixTime`/
 * `nonce`/`seqNum`) can't drift.
 */
export type Ff09TransInput = Omit<Ff09FrameInput, "omitUserFields" | "username" | "shortUserId"> & {
    username: string;
    shortUserId: string;
};
/** The inner `trans` object (before base64) — `{cmd:1940,…,payload:{apiCommand,lock_payload,…}}`. */
export interface Ff09Trans {
    cmd: number;
    mChannel: number;
    mValue3: number;
    payload: Ff09TransferPayload;
}
/**
 * Build the ff09 actuate command as the inner `trans` object. `engage` only flips the ff09 frame's
 * internal `A3` byte; the `apiCommand` comes from the frame builder (see `transport/ff09.ts`).
 */
export declare function buildFf09Trans(input: Ff09TransInput): Ff09Trans;
/**
 * Build the `{head, payload}` envelope a ff09 command publishes to {@link ff09MqttTopic} — `head.cmd:9`,
 * `payload` = `{account_id, device_sn, trans: base64(trans)}`. `timestamp`/`sessId`/`seed` are
 * injectable for deterministic tests; default to fresh/random.
 */
export declare function buildFf09MqttEnvelope(input: {
    trans: Ff09Trans;
    clientId: string;
    accountId: string;
    deviceSn: string;
    timestamp?: number;
    sessId?: string;
    seed?: string;
}): string;
/**
 * The facade-side dependencies the router needs. It owns the one-shot MQTT connection lifecycle + all
 * command wire logic, but defers device-list access + lifecycle event fan-out to the client (which owns
 * the typed EventEmitter).
 */
export interface MqttRouterDeps {
    mega: MegaHttpClient;
    /** Diagnostics sink. Omit for silence. */
    logger?: Logger;
    /** Current (already-loaded) device list. */
    listDevices: () => EufyDevice[];
    /** Load the device list if it isn't loaded yet (delegates to the client's getDevices). */
    ensureDevices: () => Promise<void>;
    /** A command delivery/actuation ack — the client re-emits it as the `commandAck` event. */
    onCommandAck: (info: Record<string, unknown>) => void;
    onError: (err: Error) => void;
    /**
     * The `a2` account id an `eufy_life` DP frame embeds for `dev` — the owning member's `admin_user_id`
     * (or the session user id). Injected because it needs session state the transport doesn't hold; the
     * router treats it opaquely. Required once any `mqtt-dp` command family can be routed.
     */
    resolveAccountId?: (dev: EufyDevice) => string;
    /**
     * Resolve a gallery `lightId` to its serializable effect definition — a thin wrapper over the HTTP
     * effect catalog the client owns (so the transport never imports HTTP). Injected; required to route
     * `mqtt-dp-preset`.
     */
    resolvePreset?: (lightId: number) => Promise<DpPresetSpec>;
    /**
     * Publish an already-built MQTT message `body` to `topic` over the facade's persistent account-wide
     * secure-MQTT transport — the CONFIRMED `eufy_life` light-write path (the facade's `connectMQTT()` +
     * `transport.publish`). Injected because that persistent connection is owned by the facade, not this
     * router (which otherwise opens per-command one-shot connections for ff09). Required to route
     * `mqtt-dp`/`mqtt-dp-color`/`mqtt-dp-preset`.
     */
    publishSecure?: (dev: EufyDevice, topic: string, body: string) => Promise<void>;
}
export declare class MqttCommandRouter {
    private readonly deps;
    private readonly logger;
    constructor(deps: MqttRouterDeps);
    /**
     * Whether this transport stack drives `dev`'s `ff09-*` commands — a **eufy-cloud device**
     * (`api === "mega"`) with NO usable P2P endpoint (empty `p2p_did`): a standalone lock/garage (T85D0),
     * an appliance, and so on. Named positively by the plane it drives rather than "anything without a
     * P2P id", so a device on another cloud (a printer, `api === "ankermake"`) is claimed by NEITHER this
     * stack nor {@link P2PCommandRouter.claimsDevice} instead of falling onto the eufy MQTT plane. (See
     * P2P's `claimsDevice` for why the endpoint, not the `realtime` tag, is the routing fact.)
     */
    static claimsDevice(dev: EufyDevice): boolean;
    /**
     * Route a transport-neutral {@link Command} to the secure-MQTT wire — the MQTT half of the command
     * sink. The `ff09-actuate`/`ff09-autolock` (locks/garage) and `mqtt-dp`/`mqtt-dp-color`/`mqtt-dp-preset`
     * (`eufy_life` lights) kinds reach here (the facade fans everything else to the P2P router); any
     * other kind is a routing bug, so fail loud rather than resolve as a silent success.
     */
    dispatchCommand(sn: string, cmd: Command): Promise<void>;
    /** Resolve a serial to its loaded device record (loading the device list if needed). */
    private deviceFor;
    /**
     * Fallback broker-instance IPs, tried alongside a fresh DNS resolution — the `aiot-mqtt-{region}
     * .anker.com` NLB has been observed (2026-07-16) to answer a single DNS query with only 2 of its
     * targets, and NOT necessarily including the one currently holding a given device's session (e.g.
     * `3.139.229.186` held a live T85D0 session all evening but never once appeared in `dig`/`resolve4`
     * output during that window). These are just previously-observed AWS infra IPs, not secrets — kept as
     * a small seed list so discovery doesn't depend on DNS happening to expose the right target.
     *
     * NOTE: this is a hardcoded FALLBACK, not a source of truth — a fresh `dig`/`resolve4` of
     * `aiot-mqtt-{region}.anker.com` runs alongside it every discovery, and AWS can rotate these NLB
     * targets at any time. If discovery starts failing, the seed list is the first thing to re-resolve
     * from DNS and refresh; it's not meant to be maintained by hand long-term.
     */
    private static readonly KNOWN_AIOT_BROKER_IPS;
    /**
     * Connect a fresh **security-scoped** (`eufy_security`) MQTT client PINNED to whichever broker
     * instance currently holds `dev`'s live session. `aiot-mqtt-{region}.anker.com` fronts multiple
     * independent backend instances (an AWS NLB, one target per AZ) that do NOT share subscribe/publish
     * routing — a plain DNS connect can silently land on an instance that will accept the TLS CONNECT but
     * never route to this device (looks exactly like an authorization wall, isn't one). This probes every
     * candidate with a SUBSCRIBE-only connection (never publishes during discovery — see
     * `transport/mqtt/broker-discovery.ts`), then opens one real connection pinned to the first instance
     * that granted the SUBSCRIBE, for the caller to actually publish on.
     *
     * Which cert is used does NOT change the outcome — the account's own `get_user_mqtt_info` cert and a
     * cert extracted from a real phone's keystore produce the identical grant/deny pattern across every
     * candidate IP. Only the instance matters, which is why this probes instances and not credentials.
     * One exception is known: a single garage unit whose own-cert SUBSCRIBE was denied on every candidate
     * while a phone-extracted cert granted on the same one, with a sibling of the same model on the same
     * account granting fine. That is a per-device authorization gap on the vendor's backend, not a
     * broker-instance problem and not something this SDK works around — the throw below names each
     * candidate's outcome (its SUBACK deny code, a timeout or a connection error) until the backend grants
     * the account's own credentials.
     *
     * One fresh, explicitly non-reconnecting (`reconnectPeriod: 0`) connection per call — it repays the
     * full mTLS handshake every command and tears the socket down right after (see
     * {@link SecureMqttOptions.reconnectPeriod} for why a one-shot connection MUST disable reconnect).
     * That cost is accepted because garage/lock commands are rare. ⚠️ A reused connection off a persistent
     * security-MQTT transport would amortize the handshake and stay mounted long enough for a slow actuator
     * (a garage door travels ~20-30s) to push an async state update on the same socket, subscribing once
     * with a scope-bounded wildcard (`cmd/{app}/+/+/res`) instead of per-call subscribe/unsubscribe.
     */
    private ensureSecurityMqttFor;
    /**
     * How long {@link dispatchFf09Actuate} waits for the device's `/res` **delivery ack** before giving up.
     * This is NOT a physical-actuation budget, so the SAME number covers a deadbolt and a garage door
     * despite their very different travel times — see that method's doc for why.
     */
    private static readonly FF09_ACK_TIMEOUT_MS;
    /**
     * Shared "arm a listener, resolve on the first matching message, else time out" scaffold —
     * {@link dispatchFf09Actuate}'s ack wait and {@link dispatchFf09Autolock}'s GET-reply/SET-ack waits
     * are all one instance of this pattern (differing only in `match`), so it's factored here instead of
     * three near-identical inline `new Promise(...)` blocks. `match` returns the extracted value once a
     * message satisfies it, or `undefined` to keep waiting; the returned promise resolves `undefined` on
     * timeout with no unhandled listener left behind either way.
     */
    private waitForMqttMessage;
    /**
     * The `ff09-actuate` intent handler over MQTT — a standalone lock/garage door (T85D0) with no P2P endpoint.
     * Builds the same `ff09` frame the P2P lock uses (`transport/ff09.ts`), wraps it in the MQTT `trans`
     * envelope (`buildFf09Trans`/`buildFf09MqttEnvelope`, this module), discovers which broker instance holds the device's
     * live session (see {@link ensureSecurityMqttFor}), and publishes to `cmd/eufy_security/{pn}/{sn}/req`.
     * `cmd.engage` maps straight to the frame's direction byte (`true`=lock/close, `false`=unlock/open) — no inversion.
     *
     * **Verification status differs by direction — don't conflate them.** ✅ Unlock is LIVE-VERIFIED on a
     * T85D0 (2026-07-16): 3/3 closed→open transitions, direct cause→observed-effect, driven fully
     * end-to-end through this exact codepath. Lock is byte-exact against two independently-captured
     * real-app close frames — the same evidentiary bar the P2P video lock's wire ships under — but has
     * NOT itself been driven through this codepath and physically observed closing the real door; that's
     * still open.
     *
     * **What the `/res` reply actually means — a delivery ack, NOT "motion complete".** A live garage-open
     * test (2026-07-15) got its `/res` in ~2.5s, far faster than the ~20-30s a garage door physically takes
     * to travel — so this is the device saying "I received the command", not "I finished moving". That's
     * why {@link FF09_ACK_TIMEOUT_MS} is one fixed, short window shared by every ff09 device regardless of
     * its actuator's physical speed: it's timing a network round-trip, not a door. (There is currently no
     * signal at all for actuation completion — that would need a different source, e.g. the device's own
     * state push — so this method stays fire-and-forget: it resolves either way, never throws on a missing
     * ack, and reports what it knows via the `commandAck` event rather than the return value, so a future
     * richer per-device state model doesn't have to fight this method's `Promise<void>` contract.)
     *
     * Subscribes to the reply topic BEFORE publishing and waits for the actual message event (or the
     * timeout) rather than a blind sleep, so a reply arriving anywhere in that window is never missed —
     * unlike a fixed-sleep-then-teardown, where a late reply arrives after the subscription is already gone.
     */
    private dispatchFf09Actuate;
    /**
     * The `ff09-autolock` intent handler over MQTT — read-modify-write the T85D0's auto-lock setting.
     * ✅ LIVE-VERIFIED end-to-end (2026-07-17): both enable and disable
     * driven through this exact codepath against a real T85D0, confirmed via the app UI showing the new
     * state afterward, not just byte-exact against a capture. Unlike {@link dispatchFf09Actuate} (one
     * fire-and-forget frame), this is a GET then a SET over the SAME one-shot MQTT connection:
     *
     *  1. Publish a settings GET query ({@link buildFf09QueryTrans}), then wait for the device's `/res`
     *     reply — NOT the generic "any /res" ack {@link dispatchFf09Actuate} accepts, but specifically a
     *     message matching {@link parseFf09SettingsResponseTrans}'s shape whose `time` (hex string,
     *     parsed as the keyTime) equals the GET's own `time`, so unrelated traffic on the same
     *     subscription can't be mistaken for the reply. **No reply within the timeout throws** — unlike
     *     lock/unlock, this is a genuine precondition (we need the device's live `A7`/`A8`/delay values
     *     to preserve them), not a fire-and-forget actuation, so silently guess-writing would be worse
     *     than failing loud.
     *  2+3. Decrypt the reply, preserve the current delay (`a2`) + `A7`/`A8` passthrough values (`a4`/
     *     `a5`), and build the SET frame that changes only `A4`=`cmd.enabled` / `A5`=`cmd.delaySeconds`
     *     (or the just-read delay if omitted) — the decrypt→read→rebuild is shared with the P2P sibling in
     *     `transport/ff09.ts`'s {@link buildFf09AutolockSetFrame}; here it's wrapped in the MQTT `trans`
     *     envelope and published. Its ack follows the same fire-and-forget device-scoped `/res` convention
     *     as {@link dispatchFf09Actuate} —
     *     there's no captured evidence of a distinct SET-ack shape to match more strictly against. This
     *     listener is armed fresh (topic-only match, no keyTime correlation like step 1's), so in theory a
     *     REDELIVERED copy of the already-consumed GET reply (QoS-1 retransmit) could latch it early —
     *     telemetry-only (the call resolves either way; `setAcked` only affects a debug log line), so left
     *     as-is rather than adding keyTime correlation this ack doesn't otherwise need.
     */
    private dispatchFf09Autolock;
    /**
     * Shared GET-and-wait step behind both {@link dispatchFf09Autolock} (which reads to preserve A7/A8
     * across a write) and {@link getAutoLockState} (which reads for its own sake) — extracted so the two
     * don't drift on the query/keyTime-matching machinery. Takes an already-connected+subscribed
     * `mqtt`/`topic`; connection lifecycle stays the caller's concern (the write path keeps the
     * connection open for a following SET, the read path closes right after). Throws if no matching
     * reply arrives within {@link FF09_ACK_TIMEOUT_MS}.
     */
    private fetchFf09SettingsGetReply;
    /**
     * **Read the T85D0's current auto-lock settings over MQTT** — the `Ff09SettingsReader` implementation.
     * A pure GET, no SET: opens its own one-shot MQTT connection (same
     * lifecycle as {@link dispatchFf09Autolock}), reuses {@link fetchFf09SettingsGetReply}, then decrypts
     * + decodes fields `a1`-`a5` per `transport/ff09.ts`'s response tag map. Live-verified only insofar
     * as the underlying GET step already is (`setAutoLock`'s own read) — the standalone read path itself
     * has not been independently exercised against a real device yet.
     */
    getAutoLockState(sn: string, cmd: {
        adminUserId: string;
        deviceSn: string;
    }): Promise<AutoLockSnapshot>;
    /**
     * The `a2` account id an `eufy_life` DP frame embeds — the owning member's `admin_user_id` (or the
     * session user id), resolved by the injected {@link MqttRouterDeps.resolveAccountId}. Throws if the
     * resolver isn't wired or yields an empty id: the frame's `a2` opener is a required field, and a
     * fire-and-forget write with an empty account id would look like success while doing nothing.
     */
    private requireAccountId;
    /**
     * Wrap a built DP frame in its `eufy_life` MQTT envelope and publish it to the device's `.../req`
     * topic over the facade's persistent account-wide transport ({@link MqttRouterDeps.publishSecure}) —
     * the CONFIRMED light-write path. Fire-and-forget: the DP wire carries no delivery ack the SDK
     * has captured, so there's nothing to wait on here (unlike the ff09 paths above).
     */
    private publishDpFrame;
    /**
     * The `mqtt-dp` handler — a single `eufy_life` DP TLV write (on/off, brightness). The capability
     * supplies the opaque `mqttCmdCode`/`cmdCode` + already-tagged scalar `fields`; this builds the frame
     * ({@link buildDpFrame} prepends the `a1` timestamp + `a2` account id) and publishes it.
     */
    private dispatchMqttDp;
    /** Serialize and publish one semantic RGB DP action without changing configured brightness. */
    private dispatchDpColor;
    /**
     * The `aiot-dp` handler — a single DP write to a clean-line device (vacuum/mower). Builds the
     * AIoT MQTT envelope ({@link buildCleanDpEnvelope}) and publishes fire-and-forget to the device's
     * `cmd/eufy_home/{pn}/{sn}/req` topic over the facade's persistent transport. The clean line uses
     * the DEFAULT credential (same as `eufy_mega` devices) — no separate MQTT connection needed; only
     * `eufy_life` (smart lights) gets its own certificate. Confirmed live on T2351 (2026-07-30).
     */
    private dispatchAiotDp;
    /**
     * The `mqtt-dp-preset` handler — select a gallery effect by catalog id. Resolves the effect's
     * layer definition via the injected {@link MqttRouterDeps.resolvePreset} (HTTP catalog, client-
     * owned), serializes it to the `0x020D` effect frame ({@link dpPresetFields}), and publishes it;
     * if the catalog entry carries an overall brightness, sends the companion `0x0201` brightness frame
     * ({@link dpLevelFields}) right after, matching the app's two-frame effect apply.
     */
    private dispatchDpPreset;
}
