#!/usr/bin/env python3
"""
Generate a document-backed golden evaluation suite.

Creates one or more eval cases per markdown document with:
- query
- expected_answer (deterministic extract from source doc)
- source_documents (traceability)

Usage:
  python3 generate_golden_suite.py
  python3 generate_golden_suite.py --docs-dir . --output evaluation-suite.generated.json
"""

from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import re
import typing

_DOC_EXCLUDE: set[str] = {
    "TESTING_GUIDE.md",
    "UI_NAVIGATION_GUIDE.md",
}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _clean_markdown(text: str) -> str:
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    text = re.sub(r"^[#>*\-\d.\s]+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _title_from_markdown(path: pathlib.Path, raw: str) -> str:
    for line in raw.splitlines():
        line: str = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip()
    return path.stem.replace("-", " ").replace("_", " ").strip().title()


def _expected_answer(raw: str, max_chars: int = 420) -> str:
    cleaned: str = _clean_markdown(raw)
    if not cleaned:
        return ""

    sentences: list[str | Any] = re.split(r"(?<=[.!?])\s+", cleaned)
    picked: list[str] = []
    size = 0
    for sentence in sentences:
        s: str | typing.Any = sentence.strip()
        if not s:
            continue
        if size + len(s) + 1 > max_chars and picked:
            break
        picked.append(s)
        size += len(s) + 1
        if len(picked) >= 3:
            break

    return " ".join(picked).strip()


def _query_from_title(title: str) -> str:
    return f"What does the {title} document say?"


def _load_documents(docs_dir: pathlib.Path) -> list[pathlib.Path]:
    docs: list[Path] = sorted(p for p in docs_dir.glob("*.md") if p.name not in _DOC_EXCLUDE)
    return [p for p in docs if p.is_file()]


def build_suite(docs_dir: pathlib.Path, suite_name: str) -> dict[str, typing.Any]:
    cases: list[dict[str, typing.Any]] = []

    for doc_path in _load_documents(docs_dir):
        raw: str = doc_path.read_text(encoding="utf-8")
        title: str = _title_from_markdown(doc_path, raw)
        expected: str = _expected_answer(raw)
        if not expected:
            continue

        cases.append(
            {
                "id": _slug(doc_path.stem),
                "query": _query_from_title(title),
                "expected_answer": expected,
                "source_documents": [doc_path.name],
                "notes": "Auto-generated from source document",
            }
        )

    today: str = datetime.date.today().isoformat()
    return {
        "suite_name": suite_name,
        "description": "Document-backed golden suite (auto-generated)",
        "version": "1.0.0",
        "created": today,
        "cases": cases,
        "metadata": {
            "total_cases": len(cases),
            "source": str(docs_dir),
            "generation": "deterministic-extractive",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate document-backed golden eval suite")
    parser.add_argument(
        "--docs-dir",
        type=pathlib.Path,
        default=pathlib.Path("."),
        help="Directory containing markdown source documents",
    )
    parser.add_argument(
        "--output",
        type=pathlib.Path,
        default=pathlib.Path("evaluation-suite.generated.json"),
        help="Output JSON suite path",
    )
    parser.add_argument(
        "--suite-name",
        default="knowledge-base-golden-doc-suite",
        help="Suite name",
    )

    args: argparse.Namespace = parser.parse_args()

    if not args.docs_dir.exists() or not args.docs_dir.is_dir():
        print(f"Docs directory does not exist: {args.docs_dir}")
        return 1

    suite: dict[str, Any] = build_suite(args.docs_dir, args.suite_name)
    args.output.write_text(json.dumps(suite, indent=2), encoding="utf-8")

    print(f"Generated {len(suite['cases'])} cases")
    print(f"Output: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
