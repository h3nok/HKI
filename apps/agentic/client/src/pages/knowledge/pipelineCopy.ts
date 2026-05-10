export const KNOWLEDGE_PIPELINE_STAGES = [
  "extracting",
  "cleaning",
  "enriching",
  "chunking",
  "indexing",
  "completed",
] as const;

export type KnowledgePipelineStage = (typeof KNOWLEDGE_PIPELINE_STAGES)[number];

type PipelineStageCopy = {
  compactLabel: string;
  fullLabel: string;
  graphLabel: string;
  stageHeadline: string;
  whatHappened: string;
  whyItMatters: string;
  nextStep: string;
};

export const PIPELINE_STAGE_COPY: Record<
  KnowledgePipelineStage,
  PipelineStageCopy
> = {
  extracting: {
    compactLabel: "Reading",
    fullLabel: "Read Document",
    graphLabel: "Read",
    stageHeadline: "We are reading the source and pulling the usable text out.",
    whatHappened:
      "The pipeline opens the file or page, extracts the text, and prepares it for the next steps.",
    whyItMatters:
      "If we cannot read the source clearly, every later answer becomes weaker or incomplete.",
    nextStep:
      "Use selectable text when possible. Scanned PDFs, screenshots, and protected files often need cleanup first.",
  },
  cleaning: {
    compactLabel: "Cleaning",
    fullLabel: "Clean Up Content",
    graphLabel: "Clean Up",
    stageHeadline:
      "We are removing formatting noise and normalizing the content.",
    whatHappened:
      "The pipeline strips extra whitespace, control characters, and formatting artifacts that distract retrieval.",
    whyItMatters:
      "Cleaner content produces more stable chunks, stronger matches, and fewer confusing answers.",
    nextStep:
      "Prefer clear headings, short sections, and simpler formatting over long copied tables or decorative layouts.",
  },
  enriching: {
    compactLabel: "Finding Facts",
    fullLabel: "Find Key Facts",
    graphLabel: "Key Facts",
    stageHeadline:
      "We are looking for titles, dates, named teams, and recurring topics.",
    whatHappened:
      "The pipeline pulls out business signals like titles, dates, entities, and themes so the agent understands context.",
    whyItMatters:
      "Those signals help the agent answer specifically instead of giving vague generic language.",
    nextStep:
      "Documents with clear titles, dates, policy names, and ownership details perform much better here.",
  },
  chunking: {
    compactLabel: "Sectioning",
    fullLabel: "Break Into Sections",
    graphLabel: "Sections",
    stageHeadline: "We are breaking the content into answerable sections.",
    whatHappened:
      "The pipeline splits the document into smaller sections that can be retrieved quickly and cited accurately.",
    whyItMatters:
      "Strong sections keep unrelated policies from being blended into the same answer.",
    nextStep:
      "Use headings and natural section breaks. Very long walls of text are harder to retrieve correctly.",
  },
  indexing: {
    compactLabel: "Making Searchable",
    fullLabel: "Make Searchable",
    graphLabel: "Search",
    stageHeadline:
      "We are storing the sections so the agent can find them later.",
    whatHappened:
      "The processed sections are saved into search and retrieval systems so the agent can pull them into live answers.",
    whyItMatters:
      "This is what makes the content discoverable when an employee asks a real question.",
    nextStep:
      "After this step, test a few employee-style questions to confirm the right content is being found.",
  },
  completed: {
    compactLabel: "Ready",
    fullLabel: "Ready for Questions",
    graphLabel: "Ready",
    stageHeadline: "This content is now available to support employee answers.",
    whatHappened:
      "The document finished processing and is now part of the domain library the agent can search.",
    whyItMatters:
      "Your new content can now improve answer quality, coverage, and citations for the stream.",
    nextStep:
      "Test two or three realistic questions and verify the answer uses the right source and policy language.",
  },
};

const ACTIVE_PIPELINE_STATUSES = new Set([
  "extracting",
  "cleaning",
  "enriching",
  "chunking",
  "indexing",
]);

const TERMINAL_PIPELINE_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
]);

function isKnowledgePipelineStage(
  value: string | null | undefined
): value is KnowledgePipelineStage {
  return (
    !!value &&
    KNOWLEDGE_PIPELINE_STAGES.includes(value as KnowledgePipelineStage)
  );
}

export function isPipelineProcessingStatus(status: string | null | undefined) {
  return !!status && ACTIVE_PIPELINE_STATUSES.has(status);
}

export function getPipelineStatusLabel(
  status: string | null | undefined,
  opts?: { failedAtStage?: string | null; tone?: "compact" | "full" | "graph" }
) {
  const tone = opts?.tone ?? "compact";
  if (!status) return "Unknown";

  if (status === "manual_check") return "Check Pipeline Status";
  if (status === "queued") return "Queued";
  if (status === "failed") return "Needs Attention";
  if (status === "cancelled")
    return tone === "full" ? "Cancelled" : "Cancelled";

  if (isKnowledgePipelineStage(status)) {
    const copy = PIPELINE_STAGE_COPY[status];
    if (tone === "full") return copy.fullLabel;
    if (tone === "graph") return copy.graphLabel;
    return copy.compactLabel;
  }

  if (isKnowledgePipelineStage(opts?.failedAtStage ?? undefined)) {
    const copy =
      PIPELINE_STAGE_COPY[opts?.failedAtStage as KnowledgePipelineStage];
    if (tone === "full") return `${copy.fullLabel} Failed`;
    if (tone === "graph") return copy.graphLabel;
    return `${copy.compactLabel} Failed`;
  }

  if (TERMINAL_PIPELINE_STATUSES.has(status)) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getPipelineCoachCopy(opts: {
  status: string | null | undefined;
  failedAtStage?: string | null;
  error?: string | null;
}) {
  const { status, failedAtStage, error } = opts;

  if (status === "cancelled") {
    return {
      title: "Processing was cancelled",
      whatHappened: "The job was stopped before it could finish the pipeline.",
      whyItMatters:
        "Cancelled jobs do not become searchable knowledge, so the source may need to be added again later.",
      nextStep:
        "If this was accidental, start a new ingest job. Otherwise no further action is needed.",
    };
  }

  if (status === "manual_check") {
    return {
      title: "Live tracking needs a manual check",
      whatHappened:
        "The upload was accepted, but the wizard could not confirm the latest pipeline state from the live job endpoint.",
      whyItMatters:
        "The document may have finished successfully or may need attention, so retrieval testing would be premature until the final state is confirmed.",
      nextStep:
        "Open Pipeline Jobs, check the job ID, and confirm whether it completed or failed before moving on.",
    };
  }

  if (status === "queued") {
    return {
      title: "Queued for processing",
      whatHappened:
        "The job has been accepted and is waiting for the pipeline to start.",
      whyItMatters:
        "Nothing is wrong yet. The pipeline simply has not started working on this content.",
      nextStep:
        "Leave this open if you want to watch it progress, or come back when the first stage begins.",
    };
  }

  if (status === "failed") {
    return getPipelineFailureGuidance(failedAtStage, error);
  }

  if (isKnowledgePipelineStage(status)) {
    const copy = PIPELINE_STAGE_COPY[status];
    return {
      title: copy.fullLabel,
      whatHappened: copy.whatHappened,
      whyItMatters: copy.whyItMatters,
      nextStep: copy.nextStep,
    };
  }

  return {
    title: getPipelineStatusLabel(status, { tone: "full" }),
    whatHappened:
      "The pipeline is working through this content, but this step does not yet have custom guidance.",
    whyItMatters:
      "Each stage improves how reliably the agent can find and cite the right information.",
    nextStep:
      "If this stage takes too long or fails repeatedly, retry once and then inspect the source content.",
  };
}

export function getPipelineFailureGuidance(
  failedAtStage?: string | null,
  error?: string | null
) {
  const raw = (error ?? "").toLowerCase();

  if (
    failedAtStage === "queued" ||
    raw.includes("service restarted before processing began")
  ) {
    return {
      title: "The service restarted before processing began",
      whatHappened:
        "This job was accepted, but the pipeline restarted before any processing work actually started.",
      whyItMatters:
        "Nothing is wrong with the content itself, but this run will not complete on its own.",
      nextStep:
        "Submit the content again from Add Knowledge. If this keeps happening, the queue or worker needs attention rather than the document.",
    };
  }

  if (raw.includes("413") || raw.includes("file too large")) {
    return {
      title: "The upload was too large to process safely",
      whatHappened:
        "The pipeline rejected the file before it could finish processing it.",
      whyItMatters:
        "Oversized files usually slow retrieval, strain indexing, and make failures more likely.",
      nextStep:
        "Split the document into smaller files or export a lighter version before retrying.",
    };
  }

  if (raw.includes("401") || raw.includes("403")) {
    return {
      title: "The pipeline could not reach a required service",
      whatHappened:
        "A backend dependency denied the request during processing.",
      whyItMatters:
        "The content itself may be fine, but the pipeline cannot finish until service access is restored.",
      nextStep: "Retry once after credentials or service access are corrected.",
    };
  }

  if (raw.includes("timeout") || raw.includes("etimedout")) {
    return {
      title: "The pipeline ran out of time",
      whatHappened:
        "A processing step took too long and was stopped before completion.",
      whyItMatters:
        "Large or irregular documents are more likely to time out and return incomplete results.",
      nextStep:
        "Retry once. If it repeats, split the source into smaller sections or simplify the formatting.",
    };
  }

  if (
    raw.includes("name 'self' is not defined") ||
    raw.includes("is not defined")
  ) {
    return {
      title: "The pipeline hit an internal rule error",
      whatHappened:
        "The service started processing your content but an internal pipeline rule failed partway through.",
      whyItMatters:
        "This is usually a system issue, not a document-quality issue.",
      nextStep:
        "Retry once. If it repeats, escalate with the job ID so engineering can inspect the failing stage.",
    };
  }

  switch (failedAtStage) {
    case "extracting":
      return {
        title: "We could not read the source cleanly",
        whatHappened:
          "The pipeline could not pull usable text out of the file or page.",
        whyItMatters:
          "If the text cannot be read reliably, the agent will have nothing trustworthy to answer from.",
        nextStep:
          "Try a text-based PDF, DOCX, or paste the content directly. Scanned images usually need OCR cleanup.",
      };
    case "cleaning":
      return {
        title: "The content structure was too noisy to normalize",
        whatHappened:
          "The pipeline hit trouble while removing formatting noise and preparing the text.",
        whyItMatters:
          "Messy formatting can create unstable chunks and poor answer retrieval.",
        nextStep:
          "Simplify the source, remove broken OCR or large copied tables, and retry.",
      };
    case "enriching":
      return {
        title: "We could not reliably pull key facts from the content",
        whatHappened:
          "The metadata step failed while identifying titles, dates, entities, or topics.",
        whyItMatters:
          "Without those signals, answers become less specific and harder to trust.",
        nextStep:
          "Add a clear title, headings, dates, and policy owners, then retry the upload.",
      };
    case "chunking":
      return {
        title: "The document was hard to split into useful sections",
        whatHappened:
          "The pipeline could not create stable answerable sections from the content.",
        whyItMatters:
          "Good retrieval depends on small, well-bounded sections instead of one long block of text.",
        nextStep:
          "Break the document into smaller sections or add headings before retrying.",
      };
    case "indexing":
      if (raw.includes("422") || raw.includes("validation")) {
        return {
          title: "The processed content was rejected during indexing",
          whatHappened:
            "The pipeline finished preparing the content, but the indexing service rejected it during the final validation step.",
          whyItMatters:
            "The source may be readable, yet it still will not become searchable until the indexing payload is accepted.",
          nextStep:
            "Try the upload again once. If it repeats, split the content into smaller sections or remove unusually noisy tables and formatting before re-adding it.",
        };
      }
      return {
        title: "The content could not be made searchable",
        whatHappened:
          "The final storage step failed before the content could be indexed for retrieval.",
        whyItMatters:
          "Until indexing succeeds, the agent cannot find this document during live questions.",
        nextStep:
          "Retry once. If it happens again, reduce file size or split the upload into smaller documents.",
      };
    default:
      return {
        title: "The pipeline needs attention",
        whatHappened:
          "This job stopped before it finished processing the content.",
        whyItMatters:
          "Until the job completes, the content will not help the agent answer questions.",
        nextStep:
          "Retry once. If it fails again, inspect the source content and share the job ID for follow-up.",
      };
  }
}
