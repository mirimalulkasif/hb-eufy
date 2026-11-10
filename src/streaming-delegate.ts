import { createSocket, type Socket } from 'node:dgram';
import os from 'node:os';

import type {
  API,
  CameraController,
  CameraStreamingDelegate,
  HAP,
  Logging,
  PrepareStreamCallback,
  PrepareStreamRequest,
  SnapshotRequest,
  SnapshotRequestCallback,
  StartStreamRequest,
  StreamingRequest,
  StreamRequestCallback,
} from 'homebridge';
import { StreamRequestTypes } from 'homebridge';
import { pickPort } from 'pick-port';

import {
  grabJpegFromStream,
  placeholderJpeg,
  resolveFfmpegPath,
  serveReadableOnce,
  startFfmpeg,
  type FfmpegHandle,
} from './ffmpeg';
import { LivestreamManager } from './livestream-manager';
import type { EufyMega } from './mega';
import type { EufyCamerasPlatform } from './platform';

type SessionInfo = {
  address: string;
  ipv6: boolean;
  videoPort: number;
  videoReturnPort: number;
  videoSSRC: number;
  videoSRTP: Buffer;
  audioPort: number;
  audioReturnPort: number;
  audioSSRC: number;
  audioSRTP: Buffer;
};

type ActiveSession = {
  video?: FfmpegHandle;
  socket?: Socket;
  timeout?: NodeJS.Timeout;
};

export class StreamingDelegate implements CameraStreamingDelegate {
  private readonly hap: HAP;
  private readonly ffmpegPath: string;
  private readonly livestream: LivestreamManager;
  private controller?: CameraController;
  private readonly pending = new Map<string, SessionInfo>();
  private readonly ongoing = new Map<string, ActiveSession>();
  private cachedSnapshot?: Buffer;

  constructor(
    private readonly platform: EufyCamerasPlatform,
    private readonly api: API,
    private readonly log: Logging,
    private readonly client: EufyMega,
    private readonly serial: string,
    private readonly displayName: string,
  ) {
    this.hap = api.hap;
    this.ffmpegPath = resolveFfmpegPath(
      typeof platform.config.ffmpegPath === 'string'
        ? platform.config.ffmpegPath
        : undefined,
    );
    this.livestream = new LivestreamManager(client, serial, log);
  }

  setController(controller: CameraController): void {
    this.controller = controller;
  }

  async dispose(): Promise<void> {
    for (const id of [...this.ongoing.keys()]) {
      this.stopStream(id);
    }
    await this.livestream.dispose();
  }

  handleSnapshotRequest(
    request: SnapshotRequest,
    callback: SnapshotRequestCallback,
  ): void {
    void this.takeSnapshot(request.width, request.height)
      .then((image) => callback(undefined, image))
      .catch((err) => {
        this.log.debug(`Snapshot failed: ${String(err)}`);
        callback(undefined, this.cachedSnapshot ?? placeholderJpeg());
      });
  }

  prepareStream(
    request: PrepareStreamRequest,
    callback: PrepareStreamCallback,
  ): void {
    void this.prepare(request)
      .then((response) => callback(undefined, response))
      .catch((err) => callback(err as Error));
  }

  handleStreamRequest(
    request: StreamingRequest,
    callback: StreamRequestCallback,
  ): void {
    switch (request.type) {
      case StreamRequestTypes.START:
        void this.startStream(request, callback);
        break;
      case StreamRequestTypes.RECONFIGURE:
        callback();
        break;
      case StreamRequestTypes.STOP:
        this.stopStream(request.sessionID);
        callback();
        break;
      default:
        callback();
    }
  }

  private async takeSnapshot(width: number, height: number): Promise<Buffer> {
    try {
      const device = await this.client.getDevice(this.serial);
      const cam = device.camera?.();
      const stored = await cam?.snapshotStored?.();
      if (stored && stored.length > 100) {
        this.cachedSnapshot = stored;
        return stored;
      }
      const live = await cam?.snapshotLive?.();
      if (live?.jpeg?.length) {
        this.cachedSnapshot = live.jpeg;
        return live.jpeg;
      }
    } catch (err) {
      this.log.debug(`Native snapshot unavailable: ${String(err)}`);
    }

    const stream = await this.livestream.getStream();
    try {
      const jpeg = await grabJpegFromStream(
        this.ffmpegPath,
        stream.videostream,
        width,
        height,
      );
      this.cachedSnapshot = jpeg;
      return jpeg;
    } finally {
      this.livestream.release();
    }
  }

  private async prepare(request: PrepareStreamRequest) {
    const videoReturnPort = await pickPort({ type: 'udp' });
    const audioReturnPort = await pickPort({ type: 'udp' });
    const videoSSRC = this.hap.CameraController.generateSynchronisationSource();
    const audioSSRC = this.hap.CameraController.generateSynchronisationSource();
    const ipv6 = request.addressVersion === 'ipv6';

    const session: SessionInfo = {
      address: request.targetAddress,
      ipv6,
      videoPort: request.video.port,
      videoReturnPort,
      videoSSRC,
      videoSRTP: Buffer.concat([request.video.srtp_key, request.video.srtp_salt]),
      audioPort: request.audio.port,
      audioReturnPort,
      audioSSRC,
      audioSRTP: Buffer.concat([request.audio.srtp_key, request.audio.srtp_salt]),
    };
    this.pending.set(request.sessionID, session);

    return {
      address: this.pickLocalAddress(ipv6),
      video: {
        port: videoReturnPort,
        ssrc: videoSSRC,
        srtp_key: request.video.srtp_key,
        srtp_salt: request.video.srtp_salt,
      },
      audio: {
        port: audioReturnPort,
        ssrc: audioSSRC,
        srtp_key: request.audio.srtp_key,
        srtp_salt: request.audio.srtp_salt,
      },
    };
  }

  private pickLocalAddress(ipv6: boolean): string {
    const nets = os.networkInterfaces();
    for (const entries of Object.values(nets)) {
      for (const net of entries || []) {
        if (net.internal) continue;
        const family = String(net.family);
        if (ipv6 && (family === 'IPv6' || family === '6')) return net.address;
        if (!ipv6 && (family === 'IPv4' || family === '4')) return net.address;
      }
    }
    return ipv6 ? '::1' : '127.0.0.1';
  }

  private async startStream(
    request: StartStreamRequest,
    callback: StreamRequestCallback,
  ): Promise<void> {
    const sessionInfo = this.pending.get(request.sessionID);
    if (!sessionInfo) {
      callback(new Error('No pending session'));
      return;
    }

    const active: ActiveSession = {};
    this.ongoing.set(request.sessionID, active);
    this.pending.delete(request.sessionID);

    try {
      active.socket = this.bindReturnSocket(sessionInfo, request);
      const stream = await this.livestream.getStream();
      const videoPort = await serveReadableOnce(stream.videostream);
      const v = request.video;
      const profile =
        v.profile === this.hap.H264Profile.HIGH
          ? 'high'
          : v.profile === this.hap.H264Profile.MAIN
            ? 'main'
            : 'baseline';
      const level =
        v.level === this.hap.H264Level.LEVEL4_0
          ? '4.0'
          : v.level === this.hap.H264Level.LEVEL3_2
            ? '3.2'
            : '3.1';

      const videoArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-use_wallclock_as_timestamps',
        '1',
        '-f',
        'h264',
        '-r',
        String(v.fps),
        '-i',
        `tcp://127.0.0.1:${videoPort}`,
        '-an',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-color_range',
        'mpeg',
        '-profile:v',
        profile,
        '-level:v',
        level,
        '-preset',
        'ultrafast',
        '-tune',
        'zerolatency',
        '-vf',
        `scale=${v.width}:${v.height}:force_original_aspect_ratio=decrease,pad=${v.width}:${v.height}:(ow-iw)/2:(oh-ih)/2`,
        '-b:v',
        `${v.max_bit_rate}k`,
        '-bufsize',
        `${v.max_bit_rate * 2}k`,
        '-maxrate',
        `${v.max_bit_rate}k`,
        '-payload_type',
        String(v.pt),
        '-ssrc',
        String(sessionInfo.videoSSRC),
        '-f',
        'rtp',
        '-srtp_out_suite',
        'AES_CM_128_HMAC_SHA1_80',
        '-srtp_out_params',
        sessionInfo.videoSRTP.toString('base64'),
        `srtp://${sessionInfo.address}:${sessionInfo.videoPort}?rtcpport=${sessionInfo.videoPort}&pkt_size=1128`,
      ];

      let callbackFired = false;
      const safeCallback = (err?: Error) => {
        if (callbackFired) return;
        callbackFired = true;
        callback(err);
      };

      active.video = startFfmpeg(
        this.ffmpegPath,
        videoArgs,
        () => {
          this.log.info(
            `Streaming ${this.displayName} ${v.width}x${v.height} @ ${v.fps}fps`,
          );
          safeCallback();
        },
        (err) => {
          this.log.error(`Video ffmpeg error: ${err.message}`);
          this.stopStream(request.sessionID);
          safeCallback(err);
        },
      );
    } catch (err) {
      this.log.error(`Failed to start stream: ${String(err)}`);
      this.stopStream(request.sessionID);
      callback(err as Error);
    }
  }

  private bindReturnSocket(
    sessionInfo: SessionInfo,
    request: StartStreamRequest,
  ): Socket {
    const socket = createSocket(sessionInfo.ipv6 ? 'udp6' : 'udp4');
    const active = this.ongoing.get(request.sessionID)!;
    socket.on('error', (err) => {
      this.log.error(`Stream socket error: ${err.message}`);
      this.stopStream(request.sessionID);
    });
    socket.on('message', () => {
      if (active.timeout) clearTimeout(active.timeout);
      active.timeout = setTimeout(() => {
        this.log.debug('No RTCP keep-alive — stopping stream');
        this.controller?.forceStopStreamingSession(request.sessionID);
        this.stopStream(request.sessionID);
      }, request.video.rtcp_interval * 5 * 1000);
    });
    socket.bind(sessionInfo.videoReturnPort);
    return socket;
  }

  stopStream(sessionID: string): void {
    const active = this.ongoing.get(sessionID);
    this.ongoing.delete(sessionID);
    this.pending.delete(sessionID);
    if (!active) {
      return;
    }
    if (active.timeout) clearTimeout(active.timeout);
    active.video?.stop();
    try {
      active.socket?.close();
    } catch {
      // ignore
    }
    this.livestream.release();
  }
}
