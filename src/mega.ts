import fs from 'node:fs';
import path from 'node:path';

import type { Logging } from 'homebridge';

export type MegaSdk = typeof import('@mega-yfue/eufy-sdk');
export type EufyMega = import('@mega-yfue/eufy-sdk').EufyMega;
export type MegaDevice = import('@mega-yfue/eufy-sdk').Device;
export type EufyDeviceInfo = import('@mega-yfue/eufy-sdk').EufyDevice;

let sdkPromise: Promise<MegaSdk> | undefined;

export function loadMegaSdk(): Promise<MegaSdk> {
  if (!sdkPromise) {
    sdkPromise = import('@mega-yfue/eufy-sdk');
  }
  return sdkPromise;
}

export type MegaLoginConfig = {
  email: string;
  password: string;
  countryCode: string;
  persistDir: string;
  mfaCode?: string;
  captchaCode?: string;
};

/**
 * Login to Eufy Mega (v6). Handles captcha / 2FA via config values when present.
 */
export async function loginMega(
  log: Logging,
  cfg: MegaLoginConfig,
): Promise<{ sdk: MegaSdk; client: EufyMega }> {
  const sdk = await loadMegaSdk();
  const sessionPath = path.join(cfg.persistDir, 'eufy-session.json');
  const pushPath = path.join(cfg.persistDir, 'eufy-push.json');

  const client = new sdk.EufyMega({
    email: cfg.email,
    password: cfg.password,
    countryCode: cfg.countryCode,
    store: new sdk.FileSessionStore(sessionPath),
    pushStore: new sdk.FileFcmStore(pushPath),
  });

  let result = await client.login();
  const { LoginStatus } = sdk;

  if (result.status === LoginStatus.Captcha) {
    const captchaFile = path.join(cfg.persistDir, 'captcha.png');
    try {
      const raw = result.image.includes('base64,')
        ? result.image.split('base64,')[1]
        : result.image;
      fs.writeFileSync(captchaFile, Buffer.from(raw, 'base64'));
      log.warn(`Eufy captcha required. Image saved to: ${captchaFile}`);
    } catch (err) {
      log.warn(`Could not write captcha image: ${String(err)}`);
    }
    if (!cfg.captchaCode) {
      throw new Error(
        `Captcha required — open ${captchaFile}, set captchaCode in config, restart`,
      );
    }
    result = await client.solveCaptcha(String(cfg.captchaCode).trim());
  }

  if (result.status === LoginStatus.TwoFactor) {
    log.warn(
      `Eufy 2FA required (method=${result.method}). Set mfaCode in config and restart.`,
    );
    if (!cfg.mfaCode) {
      throw new Error('2FA code required — set mfaCode in plugin config and restart');
    }
    result = await client.submitVerifyCode(String(cfg.mfaCode).trim());
  }

  if (result.status === LoginStatus.Captcha) {
    throw new Error('Captcha still required after captchaCode — try again with a fresh code');
  }
  if (result.status === LoginStatus.TwoFactor) {
    throw new Error('2FA still required after mfaCode — try a fresh code');
  }
  if (result.status !== LoginStatus.Ok) {
    throw new Error(`Unexpected login status: ${JSON.stringify(result)}`);
  }

  log.info('Logged into Eufy Mega (v6) cloud.');
  return { sdk, client };
}

/** Doorbell / indoor filter for this plugin. */
export function classifyMegaDevice(info: EufyDeviceInfo): 'doorbell' | 'indoor' | null {
  if (info.deviceClass !== 'camera') {
    return null;
  }
  const model = String(info.model || '').toUpperCase();
  const blob = `${info.name || ''} ${info.model || ''}`.toLowerCase();

  if (model.startsWith('T82') || blob.includes('doorbell')) {
    return 'doorbell';
  }
  if (
    model.startsWith('T84') ||
    blob.includes('indoor') ||
    blob.includes('pan & tilt') ||
    blob.includes('pan and tilt')
  ) {
    return 'indoor';
  }
  // Other security cameras — still expose as indoor-style (motion + video).
  if (info.category === 'eufy_security' || info.category === 'eufy_mega') {
    return 'indoor';
  }
  return null;
}
