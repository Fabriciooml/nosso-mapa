from unittest.mock import MagicMock, patch

import pytest

from app.scripts import backfill_google_places


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


def test_backfill_updates_place_missing_google_fields(client, monkeypatch):
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
    ) as mock_get:
        backfill_google_places.run()

    mock_get.assert_called_once()
    body = client.get("/api/places").json()[0]
    assert body["id"] == place_id
    assert body["website"] == "https://example.com"
    assert body["opening_hours"] == ["segunda: 09:00–18:00"]
    assert body["price_level"] == 2


def test_backfill_skips_place_with_no_google_place_id(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    _make_place(client, name="No Google Id", google_place_id=None)

    with patch("app.scripts.backfill_google_places.httpx.get") as mock_get:
        backfill_google_places.run()

    mock_get.assert_not_called()


def test_backfill_skips_already_filled_place(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    _make_place(
        client,
        name="Already Filled",
        google_place_id="already-filled-id",
        extra={
            "website": "https://already.com",
            "opening_hours": ["segunda: 09:00–18:00"],
            "price_level": 1,
        },
    )

    with patch("app.scripts.backfill_google_places.httpx.get") as mock_get:
        backfill_google_places.run()

    mock_get.assert_not_called()


def test_backfill_continues_after_a_google_error(client, monkeypatch, capsys):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    _make_place(client, name="Broken", google_place_id="broken-id")

    with patch(
        "app.scripts.backfill_google_places.httpx.get",
        return_value=_mock_response(status="NOT_FOUND"),
    ):
        backfill_google_places.run()

    out = capsys.readouterr().out
    assert "Errors: 1" in out


def test_backfill_exits_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    with pytest.raises(SystemExit):
        backfill_google_places.run()
