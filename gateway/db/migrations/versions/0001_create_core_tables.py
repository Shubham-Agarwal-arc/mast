"""Create the core persistence tables.

Revision ID: 0001_core_tables
Revises:
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_core_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("auth_provider", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("plan_tier", sa.String(length=32), server_default="free", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("auth_provider", "external_id", name="uq_users_auth_provider_external_id"),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("device_metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_sessions_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
    )
    op.create_index("ix_sessions_user_started_at", "sessions", ["user_id", "started_at"])
    op.create_table(
        "interactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("error_category", sa.String(length=64), nullable=False),
        sa.Column("kc_ids", sa.JSON(), nullable=False),
        sa.Column("resolved", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("hint_depth", sa.Integer(), server_default="0", nullable=False),
        sa.Column("constitutional_triggered", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("latency_ms", sa.Float(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["sessions.id"], name="fk_interactions_session_id_sessions", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_interactions"),
    )
    op.create_index("ix_interactions_session_created_at", "interactions", ["session_id", "created_at"])
    op.create_table(
        "mastery_states",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kc_id", sa.String(length=64), nullable=False),
        sa.Column("mastery_probability", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_mastery_states_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_mastery_states"),
        sa.UniqueConstraint("user_id", "kc_id", name="uq_mastery_states_user_id_kc_id"),
    )
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("tier", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("renews_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_ref", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_subscriptions_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_subscriptions"),
        sa.UniqueConstraint("provider_ref", name="uq_subscriptions_provider_ref"),
        sa.UniqueConstraint("user_id", name="uq_subscriptions_user_id"),
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_table("mastery_states")
    op.drop_index("ix_interactions_session_created_at", table_name="interactions")
    op.drop_table("interactions")
    op.drop_index("ix_sessions_user_started_at", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("users")