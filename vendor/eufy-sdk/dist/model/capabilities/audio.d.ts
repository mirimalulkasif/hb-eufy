import { isHomeBase } from "../device-family.js";
import { isCameraCodec } from "./access.js";
import { type Surface } from "./members.js";
import type { AvailabilityContext, CapabilityModule, CommandContext } from "./types.js";
import type { Command } from "../../core/contracts.js";
/**
 * The P2P **feature-command ids** this audio capability drives — the outer-cmd IS the param id on the
 * camera side (direct-binary struct), or the inner cmd of a `1350` SET_PAYLOAD on the station side.
 * Capability-owned wire vocabulary (transport forwards `cmd.param` opaquely; full id→name catalog in
 * the generated `transport/p2p/commands.ts`). All ✅ wire-verified live — see the module JSDoc below.
 */
export declare const AUDIO_CMD: {
    /**
     * Microphone on/off (app `AUDIO_MICROPHONE_SWITCH`). ✅ Wire verified live on T8214: direct-binary
     * 136-byte struct, signCode 8, 1=on/0=off (a switch, not a mute).
     */
    readonly AUDIO_MICROPHONE: 1240;
    /** Speaker on/off (app `AUDIO_SPEAKER_SWITCH`). ✅ Wire verified live on T8214 — direct-binary, 1=on/0=off. */
    readonly AUDIO_SPEAKER: 1241;
    /** Speaker volume 0..100 (app `DOORBELL_AUDIO_VOLUME`). ✅ Same direct-binary wire; write verified live on T8214 (set 60 → param 60). */
    readonly SPEAKER_VOLUME: 1230;
    /**
     * Audio recording on/off (app `DOORBELL_AUDIO_RECORDING_SWITCH`) — whether the camera records audio
     * with video. Reported by every camera. ✅ Wire reversed from a live outbound capture + L2 decrypt on
     * T8425 (ch3): `1350` SET_PAYLOAD on the device channel (mChannel = device ch, mValue3 0), payload
     * `{channel:<deviceCh>, record_mute:0|1}`. The key is `record_mute` and it is **INVERTED** —
     * `record_mute:1` = muted (recording OFF), `record_mute:0` = recording ON.
     */
    readonly AUDIO_RECORDING: 1288;
    /**
     * Doorbell ringtone/chime volume 0..100 (app `DOORBELL_RINGTONE_VOLUME`). ✅ Wire verified live on
     * T8214 — same direct-binary 136-byte struct, signCode 8. Doorbell-only: this capability adds it when
     * the device is a doorbell.
     */
    readonly DOORBELL_RINGTONE_VOLUME: 1708;
    /**
     * HomeBase voice **prompt** volume 0..100 (app `APP_CMD_SET_PROMPT_VOLUME`). ✅ Wire verified live on
     * T8030 (audible): the `1350` SET_PAYLOAD wrapper on ch0 with `payload:{value}`. Station-only.
     */
    readonly HUB_PROMPT_VOLUME: 1292;
};
/**
 * Bound audio controls — the object returned by `dev.audio()`.
 *
 * Everything is DERIVED from `AUDIO_MEMBERS`. Which methods a device has depends on its FAMILY, so
 * every write is optional and a caller checks: a **camera/doorbell** gets `setMicrophone`/`setSpeaker`/
 * `setVolume`/`setAudioRecording` (+ `setRingtoneVolume` on a doorbell); a **HomeBase/station** gets
 * `setPromptVolume`. Alarm-output configuration belongs to the `siren` capability.
 */
export type AudioActions = Surface<typeof AUDIO_MEMBERS>;
/**
 * Every general audio feature, declared once and family-gated across cameras, doorbells, and HomeBases.
 *
 * Camera side (Doorbell T8214): outer-cmd = the param id
 * (1240/1241/1230/1708), signCode 8, device channel, 168B→136B direct-binary struct
 * `[u32 channel][u32 value][account_id pad→128]`; polarity is 1=on. HomeBase prompt volume `1292`
 * rides the `1350` SET_PAYLOAD wrapper on channel 0 with `payload:{value}` and is not cloud-reflected.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const AUDIO_MEMBERS: {
    /**
     * A SWITCH, not a mute: `true` powers the mic, so the polarity reads the same way round on the wire
     * (1 = on) with no `invert`. Camera-family only — a HomeBase has no microphone, so the getter and
     * setter are both absent there and a caller must check.
     */
    readonly microphone: {
        readonly param: 1240;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: "Microphone on/off (1240 AUDIO_MICROPHONE_SWITCH; 1=on/0=off). Wire verified live on T8214.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The camera's own speaker switch — what talkback and the doorbell's responses play out of. Distinct
     * from `volume`, which sets how loud it is: turning this off silences the camera whatever the level
     * says. Camera-family only, like `microphone` above; HomeBase voice prompts use `promptVolume`.
     */
    readonly speaker: {
        readonly param: 1241;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: "Speaker on/off (1241 AUDIO_SPEAKER_SWITCH; 1=on/0=off). Wire verified live on T8214.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * `volume` is the accessor a caller sees; the flat property has to be `speakerVolume` because three
     * capabilities claim `volume`. Both names reach the same write through the intent path.
     */
    readonly volume: {
        readonly param: 1230;
        readonly property: "speakerVolume";
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly min: 0;
        readonly max: 100;
        readonly intentNames: readonly ["volume"];
        readonly description: "Speaker volume 0..100 (1230 DOORBELL_AUDIO_VOLUME). Write verified live on T8214 (set 60 → param 60).";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /** Raw param 1288 is `record_mute` (1 = muted / recording OFF), so audioRecording = NOT record_mute. */
    readonly audioRecording: {
        readonly param: 1288;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly invert: true;
        readonly provenance: "verified";
        readonly available: typeof isCameraCodec;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * Doorbell ring/chime loudness — WRITE-ONLY here on purpose. The READ property `ringtoneVolume` (1708)
     * lives on the `doorbell` capability: 1708 leaks onto non-doorbell cameras, so it cannot be an `audio`
     * property (which spans all cameras) without over-surfacing junk. Audio owns the write.
     */
    readonly ringtoneVolume: {
        readonly param: 1708;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly writeOnly: true;
        readonly provenance: "verified";
        readonly available: (ctx: AvailabilityContext) => boolean;
        readonly min: 0;
        readonly max: 100;
        readonly description: "Doorbell ring/chime volume 0..100 (1708 DOORBELL_RINGTONE_VOLUME). Wire verified live on T8214.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /** HomeBase voice-prompt volume uses the 1350 SET_PAYLOAD wrapper on channel 0 and has no cloud readback. */
    readonly promptVolume: {
        readonly param: 1292;
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly writeOnly: true;
        readonly provenance: "verified";
        readonly available: typeof isHomeBase;
        readonly min: 0;
        readonly max: 100;
        readonly description: "HomeBase voice-prompt volume 0..100 (1292 APP_CMD_SET_PROMPT_VOLUME). Verified audible on a T8030.";
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
};
export declare const AUDIO: CapabilityModule;
