import { useEffect, useState } from "react";

export interface ToastItem {
	id: string;
	message: string;
	type: "success" | "error" | "info";
}

let toastListeners: ((toast: ToastItem) => void)[] = [];

export function showToast(message: string, type: ToastItem["type"] = "info") {
	const toast: ToastItem = {
		id: `${Date.now()}-${Math.random()}`,
		message,
		type,
	};
	for (const cb of toastListeners) {
		cb(toast);
	}
}

export default function ToastContainer() {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	useEffect(() => {
		const handler = (toast: ToastItem) => {
			setToasts((prev) => [...prev, toast]);
			setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== toast.id));
			}, 4000);
		};
		toastListeners.push(handler);
		return () => {
			toastListeners = toastListeners.filter((cb) => cb !== handler);
		};
	}, []);

	if (toasts.length === 0) return null;

	return (
		<div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={`px-4 py-2 rounded-lg text-sm shadow-lg transition-all animate-in slide-in-from-right ${
						toast.type === "error"
							? "bg-red-600 text-white"
							: toast.type === "success"
								? "bg-green-600 text-white"
								: "bg-zinc-800 text-zinc-100 border border-zinc-700"
					}`}
				>
					{toast.message}
				</div>
			))}
		</div>
	);
}
