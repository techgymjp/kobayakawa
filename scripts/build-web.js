// Android アプリに同梱する Web ファイルを www/ にコピーする
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'style.css', 'js']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
// 本番の広告 ID を入れ忘れたままストア用にビルドしないようにする（ADMOB_PLATFORM=ios なら iOS を確認）
if (mode === 'production') {
  const platform = process.env.ADMOB_PLATFORM === 'ios' ? 'ios' : 'android';
  const ads = fs.readFileSync(path.join(root, 'js', 'ads.js'), 'utf8');
  const block = ads.slice(ads.indexOf(`    ${platform}: {`));
  const prod = block.slice(block.indexOf('production: {'), block.indexOf('},', block.indexOf('production: {')));
  const appIdFile = platform === 'ios'
    ? path.join(root, 'ios', 'App', 'App', 'Info.plist')
    : path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  const appIdText = fs.readFileSync(appIdFile, 'utf8');
  if (/: ''/.test(prod) || prod.includes("'TODO-") || appIdText.includes('ca-app-pub-3940256099942544')) {
    console.error(`本番の AdMob ID（${platform}）が未設定です（js/ads.js の広告ユニット ID と ${path.relative(root, appIdFile)} のアプリ ID）`);
    process.exit(1);
  }
}
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (ads: ${mode}, version: ${version})`);
