from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .api.routes import upload, sessions
from .config import settings

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="RupeeRadar API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/v1", tags=["Upload"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["Sessions"])

@app.get("/")
def read_root():
    return {"message": "Welcome to RupeeRadar API"}
