import { getApiKey } from "./auth";
import { withBackoff } from "./backoff";
import { fakeStreamChat, isTestMode } from "./test-mode";

const CHAT_ENDPOINT = "https://api.minimaxi.chat/v1/text/chatcompletion_v2";

export interface ToolDef {
	type: "function";
	function: {
		name: string;
		description?: string;
		parameters: Record<string, unknown>;
	};
}

/** Flexible message type supporting tool calls for the ReAct loop. */
export interface ApiMessage {
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	tool_calls?: Array<{
		id: string;
		type: "function";
		function: { name: string; arguments: string };
	}>;
	tool_call_id?: string;
}

export interface StreamChatOpts {
	messages: ApiMessage[];
	/** Default: "MiniMax-Text-01" */
	model?: string;
	turnId: string;
	tools?: ToolDef[];
	signal?: AbortSignal;
}

export interface ToolCallDelta {
	index: number;
	id?: string;
	name?: string;
	argumentsChunk?: string;
}

export interface ChatChunk {
	text: string;
	finishReason?: string;
	toolCallDeltas?: ToolCallDelta[];
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

/** Parse a single SSE data line and return the text delta or null. */
function parseSseLine(line: string): ChatChunk | null {
	if (!line.startsWith("data:")) return null;
	const json = line.slice(5).trim();
	if (json === "[DONE]") return { text: "", finishReason: "stop" };
	try {
		const parsed = JSON.parse(json) as {
			choices?: Array<{
				delta?: {
					content?: string;
					tool_calls?: Array<{
						index: number;
						id?: string;
						type?: string;
						function?: { name?: string; arguments?: string };
					}>;
				};
				finish_reason?: string;
			}>;
			usage?: {
				prompt_tokens?: number;
				completion_tokens?: number;
				total_tokens?: number;
			};
		};
		const choice = parsed.choices?.[0];
		const text = choice?.delta?.content ?? "";
		const finishReason = choice?.finish_reason ?? undefined;
		const usage = parsed.usage
			? {
					promptTokens: parsed.usage.prompt_tokens ?? 0,
					completionTokens: parsed.usage.completion_tokens ?? 0,
					totalTokens: parsed.usage.total_tokens ?? 0,
				}
			: undefined;
		const toolCallDeltas: ToolCallDelta[] | undefined =
			choice?.delta?.tool_calls?.map((tc) => ({
				index: tc.index,
				id: tc.id,
				name: tc.function?.name,
				argumentsChunk: tc.function?.arguments,
			}));
		return {
			text,
			finishReason,
			usage,
			toolCallDeltas: toolCallDeltas?.length ? toolCallDeltas : undefined,
		};
	} catch {
		return null;
	}
}

/**
 * Stream chat completion from MiniMax M2.7.
 * Yields text delta chunks as they arrive via SSE.
 */
export async function* streamChat(
	opts: StreamChatOpts,
): AsyncGenerator<ChatChunk> {
	if (isTestMode()) {
		for await (const chunk of fakeStreamChat({
			messages: opts.messages,
			turnId: opts.turnId,
		})) {
			yield {
				text: chunk.text,
				finishReason: chunk.finishReason,
				usage: chunk.usage,
			};
		}
		return;
	}

	const apiKey = getApiKey();

	const response = await withBackoff(async () => {
		const res = await fetch(CHAT_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"x-bubbles-turn-id": opts.turnId,
			},
			body: JSON.stringify({
				model: opts.model ?? "MiniMax-Text-01",
				messages: opts.messages,
				stream: true,
				...(opts.tools?.length ? { tools: opts.tools } : {}),
			}),
			signal: opts.signal,
		});
		if (!res.ok) {
			const err = new Error(
				`MiniMax chat error: ${res.status} ${res.statusText}`,
			) as Error & { status: number };
			err.status = res.status;
			throw err;
		}
		return res;
	});

	const reader = response.body?.getReader();
	if (!reader) throw new Error("Response body is null");
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const chunk = parseSseLine(line.trim());
			if (chunk) yield chunk;
		}
	}
	// flush any remaining buffer
	if (buffer.trim()) {
		const chunk = parseSseLine(buffer.trim());
		if (chunk) yield chunk;
	}
}
