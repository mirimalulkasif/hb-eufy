# homebridge-eufy-cameras

Homebridge plugin for **Eufy** doorbell and indoor cameras with **HomeKit live video**.

Uses the modern **Eufy Mega (v6)** cloud via [`@mega-yfue/eufy-sdk`](https://www.npmjs.com/package/@mega-yfue/eufy-sdk). The old Eufy API returns empty device lists for many accounts — this plugin does not use that legacy path.

Exposes:

- **Camera** — live stream + snapshots in the Home app
- **Doorbell** — ring events (doorbell models)
- **Motion** — motion events from Mega realtime
- **Enabled** switch — camera on/off when the device supports it

This project is not affiliated with Anker or Eufy.

## Requirements

- **Node.js `>= 24.5.0`** (required by `@mega-yfue/eufy-sdk`)
- Homebridge `^1.8` or `^2`
- Working LAN path to the camera / HomeBase for live video
- `ffmpeg` (bundled via `ffmpeg-for-homebridge`, or set `ffmpegPath`)

## Install

```bash
npm install -g homebridge-eufy-cameras
```

Or Homebridge UI → Plugins → `homebridge-eufy-cameras`.

## Configure

```json
{
  "platform": "EufyCameras",
  "name": "Eufy Cameras",
  "username": "you@example.com",
  "password": "your-password",
  "country": "IL"
}
```

`country` must match the region in the Eufy mobile app.

### MFA / captcha (restart-friendly)

1. Start the plugin. If Eufy requires 2FA, it requests **one** code and saves the challenge, then stops with a log message.
2. Put that code in `mfaCode` in the plugin config **or**:
   ```bash
   echo '123456' > /var/lib/homebridge/eufy-cameras/mfa-code.txt
   ```
3. Restart Homebridge. The plugin submits the saved code and **does not request a new 2FA**.
4. If the code is wrong/expired, it requests a new one, saves a new challenge, and you repeat steps 2–3.

Captcha works the same way with `captcha.png` + `captchaCode` / `captcha-code.txt`.

After a successful login the session is stored, so later starts usually need no code.

Also requires **Node.js ≥ 24.5** (Mega SDK).

## Notes

- Live video uses Mega P2P + ffmpeg remux to HomeKit SRTP.
- Delete the `eufy-cameras` persist folder if you change account/country and need a clean login.
- HomeKit Secure Video recording is not included in this version.

## License

MIT
