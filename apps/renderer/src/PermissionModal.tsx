import type { PermissionRequest } from "@bubbles/shared-types";
import { useEffect, useState } from "react";
import { showToast } from "./components/Toast";

export function extractPlanSteps(
	args: Record<string, unknown> | undefined,
): string[] {
	if (!args) return [];
	if (Array.isArray(args.steps)) {
		return args.steps.map((step) => String(step).trim()).filter(Boolean);
	}

	const plan = typeof args.plan === "string" ? args.plan.trim() : "";
	if (!plan) return [];

	const inlineNumbered = [
		...plan.matchAll(/(?:^|\s)\d+[.)]\s+(.+?)(?=\s+\d+[.)]\s+|$)/g),
	]
		.map((match) => match[1]?.trim())
		.filter((step): step is string => Boolean(step));
	if (inlineNumbered.length > 1) return inlineNumbered;

	const lines = plan
		.split(/\r?\n/)
		.map((line) => line.trim().replace(/^(\d+[.)]|[-*])\s*/, ""))
		.filter(Boolean);
	return lines.length ? lines : [plan];
}

export default function PermissionModal() {
	const [req, setReq] = useState<PermissionRequest | null>(null);
	const [existingContent, setExistingContent] = useState<string | null>(null);
	const [loadingPeek, setLoadingPeek] = useState(false);

	useEffect(() => {
		if (!window.bubbles?.permission) return;
		const unsub = window.bubbles.permission.onRequest((incoming) => {
			setReq(incoming);
			setExistingContent(null);

			// Peek file content for writeFile diff preview
			if (
				incoming.tool === "writeFile" &&
				incoming.args &&
				typeof incoming.args === "object"
			) {
				const args = incoming.args as Record<string, unknown>;
				const path = args.path;
				if (typeof path === "string") {
					setLoadingPeek(true);
					window.bubbles?.file
						.peek({ path })
						.then((res) => {
							if (res.exists) {
								setExistingContent(res.content);
							}
						})
						.catch(() => {})
						.finally(() => setLoadingPeek(false));
				}
			}
		});
		return unsub;
	}, []);

	if (!req) return null;

	function respond(decision: "allow" | "deny" | "allow_always") {
		if (!req) return;
		window.bubbles?.permission.respond(req.requestId, decision);
		setReq(null);
		setExistingContent(null);
		if (decision === "deny") {
			showToast("Tool call denied", "error");
		}
	}

	const args = req.args as Record<string, unknown> | undefined;

	function renderArgsPreview(r: PermissionRequest) {
		const planSteps = r.tool === "plan_mode" ? extractPlanSteps(args) : [];
		if (planSteps.length > 0) {
			return (
				<div>
					<p className="text-xs text-zinc-500 mb-2">Plan steps</p>
					<ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300">
						{planSteps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
				</div>
			);
		}

		if (r.tool === "writeFile" && args) {
			const newContent = String(args.content ?? "");
			const path = String(args.path ?? "");
			return (
				<div className="space-y-2">
					<p className="text-xs text-zinc-500">File: {path}</p>
					{loadingPeek ? (
						<p className="text-xs text-zinc-500">Checking existing file…</p>
					) : existingContent !== null ? (
						<div className="grid grid-cols-2 gap-2">
							<div>
								<p className="text-xs text-red-400 mb-1">Current</p>
								<pre className="text-xs text-red-300 bg-zinc-950 p-2 rounded max-h-40 overflow-auto">
									{existingContent}
								</pre>
							</div>
							<div>
								<p className="text-xs text-green-400 mb-1">New</p>
								<pre className="text-xs text-zinc-300 bg-zinc-950 p-2 rounded max-h-40 overflow-auto">
									{newContent.slice(0, 2000)}
									{newContent.length > 2000 && "\n…"}
								</pre>
							</div>
						</div>
					) : (
						<div>
							<p className="text-xs text-green-400 mb-1">Create new file</p>
							<pre className="text-xs text-zinc-300 bg-zinc-950 p-2 rounded max-h-40 overflow-auto">
								{newContent.slice(0, 2000)}
								{newContent.length > 2000 && "\n…"}
							</pre>
						</div>
					)}
				</div>
			);
		}

		return (
			<pre className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded max-h-48 overflow-auto whitespace-pre-wrap break-all">
				{JSON.stringify(r.args, null, 2)}
			</pre>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-[520px] max-h-[80vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="px-5 py-4 border-b border-zinc-800">
					<p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">
						Tool approval required
					</p>
					<h2 className="text-base font-semibold text-zinc-100">
						<span className="font-mono text-blue-400">{req.tool}</span>
					</h2>
					<p className="text-xs text-zinc-400 mt-1">{req.description}</p>
				</div>

				{/* Args preview */}
				<div className="flex-1 overflow-y-auto px-5 py-3">
					{renderArgsPreview(req)}
				</div>

				{/* Actions */}
				<div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
					<button
						type="button"
						onClick={() => respond("deny")}
						className="px-4 py-1.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
					>
						Deny
					</button>
					<button
						type="button"
						onClick={() => respond("allow_always")}
						className="px-4 py-1.5 rounded-lg text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
					>
						Always Allow
					</button>
					<button
						type="button"
						onClick={() => respond("allow")}
						className="px-4 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium"
					>
						Allow
					</button>
				</div>
			</div>
		</div>
	);
}
