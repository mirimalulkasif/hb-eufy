import { type SolixCapability, type SolixEnergyMeterReads } from "./capabilities/solix.js";
import { type SolixProductFamily } from "./solix-family.js";
import type { SolixDeviceRecord, SolixProductCategory, SolixSiteScene } from "../core/solix-types.js";
/**
 * The device record shape, re-exported from the model surface. It lives in `core/solix-types` so the
 * transport client can return it without crossing the transport↔model line.
 */
export type { SolixDeviceRecord } from "../core/solix-types.js";
export interface SolixIdentity {
    serial: string;
    productCode: string;
    /** Friendly name — the catalog marketing name if resolvable, else the record's alias/name. */
    name: string;
    /** Anker catalog category (e.g. "Accessory", "Portable Power Station"), if resolvable. */
    category?: string;
    /**
     * Normalized product family — the "what kind of thing is this" answer (power station, Solarbank,
     * smart meter, …), decorrelated from the marketing `category` string. See {@link SolixDevice.family}.
     */
    family: SolixProductFamily;
}
export interface SolixConnectivity {
    online: boolean;
    rssi?: number;
    ssid?: string;
}
/**
 * The `dev.energyMeter()` handle: the members-derived reads ({@link SolixEnergyMeterReads} —
 * `meterVoltageL1` is present only once a frame carrying its tag has landed). Every not-yet-named meter
 * quantity is read from {@link SolixDevice.telemetry} under its `channel_<hex tag>` key instead, which a
 * static members table cannot enumerate.
 */
export type SolixEnergyMeter = SolixEnergyMeterReads;
/** Options for {@link SolixDevice}. */
export interface SolixDeviceOptions {
    /** Catalog categories (from `SolixClient.getProductCatalog()`) — used to resolve name + category. */
    catalog?: SolixProductCategory[];
}
/**
 * A discovered Solix device with resolved category + capabilities. Feed live telemetry with
 * {@link applyReading} (from {@link SolixMqtt}'s `reading` events) to populate value accessors.
 */
export declare class SolixDevice {
    readonly serial: string;
    readonly productCode: string;
    readonly record: SolixDeviceRecord;
    private readonly caps;
    private readonly identity_;
    private values;
    constructor(record: SolixDeviceRecord, opts?: SolixDeviceOptions);
    /**
     * The device's {@link SolixProductFamily} — the classification a caller branches on to SORT devices
     * (a site's power stations vs its meters), the Solix analogue of eufy's `isHomeBase()`. Distinct from
     * {@link has}, which answers what the device can DO; family answers what KIND of device it is.
     */
    get family(): SolixProductFamily;
    /** All capabilities this device carries. */
    get capabilities(): SolixCapability[];
    /** Whether the device carries a capability — the only correct way to branch on behaviour. */
    has(capability: SolixCapability): boolean;
    /**
     * Merge a live telemetry reading (a `SolixMqtt` `reading` event) so accessors reflect it. Takes the
     * WHOLE reading, not just its values, and drops one addressed to a different device: the documented
     * wiring is `mqtt.on("reading", r => device.applyReading(r))`, and one MQTT stream carries every
     * watched meter on the account — so without this filter two meters would cross-feed each other's floats.
     * A reading with no `deviceSn` (a hand-built one) is accepted as-is.
     */
    applyReading(reading: {
        deviceSn?: string;
        values: Record<string, number>;
    }): void;
    /** All decoded float telemetry channels from the latest applied reading (raw, `channel_<tag>` keys). */
    telemetry(): Record<string, number>;
    identity(): SolixIdentity;
    firmware(): {
        version: string;
    } | undefined;
    connectivity(): SolixConnectivity | undefined;
    /**
     * The members-derived `energyMeter` reads, or `undefined` when the device has no meter. Each getter is
     * installed only for a tag this device has actually reported, and reads `this.values` LIVE — a handle
     * held across an {@link applyReading} reflects the newer values. Getter INSTALLATION is fixed at the
     * time of this call, so re-call it to pick up a tag first seen since.
     */
    energyMeter(): SolixEnergyMeter | undefined;
    /**
     * The {@link MemberDeps} the members engine needs: a read closure over the live values store, and the
     * evidence gate (`ctx.paramIds`) rebuilt from the ff09 tags this device has reported. No `codec` — the
     * codecs are eufy transport families and a Solix device belongs to none of them. The sink is a no-op:
     * Solix telemetry is read-only, no member here dispatches a command.
     */
    private meterDeps;
    /** The ff09 tags this device has reported, derived from the decoder's `channel_<hex>` keys. */
    private seenTags;
}
/**
 * The minimum a client must offer to be discovered against — the two wire reads {@link discoverSolixDevices}
 * composes. Typed STRUCTURALLY (not as `SolixClient`) so the model layer never imports the transport
 * client: the hard `transport ⊥ model` rule forbids it, and a structural shape needs no import.
 */
export interface SolixDeviceReader {
    getDevices(): Promise<SolixDeviceRecord[]>;
    getProductCatalog(): Promise<SolixProductCategory[]>;
}
/**
 * Resolve the product catalog for a discovery: a caller-supplied `opts.catalog` short-circuits the wire
 * read, and a failed `getProductCatalog()` degrades to no categories (names/families just go unresolved,
 * never a thrown discovery). Shared by {@link discoverSolixDevices} and `discoverSolixSites` so that
 * "a failed catalog is non-fatal" decision lives in exactly one place.
 */
export declare function resolveSolixCatalog(client: SolixDeviceReader, opts: {
    catalog?: SolixProductCategory[];
}): Promise<SolixProductCategory[]>;
/**
 * Discover an account's Solix devices as capability-driven {@link SolixDevice} objects — the wire+model
 * composition (a transport read + the product catalog) that used to be `SolixClient.discoverDevices()`.
 * It lives in the model layer because it builds `SolixDevice`; the wire client (now `transport/http`)
 * cannot, and passing it structurally keeps the layers decorrelated. Feed live telemetry to each result
 * via `SolixDevice.applyReading`.
 */
export declare function discoverSolixDevices(client: SolixDeviceReader, opts?: {
    catalog?: SolixProductCategory[];
}): Promise<SolixDevice[]>;
/**
 * Reduce a site "scene" snapshot to per-device telemetry readings — the BACKSTOP counterpart to the
 * realtime `ff09` decode. It emits the fields the scene reliably carries that the fast MQTT frame does
 * NOT: `batteryTemperature` (the realtime frame's BMS blob is empty, so `solixReadings` withholds it),
 * `batterySoc` (a cross-check/seed for the `0xa3` SOC), and `expansionPacks` — the count of ATTACHED
 * add-on battery packs (0 on a standalone main unit). Each reading is shaped exactly like a `SolixMqtt`
 * `reading` event — `{ deviceSn, values }` — so a caller can feed it straight into
 * {@link SolixDevice.applyReading} and broadcast it on the same path as a live frame. Entries with no
 * usable value are dropped.
 */
export declare function solarbankSceneReadings(scene: SolixSiteScene): {
    deviceSn: string;
    values: Record<string, number>;
}[];
