from datetime import UTC, datetime

import httpx
from django.test import SimpleTestCase

from instagram.gateway import (
    AccountNotFoundError,
    GraphApiGateway,
    InstagramGatewayError,
    RateLimitedError,
)

SECRET_TOKEN = "secret-token-value"


def _gateway(handler) -> GraphApiGateway:
    return GraphApiGateway(
        ig_user_id="17840000000000000",
        access_token=SECRET_TOKEN,
        api_version="v24.0",
        base_url="https://graph.facebook.com",
        timeout_seconds=1.0,
        transport=httpx.MockTransport(handler),
    )


class GraphApiGatewayTests(SimpleTestCase):
    # テストケース: Business Discovery の正常応答を受け取る
    # 期待値: プロフィールと投稿を値オブジェクトへ変換し、リクエストに username と件数を含める
    def test_parses_business_discovery_response(self):
        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = request.url
            return httpx.Response(
                200,
                json={
                    "business_discovery": {
                        "username": "ramen_tokyo",
                        "name": "東京ラーメン日記",
                        "followers_count": 12345,
                        "media_count": 2,
                        "media": {
                            "data": [
                                {
                                    "id": "180001",
                                    "caption": "濃厚煮干し🍜",
                                    "permalink": "https://www.instagram.com/p/abc/",
                                    "media_type": "IMAGE",
                                    "media_url": "https://cdn.example/1.jpg",
                                    "timestamp": "2026-11-10T03:04:05+0000",
                                },
                                {"id": "180002", "media_type": "VIDEO"},
                            ]
                        },
                    },
                    "id": "17840000000000000",
                },
            )

        profile = _gateway(handler).fetch_profile("ramen_tokyo", 5)

        fields = captured["url"].params["fields"]
        self.assertIn("business_discovery.username(ramen_tokyo)", fields)
        self.assertIn("media.limit(5)", fields)
        self.assertEqual(captured["url"].path, "/v24.0/17840000000000000")
        self.assertEqual(profile.display_name, "東京ラーメン日記")
        self.assertEqual(profile.followers_count, 12345)
        self.assertEqual(len(profile.media), 2)
        self.assertEqual(profile.media[0].posted_at, datetime(2026, 11, 10, 3, 4, 5, tzinfo=UTC))
        self.assertEqual(profile.media[1].caption, "")
        self.assertEqual(profile.media[1].media_url, "")

    # テストケース: 個人アカウント等で「ユーザーが見つからない」エラーが返る
    # 期待値: AccountNotFoundError に変換する
    def test_translates_not_found_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                400,
                json={
                    "error": {"message": "Invalid user id", "code": 110, "error_subcode": 2207013}
                },
            )

        with self.assertRaises(AccountNotFoundError) as context:
            _gateway(handler).fetch_profile("someone", 5)
        self.assertIn("@someone", context.exception.message)

    # テストケース: 呼び出し上限エラー（code 4）が返る
    # 期待値: RateLimitedError に変換する
    def test_translates_rate_limit_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={"error": {"message": "limit", "code": 4}})

        with self.assertRaises(RateLimitedError):
            _gateway(handler).fetch_profile("someone", 5)

    # テストケース: 通信エラーが発生する
    # 期待値: アクセストークンを含まない汎用メッセージの例外になる
    def test_network_error_does_not_leak_token(self):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError(f"failed for {request.url}", request=request)

        with self.assertRaises(InstagramGatewayError) as context:
            _gateway(handler).fetch_profile("someone", 5)
        self.assertNotIn(SECRET_TOKEN, context.exception.message)
        self.assertIsNone(context.exception.__cause__)
