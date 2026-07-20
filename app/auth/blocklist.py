import redis
from flask import current_app

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(current_app.config["REDIS_URL"], decode_responses=True)
    return _redis_client


def _key(jti: str) -> str:
    return f"jwt:blocklist:{jti}"


def add_to_blocklist(jti: str, expires_in_seconds: int) -> None:
    if expires_in_seconds <= 0:
        expires_in_seconds = 1
    get_redis().setex(_key(jti), expires_in_seconds, "revoked")


def is_blocklisted(jti: str) -> bool:
    return get_redis().exists(_key(jti)) == 1
