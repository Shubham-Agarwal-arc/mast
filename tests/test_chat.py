import os
from types import SimpleNamespace

from fastapi.testclient import TestClient
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.runnables import RunnableLambda
from langchain_openai import ChatOpenAI

os.environ.setdefault("MAST_JWT_SECRET", "test-only-secret-with-at-least-32-bytes")

from gateway.app.auth import get_current_user
from gateway.app.chat import (
    build_constitutional_verifier,
    build_socratic_chain,
    get_constitutional_verifier,
    get_socratic_chain,
)
from gateway.app.config import Settings
from gateway.app.main import create_app
from gateway.app.quota import ChatQuotaCounter


def make_client(
    *, authenticated: bool, chain=None, verifier=None, settings: Settings | None = None
) -> TestClient:
    app = create_app(settings or Settings(jwt_secret="test-only-secret-with-at-least-32-bytes"))
    if authenticated:
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="test-user")
    if chain is not None:
        app.dependency_overrides[get_socratic_chain] = lambda: chain
    if verifier is None:
        verifier = RunnableLambda(lambda _values: "SOCRATIC")
    app.dependency_overrides[get_constitutional_verifier] = lambda: verifier
    return TestClient(app)


def valid_chat_request() -> dict[str, object]:
    return {
        "message": "Can you help me understand this tensor error?",
        "error_text": "RuntimeError: size mismatch between tensor dimensions 8 and 16",
        "error_category": "shape_mismatch",
        "mastery_by_kc": {"KC_00": 0.42},
        "retrieved_context": ["A synthetic test context about aligning tensor dimensions."],
        "hint_depth": 1,
    }


def test_authenticated_chat_returns_socratic_generation_from_mocked_chain() -> None:
    fake_model = FakeListChatModel(
        responses=["What do the trailing dimensions tell you about how these tensors can align?"]
    )
    chain = build_socratic_chain(
        Settings(jwt_secret="test-only-secret-with-at-least-32-bytes"),
        model=fake_model,
    )
    with make_client(authenticated=True, chain=chain) as client:
        response = client.post("/v1/chat", json=valid_chat_request())

    assert response.status_code == 200
    assert response.json() == {
        "response": "What do the trailing dimensions tell you about how these tensors can align?"
    }


def test_direct_answer_is_regenerated_and_verified_before_return() -> None:
    generated: list[dict[str, object]] = []
    verdicts = iter(["DIRECT", "SOCRATIC"])

    def generate(values: dict[str, object]) -> str:
        generated.append(values)
        return "The direct draft" if len(generated) == 1 else "Which dimensions can align?"

    verifier = RunnableLambda(lambda _values: next(verdicts))
    with make_client(
        authenticated=True,
        chain=RunnableLambda(generate),
        verifier=verifier,
    ) as client:
        response = client.post("/v1/chat", json=valid_chat_request())

    assert response.status_code == 200
    assert response.json() == {"response": "Which dimensions can align?"}
    assert len(generated) == 2
    assert generated[0]["regeneration_guidance"] == ""
    assert "classified as a direct answer" in str(generated[1]["regeneration_guidance"])


def test_socratic_candidate_is_returned_without_regeneration() -> None:
    generated: list[dict[str, object]] = []
    chain = RunnableLambda(lambda values: generated.append(values) or "What do the dimensions imply?")
    verifier = RunnableLambda(lambda _values: "SOCRATIC")

    with make_client(authenticated=True, chain=chain, verifier=verifier) as client:
        response = client.post("/v1/chat", json=valid_chat_request())

    assert response.status_code == 200
    assert response.json() == {"response": "What do the dimensions imply?"}
    assert len(generated) == 1


def test_two_regeneration_cap_rejects_response_if_every_candidate_is_direct() -> None:
    generated: list[dict[str, object]] = []
    verified: list[dict[str, object]] = []
    chain = RunnableLambda(
        lambda values: generated.append(values) or f"Direct candidate {len(generated)}"
    )
    verifier = RunnableLambda(lambda values: verified.append(values) or "DIRECT")

    with make_client(authenticated=True, chain=chain, verifier=verifier) as client:
        response = client.post("/v1/chat", json=valid_chat_request())

    assert response.status_code == 502
    assert response.json() == {"detail": "Socratic response could not be verified"}
    assert len(generated) == len(verified) == 3
    assert "Direct candidate" not in response.text


def test_constitutional_outcome_log_contains_only_safe_metadata(caplog) -> None:
    sensitive_input = "private learner content sentinel"
    sensitive_candidate = "private direct response sentinel"
    payload = valid_chat_request()
    payload["message"] = sensitive_input
    verdicts = iter(["DIRECT", "SOCRATIC"])
    chain = RunnableLambda(lambda _values: sensitive_candidate if next(verdicts) == "DIRECT" else "Which dimension?" )
    verifier = RunnableLambda(lambda values: "DIRECT" if values["candidate_response"] == sensitive_candidate else "SOCRATIC")

    with make_client(
        authenticated=True,
        chain=chain,
        verifier=verifier,
    ) as client:
        with caplog.at_level("INFO", logger="mast.chat"):
            response = client.post("/v1/chat", json=payload)

    assert response.status_code == 200
    record = next(record for record in caplog.records if record.name == "mast.chat")
    assert record.getMessage() == "constitutional_check_complete"
    assert record.constitutional_triggered is True
    assert record.regeneration_attempts == 1
    assert record.regeneration_succeeded is True
    assert record.final_response_verified is True
    assert sensitive_input not in caplog.text
    assert sensitive_candidate not in caplog.text


def test_quota_counter_limits_per_user_and_resets_after_window() -> None:
    now = [100.0]
    counter = ChatQuotaCounter(window_seconds=60, clock=lambda: now[0])

    first = counter.consume("user-a", limit=1)
    blocked = counter.consume("user-a", limit=1)
    other_user = counter.consume("user-b", limit=1)
    now[0] += 60
    after_reset = counter.consume("user-a", limit=1)

    assert first.allowed and first.used == 1
    assert not blocked.allowed and blocked.used == 1 and blocked.retry_after_seconds == 60
    assert other_user.allowed and other_user.used == 1
    assert after_reset.allowed and after_reset.used == 1


def test_chat_quota_blocks_before_a_second_generation() -> None:
    generated: list[dict[str, object]] = []
    chain = RunnableLambda(lambda values: generated.append(values) or "What can you infer?")
    settings = Settings(
        jwt_secret="test-only-secret-with-at-least-32-bytes",
        chat_quota_limit=1,
        chat_quota_window_seconds=60,
    )
    with make_client(authenticated=True, chain=chain, settings=settings) as client:
        first = client.post("/v1/chat", json=valid_chat_request())
        second = client.post("/v1/chat", json=valid_chat_request())

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json() == {"detail": "Chat quota exceeded"}
    assert second.headers["retry-after"]
    assert len(generated) == 1


def test_verifier_prompt_chain_runs_against_a_mocked_model() -> None:
    verifier = build_constitutional_verifier(FakeListChatModel(responses=["SOCRATIC"]))

    result = verifier.invoke({"candidate_response": "Which dimension should align?"})

    assert result == "SOCRATIC"


def test_chat_requires_existing_gateway_jwt_authentication() -> None:
    with make_client(authenticated=False) as client:
        response = client.post("/v1/chat", json=valid_chat_request())

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_chat_rejects_provider_selection_and_oversized_context_from_client() -> None:
    with make_client(authenticated=True, chain=RunnableLambda(lambda _values: "question")) as client:
        provider_response = client.post("/v1/chat", json={**valid_chat_request(), "provider": "openai"})
        context_response = client.post(
            "/v1/chat",
            json={**valid_chat_request(), "retrieved_context": ["x" * 2_001]},
        )

    assert provider_response.status_code == 422
    assert context_response.status_code == 422


def test_provider_selection_uses_only_server_settings() -> None:
    from gateway.app.chat import create_chat_model

    anthropic = create_chat_model(
        Settings(
            jwt_secret="test-only-secret-with-at-least-32-bytes",
            llm_provider="anthropic",
            anthropic_api_key="test-anthropic-key-not-used-for-network",
            anthropic_model="test-anthropic-model",
        )
    )
    openai = create_chat_model(
        Settings(
            jwt_secret="test-only-secret-with-at-least-32-bytes",
            llm_provider="openai",
            openai_api_key="test-openai-key-not-used-for-network",
            openai_model="test-openai-model",
        )
    )

    assert isinstance(anthropic, ChatAnthropic)
    assert anthropic.model == "test-anthropic-model"
    assert isinstance(openai, ChatOpenAI)
    assert openai.model_name == "test-openai-model"


def test_provider_configuration_is_read_from_server_environment(monkeypatch) -> None:
    from gateway.app.chat import create_chat_model

    monkeypatch.setenv("MAST_JWT_SECRET", "test-only-secret-with-at-least-32-bytes")
    monkeypatch.setenv("MAST_LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "server-only-test-key")
    monkeypatch.setenv("MAST_OPENAI_MODEL", "server-configured-test-model")
    settings = Settings.from_env()

    model = create_chat_model(settings)

    assert settings.llm_provider == "openai"
    assert isinstance(model, ChatOpenAI)
    assert model.model_name == "server-configured-test-model"


def test_missing_server_provider_key_returns_safe_unavailable_error() -> None:
    with make_client(
        authenticated=True,
        settings=Settings(jwt_secret="test-only-secret-with-at-least-32-bytes", llm_provider="anthropic"),
    ) as client:
        response = client.post("/v1/chat", json=valid_chat_request())

    assert response.status_code == 503
    assert response.json() == {"detail": "The configured generation provider is unavailable"}


def test_provider_exception_does_not_leak_exception_details() -> None:
    secret_detail = "provider-secret-value-must-not-appear"

    def fail_generation(_values: dict[str, object]) -> str:
        raise RuntimeError(secret_detail)

    with make_client(authenticated=True, chain=RunnableLambda(fail_generation)) as client:
        response = client.post("/v1/chat", json=valid_chat_request())

    assert response.status_code == 502
    assert response.json() == {"detail": "Socratic generation failed"}
    assert secret_detail not in response.text