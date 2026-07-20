from app import create_app
from app.workflow.workflow_library import seed_all_entity_workflows


def run() -> None:
    seed_all_entity_workflows()
    print(
        "Seeded workflow definitions: company_limited_by_shares (standard + foreign), "
        "partnership, company_limited_by_guarantee, external_company"
    )


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        run()
