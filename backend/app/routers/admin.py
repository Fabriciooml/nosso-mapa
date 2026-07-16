import os

from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..scripts.backfill_google_places import backfill

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/backfill-google-places")
def backfill_google_places():
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(503, "GOOGLE_PLACES_API_KEY not set")

    conn = get_db()
    try:
        return backfill(conn, api_key)
    finally:
        conn.close()
