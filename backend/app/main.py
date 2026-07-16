from contextlib import asynccontextmanager
from fastapi import FastAPI
from .database import init_db
from .routers import admin, categories, places


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan, redirect_slashes=False)
app.include_router(categories.router)
app.include_router(places.router)
app.include_router(admin.router)
