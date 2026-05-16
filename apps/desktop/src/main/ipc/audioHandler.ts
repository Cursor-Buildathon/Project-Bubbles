import { createLogger } from "@bubbles/shared-logger";
import {
	AudioAmplitudePayloadSchema,
	AvatarSetIgnoreMousePayloadSchema,
	IPC_CHANNELS,
} from "@bubbles/shared-types";
import { BrowserWindow, ipcMain } from "electron";
import { setAvatarBounds } from "../store";
import { getAvatarWindow } from "../windows/avatar";
import {
	getChatPanelWindow,
	positionChatPanel,
	toggleChatPanel,
} from "../windows/chatPanel";

const log = createLogger("audio-handler");

export function registerAudioHandler(): void {
	// Relay amplitude from the chat window to the avatar window
	ipcMain.on(IPC_CHANNELS.AUDIO_AMPLITUDE, (_evt, raw: unknown) => {
		const result = AudioAmplitudePayloadSchema.safeParse(raw);
		if (!result.success) return;

		const avatar = getAvatarWindow();
		if (avatar && !avatar.isDestroyed()) {
			avatar.webContents.send(
				IPC_CHANNELS.AUDIO_AMPLITUDE_BROADCAST,
				result.data,
			);
		}
	});

	// Toggle click-through on the avatar window
	ipcMain.on(IPC_CHANNELS.AVATAR_SET_IGNORE_MOUSE, (_evt, raw: unknown) => {
		const result = AvatarSetIgnoreMousePayloadSchema.safeParse(raw);
		if (!result.success) return;

		const avatar = getAvatarWindow();
		if (avatar && !avatar.isDestroyed()) {
			avatar.setIgnoreMouseEvents(result.data.ignore, { forward: true });
		}
		log.debug({ event: "ignore-mouse", ignore: result.data.ignore });
	});

	// Toggle chat panel from avatar click
	ipcMain.on(IPC_CHANNELS.AVATAR_TOGGLE_CHAT, () => {
		toggleChatPanel();
	});

	// Manual window drag — renderer sends mouse deltas, main updates position.
	// More reliable than startMoving() which has async IPC timing issues.
	let dragOrigin: { x: number; y: number } | null = null;

	ipcMain.on(IPC_CHANNELS.AVATAR_DRAG_START, (evt) => {
		const win = BrowserWindow.fromWebContents(evt.sender);
		if (!win || win.isDestroyed()) return;
		const [x, y] = win.getPosition();
		dragOrigin = { x, y };
	});

	ipcMain.on(IPC_CHANNELS.AVATAR_DRAG_MOVE, (evt, dx: number, dy: number) => {
		const win = BrowserWindow.fromWebContents(evt.sender);
		if (!win || win.isDestroyed() || !dragOrigin) return;
		win.setPosition(
			Math.round(dragOrigin.x + dx),
			Math.round(dragOrigin.y + dy),
		);
	});

	ipcMain.on(IPC_CHANNELS.AVATAR_DRAG_END, () => {
		const avatar = getAvatarWindow();
		if (avatar && !avatar.isDestroyed()) {
			const [x, y] = avatar.getPosition();
			const [width, height] = avatar.getSize();
			setAvatarBounds({ x, y, width, height });
		}
		const panel = getChatPanelWindow();
		if (panel && !panel.isDestroyed() && panel.isVisible()) {
			positionChatPanel();
		}
		dragOrigin = null;
	});
}
