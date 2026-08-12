"""task input schema and submitted data

Revision ID: c7a1e2b3d4f5
Revises: eed92dfef6e0
Create Date: 2026-08-12 12:00:00.000000

Adds config-driven data-entry to tasks: task_definitions.input_schema describes
the fields a client must fill, copied onto case_tasks.input_schema at case
creation, and case_tasks.submitted_data holds the answers.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'c7a1e2b3d4f5'
down_revision = 'eed92dfef6e0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'task_definitions',
        sa.Column('input_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        'case_tasks',
        sa.Column('input_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        'case_tasks',
        sa.Column('submitted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade():
    op.drop_column('case_tasks', 'submitted_data')
    op.drop_column('case_tasks', 'input_schema')
    op.drop_column('task_definitions', 'input_schema')
