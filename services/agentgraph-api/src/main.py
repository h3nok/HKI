from __future__ import annotations

import logging

import fastapi
import fastapi.middleware.cors

from .api.routes import router
from .domain.storage import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentgraph-api")


def create_app() -> fastapi.FastAPI:
    app = fastapi.FastAPI(
        title="AgentGraph API",
        version="0.1.0",
        description="REST + SSE backend for AgentGraph — stores and serves agent execution traces.",
    )

    app.add_middleware(
        fastapi.middleware.cors.CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def startup() -> None:
        await init_db()
        logger.info("AgentGraph API started. SQLite DB initialised.")

    app.include_router(router)
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8090, reload=True)
