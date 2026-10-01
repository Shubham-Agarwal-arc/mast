"""Add safe interaction observability metadata.

Revision ID: 0003_interaction_observability
Revises: 0002_subscription_event_id
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa


revision = "0003_interaction_observability"
down_revision = "0002_subscription_event_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("interactions", recreate="auto") as batch_op:
        batch_op.alter_column("resolved", existing_type=sa.Boolean(), nullable=True)
        batch_op.add_column(sa.Column("classification_confidence", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("mastery_delta", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("predicted_hints_needed", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("regeneration_attempts", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("regeneration_succeeded", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("final_response_verified", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("latency_breakdown", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("quota_outcome", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.execute("UPDATE interactions SET resolved = false WHERE resolved IS NULL")
    with op.batch_alter_table("interactions", recreate="auto") as batch_op:
        batch_op.drop_column("quota_outcome")
        batch_op.drop_column("latency_breakdown")
        batch_op.drop_column("final_response_verified")
        batch_op.drop_column("regeneration_succeeded")
        batch_op.drop_column("regeneration_attempts")
        batch_op.drop_column("predicted_hints_needed")
        batch_op.drop_column("mastery_delta")
        batch_op.drop_column("classification_confidence")
        batch_op.alter_column("resolved", existing_type=sa.Boolean(), nullable=False, server_default=sa.false())