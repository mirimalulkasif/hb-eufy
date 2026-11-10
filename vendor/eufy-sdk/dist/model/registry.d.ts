/**
 * Device registry + the **3-tier resolver**.
 *
 * Resolving a {@link CloudRecord} to a {@link ResolvedDevice} (`{ codec, capabilities,
 * properties, name }`) is the heart of the data-driven model. Most-specific wins, but the
 * result is always *additive* so nothing is ever lost:
 *
 *  1. **model row** (curated, tier 1) — a hand-authored {@link RegistryEntry} keyed by T-code.
 *     Best naming + curated extra capabilities. Optional; most devices never need one.
 *  2. **category default** (tier 2) — {@link classify} maps the cloud `device_type` (or, failing
 *     that, the model code) to a {@link Codec}, which contributes its baseline capabilities.
 *  3. **inference** (tier 3) — {@link detectCapabilities} adds whatever the device can *prove*
 *     about itself from its reported params + model/category strings (graceful unknown).
 *
 * The final capability set is the union of all three tiers (deduped), minus the ones a module marks
 * {@link import("./capabilities/types").CapabilityModule.ownedByStation} when the record says this
 * device hangs off a parent — the one place the result is subtractive, because a control the group's
 * owner holds is one this device cannot answer for however it was granted. `source` records the most
 * authoritative tier that fired, for diagnostics.
 *
 * The curated rows below are intentionally a **small seed** — the system classifies and works
 * read-only for devices with no row at all. Rows exist only to add curation (pretty names,
 * capabilities not provable from params alone). They are the place to encode model-specific
 * knowledge as it is *confirmed* (via the APK / a mega query) — never as a dumping ground.
 *
 * @module model/registry
 */
import type { CloudRecord, RegistryEntry, ResolvedDevice, Capability, Codec, PropertySpec } from "./types.js";
/**
 * Curated model rows (tier 1), keyed by **uppercase T-code**. Seed set only — extend as model
 * specifics are confirmed. Capabilities here are *added* to the codec baseline + inference.
 *
 * NOTE: these are illustrative seeds chosen to exercise the resolver; each should be confirmed
 * against first-party evidence before being relied on (same trust rule as param ids).
 */
export declare const MODEL_REGISTRY: Readonly<Record<string, RegistryEntry>>;
/**
 * Resolve a cloud device record into its full model shape via the 3-tier lookup.
 *
 * Capability precedence (earlier = wins on property-name conflicts in `mergeProperties`):
 * curated row caps → codec baseline → inferred extras.
 *
 * @param rec the minimal cloud record (deviceType / model / category / params).
 * @returns the resolved `{ codec, capabilities, properties, name, source }`.
 */
export declare function resolveDevice(rec: CloudRecord): ResolvedDevice;
/**
 * The property manifest for a device, from its capabilities and the record's facts. The single place
 * an {@link AvailabilityContext} is built — so a family-gate (`available`) and a per-model enum
 * (`enumValuesFor`) are decided from the same truthful, session-free view on every path (initial
 * resolve and {@link Device.reresolve}). Populated only from what a record carries: its cloud params and
 * the params its device reported over realtime, the same evidence a bound getter is gated on. Never
 * transport fields a live session hasn't produced.
 */
export declare function resolveProperties(rec: CloudRecord, codec: Codec, capabilities: Capability[]): PropertySpec[];
