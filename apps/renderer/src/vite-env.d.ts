/// <reference types="vite/client" />

export {};

declare global {
	interface Window {
		bubbles?: {
			ping: () => string;
		};
	}
}
