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
  placeholderJpeg,
  resolveFfmpegPath,
  serveReadableOnce,
  startFfmpeg,
  type FfmpegHandle,
} from './ffmpeg';
import type { EufyKind } from './device-kinds';
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
    kind: EufyKind,
    model: string,
  ) {
    this.hap = api.hap;
    this.ffmpegPath = resolveFfmpegPath(
      typeof platform.config.ffmpegPath === 'string'
        ? platform.config.ffmpegPath
        : undefined,
    );
    this.livestream = new LivestreamManager(client, serial, log, {
      kind,
      model,
      lingerMs: 90_000,
    });
  }

  prewarm(): void {
    void this.livestream.prewarm();
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
    // Answer HomeKit immediately. Never open P2P on the snapshot path — that
    // blocks the HAP event loop on 32-bit hosts and Home shows "No Response".
    const image = this.cachedSnapshot ?? placeholderJpeg();
    this.log.debug(
      `Snapshot request ${this.displayName} ${request.width}x${request.height} (cache=${Boolean(this.cachedSnapshot)})`,
    );
    try {
      callback(undefined, image);
    } catch (err) {
      this.log.warn(`Snapshot callback failed: ${String(err)}`);
    }
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

  private refreshInFlight?: Promise<void>;

  /** Best-effort cache fill; never used on the HomeKit snapshot callback path. */
  async prefetchSnapshot(): Promise<void> {
    await this.refreshSnapshotCache(640, 360);
  }

  private async refreshSnapshotCache(
    width: number,
    height: number,
  ): Promise<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.doRefreshSnapshot(width, height).finally(() => {
      this.refreshInFlight = undefined;
    });
    return this.refreshInFlight;
  }

  private async doRefreshSnapshot(
    _width: number,
    _height: number,
  ): Promise<void> {
    try {
      const device = await this.client.getDevice(this.serial);
      const stored = await device.camera?.()?.snapshotStored?.();
      if (stored && stored.length > 100) {
        this.cachedSnapshot = stored;
        this.log.debug(
          `Cached push thumbnail for ${this.displayName} (${stored.length} bytes)`,
        );
      }
    } catch (err) {
      this.log.debug(`Stored snapshot unavailable: ${String(err)}`);
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

    let callbackFired = false;
    const safeCallback = (err?: Error) => {
      if (callbackFired) return;
      callbackFired = true;
      callback(err);
    };

    try {
      this.log.info(
        `HomeKit requested live stream for ${this.displayName} (${this.serial})`,
      );
      active.socket = this.bindReturnSocket(sessionInfo, request);

      const stream = await Promise.race([
        this.livestream.getStream(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `P2P connect timed out opening livestream for ${this.serial}`,
                ),
              ),
            15_000,
          ),
        ),
      ]);
      const videoPort = await serveReadableOnce(stream.videostream);
      const v = request.video;

      // Bitstream copy + low-delay flags — re-encode is too heavy on 32-bit Pis.
      const videoArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-fflags',
        'nobuffer',
        '-flags',
        'low_delay',
        '-probesize',
        '32',
        '-analyzeduration',
        '0',
        '-use_wallclock_as_timestamps',
        '1',
        '-f',
        'h264',
        '-i',
        `tcp://127.0.0.1:${videoPort}`,
        '-an',
        '-c:v',
        'copy',
        '-flush_packets',
        '1',
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

      active.video = startFfmpeg(
        this.ffmpegPath,
        videoArgs,
        () => {
          this.log.info(
            `Streaming ${this.displayName} (copy) toward ${v.width}x${v.height}@${v.fps}`,
          );
          safeCallback();
        },
        (err) => {
          this.log.error(`Video ffmpeg error: ${err.message}`);
          this.stopStream(request.sessionID);
          safeCallback(err);
        },
      );

      setTimeout(() => {
        if (!callbackFired) {
          const err = new Error('ffmpeg did not start streaming in time');
          this.log.error(err.message);
          this.stopStream(request.sessionID);
          safeCallback(err);
        }
      }, 8_000);
    } catch (err) {
      this.log.error(`Failed to start stream: ${String(err)}`);
      this.stopStream(request.sessionID);
      safeCallback(err as Error);
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
