import type { SpendSummaryResponse } from "@bubbles/shared-types";
import { useEffect, useState } from "react";
import { showToast } from "../components/Toast";

interface Props {
	onClose: () => void;
}

export default function SpendDashboard({ onClose }: Props) {
	const [summary, setSummary] = useState<SpendSummaryResponse | null>(null);
	const [capInput, setCapInput] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		window.bubbles?.settings
			.getSpendSummary({ days: 30 })
			.then((res) => {
				setSummary(res);
				setCapInput(String(res.capUsd));
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	async function saveCap() {
		const cap = Number.parseFloat(capInput);
		if (Number.isNaN(cap) || cap <= 0) {
			showToast("Please enter a valid number", "error");
			return;
		}
		const res = await window.bubbles?.settings.setCostCap({ capUsd: cap });
		if (res?.ok) {
			showToast("Cost cap updated", "success");
			setSummary((prev) => (prev ? { ...prev, capUsd: cap } : null));
		} else {
			showToast("Failed to update cap", "error");
		}
	}

	const today = summary?.days.find((d) => {
		const now = new Date();
		return d.date === now.toISOString().slice(0, 10);
	});
	const todaySpend = today?.totalCostUsd ?? 0;
	const cap = summary?.capUsd ?? 5;
	const pct = Math.min(100, (todaySpend / cap) * 100);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-[480px] max-h-[80vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
					<div>
						<p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">
							Settings
						</p>
						<h2 className="text-base font-semibold text-zinc-100">
							Spend Dashboard
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-zinc-400 hover:text-zinc-200"
					>
						✕
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
					{loading ? (
						<p className="text-sm text-zinc-500 text-center py-8">Loading…</p>
					) : (
						<>
							{/* Today progress */}
							<div className="bg-zinc-800 rounded-xl p-4">
								<div className="flex justify-between items-center mb-2">
									<span className="text-sm text-zinc-300">Today</span>
									<span className="text-sm font-medium text-zinc-100">
										${todaySpend.toFixed(4)} / ${cap.toFixed(2)}
									</span>
								</div>
								<div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
									<div
										className={`h-full rounded-full transition-all ${
											pct >= 100
												? "bg-red-500"
												: pct >= 75
													? "bg-yellow-500"
													: "bg-green-500"
										}`}
										style={{ width: `${pct}%` }}
									/>
								</div>
							</div>

							{/* Cards */}
							<div className="grid grid-cols-3 gap-3">
								{[
									{
										label: "Today",
										value: todaySpend,
									},
									{
										label: "7 days",
										value: summary?.days
											?.slice(0, 7)
											.reduce((s, d) => s + d.totalCostUsd, 0),
									},
									{
										label: "30 days",
										value: summary?.days.reduce(
											(s, d) => s + d.totalCostUsd,
											0,
										),
									},
								].map((card) => (
									<div
										key={card.label}
										className="bg-zinc-800 rounded-xl p-3 text-center"
									>
										<div className="text-xs text-zinc-400 mb-1">
											{card.label}
										</div>
										<div className="text-lg font-semibold text-zinc-100">
											${(card.value ?? 0).toFixed(4)}
										</div>
									</div>
								))}
							</div>

							{/* Cost cap editor */}
							<div className="bg-zinc-800 rounded-xl p-4 space-y-3">
								<label
									htmlFor="cost-cap"
									className="text-sm text-zinc-300 block"
								>
									Daily cost cap (USD)
								</label>
								<div className="flex gap-2">
									<input
										id="cost-cap"
										type="number"
										min="0.01"
										step="0.01"
										value={capInput}
										onChange={(e) => setCapInput(e.target.value)}
										className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none focus:border-zinc-500"
									/>
									<button
										type="button"
										onClick={saveCap}
										className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white"
									>
										Save
									</button>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
