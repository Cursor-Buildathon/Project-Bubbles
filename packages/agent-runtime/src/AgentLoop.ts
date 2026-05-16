import { randomUUID } from "node:crypto";
import type { Db, MessageRow } from "@bubbles/memory-core";
import { getMessagesByConversation, insertMessage } from "@bubbles/memory-core";
import type { ApiMessage } from "@bubbles/minimax-client";
import { streamChat } from "@bubbles/minimax-client";
import type { Guard } from "@bubbles/permission-guard";
import { createLogger, withTurnId } from "@bubbles/shared-logger";
import type { AgentStreamChunk } from "@bubbles/shared-types";
import type { Tool, ToolContext } from "@bubbles/tool-kit";
import { forAgent } from "@bubbles/tool-kit";
import { compileAgent } from "./SkillsCompiler";

const log = createLogger("agent-loop");

const MAX_TOOL_ROUNDS = 8;
const MAX_HISTORY_MESSAGES = 40;

export interface AgentLoopOpts {
	db: Db;
	guard: Guard;
	conversationId: string;
	turnId: string;
	agentId: string;
	userText: string;
	projectRoot: string;
	onChunk: (chunk: Omit<AgentStreamChunk, "turnId">) => void;
	signal?: AbortSignal;
}

export interface AgentLoopResult {
	fullText: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export function buildChatMessagesFromRows(
	rows: Array<Pick<MessageRow, "role" | "content">>,
	systemPrompt: string,
	fallbackUserText: string,
): ApiMessage[] {
	const history = rows
		.filter((message) => message.role !== "tool")
		.slice(-MAX_HISTORY_MESSAGES)
		.map<ApiMessage>((message) => ({
			role: message.role,
			content: message.content,
		}));

	if (history.length === 0 || history[history.length - 1]?.role !== "user") {
		history.push({ role: "user", content: fallbackUserText });
	}

	return [{ role: "system", content: systemPrompt }, ...history];
}

export function buildChatMessages(
	db: Db,
	conversationId: string,
	systemPrompt: string,
	fallbackUserText: string,
): ApiMessage[] {
	return buildChatMessagesFromRows(
		getMessagesByConversation(db, conversationId),
		systemPrompt,
		fallbackUserText,
	);
}

export async function runAgentLoop(
	opts: AgentLoopOpts,
): Promise<AgentLoopResult> {
	const tlog = withTurnId(log, opts.turnId);
	const compiled = compileAgent(opts.agentId);

	const systemPrompt =
		compiled?.systemPrompt ??
		"You are Bubbles, a helpful desktop AI assistant. Be concise and friendly.";
	const model = compiled?.model ?? "MiniMax-Text-01";
	const tools: Tool[] = compiled?.tools?.length ? forAgent(compiled.tools) : [];

	const messages = buildChatMessages(
		opts.db,
		opts.conversationId,
		systemPrompt,
		opts.userText,
	);

	let fullText = "";
	let lastUsage: AgentLoopResult["usage"] | undefined;
	const ctx: ToolContext = { workspaceRoot: opts.projectRoot };

	const toolDefs = tools.map((t) => ({
		type: "function" as const,
		function: {
			name: t.name,
			description: t.description,
			parameters: t.parametersSchema,
		},
	}));

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		// Accumulate tool call deltas by index across chunks
		const pending = new Map<
			number,
			{ id: string; name: string; argsStr: string }
		>();
		let textDelta = "";
		let finishReason: string | undefined;

		for await (const chunk of streamChat({
			messages,
			model,
			turnId: opts.turnId,
			tools: toolDefs.length ? toolDefs : undefined,
			signal: opts.signal,
		})) {
			if (chunk.text) {
				textDelta += chunk.text;
				fullText += chunk.text;
				opts.onChunk({ delta: chunk.text, done: false });
			}
			if (chunk.toolCallDeltas) {
				for (const td of chunk.toolCallDeltas) {
					if (!pending.has(td.index)) {
						pending.set(td.index, { id: "", name: "", argsStr: "" });
					}
					const entry = pending.get(td.index);
					if (!entry) continue;
					if (td.id) entry.id = td.id;
					if (td.name) entry.name = td.name;
					if (td.argumentsChunk) entry.argsStr += td.argumentsChunk;
				}
			}
			if (chunk.finishReason) finishReason = chunk.finishReason;
			if (chunk.usage) lastUsage = chunk.usage;
		}

		// No tool calls → done
		if (
			pending.size === 0 ||
			(finishReason !== "tool_calls" && finishReason !== "stop")
		) {
			break;
		}
		if (pending.size === 0) break;

		// Build assistant message with tool_calls
		const toolCallsList = [...pending.values()].map((tc) => ({
			id: tc.id || randomUUID(),
			type: "function" as const,
			function: { name: tc.name, arguments: tc.argsStr },
		}));

		messages.push({
			role: "assistant",
			content: textDelta,
			tool_calls: toolCallsList,
		});

		// Execute each tool
		for (const tc of toolCallsList) {
			const tool = tools.find((t) => t.name === tc.function.name);
			if (!tool) {
				messages.push({
					role: "tool",
					content: `Unknown tool: ${tc.function.name}`,
					tool_call_id: tc.id,
				});
				continue;
			}

			let args: Record<string, unknown> = {};
			try {
				args = JSON.parse(tc.function.arguments || "{}");
			} catch {
				args = {};
			}

			opts.onChunk({
				delta: "",
				done: false,
				toolCall: { name: tc.function.name, args },
			});
			tlog.info({ event: "tool-call", tool: tc.function.name });

			const decision = await opts.guard.review(tool, args, ctx);
			if (decision === "deny") {
				messages.push({
					role: "tool",
					content: "Tool call denied by user.",
					tool_call_id: tc.id,
				});
				opts.onChunk({
					delta: "",
					done: false,
					toolResult: { name: tc.function.name, result: "denied" },
				});
				continue;
			}

			const result = await tool.invoke(args, ctx);
			tlog.info({
				event: "tool-result",
				tool: tc.function.name,
				bytes: result.length,
			});

			// Persist tool exchange to DB
			insertMessage(opts.db, {
				id: randomUUID(),
				conversationId: opts.conversationId,
				role: "tool",
				content: result,
			});

			messages.push({
				role: "tool",
				content: result,
				tool_call_id: tc.id,
			});
			opts.onChunk({
				delta: "",
				done: false,
				toolResult: { name: tc.function.name, result },
			});
		}
	}

	return { fullText, usage: lastUsage };
}
