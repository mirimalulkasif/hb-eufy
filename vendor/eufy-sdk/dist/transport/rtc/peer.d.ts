/**
 * The WebRTC peer for a T9000 session: libdatachannel through `node-datachannel`, driven the way the
 * portal drives a browser's RTCPeerConnection.
 *
 * The hub is the offerer: it sends its SDP once it has granted the session, and the peer answers. Six
 * data channels are declared in the portal's order (`WebrtcDataChannel` first, the command channel,
 * then audio, idr, video, notify, download). Every one carries PTCS-framed portal packets; which logical
 * channel a reassembled frame belongs to is the PTCS header's channel, not the data channel it rode on.
 *
 * ICE defaults to relay-only. The T9000 grants a TURN allocation in its `scall 100` reply and completes DTLS only
 * over the relay pair; on a host pair ICE connects and the DTLS handshake never completes. The peer
 * plays the DTLS client (`active`) and opens its channels on the client's even SCTP stream ids, which
 * is what the hub pairs with.
 *
 * With {@link RtcPeerOptions.mediaTrack} the remote is a T8223 doorbell instead: its offer bundles an Opus
 * audio, an H.264 video and an `m=application` section, but it never completes the SCTP association. The
 * application section is rejected before the offer is applied, no data channel is declared, and the
 * video m-line's RTP is emitted as `rtp`.
 *
 * The native peer is injectable.
 */
import { EventEmitter } from "node:events";
import type { PeerConnection, RtcConfig } from "node-datachannel";
import { type Logger } from "../../core/logger.js";
export interface TurnConfig {
    turn_addr: string;
    turn_port: number;
    turn_user: string;
    turn_password: string;
    alt_turn_addr?: string;
    alt_turn_port?: number;
}
export type NativePeerFactory = (name: string, config: RtcConfig) => PeerConnection;
export interface RtcPeerOptions {
    createPeer?: NativePeerFactory;
    /** Candidate policy for the station's exchange; the default is relay-only. */
    iceTransportPolicy?: "relay" | "all";
    /**
     * The remote streams its video as RTP on the offer's video m-line and serves no data channel: the
     * offer's application section is rejected and the video track's packets are emitted as `rtp`.
     */
    mediaTrack?: boolean;
    logger?: Logger;
}
export interface RtcPeerEvents {
    commandChannelOpen: [];
    /** The command channel went away while the peer itself may still be up. */
    commandChannelClosed: [];
    data: [frame: Buffer, linkType: number];
    /** The hub echoed the portal keepalive on the command channel. */
    keepaliveEcho: [];
    /** One RTP (or multiplexed RTCP) packet from the offer's video m-line, in a {@link RtcPeerOptions.mediaTrack} peer. */
    rtp: [packet: Buffer];
    iceCandidate: [candidate: string];
    iceGatheringComplete: [];
    connectionState: [state: string];
    error: [err: Error];
}
/** The portal's channel list; index 0 is the command channel. */
export declare const DATA_CHANNEL_LABELS: readonly ["WebrtcDataChannel", "audio", "idr", "video", "notify", "download"];
export declare const COMMAND_CHANNEL: "WebrtcDataChannel";
export declare class RtcPeer extends EventEmitter<RtcPeerEvents> {
    private readonly opts;
    private pc?;
    private readonly channels;
    private framer?;
    private readonly wireTally;
    private commandOpen;
    private remoteSet;
    private remoteMid;
    private handlingOffer;
    private channelsCreated;
    private videoMid?;
    private videoTrack?;
    private gatheringDone;
    /** Set by the framer's wire callback when the native channel refused a packet mid-send. */
    private wireSendFailed;
    private readonly pending;
    private localAnswer?;
    private readonly logger;
    constructor(opts?: RtcPeerOptions);
    /** Create the native peer on the relay the hub granted in `scall 100`. */
    init(turn: TurnConfig): Promise<void>;
    /**
     * The hub offered: apply the offer, declare the channels, return the answer SDP to signal back.
     *
     * The offer is pinned to `passive` before it is applied, so the native peer has one legal answer,
     * `active`: the role is fixed where it is decided, since rewriting the answer afterwards would change
     * only what is announced. The offer goes in before the channels are declared: `createDataChannel` on
     * a peer without a remote description starts its own negotiation and leaves it in `have-local-offer`.
     * The data channels need no m-line of their own; the offer's SCTP m-line carries them. Only an ANSWER
     * is taken as the local description: one read in `have-local-offer` is an offer. A
     * {@link RtcPeerOptions.mediaTrack} peer applies the offer with its application section rejected,
     * declares no channels, and adds remote candidates on the offer's first (bundle-tagged) mid.
     */
    handleRemoteOffer(offerSdp: string): Promise<string>;
    addRemoteCandidate(candidate: string): void;
    /**
     * Send bytes on the command channel as they are, without PTCS framing; false when it isn't open. The
     * portal's data-channel keepalive rides the wire unframed.
     */
    sendRaw(bytes: Buffer): boolean;
    /**
     * Send one portal packet on the command channel, through the framer. False when the channel is not
     * usable or the native send refused a wire packet, so a dropped frame does not read as success.
     */
    sendCommand(portalPacket: Buffer): boolean;
    /** Tear the peer down. A pending answer is rejected, so a `handleRemoteOffer` in flight settles. */
    close(): void;
    private acceptsCandidate;
    private createChannels;
    /**
     * Wire one data channel. Every channel feeds the framer once the command channel has opened it; a
     * message before that has nothing to reassemble into and is dropped. The hub's echo of the portal
     * keepalive on the command channel is unframed and surfaces as `keepaliveEcho` instead.
     */
    private wireChannel;
    /** Take the offer's video m-line as the one track whose RTP is emitted; any other track is left alone. */
    private wireVideoTrack;
    private addNow;
    private flushPending;
}
