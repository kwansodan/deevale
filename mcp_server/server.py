"""Deevale GH — MCP server for clients.

Exposes a business owner's own registration to an MCP client (e.g. Claude
Desktop): check case status, see what's needed next, read and send messages --
all as tools an assistant can call on the user's behalf.

Auth is by login, so no backend changes are needed: the server signs in with the
user's own credentials (from the MCP client config), holds the JWT, and refreshes
it transparently. It only ever sees data the logged-in user is already entitled
to through the normal API.

Run:
    DEEVALE_API_URL=https://api.deevalegh.com \
    DEEVALE_EMAIL=you@example.com \
    DEEVALE_PASSWORD=... \
    python -m mcp_server.server

See README.md for the Claude Desktop config block.
"""

from __future__ import annotations

import os

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.environ.get("DEEVALE_API_URL", "https://api.deevalegh.com").rstrip("/")
EMAIL = os.environ.get("DEEVALE_EMAIL", "")
PASSWORD = os.environ.get("DEEVALE_PASSWORD", "")

mcp = FastMCP("deevale-gh")


class _Session:
    """Holds the JWT and re-authenticates on demand. One user per server."""

    def __init__(self) -> None:
        self._access: str | None = None
        self._client = httpx.Client(base_url=API_URL, timeout=20)

    def _login(self) -> None:
        if not EMAIL or not PASSWORD:
            raise RuntimeError(
                "DEEVALE_EMAIL and DEEVALE_PASSWORD must be set in the MCP server environment."
            )
        resp = self._client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        if resp.status_code != 200:
            raise RuntimeError(f"Login failed ({resp.status_code}): check your Deevale GH credentials.")
        self._access = resp.json()["access_token"]

    def request(self, method: str, path: str, **kwargs) -> httpx.Response:
        if self._access is None:
            self._login()
        headers = {**kwargs.pop("headers", {}), "Authorization": f"Bearer {self._access}"}
        resp = self._client.request(method, path, headers=headers, **kwargs)
        if resp.status_code == 401:  # token expired -> one re-login and retry
            self._login()
            headers["Authorization"] = f"Bearer {self._access}"
            resp = self._client.request(method, path, headers=headers, **kwargs)
        return resp


_session = _Session()


def _resolve_case_id(case_ref: str) -> str:
    """Accepts a case number (DGH-2026-000001) or a raw id and returns the id."""
    case_ref = case_ref.strip()
    if "-" not in case_ref:  # already looks like a UUID
        return case_ref
    resp = _session.request("GET", "/cases")
    resp.raise_for_status()
    for case in resp.json():
        if case.get("case_number", "").lower() == case_ref.lower():
            return case["id"]
    raise ValueError(f"No case found matching '{case_ref}'.")


@mcp.tool()
def list_cases() -> list[dict]:
    """List the signed-in user's business registration cases, with each one's
    case number, business name, and current status."""
    resp = _session.request("GET", "/cases")
    resp.raise_for_status()
    out = []
    for c in resp.json():
        payload = c.get("onboarding_payload") or {}
        out.append(
            {
                "case_number": c.get("case_number"),
                "business_name": payload.get("business_name"),
                "entity_type": c.get("entity_type"),
                "status": c.get("status"),
            }
        )
    return out


@mcp.tool()
def get_case(case_ref: str) -> dict:
    """Get the full status of one case: its stages and, for each, the tasks and
    their state. `case_ref` is a case number (e.g. DGH-2026-000001).

    Use this to answer "where is my registration?" and "what's next?"."""
    case_id = _resolve_case_id(case_ref)
    resp = _session.request("GET", f"/cases/{case_id}")
    resp.raise_for_status()
    case = resp.json()
    stages = []
    for stage in case.get("stages", []):
        stages.append(
            {
                "name": stage.get("name"),
                "status": stage.get("status"),
                "tasks": [
                    {"name": t.get("name"), "status": t.get("status_display") or t.get("status")}
                    for t in stage.get("tasks", [])
                ],
            }
        )
    return {
        "case_number": case.get("case_number"),
        "status": case.get("status"),
        "stages": stages,
    }


@mcp.tool()
def whats_next(case_ref: str) -> list[str]:
    """List the actions currently waiting on the user for a case -- the tasks
    they need to complete to move their registration forward."""
    case_id = _resolve_case_id(case_ref)
    resp = _session.request("GET", f"/cases/{case_id}")
    resp.raise_for_status()
    waiting = []
    for stage in resp.json().get("stages", []):
        for task in stage.get("tasks", []):
            if task.get("assignee_type") == "client" and task.get("status") in (
                "pending",
                "awaiting_client",
                "in_progress",
            ):
                waiting.append(task.get("name"))
    return waiting or ["Nothing needed from you right now — we'll let you know when there is."]


@mcp.tool()
def list_messages(case_ref: str) -> list[dict]:
    """Read the message thread between the user and their case officer for a case."""
    case_id = _resolve_case_id(case_ref)
    resp = _session.request("GET", f"/cases/{case_id}/messages")
    resp.raise_for_status()
    return [
        {"body": m.get("body"), "at": m.get("created_at"), "has_attachment": bool(m.get("attachment_document_id"))}
        for m in resp.json()
    ]


@mcp.tool()
def send_message(case_ref: str, body: str) -> dict:
    """Send a message to the user's case officer on a case. Use only to send
    what the user has actually asked to send."""
    case_id = _resolve_case_id(case_ref)
    resp = _session.request("POST", f"/cases/{case_id}/messages", json={"body": body})
    if resp.status_code >= 400:
        raise RuntimeError(f"Couldn't send the message ({resp.status_code}).")
    return {"sent": True}


if __name__ == "__main__":
    mcp.run()
