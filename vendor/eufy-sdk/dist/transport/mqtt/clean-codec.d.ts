/**
 * Build the AIoT MQTT envelope for a Tuya DP write to a clean-line device (vacuum/mower).
 *
 * Wire format confirmed on a live T2351: the outer JSON carries `{head, payload}` where `payload`
 * is itself a JSON **string** containing the DP map. `head.cmd` 65537 (0x10001), `cmd_status` 2,
 * `sign_code` 0 — all confirmed from T2351 captures.
 *
 * The DP value is sent as-is: booleans, numbers, and base64 strings all appear directly in the
 * `data` map (the device interprets the type from its own schema).
 */
export declare function buildCleanDpEnvelope(accountId: string, deviceSn: string, dp: number, value: boolean | number | string, opts?: {
    timestamp?: number;
    uuid?: string;
}): string;
