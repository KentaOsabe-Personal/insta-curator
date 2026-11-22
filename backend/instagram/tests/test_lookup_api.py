from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from rest_framework.test import APITestCase

from instagram.gateway import InstagramGatewayError
from instagram.models import Post, Tab, TrackedAccount


class _FailingGateway:
    """Instagram API の呼び出しを、指定した例外で失敗させるテスト用の gateway。"""

    mode = "graph"

    def __init__(self, error: Exception) -> None:
        self._error = error

    def fetch_profile(self, username: str, media_limit: int):
        raise self._error


class AccountLookupApiTests(APITestCase):
    def setUp(self):
        # マイグレーションで作成される「ご飯」タブ
        self.food = Tab.objects.get(name="ご飯")

    def _lookup(self, username: str, tab_id: object):
        return self.client.get("/api/accounts/lookup", {"username": username, "tabId": tab_id})

    # テストケース: 未登録の有効なアカウントをプロフィール URL で確認する（fake モード）
    # 期待値: 正規化したユーザー名のプロフィールと最新投稿3件、登録状況 none を返し、DB には何も書き込まない
    def test_lookup_unregistered_account_returns_profile_without_saving(self):
        response = self._lookup("https://www.instagram.com/Ramen_Tokyo/", self.food.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "ramen_tokyo")
        self.assertEqual(response.data["displayName"], "ramen_tokyo（デモ）")
        self.assertIsInstance(response.data["followersCount"], int)
        self.assertEqual(len(response.data["posts"]), 3)
        self.assertEqual(response.data["registration"], "none")
        self.assertFalse(TrackedAccount.objects.exists())
        self.assertFalse(Post.objects.exists())

    # テストケース: 見つからない（または個人アカウントで取得できない）アカウントを確認する（fake の missing*）
    # 期待値: 404 で not_found とメッセージを返し、DB には何も書き込まない
    def test_lookup_missing_account_returns_not_found(self):
        response = self._lookup("@missing_shop", self.food.id)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["kind"], "not_found")
        self.assertIn("@missing_shop が見つかりません", response.data["detail"])
        self.assertFalse(TrackedAccount.objects.exists())

    # テストケース: トークン切れなどで Instagram API がエラーを返す状態で確認する
    # 期待値: 502 で api_error とメッセージを返し、DB には何も書き込まない
    def test_lookup_api_error_is_distinguished_from_not_found(self):
        token_error = InstagramGatewayError("アクセストークンが無効か期限切れです。")
        with patch("instagram.views.build_gateway", return_value=_FailingGateway(token_error)):
            response = self._lookup("ramen_tokyo", self.food.id)

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["kind"], "api_error")
        self.assertEqual(response.data["detail"], "アクセストークンが無効か期限切れです。")
        self.assertFalse(TrackedAccount.objects.exists())

    # テストケース: 「デート」タブに登録済み・投稿4件保存済みのアカウントを「ご飯」タブで確認する
    # 期待値: Instagram API を呼ばずに、DB のプロフィールと新しい順の投稿3件、登録状況 other_tab を返す
    def test_lookup_account_in_other_tab_uses_saved_data_without_api(self):
        date = Tab.objects.create(name="デート", position=1)
        account = TrackedAccount.objects.create(
            username="bistro",
            display_name="ビストロ公式",
            followers_count=500,
            media_count=40,
            last_fetched_at=datetime(2026, 11, 5, tzinfo=UTC),
        )
        account.tabs.add(date)
        base = datetime(2026, 11, 1, tzinfo=UTC)
        for day in range(4):
            Post.objects.create(
                account=account, media_id=f"m{day}", posted_at=base + timedelta(days=day)
            )

        never_called = _FailingGateway(AssertionError("Instagram API を呼んではいけない"))
        with patch("instagram.views.build_gateway", return_value=never_called):
            response = self._lookup("@bistro", self.food.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["registration"], "other_tab")
        self.assertEqual(response.data["displayName"], "ビストロ公式")
        self.assertEqual(response.data["followersCount"], 500)
        self.assertEqual(response.data["mediaCount"], 40)
        self.assertEqual([post["mediaId"] for post in response.data["posts"]], ["m3", "m2", "m1"])
        self.assertEqual(TrackedAccount.objects.get().tabs.count(), 1)

    # テストケース: 確認機能より前に「デート」タブへ登録され、一度も取得に成功していないアカウントを確認する
    # 期待値: 保存済みの情報を使わずに Instagram API で確認し、見つからなければ 404 not_found を返す
    def test_lookup_never_fetched_account_in_other_tab_checks_api(self):
        date = Tab.objects.create(name="デート", position=1)
        TrackedAccount.objects.create(
            username="missing_old", last_fetch_error="@missing_old が見つかりません。"
        ).tabs.add(date)

        response = self._lookup("missing_old", self.food.id)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["kind"], "not_found")

    # テストケース: 「ご飯」タブに登録済みのアカウントを「ご飯」タブで確認する
    # 期待値: 登録状況 this_tab を返す（画面で登録ボタンを無効にするため）
    def test_lookup_account_in_this_tab_reports_this_tab(self):
        TrackedAccount.objects.create(username="ramen").tabs.add(self.food)

        response = self._lookup("ramen", self.food.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["registration"], "this_tab")

    # テストケース: 不正な文字を含むユーザー名、タブ未指定、存在しないタブで確認する
    # 期待値: 400 で項目ごとのエラーメッセージを返す
    def test_lookup_rejects_invalid_input(self):
        invalid_name = self._lookup("bad name!", self.food.id)
        self.assertEqual(invalid_name.status_code, 400)
        self.assertIn("username", invalid_name.data)

        no_tab = self.client.get("/api/accounts/lookup", {"username": "ramen"})
        self.assertEqual(no_tab.status_code, 400)
        self.assertIn("tabId", no_tab.data)

        unknown_tab = self._lookup("ramen", 9999)
        self.assertEqual(unknown_tab.status_code, 400)
        self.assertEqual(unknown_tab.data["tabId"], ["タブが見つかりません。"])
