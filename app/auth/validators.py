import re

from marshmallow import ValidationError

# Accepts local (0XXXXXXXXX) or international (+233XXXXXXXXX) Ghana mobile
# numbers and normalizes to E.164 (+233XXXXXXXXX).
_LOCAL_RE = re.compile(r"^0(2\d|5\d|3\d)\d{7}$")
_INTL_RE = re.compile(r"^\+233(2\d|5\d|3\d)\d{7}$")


def normalize_ghana_phone(raw: str) -> str:
    raw = raw.strip().replace(" ", "").replace("-", "")
    if _INTL_RE.match(raw):
        return raw
    if _LOCAL_RE.match(raw):
        return "+233" + raw[1:]
    raise ValidationError("Enter a valid Ghana phone number, e.g. 024XXXXXXX or +233XXXXXXXXX")
