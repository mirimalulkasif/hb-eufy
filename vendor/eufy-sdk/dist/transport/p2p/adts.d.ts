/**
 * ADTS (Audio Data Transport Stream) helpers — the framing the device expects on the audio path a
 * host pushes toward a camera. A host hands over an arbitrarily-chunked byte stream (an encoder's
 * stdout, a file read), so frame boundaries have to be RECOVERED from the stream rather than assumed
 * to align with the chunks; this is the single place that scans for them.
 *
 * An ADTS frame is a 7-byte header (9 with CRC) followed by the raw audio payload, and the header's
 * own `frameLength` field spans header + payload — so the scan is self-delimiting once synced.
 * Header layout, MSB-first, as the V6 app writes it (`media/player/audio/AacEncode.java:43-51`):
 *
 * ```
 * byte 0     1111 1111   syncword high
 * byte 1     1111 iilp   syncword low · i=MPEG version+layer · p=1 ⇒ NO CRC (2 fewer header bytes)
 * byte 2     ppff ffpc   p=profile-1 · f=sampling-frequency index · c=channel-config high bit
 * byte 3     cc.. LLL    c=channel-config low 2 bits · L=frameLength bits 12..11
 * byte 4     LLLL LLLL   frameLength bits 10..3
 * byte 5     LLLb bbbb   frameLength bits 2..0 · b=buffer fullness high
 * byte 6     bbbb bbnn   buffer fullness low · n=frames-in-block minus one
 * ```
 *
 * The device's parameters are fixed and verified against the app's own encoder configuration
 * (`AacEncode.java:23-41`, `player/audio/BDBAudioConfig.java:6-66`): AAC-LC, 16 kHz, mono. One AAC-LC
 * frame is 1024 samples, so at 16 kHz each frame carries exactly 64 ms of audio — the cadence the
 * send side paces on.
 *
 * @module p2p/adts
 */
/** Samples per AAC-LC frame — fixed by the codec, not by these parameters. */
export declare const AAC_SAMPLES_PER_FRAME = 1024;
/** Sample rate the device's audio path runs at. */
export declare const AAC_SAMPLE_RATE = 16000;
/**
 * Duration one frame represents, in milliseconds — `1024 / 16000`, exactly 64 ms. The send side both
 * paces on this and steps its frame timestamp by it.
 */
export declare const AAC_FRAME_MS: number;
/**
 * Largest frame the device accepts. The app drops anything longer before it reaches the wire
 * (`media/recorder/recorder/BDBRawAudioRecorder.java:98`), so a longer frame is a caller bug rather
 * than something to split or truncate.
 */
export declare const MAX_AUDIO_FRAME_BYTES = 640;
/** Parsed fields of one ADTS header, with the payload it introduces. */
export interface AdtsHeader {
    /** Header + payload length, as declared by the header itself. */
    frameLength: number;
    /** Bytes of header ahead of the payload — 7 without a CRC, 9 with one. */
    headerLength: number;
    /** Profile field, `1` for AAC-LC. */
    profile: number;
    /** Index into the ADTS sampling-frequency table, `8` for 16 kHz. */
    frequencyIndex: number;
    /** Channel configuration, `1` for mono. */
    channels: number;
}
/**
 * Read an ADTS header at `offset`, or `undefined` when the bytes there are not a plausible header —
 * no syncword, a `frameLength` shorter than its own header, or not enough bytes to decide. Says
 * nothing about whether the frame's payload has arrived yet; that is the scanner's job.
 */
export declare function parseAdtsHeader(buf: Buffer, offset?: number): AdtsHeader | undefined;
/**
 * Whether a header describes the audio parameters the device's path is fixed at — AAC-LC, 16 kHz,
 * mono. A stream at any other rate or channel count is rejected rather than resampled: the device has
 * no way to be told otherwise, so passing it through would produce audio at the wrong pitch and speed.
 */
export declare function isSupportedAdts(h: AdtsHeader): boolean;
/**
 * Human-readable reason a header is unsupported, for the error a caller sees. Reports the decoded
 * values so a mis-configured encoder is obvious from the message alone.
 */
export declare function describeAdts(h: AdtsHeader): string;
/**
 * Incremental ADTS frame scanner. Feed it byte chunks in arrival order and it yields whole frames,
 * holding a partial frame across calls — which is the whole point: a host's chunk boundaries have no
 * relationship to frame boundaries, and a naive per-chunk parse would either split frames or resync
 * mid-payload and emit garbage.
 *
 * A byte run that does not begin with a syncword is skipped one byte at a time until one is found, so
 * a stream that starts mid-frame (or carries an encoder's preamble) recovers instead of failing.
 */
export declare class AdtsFrameReader {
    private buffered;
    /**
     * Append `chunk` and return every complete frame now available, each a standalone buffer that still
     * carries its own ADTS header (the device expects the header on the wire).
     */
    push(chunk: Buffer): Buffer[];
    /** Bytes held back awaiting the rest of their frame — non-zero mid-stream, zero on a clean boundary. */
    get pending(): number;
}
