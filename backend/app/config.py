import os
from dotenv import load_dotenv

load_dotenv()

FMP_API_KEY = os.getenv("FMP_API_KEY", "")
FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"
FMP_BASE_URL_V4 = "https://financialmodelingprep.com/api/v4"
STARTING_CASH = float(os.getenv("STARTING_CASH", "100000"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sim_trading.db")

_default_origins = "http://localhost:5173"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]
