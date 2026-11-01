#!/usr/bin/env python3
"""
Autumn AI — Mobile Telegram Sidecar Companion
Allows chatting with Autumn's Level 2 Worker Agents, running Python sandbox code,
and querying real-time web search directly from Telegram.

Zero heavy dependencies: uses python standard library and `httpx`.
"""

import os
import sys
import json
import asyncio
import logging
from typing import Dict, Any, Optional

try:
    import httpx
except ImportError:
    print("Error: 'httpx' library is required. Run 'pip install httpx'.")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("AutumnTelegramBot")

# Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
AUTUMN_API_URL = os.getenv("AUTUMN_API_URL", "https://autumn-9hyt.onrender.com").rstrip("/")
AUTUMN_DEFAULT_AGENT = os.getenv("AUTUMN_DEFAULT_AGENT", "auto")

# Per-chat agent mode state
USER_AGENTS: Dict[int, str] = {}
USER_CONVERSATIONS: Dict[int, Optional[str]] = {}

AGENT_DISPLAY = {
    "auto": "⚡ Auto-Router",
    "dev": "💻 DevArchitect (Principal SWE)",
    "researcher": "📚 DocSynth (RAG Researcher)",
    "strategist": "🎯 Strategist (Career & Execution)",
    "data": "📊 DataMind (Quantitative Analyst)"
}

class TelegramBot:
    def __init__(self, token: str, backend_url: str):
        self.token = token
        self.backend_url = backend_url
        self.base_url = f"https://api.telegram.org/bot{token}"
        self.offset = 0

    async def call_tg(self, method: str, data: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/{method}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(url, json=data or {})
                if resp.status_code == 200:
                    return resp.json()
                logger.error(f"Telegram API {method} error: {resp.status_code} - {resp.text}")
            except Exception as e:
                logger.error(f"Telegram API request failed: {e}")
        return None

    async def send_message(self, chat_id: int, text: str, parse_mode: str = "Markdown") -> None:
        # Telegram has a 4096 character limit per message
        chunks = [text[i:i + 4000] for i in range(0, len(text), 4000)]
        for chunk in chunks:
            payload = {
                "chat_id": chat_id,
                "text": chunk
            }
            if parse_mode:
                payload["parse_mode"] = parse_mode
            res = await self.call_tg("sendMessage", payload)
            if not res and parse_mode == "Markdown":
                # Fallback to plain text if Markdown parsing failed due to unbalanced chars
                payload.pop("parse_mode", None)
                await self.call_tg("sendMessage", payload)

    async def check_health(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.get(f"{self.backend_url}/api/health")
                if res.status_code == 200:
                    return res.json()
            except Exception as e:
                return {"error": str(e)}
        return {"status": "unreachable"}

    async def run_sandbox_code(self, code: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.post(
                    f"{self.backend_url}/api/tools/execute-code",
                    json={"code": code}
                )
                return res.json()
            except Exception as e:
                return {"stderr": str(e), "stdout": "", "exit_code": 1}

    async def search_web(self, query: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.post(
                    f"{self.backend_url}/api/tools/web-search",
                    json={"query": query, "max_results": 4}
                )
                return res.json()
            except Exception as e:
                return {"error": str(e), "results": []}

    async def chat_with_autumn(self, chat_id: int, message: str, agent_mode: str) -> str:
        url = f"{self.backend_url}/api/chat"
        payload = {
            "message": message,
            "agent_mode": agent_mode,
            "conversation_id": USER_CONVERSATIONS.get(chat_id)
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        return f"⚠️ Backend error: HTTP {response.status_code}"
                    
                    collected = []
                    active_agent_title = None

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            raw = line[6:].strip()
                            if raw == "[DONE]":
                                break
                            try:
                                data = json.loads(raw)
                                if data.get("conversation_id"):
                                    USER_CONVERSATIONS[chat_id] = data["conversation_id"]
                                if data.get("agent"):
                                    active_agent_title = data["agent"].get("name")
                                if data.get("chunk"):
                                    collected.append(data["chunk"])
                            except Exception:
                                pass
                    
                    full_text = "".join(collected).strip()
                    prefix = f"[{active_agent_title or AGENT_DISPLAY.get(agent_mode, 'Autumn')}]\n\n"
                    return prefix + (full_text or "No response generated.")
            except Exception as e:
                return f"⚠️ Connection error: {e}"

    async def handle_update(self, update: Dict[str, Any]) -> None:
        message = update.get("message")
        if not message:
            return

        chat_id = message["chat"]["id"]
        text = message.get("text", "").strip()

        if not text:
            return

        user_agent = USER_AGENTS.get(chat_id, AUTUMN_DEFAULT_AGENT)

        # Command Dispatch
        if text.startswith("/start"):
            welcome = (
                "🤖 *Welcome to Autumn AI Mobile Companion*\n\n"
                f"Connected to: `{self.backend_url}`\n"
                f"Active Agent: *{AGENT_DISPLAY.get(user_agent, user_agent)}*\n\n"
                "⚡ *Commands:*\n"
                "• `/agent <mode>` — Switch agent (`dev`, `doc`, `strat`, `data`, `auto`)\n"
                "• `/code <python_code>` — Execute in Python Sandbox\n"
                "• `/search <query>` — Search live web via DuckDuckGo\n"
                "• `/status` — Autumn backend health check\n"
                "• `/new` — Start a fresh conversation\n"
                "• `/help` — Command guide\n\n"
                "💬 Or simply send any message to talk to Autumn!"
            )
            await self.send_message(chat_id, welcome)

        elif text.startswith("/help"):
            help_text = (
                "📖 *Autumn AI Commands:*\n\n"
                "• `/agent auto` — Autonomous auto-routing\n"
                "• `/agent dev` — DevArchitect (Full-Stack SWE)\n"
                "• `/agent doc` — DocSynth (RAG Document Researcher)\n"
                "• `/agent strat` — Strategist (Career & Roadmaps)\n"
                "• `/agent data` — DataMind (Quantitative Analytics)\n"
                "• `/code <script>` — Run Python in isolated sandbox\n"
                "• `/search <query>` — Real-time DuckDuckGo search\n"
                "• `/status` — View server & database status\n"
                "• `/new` — Reset conversation context"
            )
            await self.send_message(chat_id, help_text)

        elif text.startswith("/status"):
            health = await self.check_health()
            status_text = (
                "🟢 *Autumn AI System Status*\n\n"
                f"• Server: `{self.backend_url}`\n"
                f"• Database: `{health.get('persistence', 'unknown')}`\n"
                f"• Status: `{health.get('status', 'unknown')}`\n"
                f"• Active Agent: *{AGENT_DISPLAY.get(user_agent, user_agent)}*"
            )
            await self.send_message(chat_id, status_text)

        elif text.startswith("/new"):
            USER_CONVERSATIONS[chat_id] = None
            await self.send_message(chat_id, "🧹 Conversation reset. Starting a fresh context with Autumn.")

        elif text.startswith("/agent"):
            parts = text.split(maxsplit=1)
            if len(parts) < 2:
                current = AGENT_DISPLAY.get(user_agent, user_agent)
                await self.send_message(chat_id, f"Current agent: *{current}*\n\nUsage: `/agent dev`, `/agent doc`, `/agent strat`, `/agent data`, or `/agent auto`")
                return

            choice = parts[1].strip().lower()
            alias_map = {
                "auto": "auto",
                "dev": "dev",
                "code": "dev",
                "doc": "researcher",
                "docs": "researcher",
                "researcher": "researcher",
                "strat": "strategist",
                "strategist": "strategist",
                "data": "data"
            }

            if choice in alias_map:
                resolved = alias_map[choice]
                USER_AGENTS[chat_id] = resolved
                await self.send_message(chat_id, f"✅ Switched active agent to: *{AGENT_DISPLAY[resolved]}*")
            else:
                await self.send_message(chat_id, "⚠️ Unknown agent mode. Available: `auto`, `dev`, `doc`, `strat`, `data`.")

        elif text.startswith("/code"):
            code = text[5:].strip()
            if not code:
                await self.send_message(chat_id, "Usage: `/code print('Hello from Autumn')`")
                return

            await self.send_message(chat_id, "⚙️ *Executing Python code in sandbox...*")
            res = await self.run_sandbox_code(code)
            stdout = res.get("stdout", "").strip()
            stderr = res.get("stderr", "").strip()
            time_ms = res.get("execution_time_ms", 0)

            reply = f"⏱️ Time: `{time_ms}ms` | Exit: `{res.get('exit_code', 0)}`\n\n"
            if stdout:
                reply += f"📤 *Output:*\n```\n{stdout}\n```\n"
            if stderr:
                reply += f"⚠️ *Error:*\n```\n{stderr}\n```\n"
            if not stdout and not stderr:
                reply += "*(Code executed with no output)*"

            await self.send_message(chat_id, reply)

        elif text.startswith("/search"):
            query = text[7:].strip()
            if not query:
                await self.send_message(chat_id, "Usage: `/search python 3.13 release date`")
                return

            await self.send_message(chat_id, f"🔍 *Searching live web for:* `{query}`...")
            res = await self.search_web(query)
            results = res.get("results", [])
            if not results:
                await self.send_message(chat_id, "No web results found.")
                return

            lines = [f"🌐 *Live Web Results for \"{query}\":*\n"]
            for idx, r in enumerate(results, start=1):
                title = r.get("title", "Result")
                snippet = r.get("snippet", "")
                url = r.get("url", "")
                lines.append(f"*{idx}. {title}*")
                lines.append(f"{snippet}")
                if url:
                    lines.append(f"🔗 `{url}`\n")

            await self.send_message(chat_id, "\n".join(lines))

        else:
            # Regular AI Chat
            typing_payload = {"chat_id": chat_id, "action": "typing"}
            await self.call_tg("sendChatAction", typing_payload)

            response_text = await self.chat_with_autumn(chat_id, text, user_agent)
            await self.send_message(chat_id, response_text)

    async def run(self) -> None:
        logger.info(f"Starting Autumn Telegram Sidecar Bot... (Backend: {self.backend_url})")
        me = await self.call_tg("getMe")
        if not me or not me.get("ok"):
            logger.error("Failed to connect to Telegram with provided TELEGRAM_BOT_TOKEN.")
            return

        bot_name = me["result"]["first_name"]
        username = me["result"].get("username", "")
        logger.info(f"Connected as @{username} ({bot_name}). Waiting for mobile updates...")

        while True:
            try:
                updates = await self.call_tg("getUpdates", {
                    "offset": self.offset,
                    "timeout": 20
                })
                if updates and updates.get("ok"):
                    for update in updates.get("result", []):
                        self.offset = update["update_id"] + 1
                        await self.handle_update(update)
            except Exception as e:
                logger.error(f"Polling loop error: {e}")
                await asyncio.sleep(3)

def main():
    token = TELEGRAM_BOT_TOKEN
    if not token:
        print("\n" + "=" * 60)
        print("AUTUMN AI — TELEGRAM COMPANION SETUP")
        print("=" * 60)
        print("To run the Telegram Sidecar bot, set the TELEGRAM_BOT_TOKEN environment variable:")
        print("  $env:TELEGRAM_BOT_TOKEN=\"your_token_from_botfather\"")
        print("  python scripts/telegram_bot.py\n")
        print("1. Open Telegram and search for @BotFather.")
        print("2. Send /newbot and choose a name (e.g. Autumn_AI_Bot).")
        print("3. Copy the HTTP API token provided and set it as an env variable.")
        print("=" * 60 + "\n")
        sys.exit(1)

    bot = TelegramBot(token, AUTUMN_API_URL)
    try:
        asyncio.run(bot.run())
    except KeyboardInterrupt:
        print("\nAutumn Telegram bot terminated.")

if __name__ == "__main__":
    main()
