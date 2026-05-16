export interface WindowBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface DisplayBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const AVATAR_WINDOW_SIZE = {
	width: 256,
	height: 280,
} as const;

export function normalizeAvatarBounds(bounds: WindowBounds): WindowBounds {
	return {
		...bounds,
		width: AVATAR_WINDOW_SIZE.width,
		height: AVATAR_WINDOW_SIZE.height,
	};
}

function intersectionArea(a: WindowBounds, b: DisplayBounds): number {
	const left = Math.max(a.x, b.x);
	const right = Math.min(a.x + a.width, b.x + b.width);
	const top = Math.max(a.y, b.y);
	const bottom = Math.min(a.y + a.height, b.y + b.height);
	return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function bottomRight(
	bounds: WindowBounds,
	workArea: DisplayBounds,
): WindowBounds {
	return {
		...bounds,
		x: workArea.x + workArea.width - bounds.width - 20,
		y: workArea.y + workArea.height - bounds.height - 20,
	};
}

export function resolveVisibleBounds(
	saved: WindowBounds,
	primaryWorkArea: DisplayBounds,
	allWorkAreas: DisplayBounds[],
): WindowBounds {
	const workAreas = allWorkAreas.length > 0 ? allWorkAreas : [primaryWorkArea];
	const normalized = normalizeAvatarBounds(saved);
	const initial =
		normalized.x === -1 || normalized.y === -1
			? bottomRight(normalized, primaryWorkArea)
			: normalized;
	const bestArea = workAreas
		.map((workArea) => ({
			workArea,
			area: intersectionArea(initial, workArea),
		}))
		.sort((a, b) => b.area - a.area)[0];

	if (!bestArea || bestArea.area === 0) {
		return bottomRight(normalized, primaryWorkArea);
	}

	const maxX = bestArea.workArea.x + bestArea.workArea.width - initial.width;
	const maxY = bestArea.workArea.y + bestArea.workArea.height - initial.height;

	return {
		...initial,
		x: clamp(initial.x, bestArea.workArea.x, maxX),
		y: clamp(initial.y, bestArea.workArea.y, maxY),
	};
}
