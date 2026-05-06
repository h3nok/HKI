import { describe, expect, it } from "vitest";

import { buildLeadershipFallbackQuestions } from "../client/src/components/chat-ui/suggestions/question-quality";

describe("buildLeadershipFallbackQuestions", () => {
  it("avoids ambiguous 'my team' wording for scoped fallback prompts", () => {
    const prompts = buildLeadershipFallbackQuestions(
      "Pharmacy",
      "Standard operating procedures for in-store pharmacy operations"
    );

    expect(prompts).toContain(
      "Within Pharmacy, what day-to-day decisions depend most on current policy, SOPs, or guidance?"
    );
    expect(
      prompts.some(
        prompt =>
          /day-to-day decisions/i.test(prompt) && /my team/i.test(prompt)
      )
    ).toBe(false);
  });
});
