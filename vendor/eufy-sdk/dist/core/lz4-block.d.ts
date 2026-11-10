/**
 * Decompressor for a raw LZ4 *block* — the form the map stream's pixel planes arrive in.
 *
 * The robot publishes its map over a second MQTT topic, and the pixel planes inside are compressed
 * with LZ4 whenever that saves anything. There is no flag saying so: the message carries both the
 * `pixels` bytes and a `pixel_size`, and **the two disagreeing IS the flag** — a plane that compressed
 * to nothing useful is sent verbatim, with the two equal. So the caller decides, and passes the size
 * it already has.
 *
 * **Why not an npm package.** What travels here is a bare LZ4 block: no magic number, no frame header,
 * no checksum, no stored size. Every LZ4 package on npm speaks the *frame* format by default and
 * exposes the block API awkwardly if at all, and the block format itself is one loop over four
 * quantities. A dependency would be more code to audit than the sixty lines here, so this is
 * hand-written and tested against blocks produced by the reference liblz4 implementation.
 *
 * @module core/lz4-block
 */
/**
 * Decompress an LZ4 block into exactly `size` bytes, or `undefined` if the block is malformed.
 *
 * **Every failure is `undefined`, and the length check is what makes that trustworthy.** A truncated or
 * corrupt block does not fail loudly on its own — LZ4 has no checksum and no terminator, so a mangled
 * block usually just stops producing output early, and a decompressor that returned what it had would
 * hand back a plausible, short, wrong map. Requiring the output to reach `size` exactly turns that into
 * a rejection, and it costs nothing: the caller already knows the size, which is how it knew to call.
 *
 * The other rejections are the reads that would otherwise wander: a length that runs off the end of the
 * block, a back-reference pointing before the start of the output or nowhere at all, and a match that
 * would overrun `size`.
 *
 * Matches may overlap their own output — an offset of 1 with a length of 200 is how a run of one
 * repeated byte is encoded, and it is the common case in a mostly-empty map. That is why the copy below
 * is a byte-at-a-time loop and not a block copy: the bytes it reads are ones it just wrote.
 */
export declare function lz4BlockDecompress(block: Uint8Array, size: number): Buffer | undefined;
