from pydantic import BaseModel, Field


class LoginInput(BaseModel):
    username: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=6, max_length=72)


class LoginOutput(BaseModel):
    id: int
    nombre: str
    username: str
    rol: str | None = None