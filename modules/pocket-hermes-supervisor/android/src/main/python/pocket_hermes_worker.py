"""Private Android entry point for Pocket Hermes' Telegram gateway profile.

The module is intentionally narrow. It does not create a Python REPL, execute
shell commands, install packages, open a browser, or enable Hermes' optional
remote backends. Kotlin owns the Android foreground-service lifecycle and passes
the already Keystore-protected owner configuration directly to ``start``.
"""

from __future__ import annotations

import asyncio
import os
import re
import threading
import traceback
from pathlib import Path
from typing import Any

_TOKEN_RE = re.compile(r"^\d+:[A-Za-z0-9_-]{30,}$")
_CHAT_ID_RE = re.compile(r"^-?\d+$")
_state_lock = threading.RLock()
_state: dict[str, Any] = {
    "status": "stopped",
    "reason": "not started",
    "thread": None,
    "loop": None,
    "runner": None,
}


def _snapshot() -> dict[str, str]:
    with _state_lock:
        return {
            "status": str(_state["status"]),
            "reason": str(_state["reason"]),
        }


def _set_state(status: str, reason: str) -> None:
    with _state_lock:
        _state["status"] = status
        _state["reason"] = reason


def _configure_process(
    telegram_token: str,
    owner_chat_id: str,
    hermes_home: str,
    model_endpoint: str | None,
    model_api_key: str | None,
) -> None:
    """Configure only process-local, non-persisted values for the worker."""
    if not _TOKEN_RE.fullmatch(telegram_token):
        raise ValueError("Pocket Hermes rejected an invalid Telegram bot token.")
    if not _CHAT_ID_RE.fullmatch(owner_chat_id):
        raise ValueError("Pocket Hermes rejected an invalid owner chat ID.")

    home = Path(hermes_home).resolve()
    home.mkdir(parents=True, exist_ok=True)

    # The secrets remain process-local. In particular, the launcher never
    # writes a .env file, never logs a token, and never persists a model key.
    os.environ["HERMES_HOME"] = str(home)
    os.environ["TELEGRAM_BOT_TOKEN"] = telegram_token
    os.environ["TELEGRAM_ALLOWED_USERS"] = owner_chat_id
    os.environ["TELEGRAM_HOME_CHANNEL"] = owner_chat_id
    os.environ["HERMES_PLATFORM"] = "telegram"

    # Disable interactive or self-mutating surfaces for this embedded profile.
    os.environ["HERMES_EXEC_ASK"] = "1"
    os.environ["HERMES_DISABLE_BROWSER"] = "1"
    os.environ["HERMES_DISABLE_MCP"] = "1"
    os.environ["HERMES_DISABLE_LAZY_DEPS"] = "1"
    os.environ["PIP_NO_INPUT"] = "1"
    os.environ["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"

    if model_endpoint:
        os.environ["OPENAI_BASE_URL"] = model_endpoint
    if model_api_key:
        os.environ["OPENAI_API_KEY"] = model_api_key


def _run_gateway() -> None:
    """Run upstream Hermes in one owned Python thread and retain its runner."""
    try:
        from gateway import run as gateway_run

        original_init = gateway_run.GatewayRunner.__init__

        def capture_runner(instance: Any, *args: Any, **kwargs: Any) -> None:
            original_init(instance, *args, **kwargs)
            with _state_lock:
                _state["runner"] = instance

        gateway_run.GatewayRunner.__init__ = capture_runner
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        with _state_lock:
            _state["loop"] = loop
        _set_state("starting", "initializing Telegram gateway")
        success = loop.run_until_complete(gateway_run.start_gateway(replace=False, verbosity=0))
        _set_state("stopped" if success else "degraded", "gateway exited")
    except Exception as exc:  # A native bridge cannot crash the Android host.
        _set_state("degraded", f"gateway failed: {type(exc).__name__}")
        traceback.print_exc()
    finally:
        with _state_lock:
            loop = _state.get("loop")
            _state["loop"] = None
            _state["runner"] = None
            _state["thread"] = None
        if loop is not None:
            try:
                loop.close()
            except Exception:
                pass


def start(
    telegram_token: str,
    owner_chat_id: str,
    hermes_home: str,
    model_endpoint: str | None = None,
    model_api_key: str | None = None,
) -> dict[str, str]:
    """Start exactly one owner-locked Telegram gateway in the app process."""
    with _state_lock:
        current = _state.get("thread")
        if isinstance(current, threading.Thread) and current.is_alive():
            return _snapshot()
        _configure_process(
            telegram_token,
            owner_chat_id,
            hermes_home,
            model_endpoint,
            model_api_key,
        )
        _state["status"] = "starting"
        _state["reason"] = "launch requested"
        worker = threading.Thread(
            target=_run_gateway,
            name="PocketHermesTelegramWorker",
            daemon=True,
        )
        _state["thread"] = worker
        worker.start()
    return _snapshot()


def stop() -> dict[str, str]:
    """Request the captured gateway runner to shut down on its owning loop."""
    with _state_lock:
        runner = _state.get("runner")
        loop = _state.get("loop")
        worker = _state.get("thread")
    if runner is None or loop is None or not isinstance(worker, threading.Thread):
        _set_state("stopped", "no running gateway")
        return _snapshot()

    try:
        future = asyncio.run_coroutine_threadsafe(runner.stop(), loop)
        future.result(timeout=20)
        worker.join(timeout=5)
        _set_state("stopped", "gateway stopped by foreground service")
    except Exception as exc:
        _set_state("degraded", f"gateway stop failed: {type(exc).__name__}")
    return _snapshot()


def status() -> dict[str, str]:
    """Return a secret-free worker status for the Android bridge."""
    return _snapshot()
