# iOS 版をビルドして App Store に出す手順（Mac での作業）

孤軍奮闘小早川の iOS 版は、Android 版と同じ Capacitor で作っています（`ios/` フォルダ）。
コードの準備はできているので、Mac では「ビルドして App Store Connect にアップロードする」作業だけを行います。
JET STRIKE（techgymjp/jet-fighter）と同じ構成・同じ手順です。

- Bundle ID：`jp.techgym.kobayakawa`（Android のパッケージ名と同じ）
- チーム：Team ID `GNM3VTX9YG`（Xcode の設定に入れてあります）。Apple Developer には**個人で登録**しています（App Store の販売元は個人名になります）
- 対応端末：iPhone（横画面固定）。iPad では iPhone 用の画面で動きます
- ホーム画面のアプリ名：日本語の端末では「孤軍奮闘小早川」、それ以外では「Kobayakawa」
- 広告：AdMob（iOS 用のアプリと広告ユニット。Android とは別）。起動時に「トラッキングの許可」の確認画面が出ます
  - インタースティシャル：結果画面で「再び出陣」を押すたび
  - リワード：討死したときの「広告を見て復活する」（1 合戦 1 回）
  - バナー：一時停止中だけ画面下

---

## 0. ブラウザでの準備（最初の1回だけ）

1. **Apple Developer**（developer.apple.com）→「Certificates, Identifiers & Profiles」→「Identifiers」→「＋」→「App IDs」→「App」
   - Description：`Kobayakawa`（英数字で。記号は使えないことがある）
   - Bundle ID：「Explicit」で `jp.techgym.kobayakawa`
   - Capabilities：何もチェックしない
2. **App Store Connect**（appstoreconnect.apple.com）→「アプリ」→「＋」→「新規 App」
   - プラットフォーム：iOS ／ 名前：`孤軍奮闘小早川`（英語の名前は「Kobayakawa: Lone Samurai」を英語のローカライズに入れる）／ プライマリ言語：日本語
   - バンドル ID：1 で登録したもの ／ SKU：`kobayakawa`（あとから変更不可）／ ユーザアクセス：アクセス制限なし
3. **AdMob**
   - 「アプリを追加」→ **iOS** →「ストアに掲載されていない」で登録し、**バナー・インタースティシャル・リワード**の広告ユニットを作る
   - アプリ ID と広告ユニット ID 3 つを Claude Code に渡す（`ios/App/App/Info.plist` の `GADApplicationIdentifier` と `js/ads.js` の `ios.production` に入れてもらう）
   - 「プライバシーとメッセージ」→「欧州の規制」のメッセージに iOS アプリも追加する

iOS 用のアプリ ID（`ca-app-pub-6411535997477460~1194743654`）と広告ユニット ID 3 つは、設定済みです。

---

## 1. Mac の準備（最初の1回だけ）

1. **Xcode** を App Store からインストールする（数十 GB あるので時間がかかります）。インストール後に一度起動し、追加コンポーネントのインストールを済ませる
2. Xcode の「Settings…」→「Accounts」→「＋」で、Apple Developer に登録している Apple ID でサインインする（チームが個人名で表示されれば OK）
3. **Node.js**（LTS 版）を https://nodejs.org/ からインストールする（JET STRIKE で入れていれば不要）
4. ターミナルでリポジトリを取得する
   ```bash
   cd ~/Desktop   # 置きたい場所（どこでもよい）
   git clone https://github.com/techgymjp/kobayakawa.git
   cd kobayakawa
   npm ci
   ```
   `git` がないと言われたら、表示に従って「コマンドライン・デベロッパツール」をインストールしてから、もう一度実行します。

2回目以降は、`cd kobayakawa` のあと `git pull` と `npm ci` で最新にします。

---

## 2. 自分の iPhone で動作確認する（テスト広告）

```bash
npm run ios:sync    # ゲームのファイルを iOS のプロジェクトにコピー（テスト広告）
npm run ios:open    # Xcode で開く
```

1. iPhone を USB ケーブルで Mac につなぎ、iPhone で「このコンピュータを信頼」を許可する
2. iPhone の「設定」→「プライバシーとセキュリティ」→「デベロッパモード」をオンにする（再起動を求められます。項目がない場合は、Xcode で一度 iPhone を選ぶと表示されます）
3. Xcode の上部で、実行先に自分の iPhone を選ぶ
4. 左の「App」→「Signing & Capabilities」で、「Automatically manage signing」がオン、Team に自分（個人名）のチームが選ばれていることを確認する
5. ▶（Run）を押すと、iPhone にアプリが入って起動する

確認すること：

- 横画面で全画面表示になる。左右どちらに傾けても動く
- 切り欠き（Dynamic Island）に体力や討取数が隠れない
- トラッキングの確認画面が出る
- 左側をなぞって移動、「刀」「槍」「駆」で戦える。音（鬨の声・法螺貝・太鼓）が鳴る
- 一時停止すると画面下に**テスト用のバナー**が出て、再開すると消える
- 討死すると「広告を見て復活する」が出て、**テスト広告**を最後まで見ると復活する
- 結果画面の「再び出陣」で**テスト広告**（全画面）が出る
- 結果画面の「共有する」で iPhone の共有メニューが出る
- 端末の言語を英語にすると、ゲームもアプリ名も英語になる

---

## 3. App Store 用にビルドしてアップロードする（本番広告）

```bash
git pull && npm ci
npm run ios:release   # 本番の広告 ID でコピーする（ここが ios:sync と違う）
npm run ios:open
```

1. Xcode の左で「App」→「General」→「Identity」を開き、**Build の番号を前回より大きくする**（初回は 1。アップロードのたびに 2、3…と上げる。同じ番号は二度アップロードできない）。Version は `package.json` の version と同じ（いまは 1.4.0）
2. 上部の実行先を「**Any iOS Device (arm64)**」にする
3. 画面最上部のメニューバーの「Product」→「**Archive**」（全画面表示だとメニューバーが隠れるので、マウスを画面の上端に動かす）
4. 終わると Organizer が開くので、「**Distribute App**」→「**App Store Connect**」→「Upload」で進める（途中の確認は既定のまま「Next」でよい。「Xcode Cloud can automate…」は「Remind Me Later」で閉じてよい）
5. 10〜30 分ほどで、App Store Connect の「TestFlight」タブにビルドが表示される

輸出コンプライアンス（暗号化）の質問は、Info.plist で「独自の暗号化は使っていない」と設定済みなので、聞かれません。

**注意**：`ios:release` でビルドしたアプリは本番の広告が出ます。TestFlight で確認するときも、**本番の広告はタップしない**でください（AdMob のアカウント停止の対象）。Xcode から iPhone に直接入れて試すときは、`npm run ios:sync` でテスト広告に戻してから実行します。

---

## 4. TestFlight で確認し、審査用の録画を撮る

1. App Store Connect の「TestFlight」→「内部テスト」でグループを作り、自分を追加する
2. iPhone に「TestFlight」アプリを App Store から入れ、届いた招待から孤軍奮闘小早川をインストールする
3. **審査用の画面録画を撮る**（新しいアカウントの初回審査では、実機での操作の録画を求められます。JET STRIKE では提出後に「Guideline 2.1 - Information Needed」で求められた）
   - iPhone のコントロールセンターに「画面収録」を追加し、録画を始めてからアプリを**起動するところから**撮る
   - 撮る流れの例（2〜3 分）：起動 → トラッキングの確認 → タイトル → 出陣 → 移動・刀・槍・駆で戦う → 一時停止（バナー）→ 再開 → 討死 →「広告を見て復活する」→ 結果画面 →「共有する」→「再び出陣」（全画面広告）
   - 本番の広告が出ても**タップしない**
   - 大きすぎると App Review への返信に添付できない（400MB でも失敗した例がある）。Mac の Finder で右クリック →「選択したビデオファイルをエンコード」→ 720p にするか、Google ドライブの共有リンクを使う

---

## 5. App Store Connect で審査に出す

「配信」タブ（iOS App のバージョン 1.4.0）で入力します。バージョンのページの「バージョン」がアプリの Version（1.4.0）と違うと、アップロードしたビルドを選べません。

| 項目 | 入力内容 |
| --- | --- |
| スクリーンショット | 「Dynamic Island 搭載 iPhone（中型ディスプレイ）」の欄に、`docs/store/ios/6.3inch/` の 2622 × 1206（横向き）を入れる。日本語のページに `ja-` の 4 枚、英語のページに `en-` の 4 枚 |
| ヘッダ・検索結果 | 「ヘッダと検索結果」タブに `docs/store/ios/appstore-header-3840x1646.png` と `appstore-search-3840x2560.png`（日英共通。文字を入れていないので、App Store がアプリ名を重ねる）。ヘッダを入れたら検索結果も入れる（片方だけだと赤枠になる） |
| サブタイトル・プロモーション用テキスト・概要・キーワード | 下の「App Store の文言」 |
| サポート URL | https://techgym.jp/ |
| プライバシーポリシー URL（App 情報・アプリのプライバシー） | https://techgym.jp/privacy-policy/ |
| 著作権 | 2026 TECH GYM K.K. |
| カテゴリ（App 情報） | ゲーム（サブカテゴリ：アクション） |
| コンテンツの配信権（App 情報） | 第三者のコンテンツ：いいえ（絵・音はすべて自前） |
| ビルド | TestFlight で確認したビルドを選ぶ |
| 年齢制限 | 下の「年齢制限の目安」 |
| App のプライバシー | AdMob が収集するデータを申告する（下記） |
| App Review に関する情報 | ログイン不要。連絡先を入力。メモには下の「審査へのメモ」を入れ、**4 章の録画**を添付する（または共有リンクを書く） |

### App Store の文言

**日本語**

- 名前：`孤軍奮闘小早川`
- サブタイトル（30 文字以内）：`関ヶ原、東も西もすべてが敵`
- プロモーション用テキスト（170 文字以内）：
  ```
  寝返りが露見！東西両軍に追われる小早川秀秋となり、関ヶ原の全武将41人を斬って駆けて討ち果たせ。家康を討っても戦は終わらない――これは死に場所を見つける戦。
  ```
- キーワード（100 文字以内、カンマ区切り）：
  ```
  関ヶ原,戦国,武将,侍,合戦,アクション,歴史,小早川秀秋,徳川家康,石田三成,騎馬,刀,槍,オフライン
  ```
- 概要：`docs/store/listing.md` の「詳しい説明」（日本語）

**English**

- Name: `Kobayakawa: Lone Samurai`
- Subtitle (max 30): `Betrayed by both armies`
- Promotional text (max 170):
  ```
  Your betrayal is exposed and both armies hunt you. Ride as Kobayakawa Hideaki and slay all 41 generals at Sekigahara. Slaying Ieyasu won't end the battle.
  ```
- Keywords (max 100):
  ```
  samurai,sekigahara,sengoku,japan,warlord,shogun,history,action,sword,spear,horse,offline,battle
  ```
- Description: `docs/store/listing-en.txt` の Full description

### 年齢制限の目安

刀や槍で武士・足軽を倒し、斬ると赤い飛沫が散ります（見下ろし型の小さな絵で、写実的ではありません。部位の欠損などの残酷な表現はありません）。

- カートゥーンまたはファンタジーの暴力：**頻繁／激しい**
- リアルな暴力：なし
- 流血（血の表現）：あり（軽度）
- そのほか（性的表現、ギャンブル、薬物、汚い言葉、ホラー、医療情報など）：なし
- 広告：あり ／ ユーザー同士の交流・アプリ内課金：なし

答えた結果のレーティング（12+ 前後の見込み）を確認してから保存してください。

### App のプライバシー（AdMob を使うアプリの目安）

Google の「Apple の App Store のデータ開示要件への準備」（AdMob のヘルプ）に、AdMob が収集するデータの一覧があります。必ずそちらを見て最終確認してください。目安は次のとおりです（JET STRIKE と同じ）。

- 収集する：ID（デバイス ID）、使用状況データ（広告データ、製品の操作）、診断（クラッシュデータ、パフォーマンスデータ、その他の診断データ）、位置情報（おおよその場所）
- 目的：サードパーティ広告、アナリティクス
- ユーザーに関連付け：しない
- トラッキングに使用：デバイス ID と広告データは「する」

### 審査へのメモ（App Review に関する情報 →「メモ」）

初回の審査では、次の内容を求められることがあります（JET STRIKE では「Guideline 2.1 - Information Needed」で求められた）。最初からメモに入れ、4 章の録画を添付しておくと早く進みます。

```
1. Screen recording: attached (captured on a physical iPhone, starting from app launch).
2. Purpose and audience: A single-player action game set at the Battle of Sekigahara (1600) for players aged 12 and up. The player rides as the samurai Kobayakawa Hideaki and fights both armies.
3. How to use: No login or account is required. Tap "RIDE OUT" (出陣) on the title screen. Drag on the left half of the screen to move; tap SWORD / SPEAR and hold DASH on the right. Pause with the II button.
4. External services: Google AdMob for ads (banner while paused, an interstitial when starting another battle from the results screen, and an optional rewarded ad to revive once per battle). The App Tracking Transparency prompt is shown at launch. The system share sheet is used to share results.
5. Regional differences: None, except that Google's consent form for ads is shown in regions that require it (e.g. the EU/UK). The game text is in Japanese or English depending on the device language.
6. Regulated industries / third-party content: None. All artwork and sounds are original and generated in the app.
```

入力が終わったら「審査用に追加」→「審査へ提出」。

---

## 6. 公開後にやること

- AdMob で iOS アプリを App Store のアプリに紐づける（「アプリ」→ iOS の孤軍奮闘小早川 →「アプリの設定」）
- App Store からインストールして、起動・同意画面・トラッキングの確認・広告を確認する

---

## 7. 自動化の準備（2回目以降を GitHub Actions に任せる場合）

JET STRIKE の `docs/IOS_BUILD.md` の 7 章と同じです。API キー（.p8）と配布用の証明書（.p12）は JET STRIKE で作ったものを使い回せます。
techgymjp は個人のアカウントなので、**このリポジトリにも同じ 5 つの Secrets を登録します**（https://github.com/techgymjp/kobayakawa/settings/secrets/actions）。

| 名前 | 内容 |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | 証明書（.p12）を変換した文字列 |
| `IOS_DIST_CERT_PASSWORD` | .p12 を書き出したときのパスワード |
| `ASC_KEY_ID` | API キーのキー ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8_BASE64` | API キー（.p8）を変換した文字列 |

```bash
base64 -i 証明書.p12 | tr -d '\n' | pbcopy
base64 -i AuthKey_XXXXXXXXXX.p8 | tr -d '\n' | pbcopy
```

登録済みです。`.github/workflows/ios-release.yml` が、`claude/intelligent-rubin-6c3t95` ブランチへの push のたびに（または Actions の画面の「Run workflow」で）次を行います。

1. 本番の広告 ID でゲームのファイルをコピーする（`ios:release` と同じ）
2. 証明書と API キーで署名して Archive する。Version は `package.json` の version、**Build は 100 + 実行回数**（Mac の Xcode から手で上げる 1、2… とぶつからないように）
3. App Store Connect にアップロードする（10〜30 分ほどで TestFlight に出る）

審査への提出は、これまでどおり App Store Connect で行います。

**注意**：証明書（.p12）、そのパスワード、API キー（.p8）は、チャット・AI へのアップロード・リポジトリへのコミットで**絶対に共有しない**でください。

いまある `.github/workflows/ios.yml` は、push のたびに GitHub の Mac で「署名なしでビルドできるか」だけを確認するものです（アップロードはしません）。

---

## つまずきやすいところ

| 症状 | 対処 |
| --- | --- |
| `npm run ios:release` で「本番の AdMob ID（ios）が未設定です」 | iOS 用のアプリ ID と広告ユニット ID 3 つが入っていない。0 章の 3 を済ませて Claude Code に渡す |
| アップロードで「同じビルド番号がすでにある」 | General の Build の番号を上げてから Archive し直す |
| ビルドを選ぼうとしても、アップロードしたビルドが出てこない | App Store Connect のバージョンの「バージョン」がアプリの Version（1.4.0）と違う。直して保存する |
| Signing でエラー（チームが選べない、証明書がない） | Xcode の Accounts で Apple ID にサインインし直し、Team を選ぶ。「Automatically manage signing」をオンにする |
| 実行先に iPhone が出ない | ケーブルをつなぎ直し、iPhone で「信頼」を許可。デベロッパモードをオンにする |
| 実行先に「iOS 26.x Not Installed」と出る | 「Get」で iOS のシミュレーターと部品をダウンロードする（8 GB ほど。Archive にも必要） |
| ビルドが古いゲームのまま | `npm run ios:sync`（または `ios:release`）を実行し忘れている。`git pull` してから実行し直す |
| 「審査用に追加できません」（コンテンツの配信権／プライバシーポリシー URL） | 「App 情報」の「コンテンツの配信権」で「いいえ」、「アプリのプライバシー」でプライバシーポリシーの URL を入れて保存する |
| 返信に動画を添付すると「エラーが発生しました」 | 動画が大きすぎる。720p にエンコードするか、Google ドライブの共有リンクを貼る |
| 本番広告とテスト広告の取り違え | App Store 用は必ず `npm run ios:release`。Xcode から実機で試すときは `npm run ios:sync` に戻す |
| App Store の審査で「Xcode が古い」と言われる | Xcode を最新版に更新してから Archive し直す |
