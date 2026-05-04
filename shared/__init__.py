from __future__ import annotations

import pathlib
import pkgutil
from typing import MutableSequence

__path__: MutableSequence[str] = pkgutil.extend_path(__path__, __name__)

_package_root: pathlib.Path = pathlib.Path(__file__).resolve().parent
_inner_package_root: pathlib.Path = _package_root / "shared"

if _inner_package_root.is_dir():
    __path__.append(str(_inner_package_root))
