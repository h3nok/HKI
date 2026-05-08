from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

import pytest

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t06_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_allows_unbound_tools() -> None:
    pre: ModuleType = _load("pre_hki")
    assert pre.can_invoke_buggy("global.search", "iris")
    assert pre.can_invoke_buggy("shared.lookup", "iris")


def test_post_hki_rejects_unbound_tools() -> None:
    post: ModuleType = _load("post_hki")
    env = post._envelope("iris")
    assert post.can_invoke_safe("search.iris", env)
    with pytest.raises(post.ToolDenied):
        post.can_invoke_safe("global.search", env)
    with pytest.raises(post.ToolDenied):
        post.can_invoke_safe("shared.lookup", env)
