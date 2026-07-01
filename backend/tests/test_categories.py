def test_db_has_seeded_categories(client):
    response = client.get("/api/categories")
    assert response.status_code == 200
    names = [c["name"] for c in response.json()]
    for expected in ["Restaurante", "Café", "Museu", "Cinema", "Lanche"]:
        assert expected in names


def test_list_categories_returns_id_and_name(client):
    response = client.get("/api/categories")
    cat = response.json()[0]
    assert "id" in cat
    assert "name" in cat


def test_create_category(client):
    response = client.post("/api/categories", json={"name": "Praia"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Praia"
    assert isinstance(body["id"], int)


def test_create_category_duplicate_returns_existing(client):
    client.post("/api/categories", json={"name": "Único"})
    response = client.post("/api/categories", json={"name": "Único"})
    assert response.status_code == 201
    # second call returns the existing one, not an error
    assert response.json()["name"] == "Único"


def test_create_category_appears_in_list(client):
    client.post("/api/categories", json={"name": "Teatro"})
    names = [c["name"] for c in client.get("/api/categories").json()]
    assert "Teatro" in names
