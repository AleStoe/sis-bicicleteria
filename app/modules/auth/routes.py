from fastapi import APIRouter

from .schema import LoginInput, LoginOutput
from .service import login_service


router = APIRouter()


@router.post("/login", response_model=LoginOutput)
def login(data: LoginInput):
    return login_service(data)


@router.get("/status")
def status():
    return {"status": "ok"}
