from app import create_app
from app.auth.models import Role
from app.core.enums import RoleName
from app.extensions import db


def run() -> None:
    for role in RoleName:
        if Role.query.filter_by(name=role.value).first() is None:
            db.session.add(Role(name=role.value, description=role.value.replace("_", " ").title()))
    db.session.commit()
    print("Seeded roles:", [r.value for r in RoleName])


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        run()
