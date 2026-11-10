/** True if the blob is a v2 `v2_eufysecurity:` push thumbnail. */
export declare function isV2Image(data: Buffer): boolean;
/**
 * Decode a v2 blob to a plain JPEG buffer by reconstructing its header, or null if it isn't v2, the
 * plaintext scan can't be located, or no frame shape explains it.
 *
 * Three steps and no pixel rewrite: the frame shape is read out of the entropy scan,
 * one probe decode both proves the spliced JPEG decodes and measures how far the substitute quant
 * tables fall short of the camera's, and the answer is the same tail under a header carrying the
 * corrected tables. See the module doc for the keyless-splice rationale and for why neither the search
 * nor the correction decodes candidate frames or re-encodes the picture.
 */
export declare function decodeImageV2(data: Buffer): Buffer | null;
