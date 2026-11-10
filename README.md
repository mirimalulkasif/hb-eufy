# homebridge-eufy-cameras

Homebridge plugin for **Eufy** doorbell and indoor cameras.

Exposes:

- **Doorbell** — ring events + motion
- **Indoor camera** — motion (person / pet / sound where the cloud reports them)
- **Enabled** switch — arm/disarm the device via Eufy cloud / P2P

This project is not affiliated with Anker or Eufy.

## Install

Homebridge UI → Plugins → search `homebridge-eufy-cameras`, or:

```bash
npm install -g homebridge-eufy-cameras
```

## Configure

In the Homebridge UI (or `config.json`):

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

## Notes

- Live HomeKit video streaming is not included in this version (motion / ring / enable are).
- Push events depend on a successful Eufy push connection.
- Uses the community [`eufy-security-client`](https://www.npmjs.com/package/eufy-security-client) library.

## License

MIT
