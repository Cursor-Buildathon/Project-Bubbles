import { z } from "zod";

/** Validates IPC / channel names use the `v1:` prefix (Foundation Enabler #8). */
export const versionedChannelSchema = z.string().regex(/^v1:[a-z0-9:_-]+$/i);
export type VersionedChannel = z.infer<typeof versionedChannelSchema>;

export * from "./agent";
export * from "./ipc";
export * from "./memory";
export * from "./message";
