# Bubbles Setup Guide

Last updated: 2026-05-16

## Required Keys

- MiniMax Token Plan key: required for chat/task synthesis, research report writing, TTS, image generation, and music generation.
- Tavily API key: required for live web research through Tavily Remote MCP.
- Gemini STT key: primary speech-to-text provider.
- OpenAI STT key: optional fallback for speech-to-text.

All keys are stored in macOS Keychain through the app setup screens. Do not place keys in repo files, logs, screenshots, memory, or timeline metadata.

## MiniMax

Use the MiniMax setup card to save a Token Plan key. Bubbles verifies it through direct MiniMax HTTPS APIs and uses `MiniMax-M2.7` by default for text/JSON generation.

The old MiniMax CLI bridge and General API setup paths have been removed.

## Tavily Research

Use the Tavily setup card to save a Tavily API key, then enable `Tavily Research` in Connectors and run a health check. The app calls Tavily Remote MCP directly at `https://mcp.tavily.com/mcp/`.

Research trigger phrases include `do me a research`, `do research`, `search me`, `search for`, `look up`, `investigate`, and `find sources`.

Research output is shown in chat as a comprehensive cited report. Voice playback follows the global spoken-response policy: replies under 50 normalized characters are spoken in full, while replies at 50 characters or longer say `Please look in the chat panel for the response.` The full report stays in chat instead of being read aloud through TTS.

## Voice

Voice input uses Gemini STT first, with optional OpenAI fallback through OpenAI audio translations. Both providers are instructed to return English text only. Voice playback uses English MiniMax TTS with English language boost. The wake phrase is `Hi Bubbles`.

Voice output is intentionally brief. The shared spoken-response policy returns the original reply only when it is shorter than 50 normalized characters; longer assistant replies, research reports, and long follow-up answers use the chat-panel prompt for both TTS and captions. The renderer deduplicates against the original assistant text so separate long replies can still trigger their own prompt without replaying the same message.

## Removed Connector Paths

The app no longer ships Web Search, Local Files, Email, Calendar, Google Workspace, generic MCP command launch, or MCP fixture connectors. Keep MiniMax media fixture artifacts for tests/CI only; live product and demo paths should use real providers or show a clear unavailable state.
