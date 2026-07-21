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


# Any international mobile in E.164: a leading +, a country code starting 1-9,
# then 6-14 more digits. Deliberately permissive about which country, because
# foreign founders register from abroad and do not hold a Ghanaian SIM.
_E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")


def normalize_mobile(raw: str) -> str:
    """Normalizes any international mobile to E.164.

    A bare local number (0XXXXXXXXX) is still assumed Ghanaian, so Ghanaian
    users can keep typing 024XXXXXXX as they always have.
    """
    raw = raw.strip().replace(" ", "").replace("-", "")
    if _LOCAL_RE.match(raw):
        return "+233" + raw[1:]
    if _E164_RE.match(raw):
        return raw
    raise ValidationError(
        "Enter a valid mobile number in international format, e.g. 024XXXXXXX or +44XXXXXXXXXX"
    )
