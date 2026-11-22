# insta-curator

Instagram で自分が選んだアカウントの投稿だけを集めて、一覧で見るための個人用ツールです。ご飯・ファッションなど、ジャンルを問わず使えます。

| Service  | Stack                                     | Port（ホスト）   |
| -------- | ----------------------------------------- | ---------------- |
| frontend | React 19 + TypeScript + Vite + Tailwind 4 | 127.0.0.1:5180   |
| backend  | Python 3.14 / Django 6 + DRF              | 127.0.0.1:8080   |
| db       | MySQL 8.4                                 | 127.0.0.1:3308   |

認証なしのローカル専用ツールです。ポートは `127.0.0.1` にだけ公開しています。外部に公開しないでください。

## できること（スモールスタート版）

- ジャンル別のタブ（初期状態は「ご飯」）の作成・名前変更・削除
  - アカウントが登録されているタブと、最後の1つのタブは削除できません
- タブごとの取得対象アカウントの登録・メモ編集・停止／再開・削除
  - 登録の前に「確認」で Instagram のプロフィール（アイコン、表示名、フォロワー数、投稿数）と最新投稿 3 件を確認し、ダイアログでメモを付けて登録します
    - 見つからないアカウントや、個人アカウント（Business Discovery では区別できません）、トークン切れなどで確認できないときは登録できません
    - 登録済みのアカウントは Instagram API を呼ばず、保存済みの情報で確認します
  - 同じアカウントを複数のタブに登録できます（投稿は共有。メモと停止／再開はすべてのタブに反映されます）
  - 「削除」は表示中のタブから外します。どのタブにも属さなくなったアカウントは、取得済みの投稿ごと削除します
  - `@name`、`name`、プロフィール URL のどれで入力しても登録できます
- 投稿の取得
  - **アプリ起動時に自動取得**します。前回取得から `IG_MIN_FETCH_INTERVAL_MINUTES` 分以内のアカウントはスキップします
  - **ヘッダーの更新ボタン**（表示中のタブのみ）か、アカウントごとの「取得」で手動取得します。手動取得は間隔に関係なく実行します
- 表示中のタブの投稿を新しい順に一覧表示し、アカウントで絞り込めます

## 起動

```bash
cp .env.example .env
docker compose up --build
```

- 画面: http://localhost:5180
- API: http://localhost:8080/api/health

### スマホから使う（ngrok）

ngrok の開発用ドメイン経由で、スマホから HTTPS でアクセスできます。

1. `.env` に `NGROK_AUTHTOKEN` と `NGROK_DOMAIN`（スキームなしのホスト名）を設定する
2. `docker compose --profile mobile up -d` で起動し、スマホで `https://${NGROK_DOMAIN}` を開く

**認証なしで公開されます。** URL を知っている人は誰でも操作できるため、URL を共有せず、使い終わったら `docker compose stop ngrok` でトンネルを止めてください。`--profile mobile` を付けないときは、ngrok は起動しません。同じドメインは同時に1つのトンネルでしか使えないため、ほかのアプリで同じドメインを使うときは、先にこちらを止めてください。

`IG_USER_ID` と `IG_ACCESS_TOKEN` が空のときは **デモモード**（ダミー投稿）で動きます。`missing` で始まるユーザー名を確認すると、「見つからない」エラーの表示を確認できます。

## Instagram API の準備（実データを取る場合）

[Business Discovery API](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery) を使います。取得できるのは **ビジネス／クリエイターアカウントの公開投稿だけ**です。個人アカウントは取得できません。

1. 自分の Instagram アカウント（サブアカウントでも可）を **プロアカウント（クリエイター）** に切り替える
2. Facebook ページを作成し、その Instagram アカウントとリンクする
3. [Meta for Developers](https://developers.facebook.com/) でアプリを作成し、「Facebook ログインによる Instagram API」を追加する
4. Graph API エクスプローラーなどで、以下の権限を持つ **ユーザーアクセストークン** を発行し、長期トークンに交換する
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`（ページをビジネスポートフォリオ経由で管理している場合）
5. `GET /me/accounts?fields=instagram_business_account` で、自分の **Instagram ビジネスアカウント ID** を確認する
6. `.env` に設定して再起動する

```dotenv
IG_USER_ID=1784xxxxxxxxxxxxx
IG_ACCESS_TOKEN=EAAG...
```

注意点:

- API には呼び出し上限があります。起動時の自動取得は間隔制限でスキップされます。
- 2026年9月以降、ダウンロード設定や著作権チェックの影響で `media_url`（画像）が返らない投稿があります。その場合はプレースホルダーを表示し、「Instagram で見る」リンクから元の投稿を開けます。
- 長期トークンの有効期限は約60日です。期限が切れると、画面にトークン更新を促すエラーが出ます。

## API

| Method | Path                       | 説明                                                       |
| ------ | -------------------------- | ---------------------------------------------------------- |
| GET    | `/api/status`              | 動作モード（`graph` / `fake`）と取得設定                   |
| GET    | `/api/tabs`                | タブ一覧                                                   |
| POST   | `/api/tabs`                | タブ作成 `{ name }`                                        |
| PATCH  | `/api/tabs/{id}`           | タブ名変更 `{ name }`                                      |
| DELETE | `/api/tabs/{id}`           | タブ削除（アカウントがあるタブ・最後のタブは 400）         |
| DELETE | `/api/tabs/{id}/accounts/{accountId}` | タブから外す（最後のタブなら投稿ごと削除）      |
| GET    | `/api/accounts?tab=`       | アカウント一覧（tab 指定でそのタブのみ）                   |
| GET    | `/api/accounts/lookup?username=&tabId=` | 登録前の確認（DB に書き込まない）。プロフィール、最新投稿3件、`registration`（`this_tab` / `other_tab` / `none`）を返す。見つからない・個人アカウントは 404 `kind: not_found`、API エラーは 502 `kind: api_error` |
| POST   | `/api/accounts`            | タブに登録 `{ username, memo?, tabId }`（既存なら追加）    |
| PATCH  | `/api/accounts/{id}`       | 更新 `{ memo?, isActive? }`                                |
| DELETE | `/api/accounts/{id}`       | 削除（取得済み投稿も削除）                                 |
| POST   | `/api/accounts/{id}/fetch` | 1アカウントを取得                                          |
| POST   | `/api/fetch`               | 有効な全アカウントを取得 `{ force, tabId? }`（false は間隔制限あり） |
| GET    | `/api/posts?tab=&account=&limit=` | 投稿一覧（新しい順、最大200件）                     |

## テスト・チェック

```bash
docker compose run --rm --no-deps backend sh -c "DJANGO_SETTINGS_MODULE=config.test_settings python manage.py test && ruff check . && ruff format --check ."
```

```bash
docker compose run --rm --no-deps frontend sh -c "npm test && npm run check"
```

## 構成メモ

- `backend/instagram/gateway.py`: Graph API との境界。アクセストークンや httpx の例外を外に出しません。トークン未設定時は `FakeGateway` を使います。
- `backend/instagram/services.py`: 取得のユースケース（`media_id` で upsert、間隔制限によるスキップ）
- `frontend/src/*Api.ts` / `*Dto.ts` / `fetchState.ts`: HTTP 通信、レスポンスの実行時検証、取得状態の純粋な状態遷移

## 次にやりたいこと（候補）

- キャプションから店名・エリア・ジャンルを LLM で抽出する
- Google Places で住所や地図を補完する
- 「行きたい」リスト
