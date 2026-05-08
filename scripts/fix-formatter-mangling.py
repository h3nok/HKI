#!/usr/bin/env python3
"""
Repair HKI Python files mangled by an aggressive on-save formatter.

The formatter on this workspace produces two invalid-syntax patterns:

  1. Duplicated exception type after `as`:
       except SomeError as err:
       except (A, B) as exc:

  2. Bogus annotation on for-loop / comprehension targets:
       for x in iter:
       [v for v in iter]

This script reverses both. Run after the formatter strikes:

  python3 scripts/fix-formatter-mangling.py

It only touches first-party source roots and never the `.venv` /
`site-packages` copies.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOTS: list[str] = [
    "examples/threats",
    "packages/hki-runtime-py/hki_runtime",
    "packages/hki-langchain/hki_langchain",
    "packages/hki-langchain/tests",
    "packages/hki-litellm/hki_litellm",
    "packages/hki-litellm/tests",
    "packages/hki-llamaindex/hki_llamaindex",
    "packages/hki-llamaindex/tests",
    "packages/hki-adk/hki_adk",
    "packages/hki-adk/tests",
    "packages/hki-autogen/hki_autogen",
    "packages/hki-autogen/tests",
    "packages/hki-crewai/hki_crewai",
    "packages/hki-crewai/tests",
    "packages/hki-integration-tests/tests",
    "services",
    "scripts",
]

# Match `except <expr> as <name>: <trailing-type-expr>:` and drop the trailing
# duplicate that the formatter inserted. The `<expr>` may contain parens, dots,
# commas, and union pipes; we anchor on `as <name>:` to find the legitimate
# colon, then strip everything between it and the next newline if there is a
# trailing duplicate ending in `:`.
RE_EXCEPT: re.Pattern[str] = re.compile(
    r"(except\s+.+?\s+as\s+[A-Za-z_]\w*\s*:)[ \t]+[^\n:]+:[ \t]*(?=\n)"
)

# Match `for <name>: <type> in ` (loop or comprehension) and drop the
# annotation. The annotation may contain dots, brackets, commas, pipes,
# strings, spaces, etc.; `in` is required to be a standalone keyword.
RE_FOR: re.Pattern[str] = re.compile(r"(\bfor\s+[A-Za-z_]\w*)\s*:\s*[^\n]+?(?=\s+in\s)")


def fix_file(path: pathlib.Path) -> bool:
    text: str = path.read_text()
    fixed: str = RE_FOR.sub(r"\1", RE_EXCEPT.sub(r"\1", text))
    if fixed != text:
        path.write_text(fixed)
        return True
    return False


def main() -> int:
    repo: pathlib.Path = pathlib.Path(__file__).resolve().parent.parent
    fixed = 0
    for root: str in ROOTS:
        for path: pathlib.Path in (repo / root).rglob("*.py"):
            sp = str(path)
            if "/.venv/" in sp or "/site-packages/" in sp:
                continue
            if fix_file(path):
                fixed += 1
                print(f"fixed {path.relative_to(repo)}")
    print(f"total fixed: {fixed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
