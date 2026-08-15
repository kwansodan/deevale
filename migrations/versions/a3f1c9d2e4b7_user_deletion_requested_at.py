"""user account deletion request flag

Revision ID: a3f1c9d2e4b7
Revises: f1a2b3c4d5e6
Create Date: 2026-08-15 10:00:00.000000

Adds users.deletion_requested_at: set when a customer requests account closure
from the account section. A flag, not a delete -- staff act on it out of band.
"""
import sqlalchemy as sa
from alembic import op

revision = 'a3f1c9d2e4b7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column('deletion_requested_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column('users', 'deletion_requested_at')
