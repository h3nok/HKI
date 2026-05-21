#!/usr/bin/env python3
"""
Repair HKI Python files mangled by an aggressive on-save formatter.

The formatter on this workspace produces invalid-syntax patterns:

    1. Duplicated exception type after an exception handler colon.

  2. Bogus annotation on for-loop / comprehension targets:
       for x in iter:
       [v for v in iter]

    3. Duplicated context manager target type after an `as` target.

    4. Bogus annotations on assignments to module globals inside functions.

This script reverses these patterns. Run after the formatter strikes:

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
    "packages/hki-runtime-py/tests",
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

# Match `with <expr> as <name>: <trailing-type-expr>:` and drop the trailing
# duplicate that the formatter inserted after the legitimate context-manager
# colon.
RE_WITH: re.Pattern[str] = re.compile(
    r"(with\s+.+?\s+as\s+[A-Za-z_]\w*\s*:)[ \t]+[^\n:]+:[ \t]*(?=\n)"
)

# Match parenthesized context manager call items that annotate the target before
# the comma. Anchor to call-shaped lines so ordinary strings like
# "such as department:manager" are left alone.
RE_WITH_ITEM: re.Pattern[str] = re.compile(
    r"(^[ \t]*(?:async[ \t]+)?(?:with[ \t]+)?[^\n#]*\)\s+as\s+[A-Za-z_]\w*)[ \t]*:[ \t]*[^,\n]+(?=,)",
    re.MULTILINE,
)

# Match `for <name>: <type> in ` (loop or comprehension) and drop the
# annotation. The annotation may contain dots, brackets, commas, pipes,
# strings, spaces, etc.; `in` is required to be a standalone keyword.
RE_FOR: re.Pattern[str] = re.compile(r"(\bfor\s+[A-Za-z_]\w*)\s*:\s*[^\n]+?(?=\s+in\s)")

# Match indented assignments to known module-global state names that Python
# rejects when the name is declared `global` in the same function.
RE_GLOBAL_STATE_ASSIGN: re.Pattern[str] = re.compile(
    r"(^[ \t]+_(?:embedding_client|vector_store|chunker|graph|entity_extractor|taxonomy_store|llm_judge|using_local_embedder)\s*):\s*[^=\n]+(\s*=\s*)",
    re.MULTILINE,
)


def fix_file(path: pathlib.Path) -> bool:
    text: str = path.read_text()
    fixed: str = RE_FOR.sub(
        r"\1",
        RE_GLOBAL_STATE_ASSIGN.sub(
            r"\1\2",
            RE_WITH_ITEM.sub(r"\1", RE_WITH.sub(r"\1", RE_EXCEPT.sub(r"\1", text))),
        ),
    )
    if fixed != text:
        path.write_text(fixed)
        return True
    return False


def main() -> int:
    repo: pathlib.Path = pathlib.Path(__file__).resolve().parent.parent
    fixed = 0
    paths: list[pathlib.Path] = []
    root_index = 0
    while root_index < len(ROOTS):
        paths.extend((repo / ROOTS[root_index]).rglob("*.py"))
        root_index += 1

    path_index = 0
    while path_index < len(paths):
        path = paths[path_index]
        path_index += 1
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
