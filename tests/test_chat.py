import os
from types import SimpleNamespace

from fastapi.testclient import TestClient
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.runnables import RunnableLambda
from langchain_openai import ChatOpenAI

os.environ.setdefault("MAST_JWT_SECRET", "test-only-secret-with-at-least-32-bytes")

from gateway.app.auth import get_current_user
from gateway.app.chat import build_socratic_chain, get_socratic_chain
from gateway.app.config import Settings
from gateway.app.main import create_app


def make_client(*, authenticated: bool, chain=None, settings: Settings | None = None) -> TestClient:
    app = create_app(settings or Settings(jwt_secret="test-only-secret-with-at-least-32-bytes"))
    if authenticated:
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="test-user")
    if chain is not None:
        app.dependency_overrides[get_socratic_chain] = lambda: chain
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