# HKI Notebooks

Interactive demos for Hermetic Knowledge Isolation. All notebooks run in Google Colab — no local setup required.

| Notebook | What it covers | Colab |
|----------|---------------|-------|
| [01 — Quickstart](./01_quickstart.ipynb) | The cache leak problem, envelope validation, artifact visibility, gateway enforcement. Start here. | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/01_quickstart.ipynb) |
| [02 — LangChain RAG](./02_langchain_rag.ipynb) | Domain-isolated RAG with `HkiRetriever` and `HkiCallbackHandler` | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/02_langchain_rag.ipynb) |
| [03 — FastAPI Middleware](./03_fastapi_middleware.ipynb) | HTTP-layer enforcement with `HkiMiddleware`, artifact visibility in route handlers | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/03_fastapi_middleware.ipynb) |
| [04 — Threat Demos](./04_threat_demos.ipynb) | All 15 HKI threats: vulnerable code → HKI fix, grouped by attack category | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/04_threat_demos.ipynb) |
| [05 — GCP Integration](./05_gcp_integration.ipynb) | Full GCP stack: Vertex AI/Gemini, AlloyDB, Cloud Pub/Sub, Google ADK, Document AI, GCS | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/05_gcp_integration.ipynb) |
| [06 — MCP Server](./06_mcp_server.ipynb) | Domain-isolated MCP tool routers, `HkiToolGuard`, gateway target evaluation, conformance probe | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/06_mcp_server.ipynb) |
| [07 — OpenAI Agents](./07_openai_agents.ipynb) | `HkiRunContext`, typed tool enforcement, hand-off domain re-minting, guardrails, tracing | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/07_openai_agents.ipynb) |

## Run locally

```bash
pip install hki-runtime hki-langchain jupyter
jupyter notebook notebooks/
```

## Run in Colab

Click any badge above. Colab installs the packages automatically in the first cell.
