"""
Integration tests — requires the Docker stack to be running.

  docker compose up -d
  cd tests && pip install httpx pytest && pytest test_integration.py -v
"""

import pytest
import httpx

# Test through the nginx proxy (same path the browser uses)
PROXY = "http://localhost:1996/api"
# Test backend directly
BACKEND = "http://localhost:2000/api"


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=PROXY, timeout=10) as c:
        yield c


# ── Categories ────────────────────────────────────────────────────────────────

def test_proxy_get_categories(client):
    r = client.get("/categories")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    names = [c["name"] for c in data]
    # seeded categories must exist
    for expected in ("Restaurante", "Café", "Museu", "Cinema", "Lanche"):
        assert expected in names


def test_proxy_create_category(client):
    r = client.post("/categories", json={"name": "_IntegTest"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "_IntegTest"
    assert "id" in body


def test_proxy_create_category_idempotent(client):
    """Creating same category twice returns the existing one (not an error)."""
    r1 = client.post("/categories", json={"name": "_IntegDup"})
    r2 = client.post("/categories", json={"name": "_IntegDup"})
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


# ── Places ────────────────────────────────────────────────────────────────────

PLACE_PAYLOAD = {
    "name": "Integ Test Place",
    "google_place_id": "ChIJInteg001",
    "lat": 38.7169,
    "lng": -9.1399,
    "category_ids": [],
}


def test_proxy_get_places_empty_or_list(client):
    r = client.get("/places")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_proxy_create_place(client):
    r = client.post("/places", json=PLACE_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Integ Test Place"
    assert body["status"] == "to_go"
    assert body["avg_rating"] is None
    assert body["categories"] == []
    assert "id" in body


def test_proxy_created_place_appears_in_list(client):
    client.post("/places", json={**PLACE_PAYLOAD, "name": "Listed Place"})
    r = client.get("/places")
    names = [p["name"] for p in r.json()]
    assert "Listed Place" in names


def test_proxy_create_place_with_category(client):
    cat = client.post("/categories", json={"name": "_IntegCat"}).json()
    payload = {**PLACE_PAYLOAD, "name": "Categ Place", "category_ids": [cat["id"]]}
    r = client.post("/places", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert any(c["name"] == "_IntegCat" for c in body["categories"])


# ── Status update ─────────────────────────────────────────────────────────────

def test_proxy_update_status(client):
    place = client.post("/places", json={**PLACE_PAYLOAD, "name": "Status Place"}).json()
    r = client.patch(f"/places/{place['id']}/status", json={"status": "gone"})
    assert r.status_code == 200
    assert r.json()["status"] == "gone"


def test_proxy_update_status_invalid(client):
    place = client.post("/places", json={**PLACE_PAYLOAD, "name": "Bad Status"}).json()
    r = client.patch(f"/places/{place['id']}/status", json={"status": "nope"})
    assert r.status_code == 422


# ── Reviews ───────────────────────────────────────────────────────────────────

def test_proxy_create_review(client):
    place = client.post("/places", json={**PLACE_PAYLOAD, "name": "Review Place"}).json()
    r = client.post(f"/places/{place['id']}/reviews", json={"reviewer": "Fab", "rating": 4.5})
    assert r.status_code == 201
    assert r.json()["avg_rating"] == pytest.approx(4.5)


def test_proxy_review_avg_two_reviewers(client):
    place = client.post("/places", json={**PLACE_PAYLOAD, "name": "Avg Place"}).json()
    pid = place["id"]
    client.post(f"/places/{pid}/reviews", json={"reviewer": "Fab", "rating": 4.0})
    client.post(f"/places/{pid}/reviews", json={"reviewer": "Ana", "rating": 3.0})
    r = client.get("/places")
    found = next(p for p in r.json() if p["id"] == pid)
    assert found["avg_rating"] == pytest.approx(3.5)


def test_proxy_review_invalid_rating(client):
    place = client.post("/places", json={**PLACE_PAYLOAD, "name": "Bad Rating"}).json()
    r = client.post(f"/places/{place['id']}/reviews", json={"reviewer": "Fab", "rating": 3.3})
    assert r.status_code == 422


# ── Direct backend (sanity) ───────────────────────────────────────────────────

def test_backend_direct_reachable():
    """Backend port 2000 also responds (for debugging/portainer access)."""
    r = httpx.get(f"{BACKEND}/categories", timeout=5)
    assert r.status_code == 200
