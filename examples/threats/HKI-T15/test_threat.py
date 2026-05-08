from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

import pytest

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t15_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_tool_obeys_llm_scope() -> None:
    pre: ModuleType = _load("pre_hki")
    env = {"active_domain": "iris", "authorized_domains": ["iris"]}
    assert pre.search_tool_buggy("q", domain="pulse", envelope=env) == "pulse-secret"


def test_post_hki_tool_rejects_conflicting_scope() -> None:
    post: ModuleType = _load("post_hki")
    env = post._envelope("iris")
    with pytest.raises(post.ScopeOverrideDenied):
        post.search_tool_safe("q", domain="pulse", envelope=env)


def test_post_hki_tool_uses_envelope_when_no_override() -> None:
    post: ModuleType = _load("post_hki")
    env = post._envelope("iris")
    assert post.search_tool_safe("q", domain=None, envelope=env) == "iris-public"
