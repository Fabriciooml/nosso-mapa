from unittest.mock import MagicMock, patch


def _make_place(client, name="Place", google_place_id="abc123", extra=None):
    payload = {
        "name": name,
        "google_place_id": google_place_id,
        "lat": 1.0,
        "lng": 2.0,
        "category_ids": [],
        **(extra or {}),
    }
    return client.post("/api/places", json=payload).json()["id"]


def _mock_response(status="OK", result=None):
    mock = MagicMock()
    mock.raise_for_status = MagicMock()
    mock.json.return_value = {"status": status, "result": result or {}}
    return mock


def test_backfill_endpoint_updates_places(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    place_id = _make_place(client)

    with patch(
        "app.scripts.backfill_google_places.httpx.get",
        return_value=_mock_response(
            result={
                "website": "https://example.com",
                "opening_hours": {"weekday_text": ["segunda: 09:00–18:00"]},
                "price_level": 2,
            }
        ),
    ):
        response = client.post("/api/admin/backfill-google-places")

    assert response.status_code == 200
    body = response.json()
    assert body == {"updated": 1, "errors": 0, "skipped_no_google_place_id": 0}

    place = client.get("/api/places").json()[0]
    assert place["id"] == place_id
    assert place["website"] == "https://example.com"
    assert place["price_level"] == 2


def test_backfill_endpoint_returns_503_when_api_key_missing(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)

    response = client.post("/api/admin/backfill-google-places")

    assert response.status_code == 503
