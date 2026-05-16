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

Research output is shown in chat as a comprehensive cited report. Voice playback only says: `Your research output is ready. I put the full report in chat.` Bubbles reads the full report aloud only when the user explicitly asks.

## Voice

Voice input uses Gemini STT first, with optional OpenAI fallback through OpenAI audio translations. Both providers are instructed to return English text only. Voice playback uses English MiniMax TTS with English language boost. The wake phrase is `Hi Bubbles`.

## Removed Connector Paths

The app no longer ships Web Search, Local Files, Email, Calendar, Google Workspace, generic MCP command launch, or MCP fixture connectors. Keep MiniMax media fixture artifacts for CI/demo fallback only.
