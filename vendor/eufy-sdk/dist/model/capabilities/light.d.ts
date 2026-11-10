import type { CapabilityModule, CommandContext } from "./types.js";
import { type Surface } from "./members.js";
import type { Command } from "../../core/contracts.js";
/**
 * The P2P **feature-command ids** this light capability drives. Capability-owned wire vocabulary —
 * the transport forwards `cmd.param` opaquely and never names them (full id→name catalog in the
 * generated `transport/p2p/commands.ts`).
 */
export declare const LIGHT_CMD: {
    /** Spotlight momentary on/off; `{time,type,value}` under 1700. ✅ Verified via P2P state readback (3/3). */
    readonly FLOODLIGHT_SWITCH: 1400;
    /**
     * Spotlight brightness 1..100. ✅ SOLVED & verified live (T8425 + T8124): direct-binary command,
     * 136-byte struct `[u32 ch][u32 value][account_id pad→128]` (value = raw 1..100), NOT a JSON wrapper.
     */
    readonly SPOTLIGHT_BRIGHTNESS: 1401;
    /** Spotlight master enable — distinct from the on/off switch. ✅ Verified live T8124 (same 136-byte direct-binary struct as brightness). */
    readonly SPOTLIGHT_ENABLE: 1403;
    /** Spotlight color temperature 0=warm..100=cool. ✅ Verified live T8124 (only tunable-white spotlights respond; T8425 is white-only). */
    readonly SPOTLIGHT_COLOR_TEMP: 1410;
    /**
     * Auto-spotlight = "motion-activated light" — light up when motion fires. ✅ Wire reversed from a live
     * OUTBOUND P2P capture + replay-verified on T8425 (ch3, 2026-07-13, ON+OFF): the real command
     * is **cmd 1422**, carried in a `1350` SET_PAYLOAD envelope on the DEVICE channel (mChannel = device
     * channel, mValue3 0), with a COMPOSITE payload — NOT a bare bool:
     *   `{brightness:0..100, enable:0|1, latitude:"", longtitude:"" (sic), mode:1, schedule:[], sunset2rise:0, time}`
     * `enable` is the on/off; `time` = auto-off seconds; `mode`/`schedule`/`sunset2rise` are the scheduling
     * knobs. See {@link AutoSpotlightOptions}.
     * NB: the app-JS constant `APP_CMD_SET_LIGHT_CTRL_PIR_SWITCH` (1408) is a RED HERRING for this device —
     * the T8425 never emits 1408; three 1408 wire attempts all no-op'd. (No `1408` constant is defined — it's
     * dead; do not add one.)
     */
    readonly MOTION_ACTIVATE_LIGHT: 1422;
};
/**
 * Tunables for the "motion-activated light" (auto-spotlight): the spotlight lights up when the camera
 * detects motion. The device takes the WHOLE config on every write — there's no isolated on/off — so
 * these carry the scheduling knobs alongside the enable flag. Defaults mirror the app's; the current
 * values can't be read back, so any field left unset is written as its default rather than preserved.
 */
export type AutoSpotlightOptions = {
    /** Spotlight brightness 1..100 when it triggers (default 50). */
    brightness?: number;
    /** Auto-off timer in seconds after the light triggers (default 30). */
    time?: number;
    /** Scheduling mode (default 1). */
    mode?: number;
};
/**
 * Bound spotlight / floodlight controls — the object returned by `dev.light()`.
 *
 * The reads and their setters are DERIVED from `LIGHT_MEMBERS`: one declaration per feature gives
 * the getter, the setter, its argument type and its description. Only what a member table cannot state
 * is written out below.
 */
export type LightActions = Surface<typeof LIGHT_MEMBERS> & {
    /** Turn the light on. Throws if this model's switch wire is unverified. */
    on(): Promise<void>;
    /** Turn the light off. Throws if this model's switch wire is unverified. */
    off(): Promise<void>;
    /**
     * Enable/disable the **motion-activated light** (auto-spotlight): the spotlight lights up when the
     * camera detects motion.
     *
     * ⚠️ This is a COMPOSITE write, and it is WRITE-ONLY: the setting is not reported back in the device's
     * params, so the current config cannot be read and merged. Calling it with just `on` re-sends the
     * DEFAULT brightness/auto-off/mode ({@link AutoSpotlightOptions}), overwriting whatever the user set.
     * To preserve their config, pass the current values in `opts`. That is why this is a method and not a
     * member — the caller must own the composite.
     */
    setAutoSpotlight(on: boolean, opts?: AutoSpotlightOptions): Promise<void>;
};
/**
 * Every `light` feature, declared once. The property schema, the typed getters, the derived setters,
 * the intent routes and the descriptions all come out of this table.
 *
 * Auto-spotlight (1422) is deliberately absent: it is a COMPOSITE write — brightness, auto-off, mode
 * and enable sent together — and WRITE-ONLY, so a plain toggle would re-send hardcoded defaults and
 * clobber whatever the user set. It stays the explicit `setAutoSpotlight(on, opts)` method, where the
 * composite is visible at the call site.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const LIGHT_MEMBERS: {
    /**
     * Whether the lamp is lit RIGHT NOW — the momentary switch, not a setting. Measured on a T8170: 1400
     * goes to `1` when a client lights the spotlight and back to `0` when that client stops, so the value
     * tracks whoever is streaming rather than a preference anyone set. The vendor app lights the lamp for a
     * live view and drops it on quitting.
     *
     * So it reads on whenever any client is watching. The setting a user changes and expects to persist
     * is {@link spotlightEnabled}.
     *
     * The switch refuses for a reason a value check cannot give — this model's frame SHAPE is unconfirmed —
     * so `switchFrame` throws that reason and `bindMembers` turns it into the rejection, rather than
     * letting the generated "not a valid value" blame a boolean that was never the problem.
     */
    readonly isOn: {
        readonly param: 1400;
        readonly property: "light";
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
        readonly writeAs: "set";
        readonly aliases: {
            readonly on: true;
            readonly off: false;
        };
    };
    /**
     * Manual level for the spotlight, 1-100 — the floor is 1 rather than 0 because a 0 reads as "off" and
     * that is `isOn`'s job. The write is pinned to the level-2 direct-binary frame (`directBinary`),
     * the only shape captured for it, so a standalone camera that never negotiates a level-2 key cannot
     * set it even though the getter reads fine.
     */
    readonly brightness: {
        readonly param: 1401;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "verified";
        readonly min: 1;
        readonly max: 100;
        readonly description: "Manual brightness, range 1-100 (1401). Verified live (T8425 + T8124).";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * Warm-to-cool on a 0-100 scale — a `scalar`, not a percentage or a mired value, since 0 is one end
     * of a range rather than "none". `writeOnly`, so there is a setter and no getter at all: the device
     * accepts the setting and never reports it back.
     * Only tunable-white spotlights respond; a white-only model accepts the frame and does nothing.
     */
    readonly colorTemp: {
        readonly param: 1410;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "verified";
        readonly writeOnly: true;
        readonly min: 0;
        readonly max: 100;
        readonly description: "Colour temperature, 0 (warm) to 100 (cool). Not reported back, so it is write-only.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The master enable, one level above {@link isOn}: this decides whether the spotlight may light at all,
     * where `isOn` is the momentary switch. `writeAs` names the setter `setEnabled` rather than the
     * `setSpotlightEnabled` the key would derive, since the capability is already the spotlight.
     *
     * Reported, so it is a read as well as a write. ✅ Verified live on a T8170: the cloud device list
     * carries 1403, and its value tracks the vendor app's spotlight setting in both directions — `1` to `0`
     * when the setting is switched off, `0` to `1` when it is switched back on, so the polarity is direct
     * and 1 means enabled. The poll reports a param only when its PREVIOUS value differed, so the id is in
     * the record rather than newly appearing. The param dictionary names it `floodlightTotalSwitch`
     * (`app:FLOODLIGHT_TOTAL_SWITCH`) and lists the T8170 among its models.
     *
     * This is the switch a user changes and expects to STAY changed. {@link isOn} is a different fact:
     * the lamp being lit right now, driven by whichever
     * client is streaming — the vendor app lights it for a live view and drops it on quitting.
     *
     * The T8423 write takes the session-chosen level; level-1 int+string was verified live on a standalone
     * unit.
     */
    readonly spotlightEnabled: {
        readonly param: 1403;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
        readonly writeAs: "setEnabled";
    };
};
export declare const LIGHT: CapabilityModule;
