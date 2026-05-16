import type { AgentListResponse } from "@bubbles/shared-types";
import { useEffect, useRef, useState } from "react";

interface Props {
	agents: AgentListResponse["agents"];
	activeAgentIdx: number;
	onSwitch: (idx: number) => void;
}

const ROLE_LABELS: Record<string, string> = {
	bubbles: "General assistant",
	coda: "Coding partner",
	sage: "Research analyst",
};

export default function AgentSwitcher({
	agents,
	activeAgentIdx,
	onSwitch,
}: Props) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const active = agents[activeAgentIdx];

	useEffect(() => {
		function onClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, []);

	if (agents.length === 0) return null;

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				data-testid="agent-switcher-trigger"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
			>
				<span
					className="w-2.5 h-2.5 rounded-full"
					style={{
						backgroundColor: active?.tint
							? `#${active.tint.toString(16).padStart(6, "0")}`
							: "#fff",
					}}
				/>
				<span className="font-medium">{active?.name ?? "Bubbles"}</span>
				<svg
					className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<title>Toggle dropdown</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>

			{open && (
				<div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
					<div className="px-3 py-2 text-xs text-zinc-500 uppercase tracking-wider">
						Choose agent
					</div>
					{agents.map((agent, idx) => (
						<button
							key={agent.id}
							data-testid={`agent-option-${agent.id}`}
							type="button"
							onClick={() => {
								onSwitch(idx);
								setOpen(false);
							}}
							className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors ${
								idx === activeAgentIdx ? "bg-zinc-800/50" : ""
							}`}
						>
							<div
								className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-zinc-900"
								style={{
									backgroundColor: agent.tint
										? `#${agent.tint.toString(16).padStart(6, "0")}`
										: "#fff",
								}}
							>
								{agent.name[0]}
							</div>
							<div>
								<div className="text-sm font-medium text-zinc-100">
									{agent.name}
								</div>
								<div className="text-xs text-zinc-400">
									{ROLE_LABELS[agent.id] ?? "Assistant"}
								</div>
							</div>
							{idx === activeAgentIdx && (
								<svg
									className="w-4 h-4 text-blue-400 ml-auto"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>Active agent</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
