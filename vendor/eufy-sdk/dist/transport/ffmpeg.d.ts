/**
 * Shared `ffmpeg` spawn helper — the ONE place that shells out to ffmpeg. It decides ffmpeg's own
 * verbosity, prepends the common flags, and routes stderr into the SDK's {@link Logger}, so no caller
 * touches `spawn("ffmpeg", …)` directly. Used by the media paths that mux via ffmpeg (`p2p/media.ts`
 * snapshot/record). Not byte-on-a-wire, so it sits at the transport root
 * rather than in a wire subfolder.
 *
 * Two independent dials:
 *   - **ffmpeg verbosity** — how chatty ffmpeg itself is, via `-loglevel`, from the host's
 *     `new EufyMega({ ffmpegLogLevel })` config (default `"error"`).
 *   - **where it lands** — the host {@link Logger} and its own min-level gate what's actually shown.
 *
 * So `new EufyMega({ ffmpegLogLevel: "trace", logger: new ConsoleLogger() })` surfaces ffmpeg's full
 * trace at `[ffmpeg]` debug lines; the default level + no logger stays silent.
 *
 * WHICH binary runs is a third, orthogonal dial: `new EufyMega({ ffmpegPath })`. See
 * {@link ffmpegExecutable} — the SDK never edits the process `PATH`, so an explicit path is what names
 * a binary that is not on it.
 *
 * @module transport/ffmpeg
 */
import { type ChildProcess, type StdioOptions } from "node:child_process";
import { type Logger } from "../core/logger.js";
/**
 * ffmpeg's `-loglevel` values, quiet → loud. `trace` is the firehose.
 *
 * Exported as the set in data form; not published — `FfmpegLevel` states the same members.
 * @internal
 */
export declare const FFMPEG_LEVELS: readonly ["quiet", "panic", "fatal", "error", "warning", "info", "verbose", "debug", "trace"];
/** A valid ffmpeg `-loglevel`. Set via `new EufyMega({ ffmpegLogLevel })`. */
export type FfmpegLevel = (typeof FFMPEG_LEVELS)[number];
/**
 * Resolve ffmpeg's own verbosity from the SDK config a host passes (`new EufyMega({ ffmpegLogLevel })`),
 * defaulting to `"error"` (quiet); an unset/invalid value yields the default. This is ffmpeg's
 * `-loglevel`, NOT the SDK's {@link LogLevel} — the two are orthogonal (ffmpeg decides what to emit,
 * the Logger decides what's shown).
 */
export declare function ffmpegLogLevel(level?: FfmpegLevel): FfmpegLevel;
/**
 * Resolve WHICH ffmpeg to run from the SDK config a host passes (`new EufyMega({ ffmpegPath })`),
 * defaulting to the bare name `"ffmpeg"` so it is looked up on `PATH`.
 *
 * An environment where no `ffmpeg` is on `PATH` is ordinary, and the SDK never mutates
 * `process.env.PATH` process-wide to reach one — this option is how such a binary is named.
 *
 * A **blank** value counts as absent: an unset host config commonly arrives as `""` or as whitespace
 * from a config file, and neither can name a binary, so spawning it would fail as an `ENOENT` on the
 * empty string — the misleading message this option exists to remove. Any non-blank value is passed
 * through EXACTLY as given, never trimmed: a leading or trailing space is legal in a POSIX path, and
 * rewriting one would make a real file unreachable.
 *
 * The value is NOT probed here. Spawn failure surfaces to the caller as the media path's own "not
 * runnable" rejection, which is the same signal a missing `PATH` entry gives, so there is nothing for
 * an extra `stat` to add. {@link ffmpegAvailable} is the probe.
 */
export declare function ffmpegExecutable(path?: string): string;
/**
 * Spawn ffmpeg. Prepends `-hide_banner` + the env-driven `-loglevel` (see {@link ffmpegLogLevel}) to
 * `args`, then forwards the child's stderr to `logger.debug` under an `[ffmpeg]` prefix — the logger's
 * min-level gates visibility, so a `noopLogger` (the default) swallows it. Callers pass only their
 * ffmpeg-specific args and read stdin/stdout off the returned child.
 *
 * `stdio` defaults to all-pipe; pass e.g. `["pipe", "ignore", "pipe"]` to drop stdout (stderr must
 * stay piped for forwarding to work). `level` overrides the resolved `-loglevel` (see
 * {@link ffmpegLogLevel} for precedence); `executable` picks the binary (see
 * {@link ffmpegExecutable}).
 */
export interface FfmpegSpawnOptions {
    logger?: Logger;
    stdio?: StdioOptions;
    level?: FfmpegLevel;
    /** The ffmpeg binary to run. Default: the bare name, looked up on `PATH`. */
    executable?: string;
}
export declare function spawnFfmpeg(args: string[], opts?: FfmpegSpawnOptions): ChildProcess;
/**
 * Whether the resolved ffmpeg is runnable, by running `-version` on it. Resolves the executable exactly
 * as the media paths do, so the answer is about the SAME binary they will launch.
 */
export declare function ffmpegAvailable(executable?: string): boolean;
/**
 * Whether `ffprobe` is on `PATH`. The SDK never spawns it, so there is no executable to resolve and
 * none is taken.
 */
export declare function ffprobeAvailable(): boolean;
