import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AvatarApp from "./AvatarApp";
import ChatApp from "./ChatApp";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("root element missing");
}

const windowKind = new URLSearchParams(window.location.search).get("window");

createRoot(root).render(
	<StrictMode>
		{windowKind === "avatar" ? <AvatarApp /> : <ChatApp />}
	</StrictMode>,
);
