# Autumn AI — Mobile Telegram Companion Guide 📱

Talk to your **Autumn AI Autonomous Operating System** directly from your phone on Telegram!

---

## ⚡ 60-Second Setup

### 1. Create your Telegram Bot Token
1. Open Telegram on your phone or PC and search for **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot` to @BotFather.
3. Choose a friendly display name (e.g., `Autumn AI Assistant`).
4. Choose a username ending with `bot` (e.g., `MyAutumnAIBot`).
5. @BotFather will give you an **HTTP API Token** (looks like `7123456789:ABCdefGHIjklMNO...`).

### 2. Start the Bot Companion
Run this command from your terminal:

**On Windows (PowerShell):**
```powershell
$env:TELEGRAM_BOT_TOKEN="your_token_from_botfather"
python scripts/telegram_bot.py
```

**On Linux / macOS:**
```bash
export TELEGRAM_BOT_TOKEN="your_token_from_botfather"
python3 scripts/telegram_bot.py
```

---

## 🚀 Available Commands on Mobile

| Command | Description |
|---|---|
| `/agent dev` | Switch to **DevArchitect** (Principal Full-Stack SWE) |
| `/agent doc` | Switch to **DocSynth** (Document RAG & Researcher) |
| `/agent strat` | Switch to **Strategist** (Career & Execution Coach) |
| `/agent data` | Switch to **DataMind** (Quantitative Data Analyst) |
| `/agent auto` | Revert to autonomous intelligent auto-routing |
| `/code <python>` | Execute Python code in the Autumn isolated sandbox |
| `/search <query>` | Query the live web via DuckDuckGo and get top sources |
| `/status` | View Autumn server health and database status |
| `/new` | Reset conversation memory and start a fresh chat |

---

## ☁️ Running Continuously in the Background

To keep the bot running 24/7 on your server or laptop:

```bash
# Using nohup:
nohup python3 scripts/telegram_bot.py > telegram_bot.log 2>&1 &

# Or using PM2:
pm2 start scripts/telegram_bot.py --name "autumn-telegram" --interpreter python3
```
