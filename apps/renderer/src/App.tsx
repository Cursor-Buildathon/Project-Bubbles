import { title } from "./strings";

export default function App() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
			<h1 className="text-2xl font-bold tracking-tight">{title()}</h1>
		</div>
	);
}
