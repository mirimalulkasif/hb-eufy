/** Verified fields decoded from the `state_info` wire, before the client assigns domain semantics. */
export interface StateInfoSignal {
    readonly deviceSn: string;
    readonly status: boolean;
    readonly observedAt?: number;
    readonly sequence?: number;
}
/**
 * Decode the verified `eufy_life` device-availability wire. The current app handles only
 * `synq/eufy_life/{model}/{deviceSn}/state_info`, parses the envelope's string `payload`, and applies
 * its boolean `status` to the light identified by the topic serial. No station or transport scope is
 * projected from this signal, and non-boolean values are not interpreted.
 */
export declare function parseStateInfoSignal(topic: string, raw: unknown): StateInfoSignal | undefined;
