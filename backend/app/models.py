from pydantic import BaseModel, field_validator
from typing import Optional


class CategoryOut(BaseModel):
    id: int
    name: str


class CategoryCreate(BaseModel):
    name: str


class PlaceCreate(BaseModel):
    name: str
    google_place_id: Optional[str] = None
    lat: float
    lng: float
    category_ids: list[int]
    website: Optional[str] = None
    opening_hours: Optional[list[str]] = None
    price_level: Optional[int] = None


class PlaceStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("to_go", "gone", "repeat"):
            raise ValueError("status must be to_go, gone, or repeat")
        return v


class PlaceUpdate(BaseModel):
    alias: Optional[str] = None
    description: Optional[str] = None
    category_ids: list[int]


class ReviewCreate(BaseModel):
    reviewer: str
    rating: float

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        if not (1.0 <= v <= 5.0) or round(v % 0.5, 10) != 0:
            raise ValueError("rating must be 1.0–5.0 in 0.5 steps")
        return v


class PlaceOut(BaseModel):
    id: int
    name: str
    google_place_id: Optional[str]
    lat: float
    lng: float
    status: str
    avg_rating: Optional[float]
    alias: Optional[str]
    description: Optional[str]
    categories: list[CategoryOut]
    created_at: str
    website: Optional[str]
    opening_hours: Optional[list[str]]
    price_level: Optional[int]
