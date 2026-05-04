# Knowledge Base File Upload E2E QA Plan

## Purpose

Use this plan to validate the hosted Knowledge Base flow end to end for one new value stream using file upload only.

This plan covers the full business path:

1. Create a new value stream.
2. Open the stream-scoped Knowledge Base.
3. Upload files and let them process through the KB pipeline.
4. Verify Library, Review, Publish, Overview, and Validate workflows.
5. Verify live Agentic answers are grounded in the uploaded files.
6. Verify knowledge does not leak across streams.
7. Clean up the test artifacts.

## Scope

### In scope

1. Value stream creation from Admin.
2. Stream-scoped Knowledge Base access.
3. File upload ingest only.
4. Processing and indexing workflow.
5. Library search, status labels, filters, and document details.
6. Review queue, approval, and publish flow.
7. Overview metrics and chart rendering.
8. Validate and retrieval testing.
9. Live Agentic chat grounding and citations.
10. Cross-stream isolation.
11. Cleanup.

### Out of scope

1. Text paste ingest.
2. URL ingest.
3. Connectors.
4. Mobile or responsive QA.
5. Performance, load, or soak testing.
6. Public invite-code join flow unless requested separately.

## Recommended test roles

| Role       | Why it is needed                                                          | Minimum access                      |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------- |
| QA Admin   | Create and delete value streams, open Knowledge Base, assist with cleanup | Admin or super-admin                |
| QA Manager | Run the Knowledge Base workflow as the normal operating user              | Manager assigned to the test stream |
| QA Viewer  | Optional negative test for access restrictions                            | Viewer or non-manager               |

If a dedicated manager test account is not available, the admin account can execute the manager steps. Document that substitution in the test evidence.

## Environment and entry criteria

Run this plan in a hosted non-prod environment that mirrors GKE production behavior.

Before execution, confirm all of the following:

1. Agentic BFF is reachable and login works.
2. Knowledge API is healthy.
3. Ingestion pipeline API and worker are healthy.
4. Orchestrator is healthy.
5. File upload is enabled for the target environment.
6. Review and publish flows are enabled.
7. Validate and Agentic chat are enabled for the test stream.
8. QA has admin credentials and at least one stream-scoped manager credential.
9. No existing test stream is using the same run identifier.

Recommended browser:

1. Chrome or Edge.
2. Use one clean profile or incognito window per role.

Recommended test duration:

1. 45 to 60 minutes for one full pass.

## Test data pack

Create one run identifier before starting, for example:

`RUN_ID=2026-04-16-a`

Use the run identifier in the stream name and file names so the evidence is easy to trace and cleanup is safe.

### Required files

Prepare these three small files before the run.

| File                                       | Required content inside the file                                                                                                                     | Example question for Validate or Agentic                               | Expected answer                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| `qa-kb-<RUN_ID>-dispense-override-sop.pdf` | Include `QA-KB-ALPHA-001`, `Emergency override code is ORBIT-4179.`, and `Pharmacist must call the supervising lead within 10 minutes.`              | `What is the emergency override code in the QA dispense override SOP?` | `ORBIT-4179`                         |
| `qa-kb-<RUN_ID>-cold-chain-guide.docx`     | Include `QA-KB-BETA-002`, `Escalate if refrigerated medication is above 46F for more than 12 minutes.`, and `Use form COLD-22 for incident logging.` | `When does the cold-chain guide say to escalate?`                      | `Above 46F for more than 12 minutes` |
| `qa-kb-<RUN_ID>-returns-procedure.pdf`     | Include `QA-KB-GAMMA-003`, `Controlled substance returns require dual sign-off.`, and `Nightly reconciliation cutoff is 7:15 PM local time.`         | `What is the nightly reconciliation cutoff in the returns procedure?`  | `7:15 PM local time`                 |

### Test data rules

1. Keep the files small and easy to read.
2. Use unique markers exactly as written above.
3. Put the key facts in plain language, not tables or images only.
4. Do not reuse old test files from prior runs.

## Pass and fail criteria

### Must-pass criteria

1. A new value stream can be created and opened in the Knowledge Base.
2. All uploaded files complete processing without silent loss.
3. Uploaded files appear only in the intended stream.
4. Statuses are understandable in Library and Review.
5. At least two uploaded files can be approved and published.
6. Published files can be retrieved in Validate and in live Agentic chat.
7. Agentic answers cite the uploaded files.
8. A second stream cannot retrieve or cite the first stream's files.
9. Overview renders without API failure and reflects the correct aggregate counts.

### Fail the run immediately for any of these

1. Cross-stream knowledge leakage.
2. Wrong or missing citations for a clearly answerable published test question.
3. File upload accepted but document never appears in Activity, Library, Review, or Overview.
4. Review and publish cannot make a document live.
5. Overview or Library returns repeated 500 errors for the stream.

## Evidence checklist

Capture at least one screenshot or recording for each of these points:

1. New value stream created in Admin.
2. Knowledge Base opened with the correct stream in the URL.
3. File upload selection screen showing the three files.
4. Processing or completion state for each file.
5. Library showing statuses.
6. Review queue showing pending, approved, and published states.
7. Overview showing document counts after publish.
8. Validate result with grounded evidence.
9. Agentic answer with citation to one uploaded file.
10. Isolation negative test in a second stream.

## Execution order

Run the cases in this order.

| ID    | Priority | Scenario                                           |
| ----- | -------- | -------------------------------------------------- |
| TC-01 | P0       | Create a new value stream                          |
| TC-02 | P0       | Open Knowledge Base and verify stream scoping      |
| TC-03 | P0       | Upload files through Add Content                   |
| TC-04 | P0       | Track processing to final status                   |
| TC-05 | P0       | Verify Library search, metadata, and status labels |
| TC-06 | P0       | Complete review and publish workflow               |
| TC-07 | P0       | Verify Overview metrics and rendering              |
| TC-08 | P1       | Validate retrieval inside the KB workspace         |
| TC-09 | P0       | Verify live Agentic grounded answers and citations |
| TC-10 | P0       | Verify cross-stream isolation                      |
| TC-11 | P1       | Optional viewer access restriction check           |
| TC-12 | P0       | Cleanup                                            |

## Detailed test cases

### TC-01: Create a new value stream

**Role:** QA Admin

**Steps**

1. Sign in to Admin.
2. Navigate to `Admin > Value Streams`.
3. Create a new stream named `QA KB E2E <RUN_ID>`.
4. Add a short description such as `Manual KB file upload E2E test`.
5. Save the stream.
6. If manager assignment is available in the current admin flow, assign the QA Manager to this stream.

**Expected results**

1. The new stream appears in the value stream list.
2. The stream has a unique identifier and no duplicate naming collision.
3. If assignment is supported, the manager is attached to the stream successfully.

**Evidence**

1. Screenshot of the stream row in Admin.

### TC-02: Open the Knowledge Base and verify stream scoping

**Role:** QA Admin, then QA Manager if available

**Steps**

1. From the stream row, click the Knowledge Base entry point.
   Acceptable entry points are the book icon or `Open Knowledge Base`.
2. Confirm the browser opens the Knowledge Base for the new stream.
3. Verify the URL includes `?stream=`.
4. Verify the page header, badge, or breadcrumb shows the new stream name.
5. Verify there is no ambiguous `All Streams` behavior for the active workflow.
6. If an onboarding or guide flow appears, complete it and continue into the workspace.
7. Repeat with the QA Manager account if available.

**Expected results**

1. The Knowledge Base opens directly into the new stream.
2. The active stream is visible in the UI.
3. The user cannot accidentally browse a different stream without intentional navigation.
4. The manager can access only the assigned stream workflow.

**Evidence**

1. Screenshot of the KB URL and stream badge.

### TC-03: Upload files through Add Content

**Role:** QA Manager or QA Admin

**Steps**

1. Open `Add` or `Add Content` in the Knowledge Base.
2. Select `Upload Files`.
3. Upload all three prepared files.
4. Verify all three files appear in the intake list.
5. Continue through the analysis and review flow.
6. Confirm each file is approved for upload.
7. Start the add or ingest action.

**Expected results**

1. The file uploader accepts the three files without client-side failure.
2. The review step shows each file as approved for upload.
3. No file is silently dropped.
4. The action transitions into background processing or completion tracking.

**Evidence**

1. Screenshot of the upload review screen showing all three files.

### TC-04: Track processing to final status

**Role:** QA Manager or QA Admin

**Steps**

1. Stay on the completion screen or open the processing or activity view.
2. Track each uploaded file until it reaches a final state.
3. Record the final state of each file.

**Expected results**

1. Each file reaches one of these final outcomes:
   1. `Added and ready to use`
   2. `Added and waiting for review`
2. No file remains stuck in `processing` or `pending` for more than 10 minutes for these small test files.
3. If a file fails, the UI shows a visible failure state and error path instead of silently disappearing.

**Evidence**

1. Screenshot of the final state for each file.
2. Note the final document status for each file in the test record.

### TC-05: Verify Library search, metadata, and status labels

**Role:** QA Manager or QA Admin

**Steps**

1. Open `Library > Documents`.
2. Search by each file title.
3. Search by each unique marker string:
   1. `QA-KB-ALPHA-001`
   2. `QA-KB-BETA-002`
   3. `QA-KB-GAMMA-003`
4. Verify all three documents appear in the current stream.
5. Confirm the status labels are understandable and visible.
   Expected labels include `Published`, `Pending Review`, `Processing`, or `Archived`.
6. Open the document detail view for each file.
7. Verify title, stream assignment, and content preview or document metadata are visible.
8. Use the Library status filter to switch between `Published`, `Pending Review`, and `Archived` if available.

**Expected results**

1. All three uploaded documents are discoverable in Library.
2. Status labels are clear and human-readable.
3. Search and status filters behave consistently.
4. Document details belong to the correct stream.

**Evidence**

1. Screenshot of Library with the three documents.
2. Screenshot of one document detail sheet.

### TC-06: Complete the review and publish workflow

**Role:** QA Manager or QA Admin

This case has two valid paths because some environments may auto-publish or auto-index small files.

#### Path A: One or more documents are already waiting for review

**Steps**

1. Open `Govern > Review` or use the `Review queue` workflow entry point.
2. Verify at least one uploaded document is listed as waiting for review.
3. Approve one or more review items.
4. Move to the approved queue.
5. Publish the approved items using either `Publish to knowledge base` or `Publish all`.

**Expected results**

1. Review items move from pending to approved.
2. Approved items move to published.
3. Published items become eligible to ground answers.

#### Path B: All uploaded documents are already live or indexed

**Steps**

1. Return to `Library > Documents`.
2. Select one or two published documents.
3. Use the batch toolbar action `Send for Review`.
4. Confirm those documents move into review.
5. Open `Govern > Review`.
6. Approve and publish them again.

**Expected results**

1. The batch action works.
2. The selected documents move into a pending review state.
3. The review queue supports approve and publish.
4. The documents return to a published state after publish.

**Evidence**

1. Screenshot of pending review items.
2. Screenshot of approved or published review state.

### TC-07: Verify Overview metrics and rendering

**Role:** QA Manager or QA Admin

**Steps**

1. Return to `Overview`.
2. Hard refresh the page once.
3. Verify the page loads without API error banners.
4. Verify the overview cards render without blank or broken charts.
5. Verify the document totals match the actual stream state from Library and Review.

**Minimum expected counts for this run**

1. Total tracked documents = 3.
2. Live documents = number currently published.
3. Pending review documents = number currently still waiting for review.
4. Processing documents = 0 after the run is complete.

**Expected results**

1. Overview loads successfully after refresh.
2. No repeated query failure occurs for document inventory.
3. Overview counts match the actual stream state.
4. Charts render instead of collapsing into an error state.

**Evidence**

1. Screenshot of Overview with final counts.

### TC-08: Validate retrieval inside the KB workspace

**Role:** QA Manager or QA Admin

**Steps**

1. Open `Validate > Test`.
2. Ask the three planned questions from the test data table.
3. Verify the answer for each question matches the source fact.
4. Verify evidence or source context references the correct uploaded file.
5. If any document is still pending review, use the pending-inclusive validation mode or comparison flow if shown.

**Expected results**

1. The Validate experience can retrieve the published test content.
2. If pending-review comparison is available, draft content can be compared before publish.
3. No answer cites the wrong test document.

**Evidence**

1. Screenshot of at least one correct Validate response with evidence.

### TC-09: Verify live Agentic grounded answers and citations

**Role:** QA Manager or QA Admin

**Steps**

1. Open Agentic chat from the stream context.
   Acceptable routes include `Open Agent` from Overview or the equivalent stream-scoped chat entry point.
2. Ask the same three planned questions.
3. Verify each answer contains the correct fact.
4. Verify each answer includes citation or source attribution to the correct uploaded file.
5. Ask one out-of-scope question that is not answered by the three files.
   Example: `What is the DEA escalation policy for narcotics loss in this QA run?`

**Expected results**

1. Published documents ground the live answer path.
2. Citations reference the uploaded file titles, not unrelated documents.
3. The out-of-scope question does not invent a citation from the uploaded files.
4. The answer either declines, signals uncertainty, or stays appropriately limited if evidence is missing.

**Evidence**

1. Screenshot of one grounded answer with citation.
2. Screenshot of the out-of-scope response.

### TC-10: Verify cross-stream isolation

**Role:** QA Admin, then QA Manager if available

**Steps**

1. Create a second empty stream named `QA KB ISO <RUN_ID>`.
2. Open the Knowledge Base for the second stream.
3. Confirm its Library does not contain the three files from the first stream.
4. Open Agentic chat for the second stream.
5. Ask a question that should only be answerable from the first stream.
   Use a unique marker or fact, for example:
   `What does QA-KB-ALPHA-001 say the emergency override code is?`

**Expected results**

1. Stream B does not show Stream A documents in Library.
2. Stream B does not return the Stream A fact.
3. Stream B does not cite Stream A files.
4. Any leakage here is a P0 defect.

**Evidence**

1. Screenshot of the second stream Library.
2. Screenshot of the second stream chat answer.

### TC-11: Optional viewer access restriction check

**Role:** QA Viewer

**Steps**

1. Sign in as a viewer or non-manager user.
2. Try to open the test stream's Knowledge Base directly.
3. Try to upload content if the page opens.

**Expected results**

1. The viewer cannot perform manager-only KB workflows.
2. The system should either deny access or show a read-only experience, depending on the intended policy for that environment.

**Evidence**

1. Screenshot of the restriction or read-only state.

### TC-12: Cleanup

**Role:** QA Admin

**Steps**

1. Delete or archive the three uploaded documents if document cleanup is part of the UI flow.
2. Delete the test stream `QA KB E2E <RUN_ID>`.
3. Delete the isolation stream `QA KB ISO <RUN_ID>`.
4. Record whether cleanup completed entirely in product or needed platform assistance.

**Expected results**

1. No test streams remain after the run.
2. No test documents remain in active Library views.
3. Cleanup status is recorded in the QA report.

**Optional operator cleanup command**

If the environment uses synthetic QA users or smoke streams and product cleanup is incomplete, a platform owner can use:

```bash
pnpm --dir apps/ai-platform/agentic exec tsx scripts/kb-user-cleanup.ts --delete-synthetic-users --delete-smoke-streams
```

## Defect classification guidance

| Severity | Definition for this plan                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | Stream isolation breach, wrong citation in live Agentic, publish path broken, Overview or Library repeatedly 500s for the test stream, or uploaded file disappears from the workflow |
| P1       | Document status inconsistency, overview counts mismatch, validate results wrong while live publish path still works, or non-blocking workflow regression                             |
| P2       | Copy, styling, spacing, non-blocking chart layout issue, or cosmetic inconsistency                                                                                                   |

## Suggested defect report template

Use this structure for each failure:

1. Test case ID.
2. Environment.
3. Account used.
4. Stream name and stream ID.
5. File name and unique marker if relevant.
6. Exact step number.
7. Expected result.
8. Actual result.
9. Screenshot or video.
10. Browser console error or network failure, if present.

## Automation companions

These do not replace the manual QA plan, but they are useful before or after the run.

Run from `apps/ai-platform` unless noted otherwise.

| Command                                                      | What it helps verify                             |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `make kb-ui-e2e`                                             | Browser-level KB UI flow smoke                   |
| `make e2e-test`                                              | Ingestion and document storage flow              |
| `make test-prod`                                             | Canonical post-deploy GKE verification suite     |
| `pnpm --dir apps/ai-platform/agentic test:kb-gke-hvsi-smoke` | Hosted stream isolation and scoped release smoke |

## Final sign-off checklist

Mark the run complete only when all are true:

1. New stream created successfully.
2. Three files uploaded successfully.
3. Files visible in Library with correct statuses.
4. Review and publish workflow proven.
5. Overview counts correct after refresh.
6. Validate retrieves the uploaded knowledge.
7. Live Agentic cites the uploaded knowledge.
8. Second stream cannot see or use the first stream's files.
9. Cleanup completed or has a named owner and follow-up ticket.
