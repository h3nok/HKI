from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys

import pytest

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t13_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_accepts_old_version() -> None:
    pre: ModuleType = _load("pre_hki")
    assert pre.accept_buggy({"hki_version": "0.9", "signature": "sig"})


def test_post_hki_rejects_old_version() -> None:
    post: ModuleType = _load("post_hki")
    with pytest.raises(ValueError):
        post.accept_safe(post._envelope("0.9"))


def test_post_hki_accepts_current_version() -> None:
    post: ModuleType = _load("post_hki")
    assert post.accept_safe(post._envelope(hki_runtime_version()))


def hki_runtime_version() -> str:
    import hki_runtime
    return hki_runtime.HKI_VERSION
