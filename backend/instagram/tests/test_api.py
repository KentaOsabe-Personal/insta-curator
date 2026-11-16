from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from instagram.models import Post, Tab, TrackedAccount


class AccountApiTests(APITestCase):
    def setUp(self):
        # マイグレーションで作成される「ご飯」タブ
        self.food = Tab.objects.get(name="ご飯")

    # テストケース: プロフィール URL でアカウントをタブに登録する
    # 期待値: 201 で正規化済みユーザー名が保存され、同じタブへの二重登録は 400 になる
    def test_create_normalizes_and_rejects_duplicates(self):
        response = self.client.post(
            "/api/accounts",
            {
                "username": "https://www.instagram.com/Ramen_Tokyo/",
                "memo": "ラーメン",
                "tabId": self.food.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["username"], "ramen_tokyo")
        self.assertEqual(response.data["memo"], "ラーメン")
        self.assertTrue(response.data["isActive"])
        self.assertEqual(response.data["postCount"], 0)
        self.assertEqual(response.data["tabIds"], [self.food.id])

        duplicate = self.client.post(
            "/api/accounts", {"username": "@ramen_tokyo", "tabId": self.food.id}, format="json"
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("username", duplicate.data)

    # テストケース: 不正な文字を含むユーザー名、またはタブ未指定・存在しないタブで登録する
    # 期待値: 400 でエラーメッセージを返し、保存しない
    def test_create_rejects_invalid_input(self):
        invalid = self.client.post(
            "/api/accounts", {"username": "bad name!", "tabId": self.food.id}, format="json"
        )
        self.assertEqual(invalid.status_code, 400)
        no_tab = self.client.post("/api/accounts", {"username": "ramen"}, format="json")
        self.assertEqual(no_tab.status_code, 400)
        self.assertIn("tabId", no_tab.data)
        unknown_tab = self.client.post(
            "/api/accounts", {"username": "ramen", "tabId": 9999}, format="json"
        )
        self.assertEqual(unknown_tab.status_code, 400)
        self.assertFalse(TrackedAccount.objects.exists())

    # テストケース: 「ご飯」に登録済みのアカウントを「デート」タブにも登録し、タブで絞り込む
    # 期待値: 200 で同じアカウントに2つのタブが付き、タブ指定の一覧にはそのタブのアカウントだけが返る
    def test_create_existing_account_adds_to_another_tab(self):
        date = Tab.objects.create(name="デート", position=1)
        account = TrackedAccount.objects.create(username="bistro")
        account.tabs.add(self.food)
        TrackedAccount.objects.create(username="ramen").tabs.add(self.food)
        Post.objects.create(account=account, media_id="m1", posted_at=timezone.now())

        response = self.client.post(
            "/api/accounts",
            {"username": "@bistro", "memo": "記念日", "tabId": date.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], account.id)
        self.assertEqual(response.data["tabIds"], sorted([self.food.id, date.id]))
        self.assertEqual(response.data["memo"], "記念日")
        self.assertEqual(response.data["postCount"], 1)
        self.assertEqual(TrackedAccount.objects.count(), 2)

        listed = self.client.get(f"/api/accounts?tab={date.id}")
        self.assertEqual([item["username"] for item in listed.data], ["bistro"])
        self.assertEqual(listed.data[0]["postCount"], 1)
        all_accounts = self.client.get("/api/accounts")
        self.assertEqual([item["username"] for item in all_accounts.data], ["bistro", "ramen"])
        invalid = self.client.get("/api/accounts?tab=abc")
        self.assertEqual(invalid.status_code, 400)

    # テストケース: 2つのタブに属するアカウントを片方のタブから外し、続けて残りのタブからも外す
    # 期待値: 1回目はタブの所属だけが外れ投稿は残り、2回目でアカウントと投稿が削除される
    def test_remove_from_tab_deletes_account_only_when_last_tab(self):
        date = Tab.objects.create(name="デート", position=1)
        account = TrackedAccount.objects.create(username="bistro")
        account.tabs.add(self.food, date)
        Post.objects.create(account=account, media_id="m1", posted_at=timezone.now())

        first = self.client.delete(f"/api/tabs/{date.id}/accounts/{account.id}")
        self.assertEqual(first.status_code, 204)
        account.refresh_from_db()
        self.assertEqual(list(account.tabs.all()), [self.food])
        self.assertTrue(Post.objects.exists())

        again = self.client.delete(f"/api/tabs/{date.id}/accounts/{account.id}")
        self.assertEqual(again.status_code, 404)

        last = self.client.delete(f"/api/tabs/{self.food.id}/accounts/{account.id}")
        self.assertEqual(last.status_code, 204)
        self.assertFalse(TrackedAccount.objects.exists())
        self.assertFalse(Post.objects.exists())

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

    # テストケース: 「ご飯」と「服」に1アカウントずつある状態で、tabId を指定して全件取得する
    # 期待値: 指定したタブのアカウントだけを取得し、不正な tabId は 400 になる
    def test_fetch_all_limited_to_tab(self):
        food = Tab.objects.get(name="ご飯")
        fashion = Tab.objects.create(name="服", position=1)
        TrackedAccount.objects.create(username="ramen").tabs.add(food)
        TrackedAccount.objects.create(username="vintage").tabs.add(fashion)

        response = self.client.post(
            "/api/fetch", {"force": True, "tabId": fashion.id}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["username"] for item in response.data["results"]], ["vintage"])
        self.assertFalse(Post.objects.filter(account__username="ramen").exists())

        invalid = self.client.post("/api/fetch", {"force": True, "tabId": "1"}, format="json")
        self.assertEqual(invalid.status_code, 400)


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

    # テストケース: 2つのタブに属するアカウントと片方だけのアカウントの投稿を、タブ指定で取得する
    # 期待値: そのタブのアカウントの投稿だけが重複なく返る
    def test_lists_posts_by_tab(self):
        now = timezone.now()
        food = Tab.objects.get(name="ご飯")
        date = Tab.objects.create(name="デート", position=1)
        both = TrackedAccount.objects.create(username="both")
        both.tabs.add(food, date)
        food_only = TrackedAccount.objects.create(username="food_only")
        food_only.tabs.add(food)
        Post.objects.create(account=both, media_id="a", posted_at=now - timedelta(hours=1))
        Post.objects.create(account=food_only, media_id="b", posted_at=now)

        food_posts = self.client.get(f"/api/posts?tab={food.id}")
        self.assertEqual([post["mediaId"] for post in food_posts.data["posts"]], ["b", "a"])
        date_posts = self.client.get(f"/api/posts?tab={date.id}")
        self.assertEqual([post["mediaId"] for post in date_posts.data["posts"]], ["a"])

    # テストケース: 動作モードを取得する
    # 期待値: トークン未設定のテスト環境では fake を返す
    def test_status_reports_fake_mode(self):
        response = self.client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mode"], "fake")


class TabApiTests(APITestCase):
    # テストケース: 初期状態のタブ一覧を取得し、新しいタブを作成・名前変更する
    # 期待値: 「ご飯」が最初にあり、新しいタブは末尾に追加され、空や重複の名前は 400 になる
    def test_list_create_and_rename(self):
        initial = self.client.get("/api/tabs")
        self.assertEqual(initial.status_code, 200)
        self.assertEqual([tab["name"] for tab in initial.data], ["ご飯"])

        created = self.client.post("/api/tabs", {"name": " ファッション "}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["name"], "ファッション")
        self.assertEqual(created.data["accountCount"], 0)

        duplicate = self.client.post("/api/tabs", {"name": "ご飯"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.data["name"], ["「ご飯」タブは作成済みです。"])
        blank = self.client.post("/api/tabs", {"name": "  "}, format="json")
        self.assertEqual(blank.status_code, 400)

        renamed = self.client.patch(
            f"/api/tabs/{created.data['id']}", {"name": "服"}, format="json"
        )
        self.assertEqual(renamed.status_code, 200)
        listed = self.client.get("/api/tabs")
        self.assertEqual([tab["name"] for tab in listed.data], ["ご飯", "服"])

        rename_duplicate = self.client.patch(
            f"/api/tabs/{created.data['id']}", {"name": "ご飯"}, format="json"
        )
        self.assertEqual(rename_duplicate.status_code, 400)
        self.assertEqual(rename_duplicate.data["name"], ["「ご飯」タブは作成済みです。"])

    # テストケース: アカウントのあるタブ、空のタブ、最後の1つのタブを順に削除する
    # 期待値: アカウントのあるタブと最後のタブは 400 で残り、空のタブだけ削除される
    def test_delete_only_empty_and_not_last(self):
        food = Tab.objects.get(name="ご飯")
        TrackedAccount.objects.create(username="ramen").tabs.add(food)
        empty = Tab.objects.create(name="空", position=1)

        not_empty = self.client.delete(f"/api/tabs/{food.id}")
        self.assertEqual(not_empty.status_code, 400)

        deleted = self.client.delete(f"/api/tabs/{empty.id}")
        self.assertEqual(deleted.status_code, 204)

        TrackedAccount.objects.all().delete()
        last = self.client.delete(f"/api/tabs/{food.id}")
        self.assertEqual(last.status_code, 400)
        self.assertTrue(Tab.objects.filter(pk=food.pk).exists())
