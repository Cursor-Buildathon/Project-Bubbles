export { clearApiKey, getApiKey, setApiKey } from "./auth";
export { withBackoff } from "./backoff";
export type {
	ApiMessage,
	ChatChunk,
	StreamChatOpts,
	ToolCallDelta,
	ToolDef,
} from "./chat";
export { streamChat } from "./chat";
export { fakeStreamChat, fakeSynthesize, isTestMode } from "./test-mode";
export type { SynthesizeOpts } from "./tts";
export { synthesize } from "./tts";
