from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t14_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_traversal_leaks_cross_domain() -> None:
    pre: ModuleType = _load("pre_hki")
    found = pre.neighbors_buggy("n1", "iris")
    assert any(n["domain"] == "pulse" for n in found)


def test_post_hki_traversal_filters_each_edge() -> None:
    post: ModuleType = _load("post_hki")
    found = post.neighbors_safe("n1", "iris")
    assert all(n["domain"] == "iris" for n in found)
