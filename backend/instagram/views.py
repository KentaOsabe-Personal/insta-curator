from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .gateway import build_gateway
from .models import Post, Tab, TrackedAccount
from .serializers import (
    AccountCreateSerializer,
    PostSerializer,
    TabSerializer,
    TrackedAccountSerializer,
    serialize_fetch_result,
)
from .services import fetch_account, fetch_active_accounts

_MAX_POST_LIMIT = 200


class InvalidQueryParam(ValueError):
    pass


def _read_id_param(request: Request, name: str) -> int | None:
    value = request.query_params.get(name)
    if not value:
        return None
    if not value.isdigit():
        raise InvalidQueryParam(f"{name} は数値で指定してください。")
    return int(value)


def _bad_request(message: str) -> Response:
    return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)


def _accounts_queryset() -> QuerySet[TrackedAccount]:
    return TrackedAccount.objects.annotate(
        post_count=Count("posts", distinct=True)
    ).prefetch_related("tabs")


class StatusView(APIView):
    def get(self, request: Request) -> Response:
        return Response(
            {
                "mode": build_gateway().mode,
                "minFetchIntervalMinutes": settings.IG_MIN_FETCH_INTERVAL_MINUTES,
                "mediaLimit": settings.IG_MEDIA_LIMIT,
            }
        )


class TabListCreateView(generics.ListCreateAPIView):
    serializer_class = TabSerializer
    pagination_class = None

    def get_queryset(self):
        return Tab.objects.annotate(account_count=Count("accounts", distinct=True))

    def perform_create(self, serializer: TabSerializer) -> None:
        last = Tab.objects.order_by("-position").first()
        serializer.save(position=(last.position + 1) if last else 0)


class TabDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TabSerializer
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        return Tab.objects.annotate(account_count=Count("accounts", distinct=True))

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        tab = self.get_object()
        if tab.accounts.exists():
            return _bad_request(
                "アカウントが登録されているタブは削除できません。先にアカウントを外してください。"
            )
        if Tab.objects.count() <= 1:
            return _bad_request("最後のタブは削除できません。")
        tab.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TabAccountDetailView(APIView):
    """タブからアカウントを外す。どのタブにも属さなくなったアカウントは投稿ごと削除する。"""

    def delete(self, request: Request, tab_id: int, account_id: int) -> Response:
        tab = get_object_or_404(Tab, pk=tab_id)
        account = get_object_or_404(TrackedAccount, pk=account_id, tabs=tab)
        with transaction.atomic():
            account.tabs.remove(tab)
            if not account.tabs.exists():
                account.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AccountListCreateView(generics.ListAPIView):
    serializer_class = TrackedAccountSerializer
    pagination_class = None

    def list(self, request: Request, *args, **kwargs) -> Response:
        try:
            tab_id = _read_id_param(request, "tab")
        except InvalidQueryParam as error:
            return _bad_request(str(error))
        accounts = _accounts_queryset()
        if tab_id is not None:
            accounts = accounts.filter(tabs=tab_id)
        serializer = self.get_serializer(accounts.order_by("username"), many=True)
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        """タブにアカウントを登録する。

        未登録なら作成（201）、他のタブに登録済みならこのタブへ追加（200）、
        このタブに登録済みならエラー（400）。
        """
        input_serializer = AccountCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        username: str = input_serializer.validated_data["username"]
        memo: str = input_serializer.validated_data["memo"]
        tab: Tab = input_serializer.validated_data["tabId"]

        with transaction.atomic():
            account, created = TrackedAccount.objects.get_or_create(
                username=username, defaults={"memo": memo}
            )
            if not created and account.tabs.filter(pk=tab.pk).exists():
                return Response(
                    {"username": [f"@{username} はこのタブに登録済みです。"]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not created and memo and not account.memo:
                account.memo = memo
                account.save(update_fields=["memo", "updated_at"])
            account.tabs.add(tab)

        output = TrackedAccountSerializer(_accounts_queryset().get(pk=account.pk))
        return Response(
            output.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class AccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TrackedAccountSerializer
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        return _accounts_queryset()


class AccountFetchView(APIView):
    """1アカウントを手動で取得する（間隔制限なし）。"""

    def post(self, request: Request, pk: int) -> Response:
        account = get_object_or_404(TrackedAccount, pk=pk)
        result = fetch_account(account, build_gateway(), media_limit=settings.IG_MEDIA_LIMIT)
        return Response({"results": [serialize_fetch_result(result)]})


class FetchAllView(APIView):
    """有効な全アカウントを取得する。force=false では最近取得したアカウントをスキップする。"""

    def post(self, request: Request) -> Response:
        force = request.data.get("force") is True
        tab_id = request.data.get("tabId")
        if tab_id is not None and (not isinstance(tab_id, int) or isinstance(tab_id, bool)):
            return _bad_request("tabId は数値で指定してください。")
        results = fetch_active_accounts(
            build_gateway(),
            force=force,
            media_limit=settings.IG_MEDIA_LIMIT,
            min_interval=timedelta(minutes=settings.IG_MIN_FETCH_INTERVAL_MINUTES),
            tab_id=tab_id,
        )
        return Response(
            {"results": [serialize_fetch_result(result) for result in results]},
            status=status.HTTP_200_OK,
        )


class PostListView(APIView):
    def get(self, request: Request) -> Response:
        posts = Post.objects.select_related("account").filter(account__is_active=True)

        try:
            tab_id = _read_id_param(request, "tab")
            account_id = _read_id_param(request, "account")
        except InvalidQueryParam as error:
            return _bad_request(str(error))
        if tab_id is not None:
            posts = posts.filter(account__tabs=tab_id)
        if account_id is not None:
            posts = posts.filter(account_id=account_id)

        limit_param = request.query_params.get("limit", "60")
        limit = int(limit_param) if limit_param.isdigit() else 60
        limit = max(1, min(limit, _MAX_POST_LIMIT))

        serializer = PostSerializer(posts.order_by("-posted_at")[:limit], many=True)
        return Response({"posts": serializer.data})
