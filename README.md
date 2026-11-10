# homebridge-eufy-cameras

Homebridge plugin for **Eufy** doorbell and indoor cameras with **HomeKit live video**.

Exposes:

- **Camera** — live stream + snapshots in the Home app
- **Doorbell** — ring events (doorbell models)
- **Motion** — motion / person / pet / sound where the cloud reports them
- **Enabled** switch — arm/disarm the device via Eufy cloud / P2P

This project is not affiliated with Anker or Eufy.

## Requirements

- Homebridge `^1.6` or `^2`
- Node.js `>=20`
- Working LAN path to the camera / HomeBase (P2P livestream)
- `ffmpeg` (bundled via `ffmpeg-for-homebridge`, or set `ffmpegPath`)

## Install

Homebridge UI → Plugins → search `homebridge-eufy-cameras`, or:

```bash
npm install -g homebridge-eufy-cameras
```

After upgrading to **1.1.0+**, restart Homebridge and wait for the accessories to reload. Cameras should appear under the Homebridge bridge in the Home app (Cameras section).

## Configure

```json
{
  "platform": "EufyCameras",
  "name": "Eufy Cameras",
  "username": "you@example.com",
  "password": "your-password",
  "country": "US"
}
```

Only **doorbell** and **indoor camera** device types are imported. Other Eufy products are ignored.

### MFA / captcha

If login requires a one-time code, set `mfaCode` (or `captchaId` + `captchaCode` from the logs) and restart. Clear those fields after a successful session (persistent login is stored under Homebridge storage).

### ffmpeg

Optional `ffmpegPath` if the bundled binary does not work on your host.

## Notes

- Live video uses Eufy **P2P** livestream + ffmpeg remux/transcode to HomeKit SRTP.
- Push / ring / motion depend on a successful Eufy push connection.
- Uses the community [`eufy-security-client`](https://www.npmjs.com/package/eufy-security-client) library.
- HomeKit Secure Video recording is not included in this version.

## License

MIT
