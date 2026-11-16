from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from instagram.models import Post, TrackedAccount


class AccountApiTests(APITestCase):
    # テストケース: プロフィール URL でアカウントを登録する
    # 期待値: 201 で正規化済みユーザー名が保存され、二重登録は 400 になる
    def test_create_normalizes_and_rejects_duplicates(self):
        response = self.client.post(
            "/api/accounts",
            {"username": "https://www.instagram.com/Ramen_Tokyo/", "memo": "ラーメン"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["username"], "ramen_tokyo")
        self.assertEqual(response.data["memo"], "ラーメン")
        self.assertTrue(response.data["isActive"])
        self.assertEqual(response.data["postCount"], 0)

        duplicate = self.client.post("/api/accounts", {"username": "@ramen_tokyo"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("username", duplicate.data)

    # テストケース: 不正な文字を含むユーザー名を登録する
    # 期待値: 400 でエラーメッセージを返し、保存しない
    def test_create_rejects_invalid_username(self):
        response = self.client.post("/api/accounts", {"username": "bad name!"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TrackedAccount.objects.exists())

    # テストケース: メモと有効状態を PATCH し、その後 DELETE する
    # 期待値: 更新内容が返り、削除後は投稿も含めて消える
    def test_update_and_delete(self):
        account = TrackedAccount.objects.create(username="izakaya")
        Post.objects.create(account=account, media_id="m1", posted_at=timezone.now())

        response = self.client.patch(
            f"/api/accounts/{account.id}", {"memo": "居酒屋", "isActive": False}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["memo"], "居酒屋")
        self.assertFalse(response.data["isActive"])
        self.assertEqual(response.data["postCount"], 1)

        deleted = self.client.delete(f"/api/accounts/{account.id}")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Post.objects.exists())


class FetchApiTests(APITestCase):
    # テストケース: fake モードで1アカウントを手動取得し、もう一度取得する
    # 期待値: 初回は新着として保存され、2回目は重複保存せず新着0件になる
    def test_fetch_single_account_is_idempotent(self):
        account = TrackedAccount.objects.create(username="ramen_tokyo")

        first = self.client.post(f"/api/accounts/{account.id}/fetch")
        self.assertEqual(first.status_code, 200)
        result = first.data["results"][0]
        self.assertEqual(result["status"], "ok")
        self.assertGreater(result["newPosts"], 0)
        saved = Post.objects.count()

        second = self.client.post(f"/api/accounts/{account.id}/fetch")
        self.assertEqual(second.data["results"][0]["newPosts"], 0)
        self.assertEqual(Post.objects.count(), saved)

        account.refresh_from_db()
        self.assertIsNotNone(account.last_fetched_at)
        self.assertEqual(account.display_name, "ramen_tokyo（デモ）")

    # テストケース: 見つからないアカウント（fake の missing*）を取得する
    # 期待値: status=error とメッセージを返し、アカウントにエラーを記録する
    def test_fetch_records_error(self):
        account = TrackedAccount.objects.create(username="missing_shop")

        response = self.client.post(f"/api/accounts/{account.id}/fetch")
        result = response.data["results"][0]
        self.assertEqual(result["status"], "error")
        self.assertIn("見つかりません", result["error"])
        account.refresh_from_db()
        self.assertIn("見つかりません", account.last_fetch_error)

    # テストケース: 直近取得済み・未取得・無効の3アカウントで起動時取得（force=false）と手動（force=true）を行う
    # 期待値: 自動取得は直近取得済みをスキップし無効は対象外、手動取得は全有効アカウントを取得する
    def test_fetch_all_respects_interval_unless_forced(self):
        recent = TrackedAccount.objects.create(
            username="recent", last_fetched_at=timezone.now() - timedelta(minutes=5)
        )
        stale = TrackedAccount.objects.create(username="stale")
        TrackedAccount.objects.create(username="inactive", is_active=False)

        auto = self.client.post("/api/fetch", {"force": False}, format="json")
        statuses = {item["username"]: item["status"] for item in auto.data["results"]}
        self.assertEqual(statuses, {"recent": "skipped", "stale": "ok"})

        manual = self.client.post("/api/fetch", {"force": True}, format="json")
        statuses = {item["username"]: item["status"] for item in manual.data["results"]}
        self.assertEqual(statuses, {"recent": "ok", "stale": "ok"})
        self.assertTrue(Post.objects.filter(account=recent).exists())
        self.assertTrue(Post.objects.filter(account=stale).exists())


class PostApiTests(APITestCase):
    # テストケース: 2アカウント分の投稿と無効アカウントの投稿がある状態で一覧を取得する
    # 期待値: 有効アカウントの投稿だけが新しい順で返り、account 指定で絞り込める
    def test_lists_posts_newest_first_with_filter(self):
        now = timezone.now()
        first = TrackedAccount.objects.create(username="first")
        second = TrackedAccount.objects.create(username="second")
        hidden = TrackedAccount.objects.create(username="hidden", is_active=False)
        Post.objects.create(account=first, media_id="a", posted_at=now - timedelta(hours=2))
        Post.objects.create(account=second, media_id="b", posted_at=now - timedelta(hours=1))
        Post.objects.create(account=hidden, media_id="c", posted_at=now)

        response = self.client.get("/api/posts")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([post["mediaId"] for post in response.data["posts"]], ["b", "a"])
        self.assertEqual(response.data["posts"][0]["username"], "second")

        filtered = self.client.get(f"/api/posts?account={first.id}")
        self.assertEqual([post["mediaId"] for post in filtered.data["posts"]], ["a"])

        invalid = self.client.get("/api/posts?account=abc")
        self.assertEqual(invalid.status_code, 400)

    # テストケース: 動作モードを取得する
    # 期待値: トークン未設定のテスト環境では fake を返す
    def test_status_reports_fake_mode(self):
        response = self.client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mode"], "fake")
