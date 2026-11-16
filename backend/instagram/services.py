from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from django.db import transaction
from django.utils import timezone

from .gateway import InstagramGateway, InstagramGatewayError
from .models import Post, TrackedAccount

FetchStatus = Literal["ok", "skipped", "error"]


@dataclass(frozen=True)
class FetchResult:
    account_id: int
    username: str
    status: FetchStatus
    new_posts: int = 0
    error: str = ""


def fetch_account(
    account: TrackedAccount,
    gateway: InstagramGateway,
    *,
    media_limit: int,
    now: datetime | None = None,
) -> FetchResult:
    """1アカウント分の最新投稿を取得し、プロフィールと投稿を保存する。"""
    now = now or timezone.now()
    try:
        profile = gateway.fetch_profile(account.username, media_limit)
    except InstagramGatewayError as error:
        account.last_fetch_error = error.message[:500]
        account.save(update_fields=["last_fetch_error", "updated_at"])
        return FetchResult(account.id, account.username, "error", error=account.last_fetch_error)

    with transaction.atomic():
        existing_ids = set(
            Post.objects.filter(
                media_id__in=[media.media_id for media in profile.media]
            ).values_list("media_id", flat=True)
        )
        for media in profile.media:
            Post.objects.update_or_create(
                media_id=media.media_id,
                defaults={
                    "account": account,
                    "caption": media.caption,
                    "permalink": media.permalink,
                    "media_type": media.media_type,
                    "media_url": media.media_url,
                    "thumbnail_url": media.thumbnail_url,
                    "posted_at": media.posted_at,
                },
            )

        account.display_name = profile.display_name[:200]
        account.profile_picture_url = profile.profile_picture_url
        account.followers_count = profile.followers_count
        account.media_count = profile.media_count
        account.last_fetched_at = now
        account.last_fetch_error = ""
        account.save()

    new_posts = sum(1 for media in profile.media if media.media_id not in existing_ids)
    return FetchResult(account.id, account.username, "ok", new_posts=new_posts)


def fetch_active_accounts(
    gateway: InstagramGateway,
    *,
    force: bool,
    media_limit: int,
    min_interval: timedelta,
    now: datetime | None = None,
) -> list[FetchResult]:
    """有効なアカウントをまとめて取得する。

    force=False（起動時の自動取得）では、前回取得から min_interval 以内のアカウントを
    スキップして API の呼び出し上限を節約する。
    """
    now = now or timezone.now()
    results: list[FetchResult] = []
    for account in TrackedAccount.objects.filter(is_active=True).order_by("username"):
        recently_fetched = (
            account.last_fetched_at is not None and now - account.last_fetched_at < min_interval
        )
        if not force and recently_fetched:
            results.append(FetchResult(account.id, account.username, "skipped"))
            continue
        results.append(fetch_account(account, gateway, media_limit=media_limit, now=now))
    return results
