"""Add idempotency storage for billing webhook events.

Revision ID: 0002_subscription_event_id
Revises: 0001_core_tables
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa


revision = "0002_subscription_event_id"
down_revision = "0001_core_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("subscriptions", recreate="auto") as batch_op:
        batch_op.add_column(sa.Column("last_event_id", sa.String(length=255), nullable=True))
        batch_op.create_unique_constraint("uq_subscriptions_last_event_id", ["last_event_id"])


def downgrade() -> None:
    with op.batch_alter_table("subscriptions", recreate="auto") as batch_op:
        batch_op.drop_constraint("uq_subscriptions_last_event_id", type_="unique")
        batch_op.drop_column("last_event_id")
