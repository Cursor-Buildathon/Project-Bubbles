import type { AgentListResponse } from "@bubbles/shared-types";
import { useEffect, useRef, useState } from "react";
import AgentSwitcher from "./agents/AgentSwitcher";
import ToastContainer, { showToast } from "./components/Toast";
import OnboardingWizard from "./onboarding/OnboardingWizard";
import PermissionModal from "./PermissionModal";
import SpendDashboard from "./settings/SpendDashboard";
import { title } from "./strings";

type Status = "idle" | "thinking" | "speaking";

interface Message {
	id: string;
	role: "user" | "assistant" | "tool";
	content: string;
	toolName?: string;
	toolStatus?: "pending" | "done" | "error";
}

export default function ChatApp() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [amplitude, setAmplitude] = useState(0);
	const [needsOnboarding, setNeedsOnboarding] = useState(false);
	const [apiKeySet, setApiKeySet] = useState(false);
	const [conversationId, setConversationId] = useState<string | undefined>();
	const [agents, setAgents] = useState<AgentListResponse["agents"]>([]);
	const [activeAgentIdx, setActiveAgentIdx] = useState(0);
	const [showSettings, setShowSettings] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const activeTurnIdRef = useRef<string | null>(null);
	const activeAgentId = agents[activeAgentIdx]?.id ?? "bubbles";

	// Load agent list + onboarding state + last conversation on mount
	useEffect(() => {
		window.bubbles?.agent
			.list()
			.then((res) => setAgents(res.agents))
			.catch(() => {});
		window.bubbles?.debug
			.hasApiKey()
			.then((res) => setApiKeySet(res.hasKey))
			.catch(() => {});
		window.bubbles?.app
			.needsOnboarding()
			.then((res) => setNeedsOnboarding(res.needsOnboarding))
			.catch(() => {});

		// Load last conversation
		window.bubbles?.agent
			.list()
			.then((res) => {
				setAgents(res.agents);
				// Try to load last conversation from main process
				return window.bubbles?.agent.list();
			})
			.then(() => {
				// Load history if we have a stored conversation id
				// We need an IPC to get it; for now, rely on memory.query with no id
			});
	}, []);

	// Try loading last conversation once agents are ready
	useEffect(() => {
		if (agents.length === 0) return;
		if (window.bubbles?.agent?.lastConversation) {
			window.bubbles.agent
				.lastConversation()
				.then((res) => {
					if (res.conversationId) {
						setConversationId(res.conversationId);
						const idx = agents.findIndex((a) => a.id === res.agentId);
						if (idx !== -1) setActiveAgentIdx(idx);
						return window.bubbles?.memory.query({
							conversationId: res.conversationId,
							limit: 100,
						});
					}
				})
				.then((history) => {
					if (history?.messages?.length) {
						setMessages(
							history.messages.map((m) => ({
								id: m.id,
								role: m.role === "system" ? "assistant" : m.role,
								content: m.content,
							})),
						);
					}
				})
				.catch(() => {});
		}
	}, [agents]);

	// Scroll to bottom when messages change
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Listen for audio events
	useEffect(() => {
		if (!window.bubbles) return;

		const unsub = window.bubbles.audio.onPlay((payload) => {
			setStatus("speaking");
			// Play audio via Web Audio API
			const bytes = new Uint8Array(payload.data);
			const blob = new Blob([bytes], { type: payload.mimeType });
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);

			// Amplitude animation via Web Audio AnalyserNode
			const ctx = new AudioContext();
			const source = ctx.createMediaElementSource(audio);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			analyser.connect(ctx.destination);
			const dataArr = new Uint8Array(analyser.frequencyBinCount);
			let frameId: number;

			const measure = () => {
				analyser.getByteTimeDomainData(dataArr);
				let sum = 0;
				for (const v of dataArr) sum += Math.abs(v - 128);
				const rms = sum / dataArr.length / 128;
				setAmplitude(rms);
				// Relay amplitude to avatar window via main process
				if (activeTurnIdRef.current) {
					window.bubbles?.audio.sendAmplitude({
						rms,
						turnId: activeTurnIdRef.current,
					});
				}
				if (!audio.ended) frameId = requestAnimationFrame(measure);
			};

			audio.onplay = () => {
				frameId = requestAnimationFrame(measure);
			};
			audio.onended = () => {
				cancelAnimationFrame(frameId);
				setAmplitude(0);
				setStatus("idle");
				activeTurnIdRef.current = null;
				URL.revokeObjectURL(url);
				ctx.close().catch(() => {});
			};
			audio.play().catch(() => {
				activeTurnIdRef.current = null;
				setStatus("idle");
			});
		});

		return unsub;
	}, []);

	// Escape key closes chat
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				window.bubbles?.app.closeChat();
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	async function handleSend() {
		const text = input.trim();
		if (!text || !window.bubbles) return;
		setInput("");
		setStatus("thinking");
		setMessages((prev) => [
			...prev,
			{ id: `user-${Date.now()}`, role: "user", content: text },
		]);

		const turnId = crypto.randomUUID();
		activeTurnIdRef.current = turnId;
		const streamId = `assistant-${turnId}`;
		let draft = "";

		const unsub = window.bubbles.agent.onStream(turnId, (chunk) => {
			if (chunk.delta) {
				draft += chunk.delta;
				setMessages((prev) => {
					const last = prev[prev.length - 1];
					if (last?.id === streamId) {
						return [
							...prev.slice(0, -1),
							{ id: streamId, role: "assistant", content: draft },
						];
					}
					return [...prev, { id: streamId, role: "assistant", content: draft }];
				});
			}
			if (chunk.toolCall) {
				const tc = chunk.toolCall;
				setMessages((prev) => [
					...prev,
					{
						id: `tool-${tc.name}-${Date.now()}`,
						role: "tool",
						content: `🔧 ${tc.name}`,
						toolName: tc.name,
						toolStatus: "pending",
					},
				]);
			}
			if (chunk.toolResult) {
				const tr = chunk.toolResult;
				setMessages((prev) => {
					const lastTool = [...prev]
						.reverse()
						.find(
							(m) =>
								m.role === "tool" &&
								m.toolName === tr.name &&
								m.toolStatus === "pending",
						);
					if (!lastTool) return prev;
					const ok = tr.result !== "denied" && !tr.result?.startsWith("Error");
					return prev.map((m) =>
						m.id === lastTool.id
							? {
									...m,
									content: ok ? `✅ ${m.toolName}` : `❌ ${m.toolName}`,
									toolStatus: ok ? "done" : "error",
								}
							: m,
					);
				});
			}
			if (chunk.done) {
				unsub();
				setStatus((s) => (s === "thinking" ? "idle" : s));
			}
		});

		const res = await window.bubbles.agent.run({
			turnId,
			agentId: activeAgentId,
			text,
			conversationId,
		});

		if (res.status === "error") {
			unsub();
			activeTurnIdRef.current = null;
			setMessages((prev) => [
				...prev,
				{
					id: `err-${Date.now()}`,
					role: "assistant",
					content: `Error: ${res.error ?? "unknown"}`,
				},
			]);
			showToast(res.error ?? "Request failed", "error");
			setStatus("idle");
			return;
		}

		setConversationId(res.conversationId);
	}

	const statusColor: Record<Status, string> = {
		idle: "bg-zinc-600",
		thinking: "bg-yellow-500 animate-pulse",
		speaking: "bg-green-500 animate-pulse",
	};

	function handleOnboardingComplete() {
		setNeedsOnboarding(false);
		setApiKeySet(true);
		showToast("Welcome to Bubbles!", "success");
	}

	function handleAgentSwitch(idx: number) {
		setActiveAgentIdx(idx);
		window.bubbles?.agent.setSkin(agents[idx].id);
		// Start a new conversation when switching agents
		setConversationId(undefined);
		setMessages([]);
	}

	return (
		<div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans">
			<ToastContainer />
			<PermissionModal />

			{needsOnboarding && (
				<OnboardingWizard onComplete={handleOnboardingComplete} />
			)}

			{showSettings && (
				<SpendDashboard onClose={() => setShowSettings(false)} />
			)}

			{/* Header */}
			<header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
				<h1 className="text-lg font-bold tracking-tight">{title()}</h1>
				<div className="flex items-center gap-3">
					<AgentSwitcher
						agents={agents}
						activeAgentIdx={activeAgentIdx}
						onSwitch={handleAgentSwitch}
					/>
					<button
						type="button"
						onClick={() => setShowSettings(true)}
						className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
						title="Settings"
					>
						<svg
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<title>Settings</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</button>
					<span className="text-xs text-zinc-400">{status}</span>
					<span className={`w-2 h-2 rounded-full ${statusColor[status]}`} />
				</div>
			</header>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{messages.length === 0 && (
					<p className="text-zinc-500 text-sm text-center mt-8">
						Type a message to start chatting.
					</p>
				)}
				{messages.map((msg) => (
					<div
						data-testid="chat-message"
						key={msg.id}
						className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
					>
						{msg.role === "tool" ? (
							<div className="bg-zinc-800/60 text-zinc-400 text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
								{msg.content}
							</div>
						) : (
							<div
								data-testid={`chat-message-${msg.role}`}
								className={`max-w-[75%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
									msg.role === "user"
										? "bg-blue-600 text-white rounded-br-sm"
										: msg.content.startsWith("Error:")
											? "bg-red-900/40 text-red-200 border border-red-800 rounded-bl-sm"
											: "bg-zinc-800 text-zinc-100 rounded-bl-sm"
								}`}
							>
								{msg.content}
							</div>
						)}
					</div>
				))}
				<div ref={bottomRef} />
			</div>

			{/* Amplitude indicator */}
			{status === "speaking" && (
				<div className="mx-4 mb-1">
					<div
						className="h-1 bg-green-500 rounded transition-all duration-75"
						style={{ width: `${Math.min(100, amplitude * 500)}%` }}
					/>
				</div>
			)}

			{/* Input */}
			<div className="flex gap-2 px-4 py-3 border-t border-zinc-800">
				<input
					data-testid="chat-input"
					type="text"
					placeholder={
						apiKeySet ? "Type a message…" : "Complete onboarding first"
					}
					value={input}
					disabled={status !== "idle" || !apiKeySet}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleSend()}
					className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm outline-none focus:border-zinc-500 disabled:opacity-50"
				/>
				<button
					type="button"
					onClick={handleSend}
					disabled={status !== "idle" || !input.trim() || !apiKeySet}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium"
				>
					Send
				</button>
			</div>
		</div>
	);
}
