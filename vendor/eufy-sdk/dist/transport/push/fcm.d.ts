import type { FcmCredentials } from "./types.js";
import { type Logger } from "../../core/logger.js";
export declare const FCM: {
    readonly PROJECT_ID: "batterycam-3250a";
    readonly API_KEY: "AIzaSyCSz1uxGrHXsEktm7O3_wv-uLGpC9BvXR8";
    readonly APP_ID: "1:348804314802:android:440a6773b3620da7";
    readonly SENDER_ID: "348804314802";
    readonly PACKAGE: "com.oceanwing.battery.cam";
    readonly CERT_SHA1: "F051262F9F99B638F3C76DE349830638555B4A0A";
    readonly AUTH_VERSION: "FIS_v2";
    readonly SDK_VERSION: "a:16.3.1";
};
/** Generate a valid Firebase Installation ID (22 url-safe chars, starts c-f). */
export declare function generateFid(): string;
export declare class FcmRegistrar {
    private readonly logger;
    constructor(logger?: Logger);
    /** Full registration → FcmCredentials. */
    register(): Promise<FcmCredentials>;
    private installFid;
    private checkin;
    private gcmRegister;
}
