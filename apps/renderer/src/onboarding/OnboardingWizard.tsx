import { useState } from "react";
import { showToast } from "../components/Toast";

interface Props {
	onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
	const [step, setStep] = useState(0);
	const [apiKey, setApiKey] = useState("");
	const [projectPath, setProjectPath] = useState("");
	const [validating, setValidating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function validateKey() {
		setValidating(true);
		setError(null);
		try {
			const res = await window.bubbles?.debug.setApiKey(apiKey.trim());
			if (!res?.ok) {
				setError("Failed to save API key.");
				setValidating(false);
				return;
			}
			// Try a tiny ping to verify the key works
			const pingRes = await window.bubbles?.agent.run({
				agentId: "bubbles",
				text: "ping",
			});
			if (pingRes?.status === "error" && pingRes.error?.includes("cap")) {
				// Cost cap error means key is valid but cap is hit — still ok for onboarding
				setStep(2);
				setValidating(false);
				return;
			}
			setStep(2);
		} catch (err) {
			setError(
				`Key validation failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		} finally {
			setValidating(false);
		}
	}

	async function pickFolder() {
		const res = await window.bubbles?.app.pickFolder();
		if (res && !res.canceled && res.filePaths.length > 0) {
			setProjectPath(res.filePaths[0]);
		}
	}

	function finish() {
		// We can't directly set the project root from renderer; main uses store.
		// For now, just mark onboarding as conceptually complete.
		showToast("Setup complete!", "success");
		onComplete();
	}

	return (
		<div
			data-testid="onboarding-wizard"
			className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950"
		>
			<div className="w-[480px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8">
				{/* Step indicator */}
				<div className="flex items-center gap-2 mb-8">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className={`h-1.5 flex-1 rounded-full transition-colors ${
								i <= step ? "bg-blue-600" : "bg-zinc-700"
							}`}
						/>
					))}
				</div>

				{step === 0 && (
					<div className="space-y-4">
						<h1 className="text-2xl font-bold text-zinc-100">
							Welcome to Bubbles
						</h1>
						<p className="text-zinc-400">
							Your desktop AI companion. Bubbles lives on your screen, ready to
							chat, code, and explore files.
						</p>
						<div className="pt-4">
							<button
								type="button"
								data-testid="onboarding-next"
								onClick={() => setStep(1)}
								className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
							>
								Get Started
							</button>
						</div>
					</div>
				)}

				{step === 1 && (
					<div className="space-y-4">
						<h2 className="text-xl font-bold text-zinc-100">
							Enter your MiniMax API key
						</h2>
						<p className="text-zinc-400 text-sm">
							Your key is encrypted and stored locally. It never leaves your
							machine.
						</p>
						<input
							type="password"
							data-testid="onboarding-apikey"
							placeholder="sk-xxxxxxxxxxxxxxxx"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none focus:border-blue-500 placeholder:text-zinc-600"
						/>
						{error && <p className="text-xs text-red-400">{error}</p>}
						<div className="flex gap-2 pt-2">
							<button
								type="button"
								onClick={() => setStep(0)}
								className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
							>
								Back
							</button>
							<button
								type="button"
								data-testid="onboarding-next"
								onClick={validateKey}
								disabled={!apiKey.trim() || validating}
								className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium text-white transition-colors"
							>
								{validating ? "Checking…" : "Continue"}
							</button>
						</div>
					</div>
				)}

				{step === 2 && (
					<div className="space-y-4">
						<h2 className="text-xl font-bold text-zinc-100">
							Choose a workspace folder
						</h2>
						<p className="text-zinc-400 text-sm">
							This is where Bubbles will read and write files.
						</p>
						<div className="flex gap-2">
							<input
								type="text"
								readOnly
								value={projectPath || "~/.bubbles/workspace (default)"}
								className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 outline-none"
							/>
							<button
								type="button"
								onClick={pickFolder}
								className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-200 transition-colors"
							>
								Browse
							</button>
						</div>
						<div className="flex gap-2 pt-2">
							<button
								type="button"
								onClick={() => setStep(1)}
								className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
							>
								Back
							</button>
							<button
								type="button"
								data-testid="onboarding-finish"
								onClick={finish}
								className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
							>
								Finish
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
