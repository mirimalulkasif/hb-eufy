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
  /** Absolute path to Homebridge config.json (optional). Polled for mfaCode/captchaCode. */
  configPath?: string;
};

const MFA_FILE = 'mfa-code.txt';
const CAPTCHA_FILE = 'captcha-code.txt';
const CAPTCHA_IMAGE = 'captcha.png';
const CODE_WAIT_MS = 5 * 60 * 1000;
const CODE_POLL_MS = 2000;
const PROGRESS_EVERY_MS = 15_000;

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

function readCodeFromHomebridgeConfig(
  configPath: string | undefined,
  field: 'mfaCode' | 'captchaCode',
): string | undefined {
  if (!configPath || !fs.existsSync(configPath)) {
    return undefined;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      platforms?: Array<Record<string, unknown>>;
    };
    for (const platform of raw.platforms || []) {
      if (platform.platform !== 'EufyCameras') {
        continue;
      }
      const value = platform[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    // ignore parse errors while the UI is writing the file
  }
  return undefined;
}

type WaitOptions = {
  log: Logging;
  filePath: string;
  label: string;
  timeoutMs: number;
  configPath?: string;
  configField?: 'mfaCode' | 'captchaCode';
  /** Codes already tried (rejected) — ignore until something new appears. */
  rejectCodes?: Set<string>;
};

/**
 * Wait for a one-time code without restarting Homebridge.
 * Prefer the persist file. Config is also polled, but saving config in the UI
 * restarts the child bridge and requests a NEW code — that path is discouraged.
 */
async function waitForCode(opts: WaitOptions): Promise<string> {
  const {
    log,
    filePath,
    label,
    timeoutMs,
    configPath,
    configField,
    rejectCodes = new Set(),
  } = opts;

  const deadline = Date.now() + timeoutMs;
  let nextProgressAt = Date.now() + PROGRESS_EVERY_MS;
  let attempt = 0;

  log.warn(
    `${label} required. Do NOT restart Homebridge and do NOT save the plugin config in the UI ` +
      `(that restarts the bridge and requests a new code).\n` +
      `  Write the code to this file (one line):\n` +
      `     ${filePath}\n` +
      `  Example: echo '123456' > "${filePath}"`,
  );

  while (Date.now() < deadline) {
    attempt += 1;
    const fromFile = readCodeFile(filePath);
    const fromConfig =
      configField && configPath
        ? readCodeFromHomebridgeConfig(configPath, configField)
        : undefined;
    const code = fromFile || fromConfig;

    if (code && !rejectCodes.has(code)) {
      if (fromFile) {
        clearCodeFile(filePath);
        log.info(`${label} code received from ${path.basename(filePath)}.`);
      } else {
        log.info(
          `${label} code read from config.json (${configField}). ` +
            'Prefer the mfa-code.txt file next time to avoid UI restarts.',
        );
      }
      return code;
    }

    if (Date.now() >= nextProgressAt) {
      const leftSec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      log.info(
        `Still waiting for ${label}… check #${attempt}, ${leftSec}s left. ` +
          `File: ${filePath}`,
      );
      nextProgressAt = Date.now() + PROGRESS_EVERY_MS;
    }

    await new Promise((resolve) => setTimeout(resolve, CODE_POLL_MS));
  }

  throw new Error(
    `${label} timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${filePath}.`,
  );
}

/**
 * Login to Eufy Mega (v6).
 * Captcha / 2FA are completed via persist files (and optionally config) while the process stays up.
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
  const rejectedMfa = new Set<string>();
  const rejectedCaptcha = new Set<string>();

  for (let step = 0; step < 6; step++) {
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
      const answer = await waitForCode({
        log,
        filePath: captchaCodePath,
        label: 'Captcha',
        timeoutMs: CODE_WAIT_MS,
        configPath: cfg.configPath,
        configField: 'captchaCode',
        rejectCodes: rejectedCaptcha,
      });
      result = await client.solveCaptcha(answer);
      if (result.status === LoginStatus.Captcha) {
        rejectedCaptcha.add(answer);
        log.warn('Captcha was rejected — waiting for a new answer.');
      }
      continue;
    }

    if (result.status === LoginStatus.TwoFactor) {
      log.warn(`Eufy 2FA required (method=${result.method}).`);
      const code = await waitForCode({
        log,
        filePath: mfaPath,
        label: '2FA',
        timeoutMs: CODE_WAIT_MS,
        configPath: cfg.configPath,
        configField: 'mfaCode',
        rejectCodes: rejectedMfa,
      });
      result = await client.submitVerifyCode(code);
      if (result.status === LoginStatus.TwoFactor) {
        rejectedMfa.add(code);
        log.warn(
          '2FA code was rejected (wrong/expired, or a new code was issued). ' +
            'Waiting for a fresh code in mfa-code.txt — do not restart.',
        );
      }
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
