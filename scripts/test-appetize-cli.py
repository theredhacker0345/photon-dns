#!/usr/bin/env python3
"""Run a focused Appetize.io Android smoke test without the interactive website player.

The Appetize.io REST API manages uploaded builds, while its documented JavaScript SDK
manages live sessions. This harness serves a minimal local SDK host, controls Chromium
through the DevTools protocol, records the session's initial Android UI, and captures a
browser screenshot. It intentionally accepts only a public Appetize build ID and never
reads, stores, or prints the APPETIZE_TOKEN.

Usage:
  python3 scripts/test-appetize-cli.py --build-id <publicKey>
"""

from __future__ import annotations

import argparse
import base64
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import websocket


SDK_HOST_TEMPLATE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pocket Agent Host Appetize CLI smoke test</title>
    <style>
      body { margin: 0; background: #111827; }
      iframe { border: 0; width: 430px; height: 900px; }
    </style>
  </head>
  <body>
    <iframe id="appetize" src="https://appetize.io/embed/__BUILD_ID__?screenOnly=true&device=pixel4&orientation=portrait"></iframe>
    <script>
      const appetizeSdkReady = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://js.appetize.io/embed.js";
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Unable to load the Appetize.io SDK"));
        document.head.appendChild(script);
      });

      window.startAppetizeSmokeTest = async () => {
        const events = [];
        const record = (type, value) => events.push({ type, value: String(value ?? "") });
        const test = async () => {
          await appetizeSdkReady;
          const client = await window.appetize.getClient("#appetize");
          client.on("queue", (queue) => record("queue", JSON.stringify(queue)));
          client.on("error", (error) => record("clientError", error && error.message));
          client.on("sessionError", (error) => record("sessionError", error && error.message));
          const session = await client.startSession({
            platform: "android",
            device: "pixel4",
            orientation: "portrait",
            screenOnly: true,
          });
          const ui = await session.getUI();
          const uiText = JSON.stringify(ui);
          const smokePass = /Pocket Agent Host|Get started|Setup|Home/.test(uiText);
          await session.end();
          return { status: smokePass ? "passed" : "unexpected-ui", events, ui, uiTextLength: uiText.length };
        };

        return await Promise.race([
          test(),
          new Promise((resolve) => setTimeout(() => resolve({ status: "timeout", events }), 120000)),
        ]);
      };
    </script>
  </body>
</html>
"""


class QuietHandler(SimpleHTTPRequestHandler):
  def log_message(self, format: str, *args: object) -> None:
    return


def json_request(url: str) -> Any:
  with urllib.request.urlopen(url, timeout=5) as response:
    return json.loads(response.read().decode("utf-8"))


def wait_for_debug_target(port: int, timeout_seconds: int) -> str:
  deadline = time.monotonic() + timeout_seconds
  while time.monotonic() < deadline:
    try:
      targets = json_request(f"http://127.0.0.1:{port}/json")
      page = next((target for target in targets if target.get("type") == "page"), None)
      if page and page.get("webSocketDebuggerUrl"):
        return page["webSocketDebuggerUrl"]
    except OSError:
      pass
    time.sleep(0.25)
  raise RuntimeError("Chromium DevTools did not become available")


class DevToolsClient:
  def __init__(self, url: str) -> None:
    self.socket = websocket.create_connection(url, timeout=185)
    self.message_id = 0

  def command(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    self.message_id += 1
    request_id = self.message_id
    self.socket.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
    while True:
      response = json.loads(self.socket.recv())
      if response.get("id") == request_id:
        if "error" in response:
          raise RuntimeError(f"DevTools {method} failed: {response['error']}")
        return response["result"]

  def close(self) -> None:
    self.socket.close()


def run_smoke_test(build_id: str, output_directory: Path) -> dict[str, Any]:
  chromium = shutil.which("chromium") or shutil.which("chromium-browser")
  if not chromium:
    raise RuntimeError("Chromium is required for the Appetize.io CLI smoke test")

  debug_port = 9322

  with tempfile.TemporaryDirectory(prefix="appetize-cli-") as temporary_directory:
    temporary_path = Path(temporary_directory)
    harness_path = temporary_path / "index.html"
    harness_path.write_text(SDK_HOST_TEMPLATE.replace("__BUILD_ID__", build_id), encoding="utf-8")
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(temporary_path)))
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    port = server.server_address[1]
    chrome_profile = temporary_path / "chrome-profile"
    chrome_process = subprocess.Popen(
      [
        chromium,
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--autoplay-policy=no-user-gesture-required",
        f"--remote-allow-origins=http://127.0.0.1:{debug_port}",
        f"--remote-debugging-port={debug_port}",
        f"--user-data-dir={chrome_profile}",
        "--window-size=430,900",
        "about:blank",
      ],
      stdout=subprocess.DEVNULL,
      stderr=subprocess.DEVNULL,
    )
    client: DevToolsClient | None = None
    try:
      client = DevToolsClient(wait_for_debug_target(debug_port, 15))
      client.command("Page.enable")
      client.command("Page.navigate", {"url": f"http://127.0.0.1:{port}/index.html"})
      harness_ready = client.command(
        "Runtime.evaluate",
        {
          "expression": "new Promise((resolve) => { const deadline = Date.now() + 20000; const waitForHarness = () => { if (typeof window.startAppetizeSmokeTest === 'function') { resolve(true); } else if (Date.now() >= deadline) { resolve(false); } else { setTimeout(waitForHarness, 100); } }; waitForHarness(); })",
          "awaitPromise": True,
          "returnByValue": True,
        },
      )
      if harness_ready["result"].get("value") is not True:
        raise RuntimeError("The local Appetize.io SDK harness did not become ready")
      result = client.command(
        "Runtime.evaluate",
        {
          "expression": "window.startAppetizeSmokeTest()",
          "awaitPromise": True,
          "returnByValue": True,
          "userGesture": True,
        },
      )
      if result.get("exceptionDetails"):
        exception_details = result["exceptionDetails"]
        exception = exception_details.get("exception", {})
        test_result: Any = {
          "status": "cli-evaluation-error",
          "details": exception.get(
            "description",
            exception_details.get("text", "Unknown DevTools evaluation error"),
          ),
        }
      else:
        test_result = result["result"].get("value")
        if not isinstance(test_result, dict):
          test_result = {
            "status": "cli-evaluation-error",
            "details": f"Unexpected DevTools result: {result['result'].get('description', result['result'].get('type', 'unknown'))}",
          }
      screenshot = client.command("Page.captureScreenshot", {"format": "png"})
      output_directory.mkdir(parents=True, exist_ok=True)
      (output_directory / "appetize-cli-smoke.png").write_bytes(base64.b64decode(screenshot["data"]))
      report = {
        "buildId": build_id,
        "testedAtEpochMs": int(time.time() * 1000),
        "result": test_result,
        "screenshot": "appetize-cli-smoke.png",
      }
      (output_directory / "appetize-cli-smoke.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
      return report
    finally:
      if client:
        client.close()
      chrome_process.terminate()
      try:
        chrome_process.wait(timeout=5)
      except subprocess.TimeoutExpired:
        chrome_process.kill()
      server.shutdown()


def main() -> int:
  parser = argparse.ArgumentParser(description="Run a CLI-driven Appetize.io Android smoke test")
  parser.add_argument("--build-id", required=True, help="Appetize.io Android public build key")
  parser.add_argument(
    "--output-dir",
    default=".tmp-appetize/cli-smoke",
    help="Directory for a JSON report and browser screenshot",
  )
  args = parser.parse_args()

  report = run_smoke_test(args.build_id, Path(args.output_dir))
  print(json.dumps(report, indent=2))
  status = report.get("result", {}).get("status") if isinstance(report.get("result"), dict) else None
  return 0 if status == "passed" else 1


if __name__ == "__main__":
  sys.exit(main())
