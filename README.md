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

### MFA / captcha

- **2FA:** set `mfaCode`, restart, then clear it.
- **Captcha:** the plugin writes `captcha.png` under Homebridge storage `eufy-cameras/`. Set `captchaCode` to the 4 characters, restart, then clear it.

## Notes

- Live video uses Mega P2P + ffmpeg remux to HomeKit SRTP.
- Delete the `eufy-cameras` persist folder if you change account/country and need a clean login.
- HomeKit Secure Video recording is not included in this version.

## License

MIT
