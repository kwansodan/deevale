"""live chat migration and cleanup

Revision ID: b4e2d6c8f1a0
Revises: a3f1c9d2e4b7
Create Date: 2026-08-17 11:20:00.000000

"""
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision = "b4e2d6c8f1a0"
down_revision = "a3f1c9d2e4b7"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()
    if "live_chat_messages" in tables:
        op.drop_table("live_chat_messages")
    if "live_chat_sessions" in tables:
        op.drop_table("live_chat_sessions")


def downgrade():
    pass
