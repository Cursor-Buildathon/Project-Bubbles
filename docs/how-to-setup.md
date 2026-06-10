# Bubbles MVP — How to Set Up

This guide covers installing the Bubbles desktop app from a DMG, configuring all required API keys, and getting a working development environment.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installing from DMG](#installing-from-dmg)
- [API Keys Overview](#api-keys-overview)
- [MiniMax Token Plan Key](#minimax-token-plan-key)
- [Tavily API Key](#tavily-api-key)
- [Gemini STT Key](#gemini-stt-key)
- [OpenAI STT Key (Optional Fallback)](#openai-stt-key-optional-fallback)
- [In-App Setup Walkthrough](#in-app-setup-walkthrough)
- [Connector Setup — Tavily Research](#connector-setup--tavily-research)
- [Feature Flags](#feature-flags)
- [Development Environment Setup](#development-environment-setup)
- [Building the DMG Locally](#building-the-dmg-locally)
- [Troubleshooting](#troubleshooting)

---

## System Requirements

| Requirement | Details |
| --- | --- |
| Operating system | macOS (Keychain-based secret storage is macOS-only) |
| Node.js | Compatible with the project toolchain (v18+ recommended) |
| Package manager | pnpm 9.15.4 via Corepack |
| Network | Required for all live provider features |

---

## Installing from DMG

Bubbles ships as a standard macOS DMG. After building or receiving the DMG file:

1. **Open the DMG** — Double-click `Bubbles MVP-<version>.dmg`. A Finder window opens showing the app icon.
2. **Drag to Applications** — Drag `Bubbles MVP.app` into your `/Applications` folder.
3. **First launch** — Open `Bubbles MVP` from Applications or Spotlight. Because the app is not signed with a Developer ID or notarized, macOS Gatekeeper will block it by default.
4. **Bypass Gatekeeper (local/internal builds only)** — Go to **System Settings → Privacy & Security**, scroll to the "Security" section, and click **Open Anyway** next to the Bubbles MVP message. Confirm in the dialog that appears. You only need to do this once.
5. **Setup screen** — On first launch the app opens the assistant workspace and shows the MiniMax setup card. Follow the [In-App Setup Walkthrough](#in-app-setup-walkthrough) to configure your keys.

> The DMG is an unsigned local/internal package. Developer ID signing, hardened runtime, and notarization are out of scope for the MVP.

---

## API Keys Overview

Bubbles uses four provider keys. All keys are stored in **macOS Keychain** — never in config files, environment variables, or repository files.

| Key | Required? | Provider | Used For |
| --- | --- | --- | --- |
| MiniMax Token Plan | **Yes** | [MiniMax](https://www.minimax.io) | Chat, text/JSON generation, research synthesis, image/music/video generation, TTS, agent birth, landing pages |
| Tavily API | **Yes** for research | [Tavily](https://tavily.com) | Live cited web research via Tavily Remote MCP |
| Gemini STT | **Yes** for voice | [Google AI Studio](https://aistudio.google.com) | Primary speech-to-text |
| OpenAI STT | Optional | [OpenAI](https://platform.openai.com) | Fallback speech-to-text |

---

## MiniMax Token Plan Key

MiniMax is the **primary readiness gate** — Bubbles will not function without it.

### How to get a key

1. Go to [minimax.io](https://www.minimax.io) and create an account.
2. Navigate to your API dashboard and generate a **Token Plan** API key.
3. The key typically starts with `sk-cp-...`.

### What it powers

- General chat and task synthesis (uses `MiniMax-M2.7` model).
- JSON generation for intents, agent drafts, and landing page code.
- Tavily research report synthesis.
- Image generation, music generation, and video generation.
- Text-to-speech (TTS) voice playback.

### How it is stored

The key is saved to macOS Keychain under the service name `com.bubbles.minimax.token-plan-key`. It is verified against the MiniMax chat completions API before being accepted.

---

## Tavily API Key

Tavily enables live cited web research.

### How to get a key

1. Go to [tavily.com](https://tavily.com) and create an account.
2. Generate an API key from your dashboard.
3. The key typically starts with `tvly-...`.

### What it powers

- Web search and content extraction via Tavily Remote MCP at `https://mcp.tavily.com/mcp/`.
- Research reports are synthesized through MiniMax after Tavily returns results.

### Research trigger phrases

Use any of these in chat or voice to trigger a research task:

- "do me a research"
- "do research"
- "search me"
- "search for"
- "look up"
- "investigate"
- "find sources"

### How it is stored

Keychain service name: `com.bubbles.tavily.api-key`.

---

## Gemini STT Key

Gemini is the **primary speech-to-text provider** for voice input.

### How to get a key

1. Go to [Google AI Studio](https://aistudio.google.com).
2. Create or select a project.
3. Generate an API key for the Gemini API.

### What it powers

- Real-time speech-to-text transcription for voice input.
- English language output only.

### How it is stored

Keychain service name: `com.bubbles.voice.gemini-api-key`.

---

## OpenAI STT Key (Optional Fallback)

OpenAI provides an optional fallback for speech-to-text when Gemini is unavailable or rate-limited.

### How to get a key

1. Go to [platform.openai.com](https://platform.openai.com).
2. Navigate to API keys and generate a new key.

### What it powers

- Fallback speech-to-text via OpenAI audio translations.
- Recommended for quota-safe smoke tests even if Gemini is your primary provider.

### How it is stored

Keychain service name: `com.bubbles.voice.openai-api-key`.

---

## In-App Setup Walkthrough

All key configuration is done through the **Setup screen** inside the Bubbles workspace.

### Step 1 — MiniMax Token Plan

1. Launch Bubbles. The setup screen appears automatically if MiniMax is not configured.
2. Paste your MiniMax Token Plan key (`sk-cp-...`) into the input field.
3. Click **Save Token Plan key**. Bubbles verifies the key against the MiniMax API.
4. On success, the status changes to **MiniMax ready** with a green checkmark.
5. If verification fails, an error message appears. Check your key and network, then click **Recheck MiniMax** or paste a corrected key.

### Step 2 — Tavily

1. Scroll down to the **Tavily setup** section on the same screen.
2. Paste your Tavily API key (`tvly-...`).
3. Click **Save Tavily key**. The app verifies connectivity to Tavily Remote MCP.
4. On success, the status shows **Tavily ready**.

### Step 3 — Voice (Gemini + OpenAI)

1. Scroll down to the **Voice setup** section.
2. Paste your **Gemini STT key** and click **Save Gemini key**.
3. Optionally paste your **OpenAI STT fallback key** and click **Save OpenAI key**.
4. When at least Gemini is configured and MiniMax TTS is ready, voice shows **Voice ready**.

### Step 4 — Enable Tavily Connector

1. Navigate to the **Connectors** panel in the workspace sidebar.
2. Find the **Tavily Research** connector.
3. Click **Enable** to activate it.
4. Click the refresh icon to run a **health check** and confirm the connector is live.

### Resetting Keys

Each setup section has reset controls:

- **Reset Token Plan key** — removes the MiniMax key from Keychain.
- **Reset all** — removes all MiniMax keys.
- **Reset Tavily key** — removes the Tavily key from Keychain.
- **Reset Gemini key** / **Reset OpenAI key** — removes individual voice keys.
- **Reset voice** — removes all voice provider keys.

---

## Connector Setup — Tavily Research

Tavily Research is the only connector-backed integration. The app calls Tavily Remote MCP directly.

| Setting | Value |
| --- | --- |
| MCP endpoint | `https://mcp.tavily.com/mcp/` |
| Auth | API key stored in macOS Keychain |
| Operations | `tavily_search`, `tavily_extract` |
| Synthesis | MiniMax processes Tavily results into a cited report |

The following connector types have been **removed** and should not be configured:

- Web Search, Local Files, Email, Calendar, Google Workspace
- Generic MCP command launch, MCP fixture connectors
- MiniMax CLI bridge

---

## Feature Flags

These environment variables can be set to control optional behavior:

| Flag | Default | Purpose |
| --- | --- | --- |
| `BUBBLES_VOICE_ENABLED` | `true` | Enable or disable voice sessions |
| `BUBBLES_VOICE_APPROVALS_ENABLED` | `true` | Enable or disable spoken approval resolution |
| `BUBBLES_CREATIVE_IMAGE` | `true` | Enable or disable MiniMax image generation |
| `BUBBLES_CREATIVE_MUSIC` | `true` | Enable or disable MiniMax music generation |
| `BUBBLES_CREATIVE_VIDEO` | `true` | Enable or disable MiniMax video generation |
| `BUBBLES_CODING_LANDING_PAGE` | `true` | Enable or disable landing page generation |
| `BUBBLES_AGENT_BIRTH_TIMEOUT_MS` | — | Override agent birth draft timeout |
| `BUBBLES_QA_TASK_DELAY_MS` | — | Test/development delay control for QA flows |
| `BUBBLES_MINIMAX_MEDIA_FIXTURE` | `false` | Use deterministic media artifacts (tests/CI only) |
| `ELECTRON_RENDERER_URL` | — | Point Electron at a custom renderer URL for development |

---

## Development Environment Setup

### Prerequisites

- **Node.js** v18 or later.
- **Corepack** enabled (ships with Node.js 16.10+).
- **pnpm** 9.15.4 — managed automatically through Corepack.

### Install Dependencies

```bash
corepack enable
corepack pnpm install
```

### Start Development Mode

```bash
npm run dev
```

This launches the Electron app with Vite hot-reload for the renderer.

### Run Tests

```bash
# All workspace tests
npm test

# Core package only
npm run test:core

# Desktop package only
npm run test:desktop
```

### Run Type Checks

```bash
# All workspaces
npm run typecheck

# Core only
npm run typecheck:core

# Desktop only
npm run typecheck:desktop
```

### Run Diagnostic Audits

```bash
# Capability map + fixture audit
npm run doctor

# Capability map only
npm run audit:capabilities

# Fixture audit only
npm run audit:fixtures
```

---

## Building the DMG Locally

The DMG build targets macOS only.

```bash
npm run package:mac
```

This runs `electron-vite build` followed by `electron-builder --mac dmg zip`. Output goes to `apps/desktop/dist/`.

The build produces:

- A `.dmg` installer for drag-and-drop installation.
- A `.zip` archive as an alternative distribution format.

Build configuration lives in `apps/desktop/electron-builder.yml`:

| Setting | Value |
| --- | --- |
| App ID | `com.bubbles.mvp` |
| Product name | `Bubbles MVP` |
| Category | `public.app-category.productivity` |
| Targets | `dmg`, `zip` |
| Code signing | Disabled (local/internal builds) |
| Notarization | Disabled (local/internal builds) |

---

## Troubleshooting

### "macOS cannot verify that this app is free from malware"

This is expected for unsigned builds. Go to **System Settings → Privacy & Security** and click **Open Anyway**.

### MiniMax key verification fails

- Confirm your key starts with `sk-cp-` and is a valid Token Plan key.
- Check your network connection — verification calls `https://api.minimax.io/v1/chat/completions`.
- Click **Recheck MiniMax** after fixing the issue.
- If the error persists, click **Reset Token Plan key** and re-enter the key.

### Tavily health check fails

- Confirm your Tavily key starts with `tvly-`.
- Check connectivity to `https://mcp.tavily.com/mcp/`.
- Click **Recheck Tavily** to retry.

### Voice shows "needs setup"

- Ensure a Gemini STT key is saved.
- MiniMax Token Plan must also be ready (it powers TTS playback).
- OpenAI is optional but recommended as a fallback.

### Voice is disabled

- Check that `BUBBLES_VOICE_ENABLED` is not set to `false` in your environment.

### Research returns no results

- Both Tavily and MiniMax must be in a ready state.
- The Tavily Research connector must be enabled in the Connectors panel.
- Run a health check on the connector to confirm it is live.

### `corepack pnpm install` fails

- Run `corepack enable` first.
- Make sure you are using Node.js v18 or later.
- Delete `node_modules` and `pnpm-lock.yaml` and retry if the lockfile is corrupted.
