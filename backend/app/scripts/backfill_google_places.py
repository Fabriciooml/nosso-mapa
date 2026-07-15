import json
import os
import sys

import httpx

from ..database import get_db

GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def fetch_place_details(place_id: str, api_key: str) -> dict:
    response = httpx.get(
        GOOGLE_PLACES_DETAILS_URL,
        params={
            "place_id": place_id,
            "fields": "website,opening_hours,price_level",
            "language": "pt-BR",
            "key": api_key,
        },
        timeout=10.0,
    )
    response.raise_for_status()
    body = response.json()
    if body.get("status") != "OK":
        raise RuntimeError(f"Google API status {body.get('status')}")
    return body["result"]


def run() -> None:
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        print("GOOGLE_PLACES_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT id, google_place_id FROM places
               WHERE deleted_at IS NULL
                 AND google_place_id IS NOT NULL
                 AND website IS NULL
                 AND opening_hours IS NULL
                 AND price_level IS NULL"""
        ).fetchall()

        updated = 0
        errors = 0
        for row in rows:
            try:
                result = fetch_place_details(row["google_place_id"], api_key)
            except Exception as exc:
                print(f"place {row['id']}: error fetching from Google: {exc}", file=sys.stderr)
                errors += 1
                continue

            opening_hours = result.get("opening_hours", {}).get("weekday_text")
            conn.execute(
                "UPDATE places SET website = ?, opening_hours = ?, price_level = ? WHERE id = ?",
                (
                    result.get("website"),
                    json.dumps(opening_hours) if opening_hours else None,
                    result.get("price_level"),
                    row["id"],
                ),
            )
            updated += 1

        conn.commit()

        no_place_id = conn.execute(
            """SELECT COUNT(*) AS n FROM places
               WHERE deleted_at IS NULL AND google_place_id IS NULL"""
        ).fetchone()["n"]

        print(f"Updated: {updated}")
        print(f"Errors: {errors}")
        print(f"Skipped (no google_place_id): {no_place_id}")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
