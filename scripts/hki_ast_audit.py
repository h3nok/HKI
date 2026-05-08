#!/usr/bin/env python3
"""
HKI AST audit (M6) — libcst-based precision pass.

Augments ``scripts/audit-hki-conformance.mjs`` (regex) with an AST-aware
classifier for Python files in the scan roots.

For each Python module under the scan roots, this script:

  1. Parses with libcst.
  2. Walks each function definition.
  3. Detects parameter accesses to scope-like fields
     (``stream_id``, ``active_domain``, ``activeDomain``, ``streamId``)
     on identifiers commonly used for request bodies
     (``body``, ``payload``, ``input``, ``inputs``, ``args``, ``kwargs``).
  4. Looks at the surrounding function for HKI guards:
       - ``reject_conflicting_scope_argument(...)`` call
       - ``validate_envelope(...)`` call
       - ``HkiMiddleware`` import in module
  5. Looks at the function's decorators / file path to classify route surface:
       - ``/internal/...`` route prefix or ``internal_routes.py`` path -> S2S
       - ``mcp_server.py`` -> MCP tool
       - everything else -> public route

Outputs a JSON report:

  {
    "total": N,
    "blocking": [...findings without a guard on a public route...],
    "advisory": [...findings on internal/MCP routes or with guards...],
  }

A finding is "blocking" iff:
  - route surface == "public"
  - AND no HKI guard appears in the same function

Exit code 1 if any blocking finding exists. Advisory findings never fail.

Run:

  uv run --with libcst python scripts/hki_ast_audit.py
  uv run --with libcst python scripts/hki_ast_audit.py --json > findings.json
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import dataclasses
import typing

try:
    import libcst as cst
    import libcst.matchers as m
except ImportError:
    print("libcst is required. Re-run with: uv run --with libcst python scripts/hki_ast_audit.py", file=sys.stderr)
    sys.exit(2)


REPO: pathlib.Path = pathlib.Path(__file__).resolve().parent.parent

SCAN_ROOTS: list[str] = [
    "services/knowledge-api/src",
    "services/ingestion-pipeline-service/src",
    "services/orchestrator-service/src",
    "shared",
    "agentic/server",
]

SCOPE_FIELDS: set[str] = {"stream_id", "streamId", "active_domain", "activeDomain"}
BODY_NAMES: set[str] = {"body", "payload", "input", "inputs", "args", "kwargs"}
HKI_GUARDS: set[str] = {
    "reject_conflicting_scope_argument",
    "validate_envelope",
    "assert_artifact_visible",
    # Project-specific resolvers that compare the body value against the
    # signed identity before returning the canonical stream/domain. Treated
    # as guards by the AST audit.
    "_resolve_stream_id",
    "resolve_stream_id",
    "_resolve_active_domain",
    "resolve_active_domain",
}

INTERNAL_PATH_MARKERS = ("internal_routes.py", "/internal/", "mcp_server.py")


@dataclasses.dataclass
class Finding:
    file: str
    line: int
    function: str
    expression: str
    surface: str  # "public" | "internal" | "mcp"
    has_guard: bool
    decorators: list[str] = dataclasses.field(default_factory=list)

    @property
    def blocking(self) -> bool:
        return self.surface == "public" and not self.has_guard


def iter_py_files() -> typing.Iterable[pathlib.Path]:
    skip_parts: set[str] = {".venv", "venv", "site-packages", "__pycache__", "tests", "node_modules", "dist"}
    for root in SCAN_ROOTS:
        base: pathlib.Path = REPO / root
        if not base.exists():
            continue
        for path in base.rglob("*.py"):
            if any(part in skip_parts for part in path.parts):
                continue
            yield path


def classify_surface(path: pathlib.Path, decorators: list[str]) -> str:
    sp = str(path)
    if "mcp_server.py" in sp:
        return "mcp"
    if "internal_routes.py" in sp or "/internal/" in sp:
        return "internal"
    for dec in decorators:
        if "/internal/" in dec or "internal_" in dec:
            return "internal"
    return "public"


class FunctionVisitor(cst.CSTVisitor):
    METADATA_DEPENDENCIES = ()

    def __init__(self, file: pathlib.Path, source: str) -> None:
        self.file: pathlib.Path = file
        self.source_lines: list[str] = source.splitlines()
        self.findings: list[Finding] = []
        self._stack: list[tuple[str, list[str], set[str]]] = []  # (name, decorators, guards_called)
        self._assign_targets: set[int] = set()  # id() of nodes that are LHS

    # --- function tracking --------------------------------------------------

    def visit_Assign(self, node: cst.Assign) -> None:
        for tgt in node.targets:
            self._mark_target(tgt.target)

    def visit_AugAssign(self, node: cst.AugAssign) -> None:
        self._mark_target(node.target)

    def visit_AnnAssign(self, node: cst.AnnAssign) -> None:
        self._mark_target(node.target)

    def _mark_target(self, node: cst.CSTNode) -> None:
        self._assign_targets.add(id(node))
        # Tuple unpacking
        if isinstance(node, (cst.Tuple, cst.List)):
            for elt in node.elements:
                self._mark_target(elt.value)

    # --- function tracking --------------------------------------------------

    def visit_FunctionDef(self, node: cst.FunctionDef) -> None:  # noqa: D401
        decorators: list[str] = [self._render_decorator(d) for d in node.decorators]
        self._stack.append((node.name.value, decorators, set()))
        # Pre-scan body for guard calls.
        for sub in self._iter_calls(node.body):
            name: str | None = self._call_name(sub)
            if name in HKI_GUARDS:
                self._stack[-1][2].add(name)

    def leave_FunctionDef(self, _node: cst.FunctionDef) -> None:
        self._stack.pop()

    # --- body access detection ---------------------------------------------

    def visit_Attribute(self, node: cst.Attribute) -> None:
        if not self._stack:
            return
        if id(node) in self._assign_targets:
            return
        if not isinstance(node.value, cst.Name):
            return
        if node.value.value not in BODY_NAMES:
            return
        if node.attr.value not in SCOPE_FIELDS:
            return
        self._record(node, expression=f"{node.value.value}.{node.attr.value}")

    def visit_Subscript(self, node: cst.Subscript) -> None:
        if not self._stack:
            return
        if id(node) in self._assign_targets:
            return
        if not isinstance(node.value, cst.Name):
            return
        if node.value.value not in BODY_NAMES:
            return
        # Look for body["stream_id"] etc.
        for sub in node.slice:
            element = sub.slice
            if isinstance(element, cst.Index):
                value = element.value
                if isinstance(value, cst.SimpleString):
                    raw = value.value.strip("'\"")
                    if raw in SCOPE_FIELDS:
                        self._record(node, expression=f'{node.value.value}["{raw}"]')

    # --- helpers ------------------------------------------------------------

    def _record(self, node: cst.CSTNode, *, expression: str) -> None:
        name, decorators, guards = self._stack[-1]
        line: int = self._approx_line(expression)
        self.findings.append(
            Finding(
                file=str(self.file.relative_to(REPO)),
                line=line,
                function=name,
                expression=expression,
                surface=classify_surface(self.file, decorators),
                has_guard=bool(guards),
                decorators=decorators,
            )
        )

    def _approx_line(self, expression: str) -> int:
        # Cheap line lookup: find first remaining occurrence.
        # libcst doesn't give positions without metadata; this is good enough
        # for triage output.
        for idx, line in enumerate(self.source_lines, start=1):
            if expression in line:
                return idx
        return 0

    @staticmethod
    def _render_decorator(d: cst.Decorator) -> str:
        try:
            module = cst.Module(body=[])
            return module.code_for_node(d.decorator).strip()
        except Exception:
            return "?"

    @staticmethod
    def _call_name(node: cst.Call) -> str | None:
        func = node.func
        if isinstance(func, cst.Name):
            return func.value
        if isinstance(func, cst.Attribute):
            return func.attr.value
        return None

    @classmethod
    def _iter_calls(cls, node: cst.CSTNode) -> typing.Iterable[cst.Call]:
        for child in m.findall(node, m.Call()):
            yield child  # type: ignore[misc]


def scan_file(path: pathlib.Path) -> list[Finding]:
    try:
        source: str = path.read_text()
        module = cst.parse_module(source)
    except Exception as exc:  # parse error -> skip
        return [
            Finding(
                file=str(path.relative_to(REPO)),
                line=0,
                function="<parse-error>",
                expression=str(exc)[:120],
                surface="public",
                has_guard=False,
            )
        ]
    visitor = FunctionVisitor(path, source)
    module.visit(visitor)
    return visitor.findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="emit JSON only")
    parser.add_argument(
        "--strict-internal",
        action="store_true",
        help="treat internal/mcp findings without a guard as blocking too",
    )
    args: argparse.Namespace = parser.parse_args()

    all_findings: list[Finding] = []
    for path in iter_py_files():
        all_findings.extend(scan_file(path))

    if args.strict_internal:
        for f in all_findings:
            if not f.has_guard and f.surface in {"internal", "mcp"}:
                f.surface = "public"  # promote to blocking

    blocking: list[Finding] = [f for f in all_findings if f.blocking]
    advisory: list[Finding] = [f for f in all_findings if not f.blocking]

    report = {
        "total": len(all_findings),
        "blocking_count": len(blocking),
        "advisory_count": len(advisory),
        "blocking": [dataclasses.asdict(f) for f in blocking],
        "advisory": [dataclasses.asdict(f) for f in advisory],
    }

    if args.json:
        json.dump(report, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print(f"HKI AST audit: total={report['total']} blocking={report['blocking_count']} advisory={report['advisory_count']}")
        if blocking:
            print("\nBLOCKING:")
            for f in blocking:
                print(f"  {f.file}:{f.line} {f.function} -> {f.expression}")
        else:
            print("No blocking AST findings.")
        if advisory:
            print(f"\nADVISORY ({len(advisory)}) — internal/MCP or guarded routes:")
            counts: dict[str, int] = {}
            for f in advisory:
                counts[f.surface] = counts.get(f.surface, 0) + 1
            for surface, n in sorted(counts.items()):
                print(f"  {surface}: {n}")

    return 1 if blocking else 0


if __name__ == "__main__":
    sys.exit(main())
