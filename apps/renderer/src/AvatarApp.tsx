import type { AgentListResponse } from "@bubbles/shared-types";
import { useEffect, useRef, useState } from "react";
import { Character } from "./avatar/Character";
import { LipSync } from "./avatar/LipSync";
import { initSpriteEngine } from "./avatar/SpriteEngine";

const ATLAS_URL = new URL(
	"sprites/bubbles/spritesheet.png",
	window.location.href,
).toString();
const DRAG_THRESHOLD = 5; // px before a mousedown becomes a drag
const AVATAR_WIDTH = 256;
const AVATAR_HEIGHT = 280;

export default function AvatarApp() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const characterRef = useRef<Character | null>(null);
	const lipSyncRef = useRef<LipSync | null>(null);
	const [agents, setAgents] = useState<AgentListResponse["agents"]>([]);

	// Boot PixiJS and load the character
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let destroyed = false;

		(async () => {
			const app = await initSpriteEngine(canvas);
			if (destroyed) return;

			const character = new Character(app, ATLAS_URL);
			characterRef.current = character;
			await character.load();

			const lipSync = new LipSync(character);
			lipSyncRef.current = lipSync;
			lipSync.start();

			if (window.bubbles?.agent.list) {
				const res = await window.bubbles.agent.list();
				if (!destroyed) setAgents(res.agents);
				if (res.agents[0]) character.setTint(res.agents[0].tint);
			}
		})();

		return () => {
			destroyed = true;
			lipSyncRef.current?.stop();
		};
	}, []);

	// Mood changes from main
	useEffect(() => {
		if (!window.bubbles?.avatar.onMoodChange) return;
		const unsub = window.bubbles.avatar.onMoodChange(({ mood }) => {
			characterRef.current?.setMood(mood);
		});
		return unsub;
	}, []);

	// Skin/agent switches from chat
	useEffect(() => {
		if (!window.bubbles?.avatar.onSkinChange) return;
		const unsub = window.bubbles.avatar.onSkinChange(({ agentId }) => {
			const idx = agents.findIndex((a) => a.id === agentId);
			if (idx !== -1) characterRef.current?.setTint(agents[idx].tint);
		});
		return unsub;
	}, [agents]);

	// Manual drag: main captures window origin on dragStart, then we send
	// mouse deltas on each mousemove and main updates the window position.
	function handleMouseDown(e: React.MouseEvent) {
		if (e.button !== 0) return;
		const startX = e.screenX;
		const startY = e.screenY;
		let isDragging = false;
		window.bubbles?.avatar.dragStart();

		const onMove = (ev: MouseEvent) => {
			const dx = ev.screenX - startX;
			const dy = ev.screenY - startY;
			if (
				!isDragging &&
				(Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
			) {
				isDragging = true;
			}
			if (isDragging) {
				window.bubbles?.avatar.dragMove(dx, dy);
			}
		};

		const onUp = () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			window.bubbles?.avatar.dragEnd();
			if (!isDragging) {
				window.bubbles?.avatar.toggleChat();
			}
		};

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: canvas drag surface
		<div
			style={{
				width: AVATAR_WIDTH,
				height: AVATAR_HEIGHT,
				overflow: "hidden",
				background: "transparent",
				cursor: "grab",
			}}
			onMouseDown={handleMouseDown}
		>
			<canvas
				ref={canvasRef}
				width={AVATAR_WIDTH}
				height={AVATAR_HEIGHT}
				style={{
					display: "block",
					width: AVATAR_WIDTH,
					height: AVATAR_HEIGHT,
				}}
			/>
		</div>
	);
}
