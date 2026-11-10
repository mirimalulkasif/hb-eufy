/**
 * The T9000's signalling does not carry SDP text: an `info` message carries a small JSON — DTLS setup
 * role, ICE ufrag/pwd, fingerprint and candidates — and each side rebuilds the one-m-line SDP from it.
 * This is the portal's own translation (security.eufy.com): the SDP handed to the native peer is the one
 * the hub meant, and the JSON sent back is the one the hub parses.
 */
export interface ScallSdpJson {
    setup?: string;
    ice?: {
        ufrag?: string;
        pwd?: string;
        fingerprint_type?: string;
        fingerprint?: string;
    };
    candidate?: string[];
}
/** The hub's SDP is one SCTP application m-line bundled under mid 2, as the portal template has it. */
export declare const HUB_SDP_MID = "2";
/** The max message size the hub advertises; the answer carries the same. */
export declare const ANKER_MAX_MESSAGE_SIZE = 262144;
/**
 * Rebuild the hub's offer (or answer) SDP from its scall JSON. The JSON carries the fingerprint as bare
 * hex; the SDP gets colon-separated byte pairs.
 */
export declare function scallJsonToSdp(json: ScallSdpJson, now?: () => number): string;
/** Reduce our local SDP to the JSON the hub parses. `actpass` is left out: the hub wants a concrete role. */
export declare function sdpToScallJson(sdp: string): ScallSdpJson;
/** The candidate type (`host` / `srflx` / `relay`) named inside an ICE candidate line. */
export declare function iceCandidateType(candidate: string): string;
/** Pin `a=max-message-size` to what the hub advertises, whatever libdatachannel wrote. */
export declare function pinMaxMessageSize(sdp: string): string;
/**
 * Force a concrete DTLS role into an SDP. The hub offers `actpass`; the peer pins that offer to
 * `passive`, which leaves one legal answer, `active`. The DTLS client opens its data channels on the
 * even SCTP stream ids (RFC 8832), and the hub pairs with those: its command channel is stream 0.
 */
export declare function forceDtlsRole(sdp: string, role: "active" | "passive"): string;
/**
 * The wire form of a trickled ICE candidate: `candidate:...`, the attribute's value, which is the shape
 * the hub sends and parses. The native peer hands out the SDP attribute line (`a=candidate:...`).
 */
export declare function toWireCandidate(candidate: string): string;
/** The `a=mid` of the first m-section of `kind` in an SDP; `undefined` when it has none. */
export declare function midOf(sdp: string, kind: "audio" | "video" | "application"): string | undefined;
/**
 * Reject an offer's `m=application` (data channel) section: port 0 and out of the BUNDLE group. The
 * remote never completes the SCTP association, so a peer waiting on it fails; without it the peer
 * connects on DTLS-SRTP alone.
 */
export declare function rejectDataSection(sdp: string): string;
