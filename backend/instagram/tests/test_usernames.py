from django.test import SimpleTestCase

from instagram.usernames import InvalidUsernameError, normalize_username


class NormalizeUsernameTests(SimpleTestCase):
    # テストケース: @付き・大文字混じりのユーザー名を渡す
    # 期待値: @を除いた小文字のユーザー名になる
    def test_strips_at_mark_and_lowercases(self):
        self.assertEqual(normalize_username("  @Ramen.Tokyo_ "), "ramen.tokyo_")

    # テストケース: プロフィール URL（クエリ付き・スキームなし）を渡す
    # 期待値: パス先頭のユーザー名だけを取り出す
    def test_extracts_username_from_profile_url(self):
        self.assertEqual(
            normalize_username("https://www.instagram.com/izakaya_lover/?igsh=abc"),
            "izakaya_lover",
        )
        self.assertEqual(normalize_username("instagram.com/izakaya_lover"), "izakaya_lover")

    # テストケース: Graph API の fields 式を壊す文字や長すぎる値を渡す
    # 期待値: InvalidUsernameError で拒否する
    def test_rejects_unsafe_or_invalid_values(self):
        for value in ["", "@", "name){id}", "a b", "x" * 31, "日本語"]:
            with self.subTest(value=value), self.assertRaises(InvalidUsernameError):
                normalize_username(value)
