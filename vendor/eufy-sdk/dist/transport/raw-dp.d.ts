import type { RawDpCodec } from "../core/contracts.js";
/**
 * The codec every Raw-DP reader shares. Stateless, so one frozen instance serves every device — there
 * is nothing per-device or per-DP to configure.
 */
export declare const rawDpCodec: RawDpCodec;
