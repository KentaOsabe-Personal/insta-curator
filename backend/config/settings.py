import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name, "").strip()
    return int(value) if value else default


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or "dev-only-insecure-secret-key"
DEBUG = _env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "health",
    "instagram",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "HOST": os.environ.get("MYSQL_HOST", "db"),
        "PORT": os.environ.get("MYSQL_PORT", "3306"),
        "NAME": os.environ.get("MYSQL_DATABASE", "insta_curator"),
        "USER": os.environ.get("MYSQL_USER", "insta_curator"),
        "PASSWORD": os.environ.get("MYSQL_PASSWORD", ""),
        "OPTIONS": {"charset": "utf8mb4"},
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

# ローカル専用の個人ツールのため、認証は持たない（compose で 127.0.0.1 にのみ公開する）。
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "UNAUTHENTICATED_USER": None,
}

# Instagram Graph API（Business Discovery）
IG_USER_ID = os.environ.get("IG_USER_ID", "").strip()
IG_ACCESS_TOKEN = os.environ.get("IG_ACCESS_TOKEN", "").strip()
IG_GRAPH_API_VERSION = os.environ.get("IG_GRAPH_API_VERSION", "").strip() or "v27.0"
IG_GRAPH_API_BASE_URL = "https://graph.facebook.com"
IG_MEDIA_LIMIT = _env_int("IG_MEDIA_LIMIT", 12)
IG_MIN_FETCH_INTERVAL_MINUTES = _env_int("IG_MIN_FETCH_INTERVAL_MINUTES", 30)
IG_HTTP_TIMEOUT_SECONDS = 15.0
