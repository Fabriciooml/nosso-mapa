import pytest


PLACE_PAYLOAD = {
    "name": "Restaurante Italia",
    "google_place_id": "ChIJabc123",
    "lat": 38.7169,
    "lng": -9.1395,
    "category_ids": [],
}


def _cat_id(client, name: str) -> int:
    return client.post("/api/categories", json={"name": name}).json()["id"]


def test_list_places_empty(client):
    response = client.get("/api/places")
    assert response.status_code == 200
    assert response.json() == []


def test_create_place_returns_201(client):
    response = client.post("/api/places", json=PLACE_PAYLOAD)
    assert response.status_code == 201


def test_create_place_fields(client):
    body = client.post("/api/places", json=PLACE_PAYLOAD).json()
    assert body["name"] == "Restaurante Italia"
    assert body["lat"] == 38.7169
    assert body["lng"] == -9.1395
    assert body["status"] == "to_go"
    assert body["avg_rating"] is None
    assert body["categories"] == []
    assert "id" in body
    assert "created_at" in body


def test_create_place_with_categories(client):
    cat_id = _cat_id(client, "Café")
    payload = {**PLACE_PAYLOAD, "category_ids": [cat_id]}
    body = client.post("/api/places", json=payload).json()
    assert len(body["categories"]) == 1
    assert body["categories"][0]["name"] == "Café"


def test_create_place_appears_in_list(client):
    client.post("/api/places", json=PLACE_PAYLOAD)
    places = client.get("/api/places").json()
    assert len(places) == 1
    assert places[0]["name"] == "Restaurante Italia"


def test_create_place_invalid_category_id_raises_422(client):
    payload = {**PLACE_PAYLOAD, "category_ids": [999]}
    response = client.post("/api/places", json=payload)
    assert response.status_code in (422, 400)


# --- status update ---

def test_update_status(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.patch(f"/api/places/{place_id}/status", json={"status": "gone"})
    assert response.status_code == 200
    assert response.json()["status"] == "gone"


def test_update_status_invalid_value(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.patch(f"/api/places/{place_id}/status", json={"status": "invalid"})
    assert response.status_code == 422


def test_update_status_nonexistent_place(client):
    response = client.patch("/api/places/9999/status", json={"status": "gone"})
    assert response.status_code == 404


# --- reviews ---

def test_create_review_returns_201(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.post(
        f"/api/places/{place_id}/reviews",
        json={"reviewer": "Fab", "rating": 4.5},
    )
    assert response.status_code == 201


def test_review_rating_appears_in_avg(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.post(f"/api/places/{place_id}/reviews", json={"reviewer": "Fab", "rating": 4.0})
    client.post(f"/api/places/{place_id}/reviews", json={"reviewer": "Ana", "rating": 3.0})
    place = client.get("/api/places").json()[0]
    assert place["avg_rating"] == pytest.approx(3.5)


def test_review_invalid_rating_rejected(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.post(
        f"/api/places/{place_id}/reviews",
        json={"reviewer": "Fab", "rating": 3.3},
    )
    assert response.status_code == 422


def test_review_nonexistent_place(client):
    response = client.post(
        "/api/places/9999/reviews",
        json={"reviewer": "Fab", "rating": 4.0},
    )
    assert response.status_code == 404


def test_review_out_of_range_rating_rejected(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    # below minimum
    r1 = client.post(f"/api/places/{place_id}/reviews", json={"reviewer": "Fab", "rating": 0.5})
    assert r1.status_code == 422
    # above maximum
    r2 = client.post(f"/api/places/{place_id}/reviews", json={"reviewer": "Fab", "rating": 5.5})
    assert r2.status_code == 422


# --- alias and description fields ---

def test_place_response_has_alias_null(client):
    body = client.post("/api/places", json=PLACE_PAYLOAD).json()
    assert "alias" in body
    assert body["alias"] is None


def test_place_response_has_description_null(client):
    body = client.post("/api/places", json=PLACE_PAYLOAD).json()
    assert "description" in body
    assert body["description"] is None
