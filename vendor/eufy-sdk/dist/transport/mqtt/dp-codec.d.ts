import type { DpInboundFrame } from "../../core/contracts.js";
/** One TLV field in a DP frame (tag `0xa1`-`0xff`, arbitrary-length value). */
export interface DpField {
    tag: number;
    value: Buffer;
}
/**
 * Build one `eufy_life` DP TLV frame: `[ff 09][total len][00 03 00 02 02][subtype][tag/len/value…]
 * [xor]`. `subtype` = `cmdCode & 0xff`. Every frame opens with `a1`=timestamp (u32LE) + `a2`=account
 * id (ASCII), prepended here so callers supply only the command-specific fields (`0xa3` onward).
 *
 * The total-size field at offset 2 is a **u16LE**, not a single byte: `0x020D` effect frames routinely
 * exceed 255 bytes, and a truncated high byte yields a frame the light rejects outright.
 */
export declare function buildDpFrame(cmdCode: number, accountId: string, fields: readonly DpField[]): Buffer;
/**
 * Wrap a DP frame in the `eufy_life` MQTT `/req` envelope the SDK publishes:
 * `{head:{…,cmd:mqttCmdCode}, payload: JSON({account_id, device_sn, data:<b64 frame>, trans:""})}`.
 * The stringified result is the MQTT message body. `client_id` follows the app's
 * `ios-eufy_mega-{userId}-{uuid}` shape; its exact value is CONFIRMED not to affect a write.
 */
export declare function buildDpEnvelope(opts: {
    accountId: string;
    deviceSn: string;
    mqttCmdCode: number;
    frame: Buffer;
}): string;
/**
 * Decode an inbound `eufy_life` MQTT message into its DP frame, or `undefined` on any shape mismatch —
 * another appliance's traffic on the same connection must fall through, never throw.
 *
 * The inbound wrapping is **asymmetric with {@link buildDpEnvelope}** and double-nested: `payload` is a
 * JSON string `{data, sn, pn}` whose `data` is base64 of *another* JSON string, whose own `data` is the
 * frame as **hex** (outbound carries base64 at that inner position). The frame is then validated —
 * magic, the u16LE self-declared length — before any field is read, and the TLV walk is bounded by the
 * trailing checksum byte so a truncated or lying length yields nothing rather than a misread.
 *
 * Tag MEANING is not decided here: the fields come back in wire order for the capability to interpret.
 */
export declare function parseDpMessage(raw: unknown): DpInboundFrame | undefined;
/**
 * Parse an AIoT realtime report into its data-point map — the Clean/appliance line's device→app leg,
 * and the counterpart to {@link parseDpMessage}'s TLV frames. The two lines share a broker and a
 * `{head, payload}` envelope but nothing below it: this payload is plain JSON, not a binary frame.
 *
 * `payload` is `{t, protocol, account_id, device_sn, data}` — sometimes as a JSON string, sometimes
 * already an object, so both are accepted. The points live under `data`; a report that flattens them
 * to the top level is read that way instead, with the envelope's own keys skipped.
 *
 * Point ids come back as numbers and every value as a string, matching the cloud record's param shape
 * so a report merges into device state on the same path a polled record does. Values are NOT
 * interpreted: a scalar arrives as its own text and a structured point as the base64 its device sent,
 * for the capability that owns the id to decode.
 *
 * Defensive throughout — this runs against every message on a shared connection, so an unrelated one
 * yields `undefined` rather than throwing.
 */
export declare function parseAiotDpReport(raw: unknown): Record<number, string> | undefined;
