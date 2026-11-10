/**
 * A baseline-JPEG entropy scanner that decodes no pixels.
 *
 * The v2 thumbnail decoder next door has to discover a frame geometry its blob does not state, and the
 * only evidence is the plaintext entropy-coded scan: how many MCUs it carries, and whether it carries
 * them under a given chroma subsampling. A JPEG decoder answers that — it throws on a frame the scan
 * does not fill — and charges a full set of component and output buffers for each question.
 *
 * That bill is fatal for a caller under a hard memory cap. Each `jpeg-js` decode churns roughly a
 * megabyte of typed arrays, glibc keeps the arenas rather than handing them back, and a search asking
 * the question of every candidate geometry costs tens of megabytes per thumbnail — permanently, and
 * more than an embedded host gives an app in total.
 *
 * This module asks the same question by walking the Huffman-coded coefficients and throwing them away:
 * no IDCT, no component planes, no output image. What it keeps is one number per MCU — the DC
 * coefficient of its luma block(s), i.e. that block's average brightness — which is all the geometry
 * search needs to tell a sheared row apart from a continuous one. Allocation is a single `Int32Array`
 * of MCU count, and the walk is linear in the scan's length.
 *
 * Baseline sequential only (SOF0), which is what the v2 tail is: no progressive refinement, no
 * arithmetic coding. Restart markers are tolerated — the scan resynchronises and resets its DC
 * predictors, exactly as a decoder would.
 *
 * @module transport/http/jpeg-scan
 */
/** What the scan carried, under one subsampling hypothesis. */
export interface EntropyScan {
    /** Complete MCUs decoded before the data ran out. */
    mcus: number;
    /**
     * Mean luma DC per MCU, in scan order — a thumbnail of the picture at MCU resolution.
     *
     * Quantized units (the quant tables are lost with the v2 head), so the values are a scale of their
     * own. Differences between neighbours are what the geometry search reads, and those survive.
     */
    luma: Int32Array;
    /**
     * Whether the scan ended where a whole MCU ended, with nothing but the EOI marker left.
     *
     * The discriminator between hypotheses: a wrong one reads a block with the wrong Huffman table,
     * diverges, and either dies mid-MCU or stops with data still ahead of it. Only the subsampling the
     * encoder used walks the scan to its last byte on an MCU boundary.
     */
    complete: boolean;
}
/**
 * Walk the plaintext tail's scan under one subsampling hypothesis.
 *
 * `extraTables` carries the DHT segments that are NOT in the tail — for a v2 thumbnail, the standard
 * luma tables the reconstructed header supplies, since only the chroma ones survive in plaintext.
 * Returns null when the tail is not a baseline scan at all (no SOS, missing tables).
 *
 * The walk stops at the first byte it cannot read as this hypothesis's next block, and the result is
 * `complete` only when that happened on an MCU boundary with nothing but a marker left. The DC array
 * grows as the scan turns out to be long rather than being sized from the scan's byte length: a wrong
 * hypothesis dies after a handful of MCUs, and provisioning three whole-scan arrays to discover that is
 * the kind of allocation this module exists to avoid.
 */
export declare function scanEntropy(tail: Uint8Array, subsampling: number, extraTables: readonly Uint8Array[]): EntropyScan | null;
