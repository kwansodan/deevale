"""platform settings

Revision ID: f1a2b3c4d5e6
Revises: c7a1e2b3d4f5
Create Date: 2026-08-12 15:00:00.000000

Adds the platform_settings key/JSON override table backing runtime-editable
referral reward amounts and public landing-page figures. Empty table == today's
env-only behaviour, so no data migration is needed.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'f1a2b3c4d5e6'
down_revision = 'c7a1e2b3d4f5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'platform_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key', name='uq_platform_settings_key'),
    )
    op.create_index('ix_platform_settings_key', 'platform_settings', ['key'], unique=False)


def downgrade():
    op.drop_index('ix_platform_settings_key', table_name='platform_settings')
    op.drop_table('platform_settings')
