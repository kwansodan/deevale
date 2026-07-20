import hashlib
import hmac
import json

from flask import current_app

from app.signatures.providers.base import SignatureProvider, WebhookResult


class DropboxSignProvider(SignatureProvider):
    """Dropbox Sign (HelloSign) integration. Networked calls are made only when
    this provider is selected via config; the built-in provider is the default
    so the app runs without external keys."""

    name = "dropbox_sign"

    def _api_key(self) -> str:
        return current_app.config["DROPBOX_SIGN_API_KEY"]

    def send(self, request) -> str:
        import requests

        signers = [
            {"email_address": p.email, "name": p.name, "order": p.order_index}
            for p in request.parties
        ]
        response = requests.post(
            "https://api.hellosign.com/v3/signature_request/send",
            auth=(self._api_key(), ""),
            json={
                "title": request.title,
                "subject": request.title,
                "signers": signers,
                "signing_options": {"draw": True, "type": True},
                "test_mode": 1 if current_app.config.get("DEBUG") else 0,
                # In production the merged HTML would be uploaded as the file.
            },
            timeout=20,
        )
        response.raise_for_status()
        return response.json()["signature_request"]["signature_request_id"]

    def parse_webhook(self, raw_body: bytes, headers: dict) -> WebhookResult:
        payload = json.loads(raw_body)
        event = payload.get("event", {})
        # Dropbox Sign signs the event with an HMAC of event_time + event_type.
        event_time = str(event.get("event_time", ""))
        event_type = str(event.get("event_type", ""))
        expected = hmac.new(
            self._api_key().encode(), (event_time + event_type).encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, event.get("event_hash", "")):
            from app.signatures.providers.base import WebhookResult as _WR  # noqa: F401

            raise ValueError("Invalid Dropbox Sign webhook signature")

        request_id = payload.get("signature_request", {}).get("signature_request_id", "")
        mapped = {
            "signature_request_all_signed": "completed",
            "signature_request_signed": "signed",
            "signature_request_declined": "declined",
        }.get(event_type, event_type)
        return WebhookResult(provider_reference=request_id, event=mapped)
