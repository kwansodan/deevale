from app import create_app
from app.extensions import db
from app.workflow.enums import EntityType, FeeType
from app.workflow.models import FeeScheduleItem

# Placeholder amounts (GHS, stored as pesewas). These are illustrative starting
# points for the demo/dev environment -- finance/admin edit the real figures
# via the fee schedule table (never hardcoded in application code).
FEE_SCHEDULE = [
    dict(
        code="ORC_NAME_RESERVATION",
        label="ORC Business Name Reservation",
        applies_to_stage_code="name_reservation",
        amount_minor=2_500,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="ORC_INCORPORATION_FILING",
        label="ORC Incorporation Filing Fee",
        applies_to_stage_code="incorporation",
        amount_minor=27_000,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="GRA_TIN_REGISTRATION",
        label="GRA Taxpayer Identification Number Registration",
        applies_to_stage_code="tax_registration",
        amount_minor=0,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="SSNIT_REGISTRATION",
        label="SSNIT Employer Registration",
        applies_to_stage_code="ssnit_registration",
        amount_minor=0,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="MMDA_OPERATING_PERMIT",
        label="MMDA Business Operating Permit",
        applies_to_stage_code="business_operating_permit",
        amount_minor=35_000,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="GIPC_REGISTRATION",
        label="GIPC Foreign Investment Registration",
        applies_to_stage_code="gipc_registration",
        amount_minor=1_200_000,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="ORC_PARTNERSHIP_FILING",
        label="ORC Partnership Registration Fee",
        applies_to_stage_code="partnership_registration",
        amount_minor=24_000,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="ORC_CLG_FILING",
        label="ORC Incorporation Fee (Limited by Guarantee)",
        applies_to_stage_code="clg_incorporation",
        amount_minor=27_000,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="ORC_EXTERNAL_FILING",
        label="ORC External Company Registration Fee",
        applies_to_stage_code="external_registration",
        amount_minor=650_000,
        fee_type=FeeType.GOVERNMENT.value,
    ),
    dict(
        code="SERVICE_FEE_COMPANY_LTD",
        label="LaunchGH Service Fee -- Company Limited by Shares",
        applies_to_entity_type=EntityType.COMPANY_LIMITED_BY_SHARES.value,
        applies_to_stage_code=None,
        amount_minor=150_000,
        fee_type=FeeType.SERVICE.value,
    ),
    dict(
        code="SERVICE_FEE_PARTNERSHIP",
        label="LaunchGH Service Fee -- Partnership",
        applies_to_entity_type=EntityType.PARTNERSHIP.value,
        applies_to_stage_code=None,
        amount_minor=100_000,
        fee_type=FeeType.SERVICE.value,
    ),
    dict(
        code="SERVICE_FEE_CLG",
        label="LaunchGH Service Fee -- Company Limited by Guarantee",
        applies_to_entity_type=EntityType.COMPANY_LIMITED_BY_GUARANTEE.value,
        applies_to_stage_code=None,
        amount_minor=180_000,
        fee_type=FeeType.SERVICE.value,
    ),
    dict(
        code="SERVICE_FEE_EXTERNAL",
        label="LaunchGH Service Fee -- External Company",
        applies_to_entity_type=EntityType.EXTERNAL_COMPANY.value,
        applies_to_stage_code=None,
        amount_minor=250_000,
        fee_type=FeeType.SERVICE.value,
    ),
]


def run() -> None:
    for item in FEE_SCHEDULE:
        existing = FeeScheduleItem.query.filter_by(code=item["code"]).first()
        if existing is None:
            db.session.add(FeeScheduleItem(**item))
    db.session.commit()
    print("Seeded fee schedule items:", [f["code"] for f in FEE_SCHEDULE])


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        run()
