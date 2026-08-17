"""Private Android entry point for Pocket Hermes' Telegram gateway profile.

The module is intentionally narrow. It does not create a Python REPL, execute
shell commands, install packages, open a browser, or enable Hermes' optional
remote backends. Kotlin owns the Android foreground-service lifecycle and passes
the already Keystore-protected owner configuration directly to ``start``.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import threading
import time
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from pathlib import Path
from typing import Any

_TOKEN_RE = re.compile(r"^\d+:[A-Za-z0-9_-]{30,}$")
_CHAT_ID_RE = re.compile(r"^\d+$")
_state_lock = threading.RLock()
_state: dict[str, Any] = {
    "status": "stopped",
    "reason": "not started",
    "thread": None,
    "loop": None,
    "runner": None,
    "heartbeat_task": None,
    "last_heartbeat_at": None,
    "hermes_home": None,
    "owner_chat_id": None,
    "task_drain_task": None,
    "scheduler_task": None,
}
_MAX_TASKS = 24
_MAX_TASK_TEXT = 12_000
_MAX_RESULT_TEXT = 12_000
_MAX_SCHEDULES = 16
_MAX_SCHEDULE_RUNS = 72
_MAX_SCHEDULE_TITLE = 120
_MAX_SCHEDULE_RETRIES = 2


def _snapshot() -> dict[str, str | int | None]:
    with _state_lock:
        return {
            "status": str(_state["status"]),
            "reason": str(_state["reason"]),
            "lastHeartbeatAt": _state["last_heartbeat_at"],
        }


def _set_state(status: str, reason: str) -> None:
    with _state_lock:
        _state["status"] = status
        _state["reason"] = reason


def _task_store_path() -> Path | None:
    with _state_lock:
        home = _state.get("hermes_home")
    return Path(home) / "pocket-hermes-tasks.json" if isinstance(home, str) and home else None


def _schedule_store_path() -> Path | None:
    with _state_lock:
        home = _state.get("hermes_home")
    return Path(home) / "pocket-hermes-schedules.json" if isinstance(home, str) and home else None


def _schedule_run_store_path() -> Path | None:
    with _state_lock:
        home = _state.get("hermes_home")
    return Path(home) / "pocket-hermes-schedule-runs.json" if isinstance(home, str) and home else None


def set_storage_root(hermes_home: str) -> None:
    """Set the app-private runtime directory without reading or retaining secrets."""
    home = Path(hermes_home).resolve()
    home.mkdir(parents=True, exist_ok=True)
    with _state_lock:
        _state["hermes_home"] = str(home)


def _read_tasks() -> list[dict[str, Any]]:
    path = _task_store_path()
    if path is None or not path.exists():
        return []
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, list) else []
    except (OSError, ValueError):
        return []


def _write_tasks(tasks: list[dict[str, Any]]) -> None:
    path = _task_store_path()
    if path is None:
        raise RuntimeError("Pocket Hermes task storage is unavailable until the host starts.")
    retained = tasks[-_MAX_TASKS:]
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(retained, separators=(",", ":")), encoding="utf-8")
    temporary.replace(path)


def _read_json_list(path: Path | None) -> list[dict[str, Any]]:
    if path is None or not path.exists():
        return []
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, list) else []
    except (OSError, ValueError):
        return []


def _write_json_list(path: Path | None, values: list[dict[str, Any]], maximum: int) -> None:
    if path is None:
        raise RuntimeError("Pocket Hermes schedule storage is unavailable until the Android host initializes.")
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(values[-maximum:], separators=(",", ":")), encoding="utf-8")
    temporary.replace(path)


def _read_schedules() -> list[dict[str, Any]]:
    return _read_json_list(_schedule_store_path())


def _write_schedules(schedules: list[dict[str, Any]]) -> None:
    _write_json_list(_schedule_store_path(), schedules, _MAX_SCHEDULES)


def _read_schedule_runs() -> list[dict[str, Any]]:
    return _read_json_list(_schedule_run_store_path())


def _write_schedule_runs(runs: list[dict[str, Any]]) -> None:
    _write_json_list(_schedule_run_store_path(), runs, _MAX_SCHEDULE_RUNS)


def _cron_values(field: str, minimum: int, maximum: int) -> set[int]:
    values: set[int] = set()
    for raw_part in field.split(","):
        part = raw_part.strip()
        if not part:
            raise ValueError("Cron fields cannot contain empty list members.")
        base, separator, step_text = part.partition("/")
        step = 1
        if separator:
            if not step_text.isdigit() or int(step_text) < 1:
                raise ValueError("Cron steps must be positive integers.")
            step = int(step_text)
        if base == "*":
            start, end = minimum, maximum
        elif "-" in base:
            bounds = base.split("-", 1)
            if len(bounds) != 2 or not all(value.isdigit() for value in bounds):
                raise ValueError("Cron ranges must use numeric bounds.")
            start, end = int(bounds[0]), int(bounds[1])
        elif base.isdigit() and not separator:
            start = end = int(base)
        else:
            raise ValueError("Cron fields support *, numeric values, ranges, lists, and steps.")
        if start < minimum or end > maximum or start > end:
            raise ValueError("Cron field is outside its allowed range.")
        values.update(range(start, end + 1, step))
    return values


def validate_cron_expression(expression: str) -> str:
    normalized = str(expression).strip()
    fields = normalized.split()
    if len(fields) != 5:
        raise ValueError("Pocket Hermes requires a five-field cron expression: minute hour day month weekday.")
    for field, minimum, maximum in zip(fields, (0, 0, 1, 1, 0), (59, 23, 31, 12, 6)):
        _cron_values(field, minimum, maximum)
    return " ".join(fields)


def _cron_matches(expression: str, moment: datetime) -> bool:
    fields = expression.split()
    values = [_cron_values(field, minimum, maximum) for field, minimum, maximum in zip(fields, (0, 0, 1, 1, 0), (59, 23, 31, 12, 6))]
    cron_weekday = (moment.weekday() + 1) % 7
    return all(value in allowed for value, allowed in zip((moment.minute, moment.hour, moment.day, moment.month, cron_weekday), values))


def _public_schedule(schedule: dict[str, Any]) -> dict[str, str | int | bool | None]:
    return {
        "id": str(schedule.get("id", "")),
        "title": str(schedule.get("title", "")),
        "expression": str(schedule.get("expression", "")),
        "body": str(schedule.get("body", "")),
        "enabled": bool(schedule.get("enabled", False)),
        "lastRunAt": schedule.get("lastRunAt"),
        "lastRunStatus": str(schedule["lastRunStatus"]) if schedule.get("lastRunStatus") else None,
        "nextRetryAt": schedule.get("nextRetryAt"),
    }


def _public_schedule_run(run: dict[str, Any]) -> dict[str, str | int | None]:
    return {
        "id": str(run.get("id", "")),
        "scheduleId": str(run.get("scheduleId", "")),
        "scheduleTitle": str(run.get("scheduleTitle", "")),
        "status": str(run.get("status", "failed")),
        "attempt": int(run.get("attempt", 0)),
        "createdAt": int(run.get("createdAt", 0)),
        "updatedAt": int(run.get("updatedAt", 0)),
        "reason": str(run["reason"]) if run.get("reason") else None,
    }


def _queue_schedule_attempt(schedule: dict[str, Any], run: dict[str, Any]) -> None:
    """Queue one schedule attempt. Its upstream response route is the configured owner only."""
    now = int(time.time() * 1000)
    attempt = int(run.get("attempt", 0)) + 1
    run.update({"attempt": attempt, "status": "queued", "updatedAt": now, "reason": None, "nextRetryAt": None})
    tasks = _read_tasks()
    tasks.append({
        "id": f"schedule-{run['id']}-{attempt}",
        "body": str(schedule["body"]),
        "status": "queued",
        "createdAt": now,
        "updatedAt": now,
        "result": None,
        "reason": None,
        "scheduleRunId": run["id"],
        "delivery": "owner-telegram",
    })
    _write_tasks(tasks)


def _complete_schedule_run(run_id: str, task_status: str, reason: str | None) -> None:
    runs = _read_schedule_runs()
    run = next((item for item in runs if item.get("id") == run_id), None)
    if run is None:
        return
    now = int(time.time() * 1000)
    schedules = _read_schedules()
    schedule = next((item for item in schedules if item.get("id") == run.get("scheduleId")), None)
    if task_status == "succeeded":
        run.update({"status": "succeeded", "updatedAt": now, "reason": None, "nextRetryAt": None})
        if schedule is not None:
            schedule.update({"lastRunAt": now, "lastRunStatus": "succeeded", "nextRetryAt": None})
    elif int(run.get("attempt", 0)) < _MAX_SCHEDULE_RETRIES:
        retry_at = now + 60_000
        run.update({"status": "retrying", "updatedAt": now, "reason": reason or "scheduled task failed", "nextRetryAt": retry_at})
        if schedule is not None:
            schedule.update({"lastRunAt": now, "lastRunStatus": "retrying", "nextRetryAt": retry_at})
    else:
        run.update({"status": "failed", "updatedAt": now, "reason": reason or "scheduled task failed", "nextRetryAt": None})
        if schedule is not None:
            schedule.update({"lastRunAt": now, "lastRunStatus": "failed", "nextRetryAt": None})
    _write_schedule_runs(runs)
    _write_schedules(schedules)


def _public_task(task: dict[str, Any]) -> dict[str, str | int | None]:
    return {
        "id": str(task.get("id", "")),
        "body": str(task.get("body", "")),
        "status": str(task.get("status", "failed")),
        "createdAt": str(task.get("createdAt", "")),
        "updatedAt": str(task.get("updatedAt", "")),
        "result": str(task["result"]) if task.get("result") is not None else None,
        "reason": str(task["reason"]) if task.get("reason") is not None else None,
    }


def _schedule_task_drain() -> None:
    with _state_lock:
        loop = _state.get("loop")
        runner = _state.get("runner")
        active = _state.get("task_drain_task")
    if runner is None or loop is None or (active is not None and not active.done()):
        return
    def create_drain() -> None:
        with _state_lock:
            _state["task_drain_task"] = asyncio.create_task(_drain_task_queue())
    loop.call_soon_threadsafe(create_drain)


async def _drain_task_queue() -> None:
    """Execute one persisted owner task at a time through Hermes' own pipeline."""
    while True:
        tasks = _read_tasks()
        next_task = next((task for task in tasks if task.get("status") == "queued"), None)
        if next_task is None:
            return
        next_task["status"] = "running"
        next_task["updatedAt"] = int(time.time() * 1000)
        _write_tasks(tasks)
        try:
            from gateway.config import Platform
            from gateway.platforms.base import MessageEvent
            from gateway.session import SessionSource
            with _state_lock:
                runner = _state.get("runner")
                owner_chat_id = _state.get("owner_chat_id")
            if runner is None or not isinstance(owner_chat_id, str):
                raise RuntimeError("runtime is unavailable")
            is_schedule = isinstance(next_task.get("scheduleRunId"), str)
            source = SessionSource(
                platform=Platform.TELEGRAM if is_schedule else Platform.LOCAL,
                chat_id=owner_chat_id if is_schedule else f"pocket-hermes:{owner_chat_id}",
                chat_type="dm",
                user_id=owner_chat_id,
                user_name="Pocket Hermes owner",
            )
            event = MessageEvent(
                text=str(next_task["body"]),
                user_id=owner_chat_id,
                user_name="Pocket Hermes owner",
                source=source,
                internal=True,
            )
            response = await runner._handle_message(event)
            next_task["status"] = "succeeded"
            next_task["result"] = str(response or "Task completed without a text response.")[:_MAX_RESULT_TEXT]
            next_task["reason"] = None
        except Exception as exc:
            next_task["status"] = "failed"
            next_task["result"] = None
            next_task["reason"] = f"Hermes task failed: {type(exc).__name__}"
        next_task["updatedAt"] = int(time.time() * 1000)
        _write_tasks(tasks)
        schedule_run_id = next_task.get("scheduleRunId")
        if isinstance(schedule_run_id, str):
            _complete_schedule_run(schedule_run_id, str(next_task["status"]), next_task.get("reason"))


async def _heartbeat_loop() -> None:
    """Publish liveness only; it never contains or logs owner credentials."""
    while True:
        with _state_lock:
            _state["last_heartbeat_at"] = int(time.time() * 1000)
        await asyncio.sleep(15)


async def _scheduler_loop() -> None:
    """Evaluate validated schedules locally while the foreground private host is running."""
    last_minute_key: str | None = None
    while True:
        now = datetime.now().astimezone()
        minute_key = now.strftime("%Y-%m-%dT%H:%M%z")
        runs = _read_schedule_runs()
        schedules = _read_schedules()
        changed = False
        if minute_key != last_minute_key:
            for schedule in schedules:
                if schedule.get("enabled") and _cron_matches(str(schedule.get("expression", "")), now):
                    run_id = f"{schedule['id']}-{minute_key}"
                    if not any(run.get("id") == run_id for run in runs):
                        run = {"id": run_id, "scheduleId": schedule["id"], "scheduleTitle": schedule["title"], "status": "queued", "attempt": 0, "createdAt": int(time.time() * 1000), "updatedAt": int(time.time() * 1000), "reason": None, "nextRetryAt": None}
                        runs.append(run)
                        _queue_schedule_attempt(schedule, run)
                        changed = True
            last_minute_key = minute_key
        for run in runs:
            retry_at = run.get("nextRetryAt")
            if run.get("status") == "retrying" and isinstance(retry_at, int) and retry_at <= int(time.time() * 1000):
                schedule = next((item for item in schedules if item.get("id") == run.get("scheduleId")), None)
                if schedule is not None and schedule.get("enabled"):
                    _queue_schedule_attempt(schedule, run)
                    changed = True
        if changed:
            _write_schedule_runs(runs)
            _write_schedules(schedules)
            _schedule_task_drain()
        await asyncio.sleep(15)


def _validate_model_configuration(model_endpoint: str | None, model_api_key: str | None, model_name: str | None) -> str:
    if not model_endpoint or not model_api_key or not model_name:
        raise ValueError("Pocket Hermes requires an endpoint, model name, and model credential.")
    parsed_endpoint = urlparse(model_endpoint)
    if parsed_endpoint.scheme != "https" or not parsed_endpoint.hostname or parsed_endpoint.username or parsed_endpoint.password:
        raise ValueError("Pocket Hermes requires a credential-free HTTPS model endpoint.")
    return model_endpoint.rstrip("/")


def _configure_process(
    telegram_token: str,
    owner_chat_id: str,
    hermes_home: str,
    model_endpoint: str | None,
    model_api_key: str | None,
    model_name: str | None,
) -> None:
    """Configure only process-local, non-persisted values for the worker."""
    if not _TOKEN_RE.fullmatch(telegram_token):
        raise ValueError("Pocket Hermes rejected an invalid Telegram bot token.")
    if not _CHAT_ID_RE.fullmatch(owner_chat_id):
        raise ValueError("Pocket Hermes rejected a non-private owner identity.")
    model_endpoint = _validate_model_configuration(model_endpoint, model_api_key, model_name)

    home = Path(hermes_home).resolve()
    home.mkdir(parents=True, exist_ok=True)

    # The secrets remain process-local. In particular, the launcher never
    # writes a .env file, never logs a token, and never persists a model key.
    os.environ["HERMES_HOME"] = str(home)
    os.environ["TELEGRAM_BOT_TOKEN"] = telegram_token
    os.environ["TELEGRAM_ALLOWED_USERS"] = owner_chat_id
    os.environ["TELEGRAM_HOME_CHANNEL"] = owner_chat_id
    # Explicitly override any inherited or stale upstream gateway policy. The
    # embedded profile only accepts the configured private Telegram user and
    # intentionally has no group, pairing, or allow-all route.
    os.environ["GATEWAY_ALLOWED_USERS"] = owner_chat_id
    os.environ["GATEWAY_ALLOW_ALL_USERS"] = "false"
    os.environ["TELEGRAM_ALLOW_ALL_USERS"] = "false"
    os.environ["TELEGRAM_GROUP_ALLOWED_USERS"] = ""
    os.environ["TELEGRAM_GROUP_ALLOWED_CHATS"] = ""
    os.environ["HERMES_PLATFORM"] = "telegram"

    # Disable interactive or self-mutating surfaces for this embedded profile.
    os.environ["HERMES_EXEC_ASK"] = "1"
    os.environ["HERMES_DISABLE_BROWSER"] = "1"
    os.environ["HERMES_DISABLE_MCP"] = "1"
    os.environ["HERMES_DISABLE_LAZY_DEPS"] = "1"
    os.environ["PIP_NO_INPUT"] = "1"
    os.environ["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"

    os.environ["OPENAI_BASE_URL"] = model_endpoint
    os.environ["OPENAI_API_KEY"] = model_api_key
    os.environ["OPENAI_MODEL"] = model_name
    with _state_lock:
        _state["hermes_home"] = str(home)
        _state["owner_chat_id"] = owner_chat_id


def preflight_model(model_endpoint: str, model_api_key: str, model_name: str) -> str:
    """Perform a bounded, secret-free OpenAI-compatible model discovery check."""
    try:
        endpoint = _validate_model_configuration(model_endpoint, model_api_key, model_name)
        models_url = endpoint if endpoint.endswith("/models") else f"{endpoint}/models"
        request = Request(models_url, headers={"Authorization": f"Bearer {model_api_key}", "Accept": "application/json"})
        with urlopen(request, timeout=12) as response:
            if 200 <= response.status < 300:
                return json.dumps({"ok": True, "reason": "model endpoint accepted credentials"}, separators=(",", ":"))
        return json.dumps({"ok": False, "reason": "model endpoint rejected the request"}, separators=(",", ":"))
    except HTTPError as error:
        reason = "model credentials were rejected" if error.code in {401, 403} else f"model endpoint returned HTTP {error.code}"
        return json.dumps({"ok": False, "reason": reason}, separators=(",", ":"))
    except (URLError, TimeoutError, ValueError):
        return json.dumps({"ok": False, "reason": "model endpoint could not be reached securely"}, separators=(",", ":"))
    except Exception as error:
        return json.dumps({"ok": False, "reason": f"model preflight failed: {type(error).__name__}"}, separators=(",", ":"))


def _run_gateway() -> None:
    """Run upstream Hermes in one owned Python thread and retain its runner."""
    try:
        from gateway import run as gateway_run

        original_init = gateway_run.GatewayRunner.__init__

        def capture_runner(instance: Any, *args: Any, **kwargs: Any) -> None:
            original_init(instance, *args, **kwargs)
            with _state_lock:
                _state["runner"] = instance
                _state["last_heartbeat_at"] = int(time.time() * 1000)
                _state["scheduler_task"] = asyncio.create_task(_scheduler_loop())
            _set_state("running", "Telegram gateway initialized")
            _schedule_task_drain()

        gateway_run.GatewayRunner.__init__ = capture_runner
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        with _state_lock:
            _state["loop"] = loop
            _state["heartbeat_task"] = loop.create_task(_heartbeat_loop())
        _set_state("starting", "initializing Telegram gateway")
        success = loop.run_until_complete(gateway_run.start_gateway(replace=False, verbosity=0))
        _set_state("stopped" if success else "degraded", "gateway exited")
    except Exception as exc:  # A native bridge cannot crash the Android host.
        _set_state("degraded", f"gateway failed: {type(exc).__name__}")
    finally:
        with _state_lock:
            loop = _state.get("loop")
            heartbeat_task = _state.get("heartbeat_task")
            scheduler_task = _state.get("scheduler_task")
            _state["loop"] = None
            _state["runner"] = None
            _state["thread"] = None
            _state["heartbeat_task"] = None
            _state["task_drain_task"] = None
            _state["scheduler_task"] = None
        if heartbeat_task is not None:
            try:
                heartbeat_task.cancel()
            except Exception:
                pass
        if scheduler_task is not None:
            try:
                scheduler_task.cancel()
            except Exception:
                pass
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
    model_name: str | None = None,
) -> dict[str, str | int | None]:
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
            model_name,
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


def stop() -> dict[str, str | int | None]:
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


def status() -> dict[str, str | int | None]:
    """Return a secret-free worker status for the Android bridge."""
    return _snapshot()


def status_json() -> str:
    """Expose one compact, secret-free status payload to the Android bridge."""
    return json.dumps(_snapshot(), separators=(",", ":"))


def enqueue_task(task_id: str, body: str) -> str:
    """Persist a console task, then run it through the owner-local Hermes path."""
    normalized_id = str(task_id).strip()
    normalized_body = str(body).strip()
    if not normalized_id or len(normalized_id) > 96 or not normalized_body or len(normalized_body) > _MAX_TASK_TEXT:
        raise ValueError("Pocket Hermes rejected an invalid task.")
    with _state_lock:
        running = _state.get("status") == "running" and _state.get("runner") is not None
    if not running:
        raise RuntimeError("Start the private Android host before submitting a task.")
    tasks = _read_tasks()
    if any(task.get("id") == normalized_id for task in tasks):
        return json.dumps(_public_task(next(task for task in tasks if task.get("id") == normalized_id)), separators=(",", ":"))
    now = int(time.time() * 1000)
    task = {"id": normalized_id, "body": normalized_body, "status": "queued", "createdAt": now, "updatedAt": now, "result": None, "reason": None}
    tasks.append(task)
    _write_tasks(tasks)
    _schedule_task_drain()
    return json.dumps(_public_task(task), separators=(",", ":"))


def list_tasks_json() -> str:
    return json.dumps([_public_task(task) for task in _read_tasks()], separators=(",", ":"))


def cancel_task(task_id: str) -> str:
    tasks = _read_tasks()
    for task in tasks:
        if task.get("id") == str(task_id).strip() and task.get("status") == "queued":
            task["status"] = "cancelled"
            task["updatedAt"] = int(time.time() * 1000)
            task["reason"] = "cancelled by owner"
            _write_tasks(tasks)
            return json.dumps(_public_task(task), separators=(",", ":"))
    raise ValueError("Only queued Pocket Hermes tasks can be cancelled.")


def upsert_schedule(schedule_id: str, title: str, expression: str, body: str, enabled: bool) -> str:
    """Persist one owner-only schedule; evaluation runs only with the foreground host."""
    normalized_id = str(schedule_id).strip()
    normalized_title = str(title).strip()
    normalized_body = str(body).strip()
    normalized_expression = validate_cron_expression(expression)
    if not normalized_id or len(normalized_id) > 96 or not normalized_title or len(normalized_title) > _MAX_SCHEDULE_TITLE or not normalized_body or len(normalized_body) > _MAX_TASK_TEXT:
        raise ValueError("Pocket Hermes rejected an invalid schedule.")
    schedules = _read_schedules()
    schedule = next((item for item in schedules if item.get("id") == normalized_id), None)
    if schedule is None:
        if len(schedules) >= _MAX_SCHEDULES:
            raise ValueError("Pocket Hermes supports at most 16 on-device schedules.")
        schedule = {"id": normalized_id, "lastRunAt": None, "lastRunStatus": None, "nextRetryAt": None}
        schedules.append(schedule)
    schedule.update({"title": normalized_title, "expression": normalized_expression, "body": normalized_body, "enabled": bool(enabled)})
    _write_schedules(schedules)
    return json.dumps(_public_schedule(schedule), separators=(",", ":"))


def list_schedules_json() -> str:
    return json.dumps([_public_schedule(schedule) for schedule in _read_schedules()], separators=(",", ":"))


def set_schedule_enabled(schedule_id: str, enabled: bool) -> str:
    schedules = _read_schedules()
    schedule = next((item for item in schedules if item.get("id") == str(schedule_id).strip()), None)
    if schedule is None:
        raise ValueError("Pocket Hermes schedule was not found.")
    schedule["enabled"] = bool(enabled)
    _write_schedules(schedules)
    return json.dumps(_public_schedule(schedule), separators=(",", ":"))


def delete_schedule(schedule_id: str) -> None:
    normalized_id = str(schedule_id).strip()
    schedules = _read_schedules()
    retained = [item for item in schedules if item.get("id") != normalized_id]
    if len(retained) == len(schedules):
        raise ValueError("Pocket Hermes schedule was not found.")
    _write_schedules(retained)


def list_schedule_runs_json() -> str:
    return json.dumps([_public_schedule_run(run) for run in _read_schedule_runs()], separators=(",", ":"))
