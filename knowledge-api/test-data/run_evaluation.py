#!/usr/bin/env python3
"""
Knowledge Base Evaluation Runner

Runs the evaluation suite against the knowledge API and prints a concise report.
"""

from __future__ import annotations

import argparse
import datetime
from io import TextIOWrapper
from io import TextIOWrapper
import json
import pathlib
import sys
import time
import typing

import httpx


def load_test_suite(suite_path: pathlib.Path) -> dict[str, typing.Any]:
    """Load evaluation test suite from JSON file."""
    with suite_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def run_search(
    client: httpx.Client,
    api_url: str,
    query: str,
    top_k: int = 5,
) -> dict[str, typing.Any]:
    """Execute search and return results."""
    payload = {
        "query": query,
        "mode": "hybrid",
        "top_k": top_k,
        "include_content": True,
        "include_citations": True,
    }

    response: httpx.Response = client.post(f"{api_url}/v1/search", json=payload, timeout=30.0)
    response.raise_for_status()
    return response.json()


def _derive_generated_answer_from_contexts(contexts: list[str]) -> str:
    """Build a deterministic answer proxy for judge metrics when no generator is used."""
    if not contexts:
        return ""

    merged: str = " ".join(c.strip() for c in contexts[:3] if c and c.strip())
    return merged[:1200]


def run_evaluation(
    client: httpx.Client,
    api_url: str,
    suite: dict[str, typing.Any],
    threshold: float = 0.7,
    top_k: int = 5,
) -> dict[str, typing.Any]:
    """Run evaluation via the knowledge API evaluation endpoint."""
    print(f"Running evaluation suite: {suite.get('suite_name', 'unknown')}")
    print(f"Test cases: {len(suite.get('cases', []))}")
    print(f"Pass threshold: {threshold:.2f}")
    print("")

    eval_request: dict[str, typing.Any] = {
        "suite_name": suite.get("suite_name", "default"),
        "cases": [],
        "relevance_threshold": threshold,
    }

    cases = suite.get("cases", [])
    print("Searching knowledge base for each test case...")
    for index, test_case in enumerate(cases, start=1):
        query: str = str(test_case.get("query", "")).strip()
        if not query:
            continue

        print(f"  [{index}/{len(cases)}] {query[:72]}")

        try:
            search_result: dict[str, Any] = run_search(client, api_url, query, top_k=top_k)
            contexts: list[str] = [
                result.get("content", result.get("extract", ""))
                for result in search_result.get("results", [])[:top_k]
                if result.get("content", result.get("extract", ""))
            ]

            eval_case = {
                "id": test_case.get("id", f"case-{index}"),
                "query": query,
                "expected_answer": test_case.get("expected_answer", ""),
                "retrieved_contexts": contexts,
                # Keep generated answer populated so LLM-as-judge metrics can run.
                "generated_answer": _derive_generated_answer_from_contexts(contexts),
            }
            eval_request["cases"].append(eval_case)

        except Exception as exc: # noqa:

            BLE001
            print(f"    warning: search failed: {exc}")

    if not eval_request["cases"]:
        print("\nNo cases to evaluate.")
        return {}

    print(f"\nSubmitting {len(eval_request['cases'])} cases for evaluation...")

    try:
        response: httpx.Response = client.post(
            f"{api_url}/v1/evaluate",
            json=eval_request,
            timeout=120.0,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        print(f"\nEvaluation failed: HTTP {exc.response.status_code}")
        print(exc.response.text)
        return {}
    except Exception as exc: # noqa:
        BLE001
        print(f"\nEvaluation failed: {exc}")
        return {}


def print_report(results: dict[str, typing.Any], threshold: float) -> bool:
    """Print evaluation results and return True if all metrics pass threshold."""
    if not results:
        return False

    print("\n" + "=" * 70)
    print("EVALUATION REPORT")
    print("=" * 70)

    summary = results.get("summary", {})
    statistics = results.get("statistics", {})

    print(f"\nSuite: {results.get('suite_name', 'unknown')}")
    print(f"Cases: {results.get('total_cases', 0)}")
    print(f"Duration: {results.get('eval_time_ms', 0):.0f}ms")
    print(f"Estimated cost: ${results.get('estimated_cost_usd', 0):.4f}")

    print("\nMETRICS SUMMARY")
    print("-" * 70)

    metrics: list[tuple[str, str]] = [
        ("Context Relevance", "context_relevance"),
        ("Context Precision", "context_precision"),
        ("Context Recall", "context_recall"),
        ("Answer Similarity", "answer_similarity"),
        ("Faithfulness", "faithfulness"),
        ("Answer Correctness", "answer_correctness"),
    ]

    all_pass = True
    for label, key in metrics:
        score = float(summary.get(key, 0.0))
        stat = statistics.get(key, {})

        status: str = "PASS" if score >= threshold else "FAIL"
        if score < threshold:
            all_pass = False

        ci_lower = float(stat.get("ci_lower", score))
        ci_upper = float(stat.get("ci_upper", score))

        print(f"{status:4s} {label:20s} {score:.3f}  (CI: {ci_lower:.3f}-{ci_upper:.3f})")

    print("\n" + "=" * 70)
    if all_pass:
        print("ALL METRICS PASSED")
    else:
        print("SOME METRICS ARE BELOW THRESHOLD")
    print("=" * 70 + "\n")

    return all_pass


def save_results(results: dict[str, typing.Any], output_path: pathlib.Path) -> None:
    """Save evaluation results to JSON file."""
    results["evaluated_at"] = datetime.datetime.now(datetime.UTC).isoformat()

    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=2)

    print(f"Results saved to: {output_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run knowledge base evaluation")
    parser.add_argument(
        "--suite",
        type=pathlib.Path,
        default=pathlib.Path("evaluation-suite.json"),
        help="Path to evaluation suite JSON file",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:9509",
        help="Knowledge API base URL",
    )
    parser.add_argument(
        "--output",
        type=pathlib.Path,
        help="Output path for results JSON (default: auto-generated)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.7,
        help="Minimum passing score for metrics (default: 0.7)",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of retrieved contexts per case (default: 5)",
    )
    parser.add_argument(
        "--auth-token",
        default="test-token",
        help="Authorization token for API",
    )

    args: argparse.Namespace = parser.parse_args()

    if not args.suite.exists():
        print(f"Test suite not found: {args.suite}")
        return 1

    try:
        suite: dict[str, Any] = load_test_suite(args.suite)
    except Exception as exc: # noqa:
        BLE001
        print(f"Failed to load test suite: {exc}")
        return 1

    headers: dict[str, str] = {"Authorization": f"Bearer {args.auth_token}"}
    with httpx.Client(headers=headers, timeout=30.0) as client:
        try:
            health: httpx.Response = client.get(f"{args.api_url}/health")
            health.raise_for_status()
            print(f"Knowledge API is healthy at {args.api_url}\n")
        except Exception as exc: # noqa:
            BLE001
            print(f"Knowledge API not accessible: {exc}")
            return 1

        start_time: float = time.time()
        results: dict[str, Any] = run_evaluation(
            client,
            args.api_url,
            suite,
            threshold=args.threshold,
            top_k=args.top_k,
        )
        elapsed: float = time.time() - start_time

    if not results:
        print("\nEvaluation failed")
        return 1

    all_passed: bool = print_report(results, args.threshold)

    if args.output:
        output_path = args.output
    else:
        timestamp: str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = pathlib.Path(f"results_{timestamp}.json")

    save_results(results, output_path)
    print(f"Total elapsed time: {elapsed:.1f}s")

    return 0 if all_passed else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(130)
