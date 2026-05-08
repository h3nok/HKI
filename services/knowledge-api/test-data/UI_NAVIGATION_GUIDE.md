# Knowledge Base UI Testing — Navigation Guide

> Maintenance note: older examples in this guide may mention `make dev-mcp`. The current workspace entrypoint is `make -C .. dev-orchestrator` unless you are explicitly wiring a custom `MCP_SERVERS` configuration by hand.

Complete guide to accessing and testing the knowledge base through the HKI Agentic UI.

---

## 📍 **Navigation Map**

```
Landing Page (/)
    │
    ├─→ Login (/login)
    │       │
    │       └─→ [After Auth]
    │               │
    │               ├─→ Chat Interface (/chat) ← MAIN KB TESTING INTERFACE
    │               │       └─→ Knowledge Base search happens here
    │               │
    │               ├─→ Knowledge Management (/knowledge) ← ADMIN/MANAGER ONLY
    │               │       ├─→ Browse documents
    │               │       ├─→ Ingest content
    │               │       ├─→ Test queries
    │               │       └─→ View metrics
    │               │
    │               ├─→ Capabilities Explorer (/capabilities)
    │               └─→ Admin Panel (/admin) ← ADMIN ONLY
```

---

## 🎯 **Testing the Knowledge Base via Chat (PRIMARY METHOD)**

### **Step 1: Start the Services**

```bash
# Terminal 1: Infrastructure
make infra-up

# Terminal 2: Orchestrator with MCP (connects to KB)
make dev-mcp

# Terminal 3: Knowledge API
cd apps/ai-platform/knowledge-api
ALLOYDB_URL=postgresql://postgres:postgres@localhost:9432/knowledge \
  uvicorn src.api.app:app --reload --port 9509

# Terminal 4: Agentic Frontend
make dev-agentic
```

### **Step 2: Navigate to Chat Interface**

1. **Open browser:** http://localhost:9001

2. **Login** (if not already):
   - Click "Sign In" or go directly to http://localhost:9001/login
   - Use test credentials (configured in your auth setup)

3. **You're now at the Main Chat Interface** (`/chat`)

### **Step 3: Test Knowledge Base via Chat**

The chat interface automatically uses the knowledge base when relevant. Here's how:

#### **A. Direct Knowledge Queries**

Ask questions that should trigger KB search:

```
💬 "What is HKI's return policy?"
💬 "How do I refill a prescription at the pharmacy?"
💬 "What are the benefits of Executive membership?"
💬 "What is the holiday schedule?"
```

#### **B. Watch for Knowledge Base Indicators**

When KB is being used, you'll see:

1. **Thinking Envelope** appears with:
   - 📖 "Searching knowledge base…" (during retrieval)
   - "Knowledge Search" trace step

2. **Citations** in the response:
   - Purple 📖 "Knowledge Base" chips
   - Click to see source document details

3. **Trace Sidebar** (right side):
   - Toggle with trace icon in top nav
   - See "Knowledge Search" step
   - View retrieved chunks and scores

#### **C. Verify KB Integration**

Look for these signals:

✅ **Agent is using KB:**

- Trace shows "knowledge_retrieval" step
- Citations appear in response
- Answer references specific documents/policies

❌ **Not using KB (mock data):**

- No "knowledge_retrieval" trace step
- Generic answers without citations
- Check if orchestrator is running with MCP: `make dev-mcp`

---

## 🛠️ **Testing the Knowledge Base via Knowledge Manager (ADMIN)**

For **administrators and managers only** — direct KB management interface.

### **Step 1: Navigate to Knowledge Manager**

From the chat interface:

1. **Bottom-left corner** → Click the **📖 Knowledge** icon
   - OR directly: http://localhost:9001/knowledge

2. **You'll see the Knowledge Base Management Interface**

### **Step 2: Knowledge Manager Features**

#### **📚 Library Tab** (Browse)

- View all indexed documents
- Search by title, department, type
- See document metadata and chunk count
- Delete documents

#### **🔍 Test Tab** (Query Testing)

- **Input:** Type a test query
- **Run Search:** Click "Search"
- **Results:**
  - Retrieved chunks with relevance scores
  - Highlights matching content
  - Metadata (department, type, source)
- **Generate Answer:** Click "Generate Answer"
  - Uses retrieved chunks to create an answer
  - Shows faithfulness score
  - Displays citations

#### **📥 Ingest Tab** (Add Content)

- **Text Input:** Paste raw text
- **URL Scraping:** Enter a URL to scrape
- **File Upload:** Upload PDFs, DOCX, MD
- **Metadata:** Set department, type, tags
- **Preview:** See chunking preview
- **Submit:** Ingest into KB

#### **📊 Monitor Tab** (Metrics)

- Search query logs
- Document counts by department
- Top queries
- Failed searches (coverage gaps)
- System health

#### **🔬 Evaluate Tab** (Quality Testing)

- Run evaluation test suites
- See RAGAS metrics:
  - Context Relevance
  - Context Precision
  - Faithfulness
  - Answer Correctness
- Compare results over time

---

## 🧪 **Quick Testing Workflow**

### **Scenario 1: Test a Single Query (5 minutes)**

1. **Start services** (if not running):

   ```bash
   make dev-mcp  # Terminal 1
   # knowledge-api in Terminal 2
   # Agentic UI in Terminal 3
   ```

2. **Go to Chat**: http://localhost:9001/chat

3. **Ask a KB question**:

   ```
   "What is the return policy for electronics?"
   ```

4. **Verify**:
   - ✅ See "Searching knowledge base…" thinking step
   - ✅ Response includes citations with 📖 icon
   - ✅ Trace sidebar shows "Knowledge Search" step

### **Scenario 2: Test Multiple Queries with Metrics (15 minutes)**

1. **Navigate to Knowledge Manager**: http://localhost:9001/knowledge

2. **Go to Test Tab**

3. **Run test queries**:

   ```
   Query 1: "membership benefits"
   Query 2: "pharmacy hours"
   Query 3: "tire installation time"
   ```

4. **For each query, check**:
   - Relevance scores (> 0.7 is good)
   - Retrieved chunk quality
   - Generated answer accuracy

5. **Go to Evaluate Tab**

6. **Run evaluation suite**:

   ```bash
   # Or from terminal:
   make kb-test-run
   ```

7. **Review metrics**:
   - Context Relevance: Target > 0.7
   - Faithfulness: Target > 0.8
   - Answer Correctness: Target > 0.75

### **Scenario 3: Full E2E Testing (30 minutes)**

```bash
# 1. Setup (one-time)
make kb-test-setup

# 2. Ingest test documents
# Via UI: /knowledge → Ingest Tab
# Upload: test-data/kb-test-data/*.md

# 3. Test via Chat
# http://localhost:9001/chat
# Ask 5-10 questions from evaluation-suite.json

# 4. Test via Knowledge Manager
# http://localhost:9001/knowledge → Test Tab
# Run the same queries, compare results

# 5. Run automated evaluation
make kb-test-run

# 6. Review results
cat test-data/kb-test-data/results-*.json
```

---

## 🎨 **UI Components That Show KB Activity**

### **1. Chat Message with Citations**

When the agent responds using KB:

```
┌─────────────────────────────────────────────┐
│ 🤖 HKI offers a generous return policy.  │
│ Most items can be returned at any time if   │
│ you're not satisfied. Electronics have a     │
│ 90-day return window.                        │
│                                              │
│ Sources:                                     │
│ • 📖 Return Policy 2024                      │
│ • 📖 Electronics Return Guidelines           │
└─────────────────────────────────────────────┘
```

### **2. Thinking Envelope (During Retrieval)**

```
┌─────────────────────────────────────────────┐
│ 💭 Thinking...                               │
│                                              │
│ 🔍 Searching knowledge base...               │
│ ━━━━━━━━━━━━━━░░░░░░░░                      │
└─────────────────────────────────────────────┘
```

### **3. Trace Sidebar (Right Panel)**

```
Thought Trace
─────────────
1. ✓ User Query
   ↓
2. 🔍 Knowledge Search
   Retrieved 5 chunks (avg score: 0.82)
   ↓
3. 💭 Reasoning
   Synthesizing answer from context
   ↓
4. ✓ Response
   Generated with 2 citations
```

### **4. Evidence Chips**

Click on purple 📖 icons to see source details:

```
┌─────────────────────────────────────┐
│ 📖 Return Policy 2024                │
├─────────────────────────────────────┤
│ Department: Customer Service         │
│ Type: Policy                         │
│ Score: 0.87                          │
│                                      │
│ "Members can return almost any       │
│ product at any time if they are      │
│ not satisfied..."                    │
└─────────────────────────────────────┘
```

---

## 🐛 **Troubleshooting**

### **Problem: Not seeing KB citations in chat**

**Check:**

1. Is orchestrator running with MCP?

   ```bash
   curl http://localhost:9501/health
   # Should show: {"status":"healthy"}
   ```

2. Are you using `make dev-mcp` (not `make dev-orchestrator`)?

   ```bash
   # dev-orchestrator uses MOCK tools (no real KB)
   # dev-mcp uses MCP → connects to real knowledge-api
   ```

3. Is knowledge-api running?

   ```bash
   curl http://localhost:9509/health
   # Should show: {"status":"healthy","service":"knowledge-api"}
   ```

4. Are there documents in the KB?
   ```bash
   curl http://localhost:9509/v1/documents \
     -H "Authorization: Bearer test-token" | jq '.total'
   # Should be > 0
   ```

### **Problem: "Knowledge" link missing from sidebar**

**Reason:** You need **manager** or **admin** role.

**Check your role:**

```bash
# In browser console:
localStorage.getItem('user')
# Should show role: "admin" or "manager"
```

**Fix:** Update your test user role in the database.

### **Problem: Search returns no results**

**Check:**

1. Query the KB directly:

   ```bash
   make kb-test-search
   ```

2. Verify indexing:

   ```sql
   SELECT COUNT(*) FROM documents;
   SELECT COUNT(*) FROM chunks;
   ```

3. Re-ingest test data:
   ```bash
   make kb-test-setup
   ```

---

## 📱 **UI Keyboard Shortcuts**

| Shortcut       | Action               |
| -------------- | -------------------- |
| `Ctrl/Cmd + K` | Focus chat input     |
| `Ctrl/Cmd + /` | Toggle trace sidebar |
| `Esc`          | Close modals/dialogs |
| `↑` / `↓`      | Navigate suggestions |

---

## 🔗 **Quick Links**

| Page                  | URL                                | Purpose                       |
| --------------------- | ---------------------------------- | ----------------------------- |
| **Chat Interface**    | http://localhost:9001/chat         | Main testing interface        |
| **Knowledge Manager** | http://localhost:9001/knowledge    | Admin KB management           |
| **Capabilities**      | http://localhost:9001/capabilities | Browse available agents/tools |
| **Admin Panel**       | http://localhost:9001/admin        | System administration         |

---

## 📚 **Related Documentation**

- [Testing Guide](./TESTING_GUIDE.md) — Full testing methodology
- [Evaluation Suite](./evaluation-suite.json) — Pre-built test cases
- [Knowledge API README](../README.md) — API details
- [Orchestrator README](../../orchestrator-service/README.md) — MCP setup

---

## ✅ **Quick Verification Checklist**

Before starting KB testing:

- [ ] Infrastructure running (`make infra-up`)
- [ ] Orchestrator with MCP (`make dev-mcp`)
- [ ] knowledge-api running (:9509/health)
- [ ] Agentic UI running (:9001)
- [ ] Logged in with valid user
- [ ] At least 5 test documents ingested
- [ ] Can see "Knowledge" link in sidebar (admin/manager only)

**Now you're ready to test!** 🚀

Start with: http://localhost:9001/chat and ask: _"What is HKI's return policy?"_
