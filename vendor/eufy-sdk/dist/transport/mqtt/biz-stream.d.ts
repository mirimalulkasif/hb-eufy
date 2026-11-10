/**
 * The `payload.protocol` discriminator, which says what the whole message is before any field of it is
 * read. Taken from the app's own dispatch, which switches on exactly these two and ignores the rest.
 *
 * `41` is the number the reference integration named its parser after without saying where it came
 * from; it is this field.
 */
export declare const BIZ_PROTOCOL: {
    /** Map-stream data: the frames this module parses. */
    readonly MAP_DATA: 41;
    /** A live photo from the robot's camera — a different payload entirely, not read here. */
    readonly LIVE_PHOTO: 43;
};
/**
 * The channels a map frame can arrive on, by id.
 *
 * **The trap.** Ids 1–10 come from `Metadata.ChanIds` in `stream.proto`, where each *field* names a
 * message and each field's *value* is the id the device chose for it. The names below pair each
 * channel with its field NUMBER, because that is the numbering the vendor ships and the one a live
 * capture shows — but a device announcing a `Metadata` frame is announcing its own numbering, and a
 * firmware that renumbers would make this table wrong without making it look wrong. Anything that
 * *decodes* a channel's bytes must therefore prefer a device-declared mapping when one has been seen;
 * this table is the default to fall back on, not an authority.
 *
 * Channel 0 is the exception and is not in `ChanIds` at all: the app hard-codes it, routing it to a
 * scene-data event rather than a map one, and asks for the scene list on it by number. That one is
 * fixed.
 */
export declare const BIZ_CHANNEL: {
    /** Scene (room-group) data. Hard-coded in the app, not part of `ChanIds`. */
    readonly SCENES: 0;
    readonly MAP_INFO: 1;
    readonly PATH: 2;
    readonly ROOM_OUTLINE: 3;
    readonly ROOM_PARAMS: 4;
    readonly RESTRICTED_ZONE: 5;
    readonly DYNAMIC_DATA: 6;
    readonly TEMPORARY_DATA: 7;
    readonly OBSTACLE_INFO: 8;
    readonly MAP_DATA: 9;
    readonly CRUISE_DATA: 10;
};
/** A channel's name under the default numbering — see the trap in {@link BIZ_CHANNEL}. */
export type BizChannel = keyof typeof BIZ_CHANNEL;
/**
 * Name a channel id under the default numbering, or `undefined` for an id the vendor's table does not
 * list. Not a substitute for a device-declared mapping where one exists.
 */
export declare function bizChannelName(id: number): BizChannel | undefined;
/** One frame off the map stream, unwrapped as far as its bytes but not decoded. */
export interface BizMapFrame {
    /** Which channel the bytes belong to. Compare against {@link BIZ_CHANNEL}, mindful of its trap. */
    readonly channelId: number;
    /**
     * The vendor's `clear_type`. Forwarded, not interpreted: the app passes it straight through to its
     * own UI layer and nothing observed says what its values mean. A `Map` I-frame is documented to make
     * the device clear the channel's accumulated data first, so this plausibly says so — plausibly is
     * not a decode.
     */
    readonly clearType: number;
    /** The vendor's `data_type`. The app reads this field and then discards it; so does this. */
    readonly dataType: number;
    /**
     * The vendor's `offset` and `len`. A large map is split across frames, and these two locate this
     * one — but which of "offset into the channel buffer" and "length of this chunk" versus "length of
     * the whole" they mean is decided in the app's React Native layer, which ships as Hermes bytecode
     * and was not readable. They are carried verbatim so a reassembler can be written against a capture
     * rather than against a guess.
     */
    readonly offset: number;
    /** See {@link BizMapFrame.offset}. */
    readonly len: number;
    /**
     * The frame's bytes, re-encoded as the base64 a `RawDpCodec` reads. The wire sends hex; the framing
     * underneath is the same `varint(len) ++ protobufMessage` every Raw DP uses.
     */
    readonly payload: string;
}
/**
 * Parse one message off `biz/…/res` into a map frame, or `undefined` if it is not one.
 *
 * **`undefined` is the common case and not an error.** This runs against every message on a shared
 * connection: DP reports, ACKs on the `biz/…/req` leg, live-photo notifications, and anything else the
 * broker delivers all arrive here and all correctly decline. Nothing is logged and nothing throws.
 *
 * The shape, layer by layer, is the app's:
 *
 * 1. `{ payload }`, where `payload` is an object OR a JSON string holding one — the same
 *    double-encoding the DP path already handles.
 * 2. `payload.protocol === 41`. A `43` here is a live photo and belongs to a different reader.
 * 3. `payload.data` carrying all six of `channel_id`, `clear_type`, `data_type`, `offset`, `data` and
 *    `len`. The app refuses the message outright when any one is missing, and so does this: a frame
 *    missing a field is a frame this code does not understand, and half of it is worth nothing.
 * 4. `data.data`, hex, re-encoded to base64 — and rejected unless it is *clean* hex, because hex
 *    truncates in the one direction the frame's own length prefix cannot catch (see
 *    {@link hexToRawDp}).
 */
export declare function parseBizMapFrame(raw: unknown): BizMapFrame | undefined;
