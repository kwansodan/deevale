"""live chat and visitor presence

Revision ID: b4e2d6c8f1a0
Revises: a3f1c9d2e4b7
Create Date: 2026-08-17 11:30:00.000000

Adds live_chat_sessions and live_chat_messages tables to back real-time
visitor presence tracking on public pages and live chat between visitors and staff.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'b4e2d6c8f1a0'
down_revision = 'a3f1c9d2e4b7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'live_chat_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('visitor_id', sa.String(length=64), nullable=False),
        sa.Column('visitor_name', sa.String(length=255), nullable=True),
        sa.Column('visitor_email', sa.String(length=255), nullable=True),
        sa.Column('visitor_phone', sa.String(length=32), nullable=True),
        sa.Column('current_page', sa.String(length=255), nullable=False, server_default='/'),
        sa.Column('referrer', sa.String(length=512), nullable=True),
        sa.Column('user_agent', sa.String(length=256), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
        sa.Column('is_online', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('assigned_officer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assigned_officer_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_live_chat_sessions_visitor_id', 'live_chat_sessions', ['visitor_id'], unique=False)
    op.create_index('ix_live_chat_sessions_is_online', 'live_chat_sessions', ['is_online'], unique=False)
    op.create_index('ix_live_chat_sessions_status', 'live_chat_sessions', ['status'], unique=False)

    op.create_table(
        'live_chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_type', sa.String(length=16), nullable=False),
        sa.Column('sender_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sender_name', sa.String(length=255), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['live_chat_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_live_chat_messages_session_id', 'live_chat_messages', ['session_id'], unique=False)


def downgrade():
    op.drop_index('ix_live_chat_messages_session_id', table_name='live_chat_messages')
    op.drop_table('live_chat_messages')
    op.drop_index('ix_live_chat_sessions_status', table_name='live_chat_sessions')
    op.drop_index('ix_live_chat_sessions_is_online', table_name='live_chat_sessions')
    op.drop_index('ix_live_chat_sessions_visitor_id', table_name='live_chat_sessions')
    op.drop_table('live_chat_sessions')
