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
};

const MFA_FILE = 'mfa-code.txt';
const CAPTCHA_FILE = 'captcha-code.txt';
const CAPTCHA_IMAGE = 'captcha.png';
const CODE_WAIT_MS = 5 * 60 * 1000;
const CODE_POLL_MS = 2000;

function readCodeFile(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    const value = fs.readFileSync(filePath, 'utf8').trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function clearCodeFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

/**
 * Wait for the user to drop a one-time code into a file.
 * Do NOT restart Homebridge — a restart requests a new code and invalidates this one.
 */
async function waitForCodeFile(
  log: Logging,
  filePath: string,
  label: string,
  timeoutMs: number,
): Promise<string> {
  clearCodeFile(filePath);
  const deadline = Date.now() + timeoutMs;
  log.warn(
    `${label} required. Do NOT restart Homebridge.\n` +
      `  1) Wait for the code (email/SMS or captcha image).\n` +
      `  2) Write it to this file (one line):\n` +
      `     ${filePath}\n` +
      `  Example: echo '123456' > "${filePath}"\n` +
      `Waiting up to ${Math.round(timeoutMs / 60000)} minutes…`,
  );

  while (Date.now() < deadline) {
    const code = readCodeFile(filePath);
    if (code) {
      clearCodeFile(filePath);
      log.info(`${label} code received from ${path.basename(filePath)}.`);
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, CODE_POLL_MS));
  }
  throw new Error(
    `${label} timed out waiting for ${filePath}. Restart the plugin to request a new code.`,
  );
}

/**
 * Login to Eufy Mega (v6).
 * Captcha / 2FA are completed via files in persistDir so you do not restart mid-challenge.
 */
export async function loginMega(
  log: Logging,
  cfg: MegaLoginConfig,
): Promise<{ sdk: MegaSdk; client: EufyMega }> {
  const sdk = await loadMegaSdk();
  const sessionPath = path.join(cfg.persistDir, 'eufy-session.json');
  const pushPath = path.join(cfg.persistDir, 'eufy-push.json');
  const mfaPath = path.join(cfg.persistDir, MFA_FILE);
  const captchaCodePath = path.join(cfg.persistDir, CAPTCHA_FILE);
  const captchaImagePath = path.join(cfg.persistDir, CAPTCHA_IMAGE);

  const client = new sdk.EufyMega({
    email: cfg.email,
    password: cfg.password,
    countryCode: cfg.countryCode,
    store: new sdk.FileSessionStore(sessionPath),
    pushStore: new sdk.FileFcmStore(pushPath),
  });

  let result = await client.login();
  const { LoginStatus } = sdk;

  // Allow a few challenge steps (captcha then 2FA, or retries).
  for (let step = 0; step < 4; step++) {
    if (result.status === LoginStatus.Ok) {
      break;
    }

    if (result.status === LoginStatus.Captcha) {
      try {
        const raw = result.image.includes('base64,')
          ? result.image.split('base64,')[1]
          : result.image;
        fs.writeFileSync(captchaImagePath, Buffer.from(raw, 'base64'));
        log.warn(`Captcha image saved to: ${captchaImagePath}`);
      } catch (err) {
        log.warn(`Could not write captcha image: ${String(err)}`);
      }
      const answer = await waitForCodeFile(
        log,
        captchaCodePath,
        'Captcha',
        CODE_WAIT_MS,
      );
      result = await client.solveCaptcha(answer);
      continue;
    }

    if (result.status === LoginStatus.TwoFactor) {
      log.warn(`Eufy 2FA required (method=${result.method}).`);
      const code = await waitForCodeFile(log, mfaPath, '2FA', CODE_WAIT_MS);
      result = await client.submitVerifyCode(code);
      continue;
    }

    throw new Error(`Unexpected login status: ${JSON.stringify(result)}`);
  }

  if (result.status !== LoginStatus.Ok) {
    throw new Error(
      `Login did not complete (status=${String((result as { status: string }).status)}).`,
    );
  }

  clearCodeFile(mfaPath);
  clearCodeFile(captchaCodePath);
  try {
    if (fs.existsSync(captchaImagePath)) {
      fs.unlinkSync(captchaImagePath);
    }
  } catch {
    // ignore
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
  if (info.category === 'eufy_security' || info.category === 'eufy_mega') {
    return 'indoor';
  }
  return null;
}
