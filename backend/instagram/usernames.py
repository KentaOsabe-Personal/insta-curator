import re
from urllib.parse import urlparse

# Instagram のユーザー名: 英数字・ピリオド・アンダースコア、30文字以内
_USERNAME_PATTERN = re.compile(r"^[a-z0-9._]{1,30}$")


class InvalidUsernameError(ValueError):
    pass


def normalize_username(raw: str) -> str:
    """`@name`、`name`、プロフィール URL のいずれからもユーザー名を取り出して正規化する。

    取り出した値は Graph API の fields 式へ埋め込むため、許可文字以外は必ず拒否する。
    """
    value = raw.strip()
    if "instagram.com" in value:
        parsed = urlparse(value if "://" in value else f"https://{value}")
        segments = [segment for segment in parsed.path.split("/") if segment]
        value = segments[0] if segments else ""
    value = value.removeprefix("@").lower()

    if not _USERNAME_PATTERN.fullmatch(value):
        raise InvalidUsernameError(
            "ユーザー名は英数字・ピリオド・アンダースコアの30文字以内で入力してください。"
        )
    return value
