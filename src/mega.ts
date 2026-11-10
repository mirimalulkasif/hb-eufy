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
  configPath?: string;
  ffmpegPath?: string;
  debug?: boolean;
};

function hbLogger(log: Logging): {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
} {
  return {
    debug: (message, ...args) => log.debug(message, ...args),
    info: (message, ...args) => log.info(message, ...args),
    warn: (message, ...args) => log.warn(message, ...args),
    error: (message, ...args) => log.error(message, ...args),
  };
}

const MFA_FILE = 'mfa-code.txt';
const CAPTCHA_FILE = 'captcha-code.txt';
const CAPTCHA_IMAGE = 'captcha.png';
const PENDING_2FA_FILE = 'eufy-2fa-pending.json';

type Pending2faState = {
  email: string;
  countryCode: string;
  auth: {
    userId: string;
    accountUserId?: string;
    authToken: string;
    geoKey?: string;
  };
  region: string;
  estimatedDomain?: string;
  sessionKey: unknown;
  savedAt: number;
};

type MegaApi = {
  auth_?: Pending2faState['auth'];
  pending2fa?: boolean;
  region?: string;
  estimatedDomain?: string;
  sessionKey?: unknown;
  loginBody: (opts: {
    verifyCode?: string;
    captchaId?: string;
    answer?: string;
  }) => Record<string, unknown>;
  attemptLogin: (
    body: Record<string, unknown>,
    messageType: number,
  ) => Promise<{ status: string; [key: string]: unknown }>;
  estimateDomain?: () => Promise<void>;
  ensureSessionKey?: () => Promise<unknown>;
};

function getApi(client: EufyMega): MegaApi {
  return client.api as unknown as MegaApi;
}

function pendingPath(persistDir: string): string {
  return path.join(persistDir, PENDING_2FA_FILE);
}

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
    // ignore
  }
  return undefined;
}

function readExistingMfaCode(
  persistDir: string,
  configPath?: string,
): string | undefined {
  return (
    readCodeFile(path.join(persistDir, MFA_FILE)) ||
    readCodeFromHomebridgeConfig(configPath, 'mfaCode')
  );
}

function readExistingCaptchaCode(
  persistDir: string,
  configPath?: string,
): string | undefined {
  return (
    readCodeFile(path.join(persistDir, CAPTCHA_FILE)) ||
    readCodeFromHomebridgeConfig(configPath, 'captchaCode')
  );
}

function loadPending2fa(
  persistDir: string,
  email: string,
  countryCode: string,
): Pending2faState | undefined {
  const file = pendingPath(persistDir);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8')) as Pending2faState;
    if (state.email !== email || state.countryCode !== countryCode) {
      return undefined;
    }
    // Ignore challenges older than 30 minutes
    if (Date.now() - state.savedAt > 30 * 60 * 1000) {
      clearPending2fa(persistDir);
      return undefined;
    }
    if (!state.auth?.authToken || !state.region) {
      return undefined;
    }
    return state;
  } catch {
    return undefined;
  }
}

function savePending2fa(
  persistDir: string,
  client: EufyMega,
  email: string,
  countryCode: string,
): void {
  const api = getApi(client);
  if (!api.auth_?.authToken || !api.region) {
    throw new Error('Cannot save 2FA pending state — missing limited auth token');
  }
  const state: Pending2faState = {
    email,
    countryCode,
    auth: { ...api.auth_ },
    region: api.region,
    estimatedDomain: api.estimatedDomain,
    sessionKey: api.sessionKey,
    savedAt: Date.now(),
  };
  fs.writeFileSync(pendingPath(persistDir), JSON.stringify(state, null, 2));
}

function clearPending2fa(persistDir: string): void {
  clearCodeFile(pendingPath(persistDir));
}

function restorePending2fa(client: EufyMega, state: Pending2faState): void {
  const api = getApi(client);
  api.auth_ = { ...state.auth };
  api.pending2fa = true;
  api.region = state.region;
  api.estimatedDomain = state.estimatedDomain;
  api.sessionKey = state.sessionKey;
}

function clearAuthCodes(persistDir: string): void {
  clearCodeFile(path.join(persistDir, MFA_FILE));
  clearCodeFile(path.join(persistDir, CAPTCHA_FILE));
  try {
    const img = path.join(persistDir, CAPTCHA_IMAGE);
    if (fs.existsSync(img)) {
      fs.unlinkSync(img);
    }
  } catch {
    // ignore
  }
}

function twoFaRestartMessage(persistDir: string): string {
  return (
    `2FA code was sent / is pending. Put the code in config mfaCode OR in:\n` +
    `  ${path.join(persistDir, MFA_FILE)}\n` +
    `Then restart Homebridge. The next start will submit that code and will NOT request a new one.`
  );
}

/**
 * Login to Eufy Mega (v6).
 *
 * Restart-friendly 2FA:
 * 1) If a pending challenge + code exist → submit code (no new SMS/email).
 * 2) If that fails or there is no pending challenge → login (may send a new code),
 *    save the challenge, and stop so you can set the code and restart.
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
    ...(cfg.ffmpegPath ? { ffmpegPath: cfg.ffmpegPath } : {}),
    // Always surface P2P/media warnings into Homebridge logs; full debug when enabled.
    logger: cfg.debug ? hbLogger(log) : {
      debug: () => undefined,
      info: () => undefined,
      warn: (message, ...args) => log.warn(message, ...args),
      error: (message, ...args) => log.error(message, ...args),
    },
  });

  const { LoginStatus } = sdk;
  const existingMfa = readExistingMfaCode(cfg.persistDir, cfg.configPath);
  const pending = loadPending2fa(cfg.persistDir, cfg.email, cfg.countryCode);

  // --- Path A: resume pending challenge with an existing code (no new 2FA send) ---
  if (pending && existingMfa) {
    log.info(
      'Using saved 2FA challenge + existing code (no new 2FA request)…',
    );
    try {
      restorePending2fa(client, pending);
      const resumed = await client.submitVerifyCode(existingMfa);
      if (resumed.status === LoginStatus.Ok) {
        clearPending2fa(cfg.persistDir);
        clearAuthCodes(cfg.persistDir);
        log.info('Logged into Eufy Mega (v6) cloud.');
        return { sdk, client };
      }
      log.warn(
        `Existing 2FA code was not accepted (status=${resumed.status}). ` +
          'Will start a fresh login and request a new code.',
      );
    } catch (err) {
      log.warn(
        `Existing 2FA code failed: ${String(err)}. ` +
          'Will start a fresh login and request a new code.',
      );
    }
    clearPending2fa(cfg.persistDir);
  } else if (pending && !existingMfa) {
    log.warn(
      'A 2FA challenge is still pending, but no code was found in config/mfa-code.txt. ' +
        'Add the code and restart — or wait for a fresh login below if the challenge expired.',
    );
  }

  // --- Path B: normal login (restores full session when possible) ---
  let result = await client.login();

  for (let step = 0; step < 4; step++) {
    if (result.status === LoginStatus.Ok) {
      clearPending2fa(cfg.persistDir);
      clearAuthCodes(cfg.persistDir);
      log.info('Logged into Eufy Mega (v6) cloud.');
      return { sdk, client };
    }

    if (result.status === LoginStatus.Captcha) {
      const captchaImagePath = path.join(cfg.persistDir, CAPTCHA_IMAGE);
      try {
        const raw = result.image.includes('base64,')
          ? result.image.split('base64,')[1]
          : result.image;
        fs.writeFileSync(captchaImagePath, Buffer.from(raw, 'base64'));
        log.warn(`Captcha image saved to: ${captchaImagePath}`);
      } catch (err) {
        log.warn(`Could not write captcha image: ${String(err)}`);
      }

      const captchaCode = readExistingCaptchaCode(cfg.persistDir, cfg.configPath);
      if (!captchaCode) {
        throw new Error(
          `Captcha required. Open ${captchaImagePath}, put the answer in captchaCode config ` +
            `or ${path.join(cfg.persistDir, CAPTCHA_FILE)}, then restart.`,
        );
      }
      log.info('Submitting captcha from config/file…');
      result = await client.solveCaptcha(captchaCode);
      continue;
    }

    if (result.status === LoginStatus.TwoFactor) {
      // login() has already requested a code for THIS challenge — save it for the next restart.
      try {
        savePending2fa(cfg.persistDir, client, cfg.email, cfg.countryCode);
      } catch (err) {
        log.warn(`Could not persist 2FA challenge: ${String(err)}`);
      }

      if (existingMfa) {
        log.info('Trying 2FA code from config/file against this challenge…');
        result = await client.submitVerifyCode(existingMfa);
        if (result.status === LoginStatus.Ok) {
          clearPending2fa(cfg.persistDir);
          clearAuthCodes(cfg.persistDir);
          log.info('Logged into Eufy Mega (v6) cloud.');
          return { sdk, client };
        }
        log.warn(
          `2FA code was rejected (status=${result.status}). ` +
            'A code was already requested for this challenge — update mfaCode / mfa-code.txt with the latest code and restart.',
        );
      }

      throw new Error(twoFaRestartMessage(cfg.persistDir));
    }

    throw new Error(`Unexpected login status: ${JSON.stringify(result)}`);
  }

  throw new Error('Login did not complete.');
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
