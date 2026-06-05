# Donna

Donna is a private, self-hosted personal AI experience. She pairs with your Discord account and lets you create and switch between multiple AI "characters" — each with their own soul, personality, and isolated memory system. Donna only responds to you in private DM chat.

## Features

- **Private & Self-Hosted** — Runs on your own Ubuntu VPS. No cloud AI service reads your data.
- **Multi-Character** — Create and switch between characters, each with their own `SOUL.md` and memory folder.
- **Memory System** — Characters remember facts, people, preferences, and events across sessions via markdown-based memory files.
- **Soul Evolution** — Characters can edit their own `SOUL.md` over time to grow and change.
- **Voice Messages** — Send voice messages in Discord DMs; Donna transcribes them with Deepgram and replies in text.
- **Model Switching** — Toggle between Deepseek V4 Flash, Deepseek V4 Pro, Minimax M3, Kimi K2.6, GPT 5.5, and Nemotron 3 Ultra (all via Vercel AI Gateway except Flash).
- **Reasoning Control** — Set reasoning depth (low / medium / high) per session.

## Tech Stack

- **Runtime:** Node.js 20+ on Ubuntu VPS
- **AI SDK:** Vercel AI SDK v6
- **Models:** Deepseek V4 Flash (default), Deepseek V4 Pro, Minimax M3, Kimi K2.6, GPT 5.5, Nemotron 3 Ultra
- **STT:** Deepgram Nova 3 (`nova-3-general`)
- **Discord:** Vercel Chat SDK with official Discord Gateway adapter
- **Language:** TypeScript (strict mode)

## Prerequisites

- Ubuntu VPS (or any Linux server)
- Node.js 20+ and npm
- ffmpeg (for voice message support)
- A Discord Bot account (Token + Application ID)
- API keys for:
  - Deepseek API
  - Vercel AI Gateway
  - Deepgram

## Installation

```bash
# Clone or upload the Donna project to your VPS
cd /opt/donna

# Install dependencies
npm install

# Build
npm run build

# Optional: link the CLI globally
npm link
```

## Setup

Run the interactive onboarding wizard:

```bash
donna setup
```

The wizard will:
1. Check dependencies (Node.js, ffmpeg)
2. Prompt for your API keys one at a time (all optional — you can skip and re-run later)
3. Save everything to `.env`

## Discord Configuration

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create an application and bot
3. Enable **Message Content Intent** in the Bot settings
4. Copy the **Bot Token** and **Application ID** into `donna setup`
5. Invite the bot to your server with scopes `bot` and `applications.commands`
6. **No public URL or Interactions Endpoint is required** — Donna connects via Gateway WebSocket

## Usage

### Start the Daemon

```bash
donna start
```

### Pairing

1. DM your bot on Discord and type `/pair`
2. Donna will reply with a 6-digit pairing code (valid 10 minutes)
3. On your VPS, run:
   ```bash
   donna pair <CODE>
   ```
4. From now on, Donna only responds to your Discord account

### Create Your First Character

In Discord DM:
```
/create Nova
```

This creates `characters/Nova/` with `SOUL.md`, `BOOTSTRAP.md`, and memory folders. Tell Nova who she should be — she'll write her own soul.

### Daily Chat

Just DM Donna normally. She will:
- Load her memories automatically
- Use her soul to guide personality
- Remember new facts with memory tools
- Evolve her soul with `patch_soul`

### Slash Commands

| Command | Description |
|---|---|
| `/reasoning [low\|medium\|high]` | Set reasoning depth |
| `/model [flash\|pro\|minimax-m3\|kimi-k2.6\|gpt-5.5\|nemotron-3-ultra]` | Switch AI model |
| `/new` | Start a fresh session (keeps memories, clears chat history) |
| `/abort` | Stop the current response mid-stream |
| `/create [name]` | Create a new character |
| `/switch [name]` | Switch to another character |
| `/soul` | View the current character's SOUL.md |
| `/pair` | Generate a new pairing code |

### CLI Commands

```bash
donna setup    # Interactive onboarding wizard
donna start    # Start the daemon
donna stop     # Stop the daemon
donna status   # Show daemon status, character, and paired user
donna logs     # Tail recent daemon logs
donna pair     # Complete pairing using code from Discord
donna help     # Show this help
```

### Project Structure

```
donna/
├── characters/          # Per-character folders
│   └── [name]/
│       ├── SOUL.md
│       ├── BOOTSTRAP.md   (deleted after first soul patch)
│       └── memory/
│           ├── INDEX.md
│           ├── people/
│           ├── facts/
│           ├── preferences/
│           └── events/
├── data/
│   ├── paired-user.json
│   ├── active-character.json
│   ├── pairing-codes.json
│   ├── donna.pid
│   ├── state/           # Chat SDK subscriptions
│   └── logs/
│       └── donna.log
├── src/                 # TypeScript source
└── dist/                # Compiled output
```

### Voice Messages

Send a voice message in Discord DMs. Donna will:
1. Download the audio attachment
2. Transcribe it with Deepgram Nova 3
3. Feed the transcript into the agent
4. Reply in text

### Memory System

Characters manage their own memories via four tools:

- **`get_memory`** — Reads `INDEX.md` to see all memories
- **`read_memory(path)`** — Reads a specific memory file
- **`write_memory(path, content, title?)`** — Creates or updates a memory file
- **`delete_memory(path)`** — Deletes a memory file

The `INDEX.md` is updated automatically on every write or delete.

### Soul System

Each character has a `SOUL.md` file that is always injected into the system prompt. It defines name, personality, tone, backstory, and behavior.

The `patch_soul` tool lets the character edit its own soul. The first time it is used, `BOOTSTRAP.md` is auto-deleted so it never appears again.

## Environment Variables

All stored in `.env`:

| Variable | Description |
|---|---|
| `DEEPSEEK_API_KEY` | Deepseek API key (for Flash model) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key (for Pro model) |
| `DEEPGRAM_API_KEY` | Deepgram API key (voice transcription) |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_APPLICATION_ID` | Discord application ID |

## Logs

Structured JSON logs are written to `data/logs/donna.log`:

```bash
donna logs
```

## Troubleshooting

- **Bot not responding**: Check `donna status`. Ensure `donna start` is running and the Discord bot token is correct.
- **Slash commands not appearing**: Discord slash commands can take up to an hour to propagate globally. For instant testing, invite the bot with `applications.commands` scope to a small server first.
- **Voice messages fail**: Ensure `ffmpeg` is installed and `DEEPGRAM_API_KEY` is set.
- **Model errors**: Ensure `DEEPSEEK_API_KEY` is set for Flash, and `AI_GATEWAY_API_KEY` for Pro.

## License

MIT
