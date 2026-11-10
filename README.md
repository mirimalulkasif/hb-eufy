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

### MFA / captcha (do not restart)

Restarting Homebridge requests a **new** code and invalidates the one you just received.

When the logs say 2FA/captcha is required, keep Homebridge running and write the code to a file under the plugin persist folder (`…/eufy-cameras/`):

```bash
# 2FA (email/SMS code)
echo '123456' > /path/to/homebridge/eufy-cameras/mfa-code.txt

# Captcha (after opening captcha.png in that same folder)
echo 'AB12' > /path/to/homebridge/eufy-cameras/captcha-code.txt
```

The plugin polls those files for a few minutes, completes login, and saves the session so the next start usually needs no code.

## Notes

- Live video uses Mega P2P + ffmpeg remux to HomeKit SRTP.
- Delete the `eufy-cameras` persist folder if you change account/country and need a clean login.
- HomeKit Secure Video recording is not included in this version.

## License

MIT
