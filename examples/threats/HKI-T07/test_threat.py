from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

import pytest

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t07_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_delegation_leaks() -> None:
    pre: ModuleType = _load("pre_hki")
    docs = pre.agent_a_delegate_buggy("x", "iris")
    assert "pulse-confidential" in docs


def test_post_hki_delegation_preserves_domain() -> None:
    post: ModuleType = _load("post_hki")
    docs = post.agent_a_delegate_safe("x", post._envelope("iris"))
    assert docs == ["iris-confidential"]
    with pytest.raises(post.DelegationError):
        post.agent_b_safe("x", {})
