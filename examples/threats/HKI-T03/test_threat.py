"""Asserts the leak and block for HKI-T03."""
from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

import pytest


HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t03_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_leaks() -> None:
    pre: ModuleType = _load("pre_hki")
    leaked = pre.query_buggy({})
    assert "iris-1" in leaked and "pulse-1" in leaked


def test_post_hki_blocks() -> None:
    post: ModuleType = _load("post_hki")
    with pytest.raises(post.MissingDomainError):
        post.query_safe({})
    with pytest.raises(post.MissingDomainError):
        post.query_safe({"active_domain": "global"})
    with pytest.raises(post.MissingDomainError):
        post.query_safe({"active_domain": "*"})
