"""Config-driven data entry for client tasks.

A task definition may carry an `input_schema`: a list of field descriptors that
the client fills in when completing the task. This keeps "collect data from the
client" as configuration on the workflow rather than bespoke UI per task.

Field descriptor shape:
    {
      "name": "name_1",           # key stored in submitted_data
      "label": "First choice",    # shown to the client
      "type": "text",             # text | textarea | select
      "required": true,           # optional, default false
      "placeholder": "...",       # optional
      "options": [                # select only
          {"value": "ltd", "label": "Limited"}
      ]
    }
"""

from app.core.errors import ValidationAppError

FIELD_TYPES = {"text", "textarea", "select"}


def validate_submission(input_schema: list[dict], data: dict) -> dict:
    """Checks a client's answers against the task's input schema and returns a
    cleaned dict containing only the declared fields. Raises on missing required
    fields or a value outside a select's options."""
    data = data or {}
    cleaned: dict = {}
    missing: list[str] = []

    for field in input_schema:
        key = field["name"]
        raw = data.get(key)
        value = raw.strip() if isinstance(raw, str) else raw

        if field.get("required") and (value is None or value == ""):
            missing.append(field.get("label", key))
            continue

        if value in (None, ""):
            continue

        if field.get("type") == "select":
            allowed = {opt["value"] for opt in field.get("options", [])}
            if value not in allowed:
                raise ValidationAppError(f"'{field.get('label', key)}' has an invalid choice.")

        cleaned[key] = value

    if missing:
        raise ValidationAppError("Please complete: " + ", ".join(missing))
    return cleaned
