import type { FcmCredentials } from "./types.js";
export interface PersistedPush {
    creds: FcmCredentials;
    persistentIds: string[];
}
export interface FcmStore {
    load(): PersistedPush | null;
    save(p: PersistedPush): void;
    clear(): void;
}
export declare class MemoryFcmStore implements FcmStore {
    private p;
    load(): PersistedPush | null;
    save(p: PersistedPush): void;
    clear(): void;
}
export declare class FileFcmStore implements FcmStore {
    private readonly path;
    constructor(path: string);
    load(): PersistedPush | null;
    save(p: PersistedPush): void;
    clear(): void;
}
