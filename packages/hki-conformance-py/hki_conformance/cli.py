"""hki-conformance CLI — run the 28-case suite against any Python adapter."""

from __future__ import annotations

import argparse
import importlib
import json
import sys

from .adapter import HkiRuntimeAdapter
from .runner import conformance_level, run_conformance
from .types import HkiConformanceAdapter


def _load_adapter(dotted_path: str) -> HkiConformanceAdapter:
    """Import and instantiate an adapter from a dotted module:Class path."""
    if ":" in dotted_path:
        module_path, class_name = dotted_path.rsplit(":", 1)
    elif "." in dotted_path:
        module_path, class_name = dotted_path.rsplit(".", 1)
    else:
        raise ValueError(
            f"Adapter path must be 'module.path:ClassName' or 'module.path.ClassName', got: {dotted_path!r}"
        )
    mod = importlib.import_module(module_path)
    cls = getattr(mod, class_name)
    return cls()


def _print_report(report: dict, *, verbose: bool) -> None:
    level = conformance_level(report)
    passed = report["passed"]
    totals = report["totals"]
    adapter = report["adapter"]

    print(f"\nHKI Conformance Report")
    print(f"  Adapter : {adapter['name']} {adapter.get('version') or ''}")
    print(f"  Level   : L{level}")
    print(f"  Result  : {'PASS' if passed else 'FAIL'}")
    print(
        f"  Totals  : {totals['passed']} passed, {totals['failed']} failed "
        f"({totals['must_failed']} must, {totals['should_failed']} should)"
    )
    print()

    if verbose or not passed:
        for result in report["results"]:
            status = "PASS" if result["passed"] else "FAIL"
            sev = result["severity"].upper()
            print(
                f"  {status}  [{result['id']}]  ({sev})  "
                f"expected={result['expected']}  actual={result['actual']}"
            )
        print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="hki-conformance",
        description="Run the HKI 28-case conformance suite against a Python adapter.",
    )
    parser.add_argument(
        "--adapter", "-a",
        default=None,
        help=(
            "Dotted path to the adapter class, e.g. 'mypackage.adapter:MyAdapter'. "
            "Defaults to the reference hki_runtime adapter."
        ),
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output the full report as JSON (to stdout).",
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Write JSON report to FILE instead of stdout.",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print each case result, not just the summary.",
    )
    parser.add_argument(
        "--min-level",
        type=int,
        default=0,
        choices=[0, 1, 2, 3, 4],
        help="Exit with code 2 if the conformance level is below this value.",
    )

    args = parser.parse_args(argv)

    if args.adapter:
        try:
            adapter = _load_adapter(args.adapter)
        except Exception as exc:
            print(f"error: could not load adapter {args.adapter!r}: {exc}", file=sys.stderr)
            return 1
    else:
        adapter = HkiRuntimeAdapter()

    report = run_conformance(adapter)
    level = conformance_level(report)

    if args.json or args.output:
        report_json = json.dumps(report, indent=2)
        if args.output:
            with open(args.output, "w") as f:
                f.write(report_json)
                f.write("\n")
        else:
            print(report_json)
    else:
        _print_report(report, verbose=args.verbose)

    if not report["passed"]:
        return 1
    if args.min_level and level < args.min_level:
        print(
            f"error: conformance level L{level} is below required L{args.min_level}",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
