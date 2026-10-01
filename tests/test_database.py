import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from gateway.db.base import Base
from gateway.db.models import Interaction, MasteryState, Session, Subscription, User


REPO_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_TABLES = {"users", "sessions", "interactions", "mastery_states", "subscriptions"}


def _assert_prd_columns(engine) -> None:
    inspector = inspect(engine)
    assert EXPECTED_TABLES <= set(inspector.get_table_names())
    assert {"id", "auth_provider", "external_id", "plan_tier", "created_at"} <= {
        column["name"] for column in inspector.get_columns("users")
    }
    assert {"id", "user_id", "started_at", "device_metadata"} <= {
        column["name"] for column in inspector.get_columns("sessions")
    }
    assert {
        "id", "session_id", "error_category", "kc_ids", "resolved", "hint_depth",
        "classification_confidence", "mastery_delta", "predicted_hints_needed",
        "constitutional_triggered", "regeneration_attempts", "regeneration_succeeded",
        "final_response_verified", "latency_ms", "latency_breakdown", "quota_outcome", "created_at",
    } <= {column["name"] for column in inspector.get_columns("interactions")}
    assert {"id", "user_id", "kc_id", "mastery_probability", "updated_at"} <= {
        column["name"] for column in inspector.get_columns("mastery_states")
    }
    assert {"id", "user_id", "tier", "status", "renews_at", "provider_ref"} <= {
        column["name"] for column in inspector.get_columns("subscriptions")
    }


def test_models_import_and_register_expected_tables() -> None:
    assert EXPECTED_TABLES <= set(Base.metadata.tables)
    assert all((User, Session, Interaction, MasteryState, Subscription))


def test_fresh_alembic_migration_creates_prd_schema(tmp_path: Path) -> None:
    database_path = tmp_path / "fresh.sqlite"
    config = Config(str(REPO_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path.as_posix()}")

    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    try:
        _assert_prd_columns(engine)
    finally:
        engine.dispose()


@pytest.mark.skipif(
    not os.getenv("MAST_TEST_DATABASE_URL"),
    reason="Set MAST_TEST_DATABASE_URL to a PostgreSQL admin URL to run the fresh-Postgres migration test.",
)
def test_fresh_postgres_database_migration() -> None:
    admin_url = make_url(os.environ["MAST_TEST_DATABASE_URL"])
    test_database = f"mast_test_{uuid4().hex}"
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    test_engine = None
    try:
        with admin_engine.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{test_database}"'))

        test_url = admin_url.set(database=test_database)
        config = Config(str(REPO_ROOT / "alembic.ini"))
        config.set_main_option("sqlalchemy.url", test_url.render_as_string(hide_password=False).replace("%", "%%"))
        command.upgrade(config, "head")

        test_engine = create_engine(test_url)
        _assert_prd_columns(test_engine)
    finally:
        if test_engine is not None:
            test_engine.dispose()
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}" WITH (FORCE)'))
        admin_engine.dispose()