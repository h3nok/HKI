from __future__ import annotations

from importlib.machinery import ModuleSpec
import importlib.util
import pathlib
import sys
import time

import pytest

HERE: pathlib.Path = pathlib.Path(__file__).parent


def _load(name: str) -> ModuleType:
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(f"hki_t12_{name}", HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module: ModuleType = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pre_hki_accepts_expired() -> None:
    pre: ModuleType = _load("pre_hki")
    env = {"signature": "sig", "expires_at": int(time.time()) - 1}
    assert pre.accept_buggy(env) is True


def test_post_hki_rejects_expired() -> None:
    post: ModuleType = _load("post_hki")
    expired = post._envelope(int(time.time()) - 3600)
    with pytest.raises(ValueError):
        post.accept_safe(expired)


def test_post_hki_accepts_valid() -> None:
    post: ModuleType = _load("post_hki")
    valid = post._envelope(int(time.time()) + 3600)
    assert post.accept_safe(valid) is True
