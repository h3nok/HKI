from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

import pytest

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t09_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_runtime_envelope_destroys_admin_resource() -> None:
    pre: ModuleType = _load("pre_hki")
    pre.INDEX.setdefault("iris", ["a"])
    pre.admin_delete_index_buggy({"purpose": "chat", "risk_tier": "read-only"}, "iris")
    assert "iris" not in pre.INDEX


def test_post_hki_blocks_runtime_envelope_at_admin_route() -> None:
    post: ModuleType = _load("post_hki")
    post.INDEX.setdefault("iris", ["a"])
    with pytest.raises(post.AdminDenied):
        post.admin_delete_index_safe({"purpose": "chat", "risk_tier": "read-only"}, "iris")
    assert "iris" in post.INDEX


def test_post_hki_allows_admin_envelope() -> None:
    post: ModuleType = _load("post_hki")
    post.INDEX.setdefault("iris", ["a"])
    post.admin_delete_index_safe({"purpose": "admin", "risk_tier": "admin"}, "iris")
    assert "iris" not in post.INDEX
