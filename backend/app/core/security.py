import hmac, time, uuid
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings

bearer = HTTPBearer(auto_error=False)


def issue_session(key: str | None = None):
    role = "external"
    if key:
        if not settings.internal_access_key or not hmac.compare_digest(
            key, settings.internal_access_key
        ):
            raise HTTPException(401, "Clave interna inválida")
        role = "internal"
    payload = {
        "sub": str(uuid.uuid4()),
        "role": role,
        "exp": int(time.time()) + 7 * 86400,
        "iss": "high-garden",
    }
    return {
        "token": jwt.encode(payload, settings.jwt_secret, algorithm="HS256"),
        "role": role,
    }


async def principal(auth: HTTPAuthorizationCredentials | None = Depends(bearer)):
    try:
        if not auth:
            raise ValueError()
        p = jwt.decode(
            auth.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer="high-garden",
        )
        if p["role"] not in {"internal", "external"}:
            raise ValueError()
        uuid.UUID(p["sub"])
        return {"owner": p["sub"], "role": p["role"]}
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Sesión inválida o expirada")
