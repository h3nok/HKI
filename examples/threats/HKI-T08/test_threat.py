from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t08_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_shares_embedding_across_domains() -> None:
    pre: ModuleType = _load("pre_hki")
    pre.CACHE.clear()
    a = pre.embed_buggy("hi", "ada-002", "iris")
    b = pre.embed_buggy("hi", "ada-002", "pulse")
    assert a == b


def test_post_hki_segregates_embedding_cache() -> None:
    post: ModuleType = _load("post_hki")
    post.CACHE.clear()
    a = post.embed_safe("hi", "ada-002", post._envelope("iris"))
    b = post.embed_safe("hi", "ada-002", post._envelope("pulse"))
    assert a != b
