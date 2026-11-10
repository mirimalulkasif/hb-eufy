/** The `protobufjs` module shape, loaded on demand. */
type Protobuf = typeof import("protobufjs");
/** The engine, loading it on the first call. The ONLY runtime reference to `protobufjs` here. */
export declare function protobufjs(): Protobuf;
export {};
