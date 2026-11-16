"""Instagram Graph API（Business Discovery）との境界。

外部 API の型・例外・アクセストークンはこのモジュールの外へ出さない。
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

import httpx
from django.conf import settings
from django.utils import timezone


@dataclass(frozen=True)
class FetchedMedia:
    media_id: str
    caption: str
    permalink: str
    media_type: str
    media_url: str
    thumbnail_url: str
    posted_at: datetime


@dataclass(frozen=True)
class FetchedProfile:
    username: str
    display_name: str
    profile_picture_url: str
    followers_count: int | None
    media_count: int | None
    media: tuple[FetchedMedia, ...]


class InstagramGatewayError(Exception):
    """利用者へそのまま表示してよい、秘密情報を含まないメッセージを持つ例外。"""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AccountNotFoundError(InstagramGatewayError):
    pass


class RateLimitedError(InstagramGatewayError):
    pass


class InstagramGateway(Protocol):
    mode: str

    def fetch_profile(self, username: str, media_limit: int) -> FetchedProfile: ...


_RATE_LIMIT_CODES = {4, 17, 32, 613, 80002}
_TOKEN_ERROR_CODE = 190
_NOT_FOUND_SUBCODE = 2207013


class GraphApiGateway:
    mode = "graph"

    def __init__(
        self,
        *,
        ig_user_id: str,
        access_token: str,
        api_version: str,
        base_url: str,
        timeout_seconds: float,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._ig_user_id = ig_user_id
        self._access_token = access_token
        self._endpoint = f"{base_url.rstrip('/')}/{api_version}/{ig_user_id}"
        self._timeout = timeout_seconds
        self._transport = transport

    def fetch_profile(self, username: str, media_limit: int) -> FetchedProfile:
        # username は normalize_username で検証済み（英数字・._ のみ）であることが前提。
        media_fields = "id,caption,permalink,media_type,media_url,thumbnail_url,timestamp"
        fields = (
            f"business_discovery.username({username})"
            "{username,name,profile_picture_url,followers_count,media_count,"
            f"media.limit({media_limit}){{{media_fields}}}}}"
        )
        try:
            with httpx.Client(timeout=self._timeout, transport=self._transport) as client:
                response = client.get(
                    self._endpoint,
                    params={"fields": fields, "access_token": self._access_token},
                )
        except httpx.HTTPError:
            # 例外メッセージには access_token を含む URL が入りうるため、外へ出さない。
            raise InstagramGatewayError("Instagram API に接続できませんでした。") from None

        payload = _json_or_empty(response)
        if response.status_code != 200 or "error" in payload:
            raise _translate_error(payload, username)

        discovery = payload.get("business_discovery")
        if not isinstance(discovery, dict):
            raise InstagramGatewayError("Instagram API の応答を解釈できませんでした。")
        return _parse_profile(discovery, username)


def _json_or_empty(response: httpx.Response) -> dict:
    try:
        data = response.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _translate_error(payload: dict, username: str) -> InstagramGatewayError:
    error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
    code = error.get("code")
    subcode = error.get("error_subcode")
    if subcode == _NOT_FOUND_SUBCODE or code == 110:
        return AccountNotFoundError(
            f"@{username} が見つかりません。"
            "ビジネス／クリエイターアカウントではない可能性があります。"
        )
    if code in _RATE_LIMIT_CODES:
        return RateLimitedError(
            "Instagram API の呼び出し上限に達しました。しばらく待ってから再取得してください。"
        )
    if code == _TOKEN_ERROR_CODE:
        return InstagramGatewayError(
            "アクセストークンが無効か期限切れです。.env の IG_ACCESS_TOKEN を更新してください。"
        )
    message = error.get("message")
    if isinstance(message, str) and message:
        return InstagramGatewayError(f"Instagram API エラー: {message[:300]}")
    return InstagramGatewayError("Instagram API から予期しない応答が返りました。")


def _parse_profile(discovery: dict, requested_username: str) -> FetchedProfile:
    media_items = discovery.get("media", {}).get("data", [])
    media = tuple(
        _parse_media(item) for item in media_items if isinstance(item, dict) and item.get("id")
    )
    return FetchedProfile(
        username=str(discovery.get("username") or requested_username),
        display_name=str(discovery.get("name") or ""),
        profile_picture_url=str(discovery.get("profile_picture_url") or ""),
        followers_count=_int_or_none(discovery.get("followers_count")),
        media_count=_int_or_none(discovery.get("media_count")),
        media=media,
    )


def _parse_media(item: dict) -> FetchedMedia:
    return FetchedMedia(
        media_id=str(item["id"]),
        caption=str(item.get("caption") or ""),
        permalink=str(item.get("permalink") or ""),
        media_type=str(item.get("media_type") or ""),
        # 2026-09 以降、ダウンロード設定や著作権チェックで media_url が返らない場合がある。
        media_url=str(item.get("media_url") or ""),
        thumbnail_url=str(item.get("thumbnail_url") or ""),
        posted_at=_parse_timestamp(item.get("timestamp")),
    )


def _parse_timestamp(value: object) -> datetime:
    if isinstance(value, str):
        try:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
        except ValueError:
            pass
    return timezone.now()


def _int_or_none(value: object) -> int | None:
    return value if isinstance(value, int) else None


class FakeGateway:
    """IG_USER_ID / IG_ACCESS_TOKEN 未設定時に使う、デモ用の決定的なダミーデータ。

    `missing` で始まるユーザー名は「見つからない」エラーを再現する。
    """

    mode = "fake"

    _SAMPLES = (
        ("IMAGE", "【新店】中目黒の路地裏に大衆酒場がオープン🍶 名物はレモンサワーと煮込み。"),
        ("CAROUSEL_ALBUM", "濃厚煮干しラーメン🍜 恵比寿駅徒歩5分。平日でも30分待ち。"),
        ("IMAGE", "神田の老舗居酒屋。刺し盛りがこのボリュームで1,500円は破格🐟"),
        ("VIDEO", "三軒茶屋でハシゴ酒するならここ！せんべろ3軒まとめ🍻"),
        ("IMAGE", "西荻窪の町中華。チャーハンと餃子で900円。#町中華"),
        ("IMAGE", "渋谷・宇田川町のつけ麺。〆の雑炊まで最高でした。"),
    )

    def fetch_profile(self, username: str, media_limit: int) -> FetchedProfile:
        if username.startswith("missing"):
            raise AccountNotFoundError(
                f"@{username} が見つかりません。"
                "ビジネス／クリエイターアカウントではない可能性があります。"
            )
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        offset = sum(ord(char) for char in username) % len(self._SAMPLES)
        media = tuple(
            FetchedMedia(
                media_id=f"fake_{username}_{index}",
                caption=self._SAMPLES[(offset + index) % len(self._SAMPLES)][1],
                permalink=f"https://www.instagram.com/{username}/",
                media_type=self._SAMPLES[(offset + index) % len(self._SAMPLES)][0],
                media_url="",
                thumbnail_url="",
                posted_at=now - timedelta(hours=offset * 3 + index * 19),
            )
            for index in range(min(media_limit, 4))
        )
        return FetchedProfile(
            username=username,
            display_name=f"{username}（デモ）",
            profile_picture_url="",
            followers_count=1000 + offset * 137,
            media_count=len(media),
            media=media,
        )


def build_gateway() -> InstagramGateway:
    if settings.IG_USER_ID and settings.IG_ACCESS_TOKEN:
        return GraphApiGateway(
            ig_user_id=settings.IG_USER_ID,
            access_token=settings.IG_ACCESS_TOKEN,
            api_version=settings.IG_GRAPH_API_VERSION,
            base_url=settings.IG_GRAPH_API_BASE_URL,
            timeout_seconds=settings.IG_HTTP_TIMEOUT_SECONDS,
        )
    return FakeGateway()
