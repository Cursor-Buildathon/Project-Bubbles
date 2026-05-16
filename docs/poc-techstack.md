# Bubbles — Tech Stack

## Core Framework

| Technology | Version | Role |
|---|---|---|
| Electron | 32+ | Desktop app shell |
| React | 19 | UI renderer |
| TypeScript | 5.6 | Language (strict mode throughout) |
| Vite / electron-vite | 6 | Build tooling |

## UI & Styling

| Technology | Role |
|---|---|
| Tailwind CSS | 4 | Styling framework |
| PixiJS | Sprite/avatar rendering and animations |

## Data & Storage

| Technology | Role |
|---|---|
| SQLite (better-sqlite3) | Local-only database with migrations |

> **Constraint**: The app is **local-only at runtime** — no cloud sync.

## AI & External APIs

| Service | Model | Role |
|---|---|---|
| MiniMax | M2.7 | LLM — agent brain / chat |
| MiniMax | Speech-02-Turbo | Text-to-speech (TTS) |

> All MiniMax calls are routed through the `packages/minimax-client` package.

## Monorepo & Package Management

| Technology | Version | Role |
|---|---|---|
| pnpm | 9 | Package manager |
| Turborepo | 2 | Monorepo build orchestration |

## Testing

| Technology | Role |
|---|---|
| Vitest | Unit testing |
| Playwright (with Electron) | End-to-end testing |

## Tooling & DX

| Technology | Role |
|---|---|
| Biome | Linting + formatting (replaces ESLint + Prettier) |
| Zod + zod-to-json-schema | Schema validation — IPC channels, agent payloads, MiniMax tool definitions |
| pino | Structured logging with `turnId` correlation IDs |
| execa | Child process management (MCP later) |

## Internal Package Architecture

| Package | Responsibility |
|---|---|
| `shared-types` | Zod schemas for IPC, agents, and messages |
| `shared-logger` | pino logger with correlation IDs |
| `agent-runtime` | AgentLoop and agent lifecycle management |
| `memory-core` | SQLite DAO layer |
| `minimax-client` | All MiniMax API calls |
| `tool-kit` | Built-in agent tools |
| `permission-guard` | File write and action gating |
| `cost-meter` | Token/spend tracking |
