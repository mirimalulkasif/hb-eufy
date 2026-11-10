# homebridge-eufy-cameras

Homebridge plugin for **Eufy** doorbell and indoor cameras with **HomeKit live video**.

Talks to the modern **Eufy Mega (v6)** cloud (vendored SDK with Node 22 / 32-bit support). The old Eufy API returns empty device lists for many accounts — this plugin does not use that legacy path.

Exposes:

- **Camera** — live stream + snapshots in the Home app
- **Doorbell** — ring events (doorbell models)
- **Motion** — motion events from Mega realtime
- **Enabled** switch — camera on/off when the device supports it

This project is not affiliated with Anker or Eufy.

## Requirements

- **Node.js `>= 22.12.0`** — including **32-bit ARM (armv7l)** on Homebridge images that cannot install Node 24
- Homebridge `^1.8` or `^2`
- Working LAN path to the camera / HomeBase for live video
- `ffmpeg` (bundled via `ffmpeg-for-homebridge`, or set `ffmpegPath`)

HomeBase S1 Pro (T9000) WebRTC needs `node-datachannel` (64-bit only). Indoor cameras use P2P on 32-bit. Standalone T8223/T8224 doorbells normally use WebRTC; on 32-bit ARM this plugin falls back to P2P for live view (ring/motion still work via push).

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

## Notes

- Live video uses Mega P2P + ffmpeg remux to HomeKit SRTP. Homebridge must be on the **same LAN** as the cameras (avoid guest Wi‑Fi isolation / Docker bridge networking).
- Indoor cameras (T8400, …) stream over P2P. The plugin pre-warms that link after login to cut open delay.
- Standalone **T8223/T8224** doorbells need WebRTC for live video. On **32-bit ARM** live view is not available (ring/motion still work). Use a 64-bit host for doorbell live.
- If you see `P2P connect timeout … (relay: not started)`, open the camera in the Eufy app to confirm it is online, then set `"debug": true` in the plugin config and retry.
- **Ghost "No Response" cameras** from older plugin versions: delete them in the Home app, or remove and re-add the Eufy Cameras child bridge (scan the QR again). The plugin only controls accessories on the current bridge.
- On Node 22, E2E media keys use a PKCS#1 unwrap fallback (Node 24 is not required).
- Delete the `eufy-cameras` persist folder if you change account/country and need a clean login.
- HomeKit Secure Video recording is not included in this version.

## License

MIT
