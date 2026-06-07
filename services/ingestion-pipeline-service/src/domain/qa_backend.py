"""
Gemini QA Backend — synthetic QA generation using Gemini LLM.

Implements QAGeneratorBackend protocol for creating ground-truth datasets
from ingested document chunks, enabling evaluation loop gating.
"""

from __future__ import annotations

import json
import re
import typing

from src.adapters.gemini_client import _call_llm
from src.core.logging import logger
from src.domain.synthesis import (
    GenerationConfig,
    QAGeneratorBackend,
    QuestionType,
    SyntheticQA,
    build_generation_prompt,
)


class GeminiQABackend(QAGeneratorBackend):
    """
    LLM backend implementing QAGeneratorBackend.

    Uses Gemini (via gateway or Vertex AI direct) to generate synthetic
    question-answer pairs grounded in document chunks.
    """

    async def generate_qa(
        self,
        chunk_text: str,
        question_type: QuestionType,
        config: GenerationConfig,
    ) -> list[SyntheticQA]:
        """
        Generate high-quality question-answer pairs for the chunk.

        Asks the LLM to generate exactly 1 pair per call, matching the
        DatasetBuilder loop orchestration.
        """
        prompt = build_generation_prompt(
            chunk_text=chunk_text,
            question_type=question_type,
            count=1,
        )

        try:
            raw = await _call_llm(prompt)
        except Exception as exc:
            logger.warning(
                "Gemini call failed during QA generation",
                extra={"error": str(exc), "question_type": question_type.value},
            )
            return []

        if not raw:
            return []

        # Extract JSON array or object
        json_str = raw.strip()
        match = re.search(r"(\[.*\]|\{.*\})", json_str, re.DOTALL)
        if match:
            json_str = match.group(1)
        else:
            # Fallback to stripping markdown code block fences if present
            if json_str.startswith("```"):
                lines = json_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                json_str = "\n".join(lines).strip()

        try:
            data = json.loads(json_str)
            if isinstance(data, dict):
                data = [data]
            elif not isinstance(data, list):
                raise ValueError("Parsed JSON is neither an array nor an object")

            qa_pairs = []
            for item in data:
                if "question" in item and "answer" in item:
                    # Validate and clamp difficulty
                    difficulty = int(item.get("difficulty", 1))
                    difficulty = max(1, min(5, difficulty))

                    qa_pairs.append(
                        SyntheticQA(
                            question=str(item["question"]).strip(),
                            answer=str(item["answer"]).strip(),
                            difficulty=difficulty,
                            question_type=question_type,
                        )
                    )
            return qa_pairs
        except Exception as exc:
            logger.warning(
                "Failed to parse generated QA JSON",
                extra={"error": str(exc), "raw_response": raw[:500]},
            )
            return []
