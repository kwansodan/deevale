# Deevale GH — MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets a
business owner manage their Deevale GH registration from an AI assistant
(Claude Desktop, or any MCP client). It wraps the normal Deevale GH API and
signs in as the user, so it can only ever see and do what that user could do in
the app.

## Tools

| Tool | What it does |
|---|---|
| `list_cases` | The user's registrations, with status |
| `get_case` | Full stage/task status of one case |
| `whats_next` | The tasks currently waiting on the user |
| `list_messages` | The case ↔ officer message thread |
| `send_message` | Send a message to the case officer |

Cases are referenced by their number (e.g. `DGH-2026-000001`).

## Setup

```bash
cd mcp_server
python -m venv .venv && . .venv/bin/activate   # or your preferred env
pip install -r requirements.txt
```

## Configure Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "deevale-gh": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/absolute/path/to/deevale",
      "env": {
        "DEEVALE_API_URL": "https://api.deevalegh.com",
        "DEEVALE_EMAIL": "you@example.com",
        "DEEVALE_PASSWORD": "your-password"
      }
    }
  }
}
```

Restart Claude Desktop. You can then ask things like *"What's next on my
registration?"* or *"Message my case officer that I've sent the documents."*

## Security notes

- The server holds one user's credentials and acts only as that user; it never
  has admin or cross-tenant access.
- Credentials live in the MCP client's config on the user's own machine and are
  sent only to `DEEVALE_API_URL` over HTTPS.
- `send_message` is the only state-changing tool. The assistant is instructed to
  send only what the user explicitly asks to send; treat that as advisory and
  confirm before sending on someone's behalf.

## Limitations / next steps

- Auth is username/password because the platform has no personal API-token
  concept yet. A cleaner design is a user-issued, revocable **personal access
  token** (a small backend addition) so credentials never sit in a config file.
- Read-focused. Completing data-entry tasks (e.g. submitting proposed names)
  from the MCP is a natural next tool once the token model lands.
