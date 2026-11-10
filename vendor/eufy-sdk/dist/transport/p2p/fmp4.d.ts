import type { LiveAudioFrame, LiveVideoFrame, MediaFragment } from "../../core/contracts.js";
export interface Fmp4Options {
    /** Minimum fragment length; a new fragment opens on the first keyframe past this (default 2s). */
    fragmentSeconds?: number;
    /** Assumed fps for the first sample's duration before inter-frame timing is known (default 15). */
    fps?: number;
    /** Include an AAC track when the source declares AAC-LC or AAC-ELD before the first media fragment. */
    audio?: boolean;
}
export declare class Fmp4Muxer {
    private params?;
    private codec;
    private width;
    private height;
    private initSent;
    private seq;
    private baseDecodeTime;
    private fragTicks;
    private samples;
    /** Ticks from the first video sample's start to the newest sample's end, at its provisional duration. */
    private videoTicks;
    private readonly audioRequested;
    private audioCodec?;
    /** Decoder config of an AAC-ELD track, taken from its frames; absent for AAC-LC, whose `esds` config is fixed. */
    private audioConfig?;
    private audioDisabled;
    private audioSamples;
    private audioBaseDecodeTime;
    private firstVideoTimestampMs?;
    private firstAudioTimestampMs?;
    private lastAudioTimestampMs?;
    private timelineOriginMs?;
    private timelineAligned;
    private readonly fragmentTicks;
    private readonly firstDuration;
    constructor(opts?: Fmp4Options);
    /**
     * Push one access unit. Returns any completed segments: the `init` on the first keyframe, and/or a
     * media fragment when this frame closed the open one. Returns `undefined` if nothing is emitted yet
     * (e.g. delta frames before the first keyframe).
     *
     * A sample lasts until the next frame's `timestampMs`, measured from the first keyframe's, so the video
     * timeline follows the arrival clock; a frame that shares the previous one's timestamp leaves that
     * sample one tick long, and the next frame's duration absorbs the difference.
     */
    push(frame: LiveVideoFrame, timestampMs?: number): MediaFragment | undefined;
    /**
     * Add one station-declared AAC access unit to the audio track: an ADTS frame for AAC-LC, a raw access unit
     * described by its frame's config for AAC-ELD. G.711 remains available via `live()`.
     */
    pushAudio(frame: LiveAudioFrame, timestampMs?: number): MediaFragment | undefined;
    /** Permanently omit incompatible audio while allowing the video recording to continue. */
    private disableAudio;
    /** Flush the open fragment (call at end-of-stream). Returns the final fragment, or undefined. */
    flush(): MediaFragment | undefined;
    private samplesStartKeyframe;
    private buildInit;
    private alignTimeline;
    private buildFragment;
    private ftyp;
    private moov;
    private mvhd;
    private trak;
    private tkhd;
    private mdia;
    private minf;
    private stbl;
    private sampleEntry;
    private avcC;
    private hvcC;
    private mvex;
    private trex;
    private moof;
    private traf;
    /**
     * One track fragment run, declaring exactly the per-sample fields its body carries.
     *
     * `tr_flags` is data-offset-present (`0x000001`) | sample-duration-present (`0x000100`) |
     * sample-size-present (`0x000200`) | sample-flags-present (`0x000400`). A parser sizes the sample
     * table from these flags alone, so every extra flag adds a 4-byte field per sample that it then reads
     * past the end of the box. A flag set wider than the body makes the run overrun its own size and the
     * whole fragment undemuxable, which is why the value and the loop below must be read together.
     *
     * Composition-time offsets are deliberately absent: the source delivers access units in decode order
     * with no reordering, so each sample's composition time equals its decode time.
     *
     * `data_offset` is written as zero and patched with the sample data's position once the enclosing
     * `moof` is assembled and its length is known.
     */
    private trun;
    private hasAudioTrack;
    private audioTrak;
    private audioTkhd;
    private audioMdia;
    private audioMinf;
    private audioStbl;
    private audioSampleEntry;
    private esds;
}
