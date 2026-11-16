from datetime import timedelta

from django.conf import settings
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .gateway import build_gateway
from .models import Post, TrackedAccount
from .serializers import PostSerializer, TrackedAccountSerializer, serialize_fetch_result
from .services import fetch_account, fetch_active_accounts

_MAX_POST_LIMIT = 200


class StatusView(APIView):
    def get(self, request: Request) -> Response:
        return Response(
            {
                "mode": build_gateway().mode,
                "minFetchIntervalMinutes": settings.IG_MIN_FETCH_INTERVAL_MINUTES,
                "mediaLimit": settings.IG_MEDIA_LIMIT,
            }
        )


class AccountListCreateView(generics.ListCreateAPIView):
    serializer_class = TrackedAccountSerializer
    pagination_class = None

    def get_queryset(self):
        return TrackedAccount.objects.annotate(post_count=Count("posts")).order_by("username")


class AccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TrackedAccountSerializer
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        return TrackedAccount.objects.annotate(post_count=Count("posts"))


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
        results = fetch_active_accounts(
            build_gateway(),
            force=force,
            media_limit=settings.IG_MEDIA_LIMIT,
            min_interval=timedelta(minutes=settings.IG_MIN_FETCH_INTERVAL_MINUTES),
        )
        return Response(
            {"results": [serialize_fetch_result(result) for result in results]},
            status=status.HTTP_200_OK,
        )


class PostListView(APIView):
    def get(self, request: Request) -> Response:
        posts = Post.objects.select_related("account").filter(account__is_active=True)

        account_param = request.query_params.get("account")
        if account_param:
            if not account_param.isdigit():
                return Response(
                    {"detail": "account は数値で指定してください。"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            posts = posts.filter(account_id=int(account_param))

        limit_param = request.query_params.get("limit", "60")
        limit = int(limit_param) if limit_param.isdigit() else 60
        limit = max(1, min(limit, _MAX_POST_LIMIT))

        serializer = PostSerializer(posts.order_by("-posted_at")[:limit], many=True)
        return Response({"posts": serializer.data})
