from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import PlaceCreate, PlaceOut, PlaceStatusUpdate, ReviewCreate

router = APIRouter(prefix="/api/places", tags=["places"])


def _fetch_place(conn, place_id: int) -> dict:
    row = conn.execute(
        """SELECT p.id, p.name, p.google_place_id, p.lat, p.lng,
                  p.status, p.created_at, p.alias, p.description,
                  AVG(r.rating) AS avg_rating
           FROM places p
           LEFT JOIN reviews r ON r.place_id = p.id
           WHERE p.id = ? AND p.deleted_at IS NULL
           GROUP BY p.id""",
        (place_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Place not found")
    cats = conn.execute(
        """SELECT c.id, c.name FROM categories c
           JOIN place_categories pc ON pc.category_id = c.id
           WHERE pc.place_id = ?""",
        (place_id,),
    ).fetchall()
    return {**dict(row), "categories": [dict(c) for c in cats]}


@router.get("", response_model=list[PlaceOut])
def list_places():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT p.id FROM places p
               WHERE p.deleted_at IS NULL
               ORDER BY p.created_at DESC"""
        ).fetchall()
        return [_fetch_place(conn, r["id"]) for r in rows]
    finally:
        conn.close()


@router.post("", response_model=PlaceOut, status_code=201)
def create_place(body: PlaceCreate):
    conn = get_db()
    try:
        # Validate category ids exist
        for cat_id in body.category_ids:
            if not conn.execute(
                "SELECT id FROM categories WHERE id = ?", (cat_id,)
            ).fetchone():
                raise HTTPException(422, f"Category {cat_id} not found")

        cur = conn.execute(
            "INSERT INTO places (name, google_place_id, lat, lng) VALUES (?, ?, ?, ?)",
            (body.name, body.google_place_id, body.lat, body.lng),
        )
        place_id = cur.lastrowid
        for cat_id in body.category_ids:
            conn.execute(
                "INSERT INTO place_categories (place_id, category_id) VALUES (?, ?)",
                (place_id, cat_id),
            )
        conn.commit()
        return _fetch_place(conn, place_id)
    finally:
        conn.close()


@router.patch("/{place_id}/status", response_model=PlaceOut)
def update_status(place_id: int, body: PlaceStatusUpdate):
    conn = get_db()
    try:
        # check place exists (raises 404 via _fetch_place if not)
        _fetch_place(conn, place_id)
        conn.execute(
            "UPDATE places SET status = ? WHERE id = ?",
            (body.status, place_id),
        )
        conn.commit()
        return _fetch_place(conn, place_id)
    finally:
        conn.close()


@router.post("/{place_id}/reviews", response_model=PlaceOut, status_code=201)
def create_review(place_id: int, body: ReviewCreate):
    conn = get_db()
    try:
        _fetch_place(conn, place_id)  # 404 if not found
        conn.execute(
            "INSERT INTO reviews (place_id, reviewer, rating) VALUES (?, ?, ?)",
            (place_id, body.reviewer, body.rating),
        )
        conn.commit()
        return _fetch_place(conn, place_id)
    finally:
        conn.close()


@router.delete("/{place_id}", status_code=204)
def delete_place(place_id: int):
    conn = get_db()
    try:
        _fetch_place(conn, place_id)  # raises 404 if not found or already deleted
        conn.execute(
            "UPDATE places SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
            (place_id,),
        )
        conn.commit()
    finally:
        conn.close()
