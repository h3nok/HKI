"""Asserts both the leak (pre) and the block (post) for HKI-T01."""
from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys


HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t01_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_leaks() -> None:
    pre: ModuleType = _load("pre_hki")
    pre.CACHE.clear()
    a = pre.respond_buggy("q", "iris")
    b = pre.respond_buggy("q", "pulse")
    assert a == b, "pre-HKI must reproduce the cross-domain leak"


def test_post_hki_blocks() -> None:
    post: ModuleType = _load("post_hki")
    post.CACHE.clear()
    a = post.respond_safe("q", "iris")
    b = post.respond_safe("q", "pulse")
    assert a != b, "post-HKI must segregate domains in cache"
