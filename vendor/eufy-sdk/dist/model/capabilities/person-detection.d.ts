import type { CapabilityModule } from "./types.js";
/**
 * `person_detection` — human/AI detection.
 *
 * Push events are the whole read surface: a person arrives as an event, and no owned camera reports a
 * detection-enable or detected-state parameter, so there is nothing for a state table to project.
 */
export declare const PERSON_DETECTION: CapabilityModule;
