"""Deterministic policy test for the embedded Pocket Hermes worker.

This exercises only the local configuration boundary. It never calls Telegram,
Hermes, or a model provider, and it never prints credentials.
"""

import json
import os
import sys
import tempfile
from datetime import datetime

sys.path.insert(0, "modules/pocket-hermes-supervisor/android/src/main/python")
import pocket_hermes_worker as worker  # noqa: E402


def expect_invalid(**overrides: str | None) -> None:
    baseline: dict[str, str | None] = {
        "telegram_token": "123456:abcdefghijklmnopqrstuvwxyzABCDE",
        "owner_chat_id": "123456789",
        "hermes_home": tempfile.mkdtemp(prefix="pocket-hermes-worker-test-"),
        "model_endpoint": "https://models.example.test/v1",
        "model_api_key": "test-model-key",
        "model_name": "test-model",
    }
    baseline.update(overrides)
    try:
        worker._configure_process(**baseline)
    except ValueError:
        return
    raise AssertionError("worker accepted an invalid private-host configuration")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="pocket-hermes-worker-test-") as home:
        worker._configure_process(
            telegram_token="123456:abcdefghijklmnopqrstuvwxyzABCDE",
            owner_chat_id="123456789",
            hermes_home=home,
            model_endpoint="https://models.example.test/v1",
            model_api_key="test-model-key",
            model_name="test-model",
        )
        assert os.environ["TELEGRAM_ALLOWED_USERS"] == "123456789"
        assert os.environ["GATEWAY_ALLOWED_USERS"] == "123456789"
        assert os.environ["GATEWAY_ALLOW_ALL_USERS"] == "false"
        assert os.environ["TELEGRAM_ALLOW_ALL_USERS"] == "false"
        assert os.environ["TELEGRAM_GROUP_ALLOWED_USERS"] == ""
        assert os.environ["TELEGRAM_GROUP_ALLOWED_CHATS"] == ""

        # Queue persistence is deliberately testable without starting Hermes or
        # contacting any external service. A synthetic running marker prevents
        # dispatch while preserving the owner-only storage contract.
        with worker._state_lock:
            worker._state["status"] = "running"
            worker._state["runner"] = object()
            worker._state["loop"] = None
        queued = json.loads(worker.enqueue_task("owner-test-1", "Summarize local host readiness."))
        assert queued["status"] == "queued"
        assert queued["result"] is None
        assert json.loads(worker.list_tasks_json())[0]["body"] == "Summarize local host readiness."
        cancelled = json.loads(worker.cancel_task("owner-test-1"))
        assert cancelled["status"] == "cancelled"

        saved_schedule = json.loads(worker.upsert_schedule(
            "schedule-test-1",
            "Daily readiness report",
            "0 9 * * *",
            "Summarize host readiness and send it to the owner.",
            True,
        ))
        assert saved_schedule["enabled"] is True
        assert saved_schedule["expression"] == "0 9 * * *"
        assert worker._cron_matches("0 9 * * *", datetime(2026, 8, 17, 9, 0))
        assert not worker._cron_matches("0 9 * * *", datetime(2026, 8, 17, 9, 1))
        paused_schedule = json.loads(worker.set_schedule_enabled("schedule-test-1", False))
        assert paused_schedule["enabled"] is False
        assert len(json.loads(worker.list_schedules_json())) == 1
        assert json.loads(worker.list_schedule_runs_json()) == []
        worker.delete_schedule("schedule-test-1")
        assert json.loads(worker.list_schedules_json()) == []
        try:
            worker.upsert_schedule("schedule-test-invalid", "Bad", "every morning", "Do not run", True)
        except ValueError:
            pass
        else:
            raise AssertionError("worker accepted an invalid cron expression")
        with worker._state_lock:
            worker._state["status"] = "stopped"
            worker._state["runner"] = None

    expect_invalid(owner_chat_id="-100123456789")
    expect_invalid(model_endpoint="http://models.example.test/v1")
    expect_invalid(model_api_key="")
    expect_invalid(model_name="")


if __name__ == "__main__":
    main()
