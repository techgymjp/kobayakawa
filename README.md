# 孤軍奮闘小早川

関ヶ原の合戦をモチーフにしたブラウザ用アクションゲーム。

慶長五年九月十五日正午。松尾山の小早川秀秋は東軍への寝返りを決したが、その企ては石田方に露見した。
眼下の西軍が押し寄せ、しびれを切らした徳川方も「問鉄砲」とともに攻めかかってくる。
東も西もすべてが敵。赤備えの一騎となって斬り、駆け、関ヶ原の全武将を討ち果たせ。

**徳川家康を討っても戦は終わらない。** これは死に場所を見つけるゲームでもある。

## 遊び方

`index.html` をブラウザで開くだけで遊べます（Web 版はビルド不要）。Vercel では `vercel.json` の設定で `npm run build` の結果（`www/`）を公開します。

| 操作 | PC | スマホ |
| --- | --- | --- |
| 移動 | WASD / 矢印キー | 画面左側をなぞる |
| 刀（3連撃目で回転斬り、鉄砲の弾を弾く） | J / 左クリック（マウス方向へ） | 「刀」ボタン |
| 槍（駆を使う。手前から 2 人まで貫く。駆けながら突くと突撃） | K / 右クリック | 「槍」ボタン |
| 駆（ダッシュ。足軽を蹴散らす） | Space / Shift 長押し | 「駆」ボタン長押し |
| 一時停止 | P / Esc | 「止」ボタン |

- 刀・槍はキーボード/タッチでは向いている方向の近くの敵へ自動で狙いを付けます。
- 武将を討つと兵糧（おにぎり）を落とし、配下の兵は潰走します。武将は斬られてもひるみません。
- 難易度は `js/game.js` の `DIFF` で調整できます。ボットに自動プレイさせて、刀と槍を使い分ける上手いボットが約 3 割で最後まで勝てる程度にしています。
- 画面端の矢印は最寄りの武将の方角、右下のミニマップは全武将の位置（紫=西軍、青=東軍）。
- 結果画面では討死の場所・称号・戦果を X / LINE / Facebook で共有できます。
- 日本語と英語に対応しています（英語名は「Kobayakawa: Lone Samurai」）。

## 戦場の再現

- 地形：笹尾山・天満山・松尾山・南宮山・桃配山・丸山などの高まり、藤古川・寺谷川・相川、中山道・北国街道・伊勢街道、関ヶ原宿・山中村などの集落を、おおよその位置関係で配置しています。斜面では馬足が鈍り、川を渡ると遅くなります。
- 布陣：正午ごろの布陣（家康は陣場野）を基に、西軍21将・東軍20将、計41人の武将に名前を表示しています。

## ファイル構成

- `index.html` / `style.css` — 画面と UI
- `js/i18n.js` — 日本語・英語の文言（端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替え可）
- `js/data.js` — 地形・河川・街道・地名・布陣データ（英語名つき）
- `js/terrain.js` — 標高グリッドと地形画像の生成
- `js/audio.js` — WebAudio による効果音（鬨の声・法螺貝・太鼓など）
- `js/game.js` — ゲーム本体
- `js/ads.js` / `js/ads-config.js` / `js/build-info.js` — Android アプリ用の広告とバージョン表示（Web 版では何もしない）
- `android/` / `capacitor.config.json` / `scripts/build-web.js` — Android アプリ（Capacitor）
- `ios/` — iOS アプリ（Capacitor。Mac での作業手順は `docs/IOS_BUILD.md`）
- `assets/` — アプリのアイコンと起動画面の元画像

## Android アプリ

Capacitor 8 で Android アプリにしています（パッケージ名 `jp.techgym.kobayakawa`、横画面）。ホーム画面のアプリ名は、端末が日本語なら「孤軍奮闘小早川」、それ以外は「Kobayakawa」です。ゲームのファイルはアプリに同梱するので、オフラインでも遊べます（フォントだけはオフラインだと端末の明朝体になります）。

- `npm ci` → `npm run build`（`www/` に Web ファイルをコピー）→ `npx cap sync android` → `cd android && ./gradlew assembleDebug`
- GitHub Actions（`.github/workflows/android.yml`）が push のたびに動作確認用 APK（デバッグ署名・テスト広告）を作ります。既定ブランチのビルドは Release `android-latest` に載り、
  `https://github.com/techgymjp/kobayakawa/releases/latest/download/kobayakawa.apk` から入れられます（QR コード：`docs/apk-qr.png`）。ダウンロード前の Release ページ `https://github.com/techgymjp/kobayakawa/releases/latest` の QR コードは `docs/release-qr.png` です。
- GitHub Secrets（`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`）を登録すると、Google Play 用の署名付き AAB も作ります。

アプリ版だけの動き：

- 戻るボタン：プレイ中は一時停止、タイトル・結果画面ではアプリを終了
- 別のアプリに切り替えると一時停止し、音も止める
- 結果画面の共有は Android の共有メニュー
- 広告（AdMob）：討死したとき 1 合戦に 1 回だけ、リワード広告を見ると体力満タンで復活できる（10 秒で自動的に結果画面へ）。「再び出陣」を押すたびにインタースティシャル広告。一時停止中だけ画面下にバナー広告
- タイトル画面にビルド番号・プライバシーポリシー・（EU など必要な地域では）広告の設定

**AdMob は本番の ID が入っています。** アプリ ID は `android/app/src/main/res/values/strings.xml`、全画面広告とリワード広告のユニット ID は `js/ads.js` の `production` にあります。ポーズ中のバナー広告のユニット ID も同じ場所（`banner`）にあります。Google Play 用のビルド（`ADMOB_MODE=production`）だけが本番の広告を出し、動作確認用 APK はテスト広告を表示します（ID が未設定のまま Google Play 用にビルドするとエラーで止まります）。

## iOS アプリ

Android 版と同じ Capacitor で iOS アプリにしています（Bundle ID `jp.techgym.kobayakawa`、iPhone 専用・横画面）。JET STRIKE と同じ構成です。

- ビルドと App Store への提出は Mac の Xcode で行います。手順は [docs/IOS_BUILD.md](docs/IOS_BUILD.md)
- `npm run ios:sync`（テスト広告）／ `npm run ios:release`（本番広告。App Store 用）／ `npm run ios:open`
- GitHub Actions（`.github/workflows/ios.yml`）が push のたびに、署名なしでビルドできるかを確認します
- 広告は Android と同じ出し方で、iOS 用の広告ユニットを使います（`js/ads.js` の `ios`）。起動時に App Tracking Transparency の確認を出します
- iOS 用の AdMob ID は本番のものが入っています。アプリ ID は `ios/App/App/Info.plist` の `GADApplicationIdentifier`、広告ユニット ID 3 つは `js/ads.js` の `ios.production`
- App Store 用の画像は `docs/store/ios/`（スクリーンショット 2622 × 1206 日英各 4 枚、ヘッダ 3840 × 1646、検索結果 3840 × 2560）

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリ（Google Play、App Store など）として公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開、広告の掲載、販売などの商用利用は禁止し、著作権表示を残してください。詳しくは [LICENSE](LICENSE) を見てください。
