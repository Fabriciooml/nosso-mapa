from fastapi import APIRouter
from ..database import get_db
from ..models import CategoryOut, CategoryCreate

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, name FROM categories ORDER BY name"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate):
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id, name FROM categories WHERE name = ?", (body.name,)
        ).fetchone()
        if existing:
            return dict(existing)
        cur = conn.execute(
            "INSERT INTO categories (name) VALUES (?)", (body.name,)
        )
        conn.commit()
        return {"id": cur.lastrowid, "name": body.name}
    finally:
        conn.close()
