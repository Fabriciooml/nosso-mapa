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


# --- soft delete ---

def test_delete_place_returns_204(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.delete(f"/api/places/{place_id}")
    assert response.status_code == 204


def test_delete_nonexistent_place_returns_404(client):
    response = client.delete("/api/places/9999")
    assert response.status_code == 404


def test_delete_already_deleted_place_returns_404(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.delete(f"/api/places/{place_id}")
    assert response.status_code == 404


def test_deleted_place_excluded_from_list(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    places = client.get("/api/places").json()
    assert places == []


def test_deleted_place_status_update_returns_404(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.patch(f"/api/places/{place_id}/status", json={"status": "gone"})
    assert response.status_code == 404


# --- edit place ---

def test_update_place_alias(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.put(f"/api/places/{place_id}", json={
        "alias": "Itália Meu Amor", "description": None, "category_ids": []
    })
    assert response.status_code == 200
    assert response.json()["alias"] == "Itália Meu Amor"


def test_update_place_description(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.put(f"/api/places/{place_id}", json={
        "alias": None, "description": "# Bom lugar\nÓtima comida.", "category_ids": []
    })
    assert response.status_code == 200
    assert response.json()["description"] == "# Bom lugar\nÓtima comida."


def test_update_place_replaces_categories(client):
    cat_id = _cat_id(client, "Café")
    place_id = client.post("/api/places", json={**PLACE_PAYLOAD, "category_ids": [cat_id]}).json()["id"]
    cat2_id = _cat_id(client, "Museu")
    response = client.put(f"/api/places/{place_id}", json={
        "alias": None, "description": None, "category_ids": [cat2_id]
    })
    assert response.status_code == 200
    names = [c["name"] for c in response.json()["categories"]]
    assert names == ["Museu"]


def test_update_place_clears_categories(client):
    cat_id = _cat_id(client, "Café")
    place_id = client.post("/api/places", json={**PLACE_PAYLOAD, "category_ids": [cat_id]}).json()["id"]
    response = client.put(f"/api/places/{place_id}", json={
        "alias": None, "description": None, "category_ids": []
    })
    assert response.status_code == 200
    assert response.json()["categories"] == []


def test_update_deleted_place_returns_404(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.put(f"/api/places/{place_id}", json={
        "alias": "test", "description": None, "category_ids": []
    })
    assert response.status_code == 404


def test_update_nonexistent_place_returns_404(client):
    response = client.put("/api/places/9999", json={
        "alias": "test", "description": None, "category_ids": []
    })
    assert response.status_code == 404


# --- deduplication on create ---

def test_create_duplicate_active_returns_409(client):
    client.post("/api/places", json=PLACE_PAYLOAD)
    response = client.post("/api/places", json=PLACE_PAYLOAD)
    assert response.status_code == 409


def test_create_restores_soft_deleted_place(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.post("/api/places", json=PLACE_PAYLOAD)
    assert response.status_code == 200
    assert response.json()["id"] == place_id


def test_create_restore_updates_name_and_coords(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    new_payload = {**PLACE_PAYLOAD, "name": "Restaurante Novo Nome", "lat": 38.72, "lng": -9.14}
    response = client.post("/api/places", json=new_payload)
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Restaurante Novo Nome"
    assert body["lat"] == 38.72


def test_create_restore_appears_in_list(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    client.post("/api/places", json=PLACE_PAYLOAD)
    places = client.get("/api/places").json()
    assert len(places) == 1


def test_create_no_google_place_id_no_dedup(client):
    payload = {**PLACE_PAYLOAD, "google_place_id": None}
    client.post("/api/places", json=payload)
    response = client.post("/api/places", json=payload)
    assert response.status_code == 201
