import os

# テストでは実トークンを持ち込まず、外部 API を呼ばない。
os.environ["IG_USER_ID"] = ""
os.environ["IG_ACCESS_TOKEN"] = ""

from .settings import *  # noqa: E402,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
