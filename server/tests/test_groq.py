"""Provider contract tests: HTTP is mocked; no external services are used."""
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from pydantic import BaseModel

from app.config import settings
from app.services import gemini
from app.services.gemini import embed as real_embed, generate_json as real_generate
from scripts.check_connections import _ai_failure


class Answer(BaseModel):
    answer: str


@pytest.fixture
def groq_request(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "private-test-sentinel")
    monkeypatch.setattr(gemini.time, "sleep", lambda _: None)
    post = Mock()
    monkeypatch.setattr(httpx, "post", post)
    monkeypatch.setattr(gemini, "_get_client", Mock(side_effect=AssertionError("Gemini generation must not be called")))
    return post


def response(content='{"answer":"pong"}', finish="stop", status=200):
    return httpx.Response(status, request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
                          json={"choices": [{"finish_reason": finish, "message": {"content": content}}]})


def test_groq_generates_validated_json_without_gemini(groq_request):
    groq_request.return_value = response()
    assert real_generate("Return pong", Answer).answer == "pong"
    request = groq_request.call_args
    assert request.args[0] == "https://api.groq.com/openai/v1/chat/completions"
    assert request.kwargs["headers"]["Authorization"] == "Bearer private-test-sentinel"
    body = request.kwargs["json"]
    assert body["model"] == settings.GROQ_MODEL
    assert body["response_format"]["json_schema"]["schema"] == Answer.model_json_schema()
    assert body["messages"][0]["content"] == "Return pong"


@pytest.mark.parametrize("content,finish", [('not json', 'stop'), ('{"wrong":true}', 'stop'), ('{"answer":"pong"}', 'length')])
def test_invalid_or_truncated_output_is_rejected(groq_request, content, finish):
    groq_request.return_value = response(content, finish)
    with pytest.raises(gemini.AIError):
        real_generate("Return pong", Answer)


def test_groq_auth_failure_is_not_retried_or_leaked(groq_request, capsys):
    groq_request.return_value = response(status=401)
    with pytest.raises(gemini.AIError) as caught:
        real_generate("Return pong", Answer)
    assert groq_request.call_count == 1
    assert isinstance(caught.value.__cause__, httpx.HTTPStatusError)
    _ai_failure("generation", caught.value, "Groq")
    output = capsys.readouterr().out
    assert "Groq generation failed (HTTP 401)" in output
    assert "private-test-sentinel" not in output + str(caught.value)


def test_missing_groq_key_never_uses_gemini(groq_request, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    with pytest.raises(gemini.AIError, match="GROQ_API_KEY"):
        real_generate("Return pong", Answer)
    groq_request.assert_not_called()


def test_groq_selection_preserves_gemini_embedding_contract(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    embed_call = Mock(return_value=SimpleNamespace(embeddings=[SimpleNamespace(values=[1.0] + [0.0] * 767)]))
    monkeypatch.setattr(gemini, "_get_client", lambda: SimpleNamespace(models=SimpleNamespace(embed_content=embed_call)))
    monkeypatch.setattr(gemini, "_embed_cache", {})
    vector = real_embed(["Python developer"])[0]
    assert len(vector) == 768
    assert vector[0] == 1.0
    assert embed_call.call_args.kwargs["model"] == settings.GEMINI_EMBED_MODEL
    assert embed_call.call_args.kwargs["config"].output_dimensionality == 768


def test_groq_request_sets_output_budget_and_low_reasoning(groq_request):
    groq_request.return_value = response()
    real_generate("Return pong", Answer)
    body = groq_request.call_args.kwargs["json"]
    assert body["max_completion_tokens"] >= 4096
    if settings.GROQ_MODEL.startswith("openai/gpt-oss"):
        assert body["reasoning_effort"] == "low"


def test_groq_rate_limit_waits_and_retries(groq_request):
    limited = httpx.Response(429, headers={"retry-after": "2"}, json={"error": {"message": "TPM"}},
                             request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"))
    groq_request.side_effect = [limited, response()]
    assert real_generate("Return pong", Answer).answer == "pong"
    assert groq_request.call_count == 2


def test_truncated_output_explains_cause_and_is_not_retried(groq_request):
    groq_request.return_value = response('{"answer":', "length")
    with pytest.raises(gemini.AIError, match="cut off"):
        real_generate("Return pong", Answer)
    assert groq_request.call_count == 1
