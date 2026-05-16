interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface ChatOptions {
	apiKey: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
}

interface MinimaxChatResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	base_resp?: {
		status_code: number;
		status_msg: string;
	};
}

export async function chatCompletion(opts: ChatOptions): Promise<string> {
	const response = await fetch(
		"https://api.minimax.io/v1/text/chatcompletion_v2",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${opts.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "MiniMax-Text-01",
				messages: opts.messages,
				temperature: opts.temperature ?? 0.7,
				max_tokens: opts.maxTokens ?? 300,
			}),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`MiniMax chat API error ${response.status}: ${text}`);
	}

	const json = (await response.json()) as MinimaxChatResponse;
	const content = json.choices?.[0]?.message?.content;

	if (!content) {
		const statusMsg = json.base_resp?.status_msg ?? "unknown error";
		throw new Error(
			`MiniMax chat API returned no content (base_resp: ${statusMsg})`,
		);
	}

	return content;
}
