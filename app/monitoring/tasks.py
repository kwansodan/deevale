"""Self-hosted uptime monitor.

A Celery Beat task probes the public URLs every few minutes and emails a
configured address on a state change: DOWN after N consecutive failures (so a
single blip or a quick deploy restart doesn't cry wolf) and RECOVERED once it is
reachable again. Reuses the Resend email sender and the Redis the app already
runs on.

Blind spot: this runs inside the stack, so it cannot email during a total
VPS/Redis outage -- pair it with an external monitor (UptimeRobot) on the same
URLs. It does catch API 5xx/crashes, a down frontend, and Caddy/TLS/DNS failures
because it probes the external URLs.
"""

import json
from datetime import UTC, datetime

import requests
from flask import current_app

from app.auth.blocklist import get_redis
from app.celery_app import celery_app
from app.notifications.channels.email import get_email_sender

_STATE_PREFIX = "uptime:"
_STATE_TTL_SECONDS = 7 * 24 * 3600  # a week; state self-heals to "up" if it expires


def _probe(url: str) -> tuple[bool, str]:
    """Return (healthy, detail). Healthy = a 2xx/3xx response within the timeout."""
    try:
        resp = requests.get(url, timeout=10)
        return (200 <= resp.status_code < 400, f"HTTP {resp.status_code}")
    except Exception as exc:  # noqa: BLE001 - any failure to reach the URL is "down"
        return (False, f"{type(exc).__name__}: {exc}")


def _get_state(r, url: str) -> dict:
    raw = r.get(_STATE_PREFIX + url)
    if raw:
        try:
            return json.loads(raw)
        except ValueError:
            pass
    return {"status": "up", "fails": 0}


def _set_state(r, url: str, status: str, fails: int) -> None:
    r.setex(_STATE_PREFIX + url, _STATE_TTL_SECONDS, json.dumps({"status": status, "fails": fails}))


def _send_alert(to_email: str, url: str, is_down: bool, detail: str) -> None:
    ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    if is_down:
        subject = f"🔴 DOWN: {url}"
        lines = [f"{url} is DOWN.", f"Reason: {detail}", f"At: {ts}"]
    else:
        subject = f"🟢 RECOVERED: {url}"
        lines = [f"{url} is back UP.", f"At: {ts}"]
    text = "\n".join(lines)
    html = "<p>" + "<br>".join(lines) + "</p>"
    get_email_sender().send(to_email, subject, html, text)


@celery_app.task(name="app.monitoring.tasks.check_uptime")
def check_uptime() -> dict:
    alert_email = current_app.config.get("UPTIME_ALERT_EMAIL", "")
    urls = current_app.config.get("UPTIME_CHECK_URLS", [])
    threshold = int(current_app.config.get("UPTIME_FAIL_THRESHOLD", 2))
    if not alert_email or not urls:
        return {"skipped": "UPTIME_ALERT_EMAIL or UPTIME_CHECK_URLS not configured"}

    r = get_redis()
    results: dict[str, str] = {}
    for url in urls:
        healthy, detail = _probe(url)
        state = _get_state(r, url)
        was_down = state.get("status") == "down"

        if healthy:
            if was_down:
                try:
                    _send_alert(alert_email, url, is_down=False, detail=detail)
                except Exception:  # noqa: BLE001 - alert failure must not crash the task
                    current_app.logger.exception("Uptime recovery email failed for %s", url)
            _set_state(r, url, "up", 0)
            results[url] = "up"
            continue

        fails = int(state.get("fails", 0)) + 1
        if fails >= threshold and not was_down:
            try:
                _send_alert(alert_email, url, is_down=True, detail=detail)
            except Exception:  # noqa: BLE001
                current_app.logger.exception("Uptime down email failed for %s", url)
            _set_state(r, url, "down", fails)
            results[url] = "down"
        else:
            # Still up (below threshold) or already alerted -- accumulate, no email.
            _set_state(r, url, "down" if was_down else "up", fails)
            results[url] = "down" if was_down else "degraded"
    return results
