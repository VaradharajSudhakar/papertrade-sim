from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app import models  # noqa: F401 ensures models are registered before create_all
from app.routers import market, portfolio, watchlist, analytics

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Paper Trading Simulator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(portfolio.router)
app.include_router(watchlist.router)
app.include_router(analytics.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
