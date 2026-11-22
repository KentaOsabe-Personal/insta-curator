# insta-curator

Instagram で自分が選んだアカウントの投稿だけを集めて見る、個人用のローカルツール。構成・起動方法・API は `README.md` を参照。

## 作業ルール

- ユーザーへの回答・質問・進捗報告はすべて日本語で書く（コード、コマンド、識別子はそのまま）
- ブランチは `develop` から切り、PR も `develop` 宛てに出す。`main` へ直接コミットしない
- スペックの実装でまとめ用ブランチ（integration branch）を作るときも、`develop` を起点にする
- 仕様、チケット、ADR、用語集、コミットメッセージ、PR 本文は日本語で書く
- `.env` はコミットしない。秘密情報は `.env.example` にダミー値だけを書く
- 認証なしのローカル専用ツールなので、ポートは `127.0.0.1` にだけ公開する設定を変えない

## テスト・チェック

変更後は、触った側のチェックを実行する。

```bash
docker compose run --rm --no-deps backend sh -c "DJANGO_SETTINGS_MODULE=config.test_settings python manage.py test && ruff check . && ruff format --check ."
```

```bash
docker compose run --rm --no-deps frontend sh -c "npm test && npm run check"
```

## Agent skills

### Issue tracker

issue は GitHub Issues（`KentaOsabe-Personal/insta-curator`）で管理し、`gh` CLI で操作する。See `docs/agents/issue-tracker.md`.

### Triage labels

デフォルトの 5 ラベル（`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`）をそのまま使う。See `docs/agents/triage-labels.md`.

### Domain docs

single-context（ルートに `GLOSSARY.md`、ADR は `docs/adr/`）。See `docs/agents/domain.md`.
