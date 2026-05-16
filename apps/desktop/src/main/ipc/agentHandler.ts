import { randomUUID } from "node:crypto";
import { listAgents, runAgentLoop } from "@bubbles/agent-runtime";
import { recordCostEvent } from "@bubbles/cost-meter";
import type { Db } from "@bubbles/memory-core";
import {
	getDailySummary,
	getLatestConversation,
	insertConversation,
	insertMessage,
	upsertAgent,
} from "@bubbles/memory-core";
import { synthesize } from "@bubbles/minimax-client";
import { Guard } from "@bubbles/permission-guard";
import { createLogger, withTurnId } from "@bubbles/shared-logger";
import { AgentRunRequestSchema, IPC_CHANNELS } from "@bubbles/shared-types";
import type { WebContents } from "electron";
import { ipcMain } from "electron";
import { playAudio } from "../audio";
import { requestPermissionFromRenderer } from "../permissionRouter";
import {
	getCostCapUsd,
	getLastAgentId,
	getLastConversationId,
	setLastAgentId,
	setLastConversationId,
} from "../store";
import { getAvatarWindow } from "../windows/avatar";
import { getChatPanelWindow } from "../windows/chatPanel";

const log = createLogger("agent-handler");

function sendMood(mood: string): void {
	const avatar = getAvatarWindow();
	if (avatar && !avatar.isDestroyed()) {
		avatar.webContents.send(IPC_CHANNELS.AVATAR_SET_MOOD, { mood });
	}
}

function syncFilesystemAgents(db: Db): void {
	for (const agent of listAgents()) {
		upsertAgent(db, {
			id: agent.id,
			name: agent.name,
			skinId: agent.id,
		});
	}
}

/** Rough cost estimation for MiniMax M2.7 + Speech-02-Turbo (USD). */
function estimateChatCost(inputTokens: number, outputTokens: number): number {
	// MiniMax M2.7: ~$0.15 / 1M input, ~$0.60 / 1M output
	return inputTokens * 0.00000015 + outputTokens * 0.0000006;
}

function estimateTtsCost(characters: number): number {
	// Speech-02-Turbo: ~$0.015 / 1K characters
	return characters * 0.000015;
}

function checkCostCap(db: Db): boolean {
	const cap = getCostCapUsd();
	if (cap <= 0) return false; // no cap
	const today = getDailySummary(db, 1);
	if (today.length === 0) return false;
	const spent = today[0].totalCostUsd;
	return spent >= cap;
}

export function registerAgentHandler(db: Db, projectRoot: string): void {
	syncFilesystemAgents(db);

	ipcMain.handle(IPC_CHANNELS.AGENT_RUN, async (evt, raw: unknown) => {
		const parseResult = AgentRunRequestSchema.safeParse(raw);
		if (!parseResult.success) {
			return {
				turnId: "",
				conversationId: "",
				status: "error",
				error: parseResult.error.message,
			};
		}

		const req = parseResult.data;
		const turnId = req.turnId ?? randomUUID();
		const conversationId = req.conversationId ?? randomUUID();
		const tlog = withTurnId(log, turnId);

		try {
			// Cost-cap gate
			if (checkCostCap(db)) {
				return {
					turnId,
					conversationId,
					status: "error",
					error:
						"I've hit today's spend cap. You can raise the limit in Settings.",
				};
			}

			syncFilesystemAgents(db);
			const existing = db
				.prepare("SELECT id FROM conversations WHERE id = ?")
				.get(conversationId);
			if (!existing) {
				insertConversation(db, { id: conversationId, agentId: req.agentId });
			}

			insertMessage(db, {
				id: randomUUID(),
				conversationId,
				role: "user",
				content: req.text,
			});
			setLastConversationId(conversationId);
			setLastAgentId(req.agentId);

			tlog.info({ event: "agent-run-start", text: req.text });
			sendMood("thinking");

			const sender: WebContents = evt.sender;
			const streamChannel = IPC_CHANNELS.AGENT_STREAM(turnId);

			// Build guard — uses chat panel sender to surface the permission modal
			const chatPanel = getChatPanelWindow();
			const permSender =
				chatPanel && !chatPanel.isDestroyed() ? chatPanel.webContents : sender;

			const guard = new Guard({
				db,
				turnId,
				requestPermission: (permReq) =>
					requestPermissionFromRenderer(permSender, permReq),
			});

			const { fullText, usage } = await runAgentLoop({
				db,
				guard,
				conversationId,
				turnId,
				agentId: req.agentId,
				userText: req.text,
				projectRoot,
				onChunk: (chunk) => {
					sender.send(streamChannel, { ...chunk, turnId });
				},
			});

			tlog.info({ event: "agent-run-complete", chars: fullText.length });

			insertMessage(db, {
				id: randomUUID(),
				conversationId,
				role: "assistant",
				content: fullText,
			});

			if (usage) {
				const costUsd = estimateChatCost(
					usage.promptTokens ?? 0,
					usage.completionTokens ?? 0,
				);
				recordCostEvent(db, {
					id: randomUUID(),
					kind: "chat",
					model: "MiniMax-Text-01",
					inputTokens: usage.promptTokens,
					outputTokens: usage.completionTokens,
					costUsd,
					turnId,
				});
			}

			if (fullText) {
				try {
					sendMood("talking");
					const mp3Buffer = await synthesize({ text: fullText, turnId });
					recordCostEvent(db, {
						id: randomUUID(),
						kind: "tts",
						model: "speech-02-turbo",
						characters: fullText.length,
						costUsd: estimateTtsCost(fullText.length),
						turnId,
					});
					playAudio(sender, mp3Buffer);
				} catch (ttsErr) {
					tlog.warn({ event: "tts-failed", error: String(ttsErr) });
					// Surface TTS failure as a toast so the user knows text still arrived
					sender.send(IPC_CHANNELS.AGENT_STREAM(turnId), {
						delta: "",
						done: false,
						toolResult: {
							name: "tts",
							result: "Speech synthesis failed — text reply delivered.",
						},
						turnId,
					});
				}
			}

			sendMood("idle");
			return { turnId, conversationId, status: "done" };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			tlog.error({ event: "agent-run-error", error: message });
			sendMood("error");
			// Emit a structured error toast to renderer
			evt.sender.send(IPC_CHANNELS.AGENT_STREAM(turnId), {
				delta: "",
				done: false,
				toolResult: { name: "error", result: message },
				turnId,
			});
			// Also append readable error to chat stream
			evt.sender.send(IPC_CHANNELS.AGENT_STREAM(turnId), {
				delta: `\n\n[Error: ${message}]`,
				done: true,
				turnId,
			});
			return { turnId, conversationId, status: "error", error: message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.AGENT_LIST, () => {
		const agents = listAgents();
		return { agents };
	});

	// Relay active agent switch to avatar window
	ipcMain.on(IPC_CHANNELS.AVATAR_SET_SKIN, (_evt, raw: unknown) => {
		const avatar = getAvatarWindow();
		if (avatar && !avatar.isDestroyed()) {
			avatar.webContents.send(IPC_CHANNELS.AVATAR_SET_SKIN, raw);
		}
	});

	// Return last conversation id for relaunch
	ipcMain.handle(IPC_CHANNELS.AGENT_LAST_CONVERSATION, () => {
		const storedConversationId = getLastConversationId();
		const storedAgentId = getLastAgentId();
		if (storedConversationId) {
			return {
				conversationId: storedConversationId,
				agentId: storedAgentId,
			};
		}

		const latest = getLatestConversation(db);
		return {
			conversationId: latest?.id ?? "",
			agentId: latest?.agent_id ?? storedAgentId,
		};
	});
}
