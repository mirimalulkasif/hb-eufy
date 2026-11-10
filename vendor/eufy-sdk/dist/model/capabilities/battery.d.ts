import type { AvailabilityContext, CapabilityModule, CommandContext } from "./types.js";
import { type Surface } from "./members.js";
import type { Command } from "../../core/contracts.js";
/**
 * The P2P **param-type ids** this battery/power capability reads and writes — the `param_type` a device
 * self-reports in `get_devs_list` / the `GET_CAMERA_INFO` (1103) live param list. Capability-owned wire
 * vocabulary (a curated subset; the full id→name catalog + schema live in `../param-dictionary.ts`).
 * Distinct from a feature-COMMAND id (the write outer-command) — these are STATE/settings param ids.
 */
export declare const BATTERY_PARAM: {
    /** Battery level 0-100 (app `BATTERY_VALUE`). */
    readonly BATTERY: 1101;
    /**
     * Battery/charge **status bitfield** (app `BATTERY_STATUS`). The app decodes it, not shown raw:
     * `charging = value ∉ {0,2}`; solar-panel-connected when `value ∈ {4,5,12,20}`. Drives the battery
     * `charging` property.
     */
    readonly BATTERY_STATUS: 2111;
    /** Battery temperature °C (app `GET_BATTERY_TEMP`). */
    readonly BATTERY_TEMP: 1138;
    /** Battery health 0-100 (app `APP_CMD_DEV_BATTERY_HEALTHY_V2`). */
    readonly BATTERY_HEALTH: 1198;
    /** Charging-in-progress flag (app `APP_CMD_SET_POWER_CHARGE`). */
    readonly POWER_CHARGE: 1293;
    /** Power **working mode** enum, e.g. optimal-battery / optimal-surveillance / custom (app `SET_INDOOR_POWER_MODE`). */
    readonly WORKING_MODE: 1246;
    /** Clip length in seconds (app `SET_RECORD_DURATION`). */
    readonly RECORD_DURATION: 1249;
    /** Minimum interval between clips, seconds (app `SET_RECORD_INTERVAL`). */
    readonly RECORD_INTERVAL: 1250;
    /** End-clip-early toggle — stop recording when motion ends (app `SET_RECORD_AUTO_STOP`). INVERTED: raw 0 = ON. */
    readonly RECORD_AUTO_STOP: 1251;
    /** Solar-panel light/charge intensity; 0 = none (app `APP_CMD_SOLAR_INTENSITY`). */
    readonly SOLAR_INTENSITY: 1309;
    /** Whether a solar panel supplied power in the last 24h (app `APP_CMD_GET_SOLAR_PANEL_CONNECT_24H`). */
    readonly SOLAR_CONNECT_24H: 6482;
    /** Battery power-history stats JSON (app `APP_CMD_GET_BATTERY_POWER_DATAS`). Often P2P-dump-only. */
    readonly BATTERY_POWER_DATAS: 3100;
    /**
     * `GET_CAMERA_INFO` — reported by battery cameras, meaning NOT evidenced. Read live as the constant
     * `5` on a T8170 at 92% and a T8171 at 27%, so nothing about it tracks the battery. See
     * `BATTERY_MEMBERS`'s `cameraInfo`.
     */
    readonly CAMERA_INFO: 1103;
};
/**
 * `battery` — battery level, charging state, health, temperature, solar input, and the power settings
 * that decide how hard the device works: the working mode, plus the three `record*` members that tune
 * its Customize-Recording mode (how long a recording runs, how soon the next may start, whether it stops
 * early when motion ends).
 *
 * Every param is a confirmed app-enum id read live off the fleet. `charging` is derived from the
 * `BATTERY_STATUS` (2111) bitfield the way the app itself decodes it (`value ∉ {0,2}`).
 * `batteryPowerStats` (3100) is only in the P2P param dump on some devices — read it via the live P2P
 * param query (the owner-gated cloud call can't return it).
 */
/**
 * The working modes the app offers (names shared across models). Use `WorkingMode.CustomizeRecording`
 * etc. with `setWorkingMode` / `setProperty` — each is resolved to that model's raw index via
 * {@link WORKING_MODE_MAPS} (models number them differently; a mode a model lacks is a safe no-op).
 */
export declare const WorkingMode: {
    readonly OptimalBatteryLife: "Optimal Battery Life";
    readonly OptimalSurveillance: "Optimal Surveillance";
    readonly CustomizeRecording: "Customize Recording";
    readonly BalanceSurveillance: "Balance Surveillance";
};
/** A working-mode name — the value side of {@link WorkingMode}. */
export type WorkingModeName = (typeof WorkingMode)[keyof typeof WorkingMode];
/** Power source options — pass `PowerSource.Battery` / `PowerSource.ExternalSolarPanel` to `setPowerSource`. */
export declare const PowerSource: {
    readonly Battery: "battery";
    readonly ExternalSolarPanel: "external";
};
/** A power-source name — the value side of {@link PowerSource}. */
export type PowerSourceName = (typeof PowerSource)[keyof typeof PowerSource];
/**
 * Bound battery/power state and controls — the object returned by `dev.battery()`.
 *
 * Every getter, setter, argument type and description is DERIVED from `BATTERY_MEMBERS`; there is
 * nothing this capability does that the table cannot state, so nothing is written out here. All writes
 * are fire-and-forget; confirm a change by re-reading.
 */
export type BatteryActions = Surface<typeof BATTERY_MEMBERS>;
/**
 * Reinterpret the reported power source (1293), whose wire form VARIES BY MODEL: a plain int on some
 * (T8124R), a JSON string `{"power_source":N}` on others. Both reduce to the numeric N; a value that is
 * neither is passed through as-is rather than turned into a plausible number.
 *
 * The richer raw `APP_CMD_SET_POWER_SOURCE` blob is a separate param, surfaced as `powerSourceInfo`.
 */
declare function decodePowerSource(raw: string | number | boolean): number | string;
/**
 * Power tier of a camera for its live-media budget and standalone P2P session: `"battery"` only when it
 * resolved the `battery` capability AND is not a listed mains-only model, else `"wired"`.
 */
export declare function cameraPowerTier(model: string | undefined, capabilities: ReadonlySet<string>): "wired" | "battery";
/**
 * The params whose subject IS the physical cell — so every member reading one must carry
 * {@link notMainsCamera}.
 *
 * The ONE place that fact is declared. {@link cellGated} applies {@link notMainsCamera} from this list
 * when the table is built, so a member never states the gate itself: adding a cell read is adding its
 * param here, and there is no second place for it to be missing from. A per-member `available` was the
 * alternative and is what the first two passes of this guard got wrong, in both directions — first by
 * covering two of the seven, then by reading `unexposed` as covering a third.
 *
 * What is NOT here matters as much.
 *
 *  - `workingMode` and the three `record*` settings describe how hard the camera works, not what powers
 *    it, and a mains camera genuinely has them. They are the reason the capability stays attached.
 *  - `cameraInfo` (1103) is a number whose meaning is unevidenced. Gating it would assert it is a
 *    battery fact, which is the kind of claim this guard exists to stop making.
 *  - `powerSource` (1293) is the open one. Both values it names — `Battery` and `External Solar Panel` —
 *    describe how a CELL is fed, so by this list's own rule it arguably belongs here. It is out because
 *    every param above is one a live mains camera was observed to publish and 1293 was not among them,
 *    and because it is `requires`-gated on its own param, so it appears only where the device reports
 *    it. Gating it would also withhold a described WRITE rather than a read, which is a different class
 *    of change. Unresolved rather than decided: see the note in the pull request.
 *
 * The two solar params ARE here: a panel exists to charge a cell, so a device without one has no solar
 * harvest to report either.
 */
export declare const CELL_PARAMS: readonly number[];
/**
 * The app's charger-state decode: `charging = value ∉ {0,2}`. The app applies this one rule both to a
 * camera's `BATTERY_STATUS` (2111) and to a keypad's `APP_CMD_KEYPAD_BATTERY_CHARGER_STATE` (1655).
 */
export declare function isChargingState(v: string | number | boolean): boolean;
/**
 * Every `battery` feature, declared once — the property schema, the evidence-gated getters, the derived
 * setters, the intent routes and the descriptions all come out of this table. Order is schema order.
 *
 * Each write is gated on the device reporting the param it reads back, because "has a battery" is much
 * weaker evidence than "speaks this setting": an entry sensor reports a level (1101) and nothing else,
 * and handing it a power-source frame it never accepts would look like success.
 *
 * Exported but NOT published: each entry states its wire id and the evidence it was confirmed on,
 * which the reference site does not carry.
 * @internal
 */
export declare const BATTERY_MEMBERS: {
    /**
     * The headline percentage, and this capability's detection evidence: reporting 1101 is what proves a
     * device is battery-powered, which is also the fact `MediaProvider` reads to decide a stream needs a
     * power budget. Published flat as `battery` — `level` alone is claimed by `suction` too.
     */
    readonly level: {
        readonly param: 1101;
        readonly property: "battery";
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "verified";
        readonly description: "Battery level 0-100 (verified: param 1101).";
    };
    /**
     * Derived from `BATTERY_STATUS` (2111), NOT `powerCharge` (1293): the app decodes it as
     * `charging = value ∉ {0,2}` (Hermes `device_charging_mode` parser). That catches solar
     * trickle-charge which 1293 misses — a T8124 with a built-in solar panel reads 4 = charging.
     */
    readonly charging: {
        readonly param: 2111;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly coerce: typeof isChargingState;
        readonly description: string;
    };
    /**
     * 1293 is the READABLE indicator (6445 is write-only/cloud-hidden). Verified live on a T8124R via an
     * app-toggle before/after diff: 0 = Battery, 1 = External Solar Panel. Values beyond 0/1 (some models
     * report 5) are shown raw — `enumValues` only labels the two that are confirmed.
     *
     * The write is a `1350` SET_PAYLOAD, inner cmd 1293, `{charge_mode:N}`, `mValue3` 0 (the app uses 0,
     * not the cmd id), and the setter accepts a NAME as well as the index the getter answers.
     */
    readonly powerSource: {
        readonly accepts: PowerSourceName;
        readonly param: 1293;
        readonly type: "enum";
        readonly kind: "enum";
        readonly enumValues: {
            readonly 0: "Battery";
            readonly 1: "External Solar Panel";
        };
        readonly provenance: "verified";
        readonly coerce: typeof decodePowerSource;
        readonly requires: readonly [1293];
        readonly args: readonly [{
            readonly name: "source";
            readonly kind: "enum";
            readonly description: "The raw value, or the name `battery`/`external`.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * A DEVICE-SPECIFIC mode index: the app maps value→mode through a per-model config (Hermes
     * `doValueConvertToUIIndex` + a per-device `mappingConfigObject`), NOT a universal enum. The domain
     * is resolved per device by {@link publishedWorkingModeDomain}: a confirmed model publishes its
     * {index → label} set (the 3-mode identity map for battery cameras, the 4-mode map for the T8214
     * doorbell), and a model with no confirmed set publishes none. Name a value with {@link
     * resolveWorkingMode}.
     *
     * The static `kind` stays `"scalar"`: a member with no static `enumValues` cannot declare `kind:
     * "enum"` (the value-kinds guard). `enumValuesFor` supplies the per-device domain, and the resolver
     * stamps the RESOLVED spec/read as an enum so the published surface is self-consistent.
     *
     * The write is DIRECT-BINARY, outer-cmd 1246, `[channel][value=mode][account_id]`. A mode NAME the
     * model does not offer resolves to nothing, which is what makes the setter refuse rather than send a
     * wrong index.
     */
    readonly workingMode: {
        readonly accepts: WorkingModeName;
        readonly param: 1246;
        readonly type: "number";
        readonly kind: "scalar";
        readonly enumValuesFor: typeof publishedWorkingModeDomain;
        readonly provenance: "verified";
        readonly requires: readonly [1246];
        readonly min: 0;
        readonly args: readonly [{
            readonly name: "mode";
            readonly kind: "scalar";
            readonly min: 0;
            readonly description: "A mode index, or its name. The set is per-model — name one with resolveWorkingMode.";
        }];
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command | undefined;
    };
    /**
     * One of the three Customize-Recording settings, and the pair to `recordInterval`: this bounds how
     * long a clip runs, that bounds how soon the next may begin. Writing it on a device in another
     * working mode changes the stored setting but nothing observable, so set `workingMode` first. Gated
     * on the device reporting 1249, since "has a battery" does not mean "speaks this setting".
     */
    readonly recordDuration: {
        readonly param: 1249;
        readonly type: "number";
        readonly unit: "s";
        readonly kind: "seconds";
        readonly provenance: "verified";
        readonly requires: readonly [1249];
        readonly min: 0;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The motion re-arm gap: seconds of enforced quiet after a clip ends before another may start, so it
     * is the setting that decides how much a busy scene costs the battery. Same Customize-Recording
     * scope and same per-param gate as `recordDuration`; the two are usually tuned together.
     */
    readonly recordInterval: {
        readonly param: 1250;
        readonly type: "number";
        readonly unit: "s";
        readonly kind: "seconds";
        readonly provenance: "verified";
        readonly requires: readonly [1250];
        readonly min: 0;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * INVERTED on the wire (a disable flag): the app decodes `stop-early = (value === 0)` (Hermes
     * `motion_stop_end_early = asBooleanToIntString("0" === value)`), so raw 0 means the feature is ON.
     */
    readonly recordAutoStop: {
        readonly param: 1251;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "verified";
        readonly requires: readonly [1251];
        readonly invert: true;
        readonly description: string;
        readonly write: (v: string | number | boolean, ctx: CommandContext) => Command;
    };
    /**
     * The cell temperature the device measures, in its own degrees Celsius — never converted, since
     * rescaling a number sourced only from the app's param table would be inventing precision. Read-only:
     * `apk` provenance means the id comes from the disassembled app, not from a captured toggle, so
     * nothing here establishes a write. Pairs with the `batteryAlert` HOT push.
     */
    readonly temperature: {
        readonly param: 1138;
        readonly property: "batteryTemperature";
        readonly type: "number";
        readonly unit: "°C";
        readonly kind: "celsius";
        readonly provenance: "apk";
        readonly description: "Battery temperature (1138 GET_BATTERY_TEMP).";
    };
    /**
     * Remaining cell capacity as a percentage of new — a slow-moving ageing figure, NOT the current
     * charge (`level` is that), which is why it takes its own flat name `batteryHealth`. `apk`
     * provenance: the id is read out of the disassembled app rather than from a captured change.
     */
    readonly health: {
        readonly param: 1198;
        readonly property: "batteryHealth";
        readonly type: "number";
        readonly unit: "%";
        readonly kind: "percent";
        readonly provenance: "apk";
        readonly description: "Battery health 0-100 (1198 APP_CMD_DEV_BATTERY_HEALTHY_V2).";
    };
    /**
     * How much light the solar panel is currently harvesting. A bare `scalar` on purpose: only the zero
     * point is established (0 = no solar input), so the SDK declares no unit and no ceiling rather than
     * publishing a percentage the wire has not been shown to be. `apk` provenance.
     */
    readonly solarIntensity: {
        readonly param: 1309;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "apk";
        readonly description: "Solar-panel light/charge intensity (1309 APP_CMD_SOLAR_INTENSITY); 0 = no solar input.";
    };
    /**
     * A rolling 24-hour verdict on whether the panel contributed anything — so it stays true through a
     * night, and is the right read for "is the panel actually working", where `solarIntensity` only says
     * what it is doing this instant. `apk` provenance; the id is the app's own, not a captured toggle.
     */
    readonly solarConnected24h: {
        readonly param: 6482;
        readonly type: "bool";
        readonly kind: "boolean";
        readonly provenance: "apk";
        readonly description: "Whether a solar panel supplied power in the last 24h (6482 APP_CMD_GET_SOLAR_PANEL_CONNECT_24H).";
    };
    /**
     * Reported, so it stays in the schema and answers through `getProperty` — but given no typed getter:
     * the payload's fields have never been decoded, and a getter would hand back an opaque blob typed as
     * though it meant something.
     *
     * `unexposed` is NOT a substitute for the cell gate. It suppresses the fluent GETTER; `propertiesOf`
     * filters `writeOnly` and `available` and deliberately not `unexposed`, because a schema entry
     * reachable through `getProperty` is the whole point of the mark. So a cell param needs
     * {@link CELL_PARAMS} either way, or a mains camera publishes "battery power history" and answers it.
     */
    readonly batteryPowerStats: {
        readonly param: 3100;
        readonly type: "string";
        readonly kind: "text";
        readonly provenance: "apk";
        readonly unexposed: true;
        readonly description: string;
    };
    /**
     * `GET_CAMERA_INFO` (1103), reported by battery cameras with its meaning unevidenced — so it is in the
     * schema and reachable through `getProperty`, with no typed getter.
     *
     * It is NOT a low-battery flag, on two independent grounds: the app's own param table names 1103
     * `GET_CAMERA_INFO`, and a T8170 at 92% and a T8171 at 27% both report the constant `5`. Typed as a
     * bool it would read `false` on every device forever — a shape indistinguishable from a real answer.
     */
    readonly cameraInfo: {
        readonly param: 1103;
        readonly type: "number";
        readonly kind: "scalar";
        readonly provenance: "apk";
        readonly unexposed: true;
        readonly description: string;
    };
};
export declare const BATTERY: CapabilityModule;
/**
 * Working-mode value → label maps, keyed by device model T-code. Models number the same mode
 * differently and the mapping is per-device, so the maps are kept here and resolved by model.
 * **Expand as new models are confirmed** — most battery cameras use the 3-mode identity map
 * (`DEFAULT`); a model with a different set (e.g. a doorbell's extra "Balance Surveillance") gets its
 * own entry, matched by model T-code prefix.
 */
export declare const WORKING_MODE_MAPS: Readonly<Record<string, Readonly<Record<number, string>>>>;
/**
 * Resolve a `workingMode` raw value to its human mode label for a device model — or `undefined`
 * if the value isn't in that model's map. Matches the model against the {@link WORKING_MODE_MAPS} keys
 * by T-code prefix, falling back to the 3-mode camera `DEFAULT`.
 */
export declare function resolveWorkingMode(model: string | undefined, value: number): string | undefined;
/**
 * Return the working-mode {index → label} map for a device model — its own {@link WORKING_MODE_MAPS}
 * entry when one matches by T-code prefix, otherwise the 3-mode `DEFAULT`. Always returns a map (used
 * for name↔index resolution), unlike {@link publishedWorkingModeDomain} which may return `undefined`.
 */
export declare function workingModeMap(model: string | undefined): Readonly<Record<number, string>>;
/**
 * Return the working-mode {index → label} domain to publish for a device, or `undefined` when the
 * device has no confirmed domain. Returns a model's own {@link WORKING_MODE_MAPS} entry when one
 * matches by T-code prefix, else the 3-mode `DEFAULT` for a {@link WORKING_MODE_DEFAULT_MODELS} model,
 * else `undefined` — so a camera that merely reports the param without a confirmed set (e.g. the mains
 * Indoor Cam T8419) publishes no domain rather than an unverified one.
 */
declare function publishedWorkingModeDomain(ctx: AvailabilityContext): Readonly<Record<number, string>> | undefined;
/**
 * Inverse of {@link resolveWorkingMode}: the raw index for a mode NAME on a device model — or
 * `undefined` if that model doesn't offer the named mode. Used to let `setWorkingMode` take names.
 */
export declare function resolveWorkingModeValue(model: string | undefined, name: string): number | undefined;
export {};
