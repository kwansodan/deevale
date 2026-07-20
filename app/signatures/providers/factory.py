from flask import current_app

from app.signatures.providers.base import SignatureProvider
from app.signatures.providers.builtin import BuiltinSignatureProvider
from app.signatures.providers.dropbox_sign import DropboxSignProvider

_PROVIDERS = {
    "builtin": BuiltinSignatureProvider,
    "dropbox_sign": DropboxSignProvider,
}


def get_signature_provider(name: str | None = None) -> SignatureProvider:
    name = name or current_app.config.get("SIGNATURE_PROVIDER", "builtin")
    provider_cls = _PROVIDERS.get(name, BuiltinSignatureProvider)
    return provider_cls()
