import { createSocket, type Socket } from 'node:dgram';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
import { streamModeFor, type StreamMode } from './stream-mode';

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
  stillPath?: string;
  stillRefresh?: NodeJS.Timeout;
};

export class StreamingDelegate implements CameraStreamingDelegate {
  private readonly hap: HAP;
  private readonly ffmpegPath: string;
  private readonly livestream: LivestreamManager;
  private readonly mode: StreamMode;
  private controller?: CameraController;
  private readonly pending = new Map<string, SessionInfo>();
  private readonly ongoing = new Map<string, ActiveSession>();
  private cachedSnapshot?: Buffer;
  private refreshInFlight?: Promise<void>;

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
    this.mode = streamModeFor(kind, model);
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
    if (this.mode === 'stills') {
      this.log.info(
        `${displayName}: picture stream mode (motion/ring + push stills, no live video)`,
      );
    }
  }

  prewarm(): void {
    if (this.mode === 'live') {
      void this.livestream.prewarm();
    }
    void this.refreshStoredSnapshot();
  }

  setController(controller: CameraController): void {
    this.controller = controller;
  }

  /** Update the still used for Home tiles / picture stream (e.g. after motion/ring). */
  updateSnapshot(jpeg: Buffer): void {
    if (jpeg.length > 100) {
      this.cachedSnapshot = jpeg;
    }
  }

  async refreshStoredSnapshot(): Promise<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = (async () => {
      try {
        const device = await this.client.getDevice(this.serial);
        const stored = await device.camera?.()?.snapshotStored?.();
        if (stored && stored.length > 100) {
          this.cachedSnapshot = stored;
          this.log.debug(
            `Updated still for ${this.displayName} (${stored.length} bytes)`,
          );
        }
      } catch (err) {
        this.log.debug(`Still refresh failed: ${String(err)}`);
      }
    })().finally(() => {
      this.refreshInFlight = undefined;
    });
    return this.refreshInFlight;
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
    const image = this.cachedSnapshot ?? placeholderJpeg();
    this.log.debug(
      `Snapshot ${this.displayName} ${request.width}x${request.height} (cache=${Boolean(this.cachedSnapshot)})`,
    );
    try {
      callback(undefined, image);
    } catch (err) {
      this.log.warn(`Snapshot callback failed: ${String(err)}`);
    }
    void this.refreshStoredSnapshot();
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

  async prefetchSnapshot(): Promise<void> {
    await this.refreshStoredSnapshot();
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
      active.socket = this.bindReturnSocket(sessionInfo, request);
      if (this.mode === 'stills') {
        await this.startStillsStream(request, sessionInfo, active, safeCallback);
      } else {
        await this.startLiveStream(request, sessionInfo, active, safeCallback);
      }
    } catch (err) {
      this.log.error(`Failed to start stream: ${String(err)}`);
      this.stopStream(request.sessionID);
      safeCallback(err as Error);
    }
  }

  private async startStillsStream(
    request: StartStreamRequest,
    sessionInfo: SessionInfo,
    active: ActiveSession,
    safeCallback: (err?: Error) => void,
  ): Promise<void> {
    this.log.info(
      `HomeKit picture stream for ${this.displayName} (${this.serial})`,
    );
    await this.refreshStoredSnapshot();
    const jpeg = this.cachedSnapshot ?? placeholderJpeg();
    const stillPath = path.join(
      os.tmpdir(),
      `eufy-still-${this.serial}-${request.sessionID}.jpg`,
    );
    fs.writeFileSync(stillPath, jpeg);
    active.stillPath = stillPath;

    const v = request.video;
    const fps = Math.min(5, Math.max(1, v.fps || 2));
    const videoArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-re',
      '-loop',
      '1',
      '-framerate',
      String(fps),
      '-i',
      stillPath,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'stillimage',
      '-pix_fmt',
      'yuv420p',
      '-vf',
      `scale=${v.width}:${v.height}:force_original_aspect_ratio=decrease,pad=${v.width}:${v.height}:(ow-iw)/2:(oh-ih)/2`,
      '-profile:v',
      'baseline',
      '-level:v',
      '3.1',
      '-b:v',
      `${Math.max(100, v.max_bit_rate)}k`,
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
          `Picture-streaming ${this.displayName} ${v.width}x${v.height}@${fps}fps`,
        );
        safeCallback();
      },
      (err) => {
        this.log.error(`Still ffmpeg error: ${err.message}`);
        this.stopStream(request.sessionID);
        safeCallback(err);
      },
    );

    // Periodically pull a newer push thumbnail into the file for the next open;
    // active ffmpeg keeps the still it opened with (stable picture stream).
    active.stillRefresh = setInterval(() => {
      void this.refreshStoredSnapshot().then(() => {
        if (this.cachedSnapshot && active.stillPath) {
          try {
            fs.writeFileSync(active.stillPath, this.cachedSnapshot);
          } catch {
            // ignore
          }
        }
      });
    }, 15_000);

    setTimeout(() => {
      if (![...this.ongoing.values()].includes(active)) return;
      // callback already handled by startFfmpeg fallback
    }, 8_000);
  }

  private async startLiveStream(
    request: StartStreamRequest,
    sessionInfo: SessionInfo,
    active: ActiveSession,
    safeCallback: (err?: Error) => void,
  ): Promise<void> {
    this.log.info(
      `HomeKit live stream for ${this.displayName} (${this.serial})`,
    );

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
      // startFfmpeg also has a 2.5s started fallback
    }, 8_000);
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
    if (active.stillRefresh) clearInterval(active.stillRefresh);
    active.video?.stop();
    try {
      active.socket?.close();
    } catch {
      // ignore
    }
    if (active.stillPath) {
      try {
        fs.unlinkSync(active.stillPath);
      } catch {
        // ignore
      }
    }
    if (this.mode === 'live') {
      this.livestream.release();
    }
  }
}
