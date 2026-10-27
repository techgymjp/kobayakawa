// Google AdMob 広告（Android / iOS アプリのときだけ動く。Web 版では何もしない）
const Ads = (() => {
  // AdMob では Android と iOS を別のアプリとして登録しているので、広告ユニットも OS ごとに分かれている
  const UNITS = {
    android: {
      // Google 公式のテスト用広告ユニット
      test: {
        interstitial: 'ca-app-pub-3940256099942544/1033173712',
        rewarded: 'ca-app-pub-3940256099942544/5224354917',
        banner: 'ca-app-pub-3940256099942544/6300978111',
      },
      production: {
        interstitial: 'ca-app-pub-6411535997477460/3793697270',
        rewarded: 'ca-app-pub-6411535997477460/2480615603',
        banner: 'ca-app-pub-6411535997477460/7042677144',
      },
    },
    ios: {
      test: {
        interstitial: 'ca-app-pub-3940256099942544/4411468910',
        rewarded: 'ca-app-pub-3940256099942544/1712485313',
        banner: 'ca-app-pub-3940256099942544/2934735716',
      },
      // AdMob で iOS 用の広告ユニットを作ったら入れる（空のままでは App Store 用にビルドできない）
      production: {
        interstitial: '',
        rewarded: '',
        banner: 'ca-app-pub-6411535997477460/3259554234',
      },
    },
  };
  const RETRY_MS = 20000;      // 読み込みに失敗したら少し待って再挑戦する
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const AdMob = native && cap.Plugins ? cap.Plugins.AdMob : null;
  const platform = native && cap.getPlatform && cap.getPlatform() === 'ios' ? 'ios' : 'android';
  const testing = window.AD_MODE !== 'production';
  const ids = UNITS[platform][testing ? 'test' : 'production'];

  let ready = false;           // 広告をリクエストしてよい状態（初期化と同意確認が済んだ）
  let showing = false;
  let privacyRequired = false; // 「広告の設定」を利用者が開けるようにする必要があるか（EU など）
  const waiters = {};          // 表示中の広告が閉じたときに呼ぶ処理

  // 広告の種類ごとの読み込み状態
  const slots = {
    inter: { loaded: false, pending: null, load: () => AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: testing }) },
    reward: { loaded: false, pending: null, load: () => AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: testing }) },
  };

  // 読み込みを始め、読み込めたら true で resolve する Promise を返す（読み込み中なら同じ Promise）
  function prepare(kind) {
    const s = slots[kind];
    if (!ready) return Promise.resolve(false);
    if (s.loaded) return Promise.resolve(true);
    if (!s.pending) {
      s.pending = s.load()
        .then(() => { s.loaded = true; return true; })
        .catch(() => { setTimeout(() => prepare(kind), RETRY_MS); return false; })
        .finally(() => { s.pending = null; });
    }
    return s.pending;
  }

  // 読み込み済みでなければ、最大 timeout ミリ秒だけ読み込みを待つ
  function ensureLoaded(kind, timeout) {
    if (slots[kind].loaded) return Promise.resolve(true);
    return Promise.race([prepare(kind), new Promise(r => setTimeout(() => r(false), timeout))]);
  }

  function finish(kind, result) {
    showing = false;
    Sfx.resume();
    const w = waiters[kind];
    waiters[kind] = null;
    if (w) w(result);
  }

  async function init() {
    try {
      await AdMob.initialize({ initializeForTesting: testing });
    } catch (e) {
      return;
    }
    // EU・英国などで必要な広告の同意確認（必要な地域でだけフォームが出る）。
    // 確認自体が失敗した場合（AdMob 側でメッセージ未設定など）は、同意不要の地域とみなして続ける
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.status === 'REQUIRED' && consent.isConsentFormAvailable) consent = await AdMob.showConsentForm();
      ready = consent.canRequestAds !== false;
      privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch (e) {
      ready = true;
    }
    // iOS では、広告用の ID を使ってよいか（App Tracking Transparency）を利用者に確認する。
    // 同意確認のあとに一度だけ出る。断られても広告は出せる（パーソナライズされないだけ）
    if (platform === 'ios') {
      try {
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch (e) { /* 確認できなくても広告は出せる */ }
    }
    let rewarded = false;
    AdMob.addListener('interstitialAdDismissed', () => finish('inter'));
    AdMob.addListener('interstitialAdFailedToShow', () => finish('inter'));
    AdMob.addListener('onRewardedVideoAdShowed', () => { rewarded = false; });
    AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
    AdMob.addListener('onRewardedVideoAdDismissed', () => finish('reward', rewarded));
    AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish('reward', false));
    prepare('inter');
    prepare('reward');
  }

  // 全画面広告を表示し、閉じられたら resolve する（読み込めていないときは出さずにすぐ resolve）
  function showInterstitial() {
    if (!AdMob || !ready || !slots.inter.loaded || showing) return Promise.resolve();
    showing = true; slots.inter.loaded = false;
    Sfx.suspend();
    return new Promise(resolve => {
      waiters.inter = () => { prepare('inter'); resolve(); };
      AdMob.showInterstitial().catch(() => finish('inter'));
    });
  }

  // リワード広告を表示する。結果は 'rewarded'（最後まで見た）/ 'skipped'（途中で閉じた）/ 'unavailable'（読み込めなかった）
  async function showRewarded() {
    if (!AdMob || showing) return 'unavailable';
    await initDone;
    if (!ready || !(await ensureLoaded('reward', 8000))) return 'unavailable';
    showing = true; slots.reward.loaded = false;
    Sfx.suspend();
    return new Promise(resolve => {
      waiters.reward = ok => { prepare('reward'); resolve(ok ? 'rewarded' : 'skipped'); };
      AdMob.showRewardVideoAd().catch(() => finish('reward', false));
    });
  }

  // 同意した内容をあとから変更するための Google のフォームを開く
  // ポーズ中だけ画面下にバナーを出す
  let bannerWanted = false, bannerShown = false;
  async function showBanner() {
    bannerWanted = true;
    if (!AdMob || !ids.banner || bannerShown || showing) return;
    await initDone;
    if (!ready || !bannerWanted) return;
    bannerShown = true;
    try {
      await AdMob.showBanner({ adId: ids.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: testing });
    } catch (e) { bannerShown = false; return; }
    // 読み込み中にポーズが解除されていたら消す
    if (!bannerWanted) { bannerShown = true; hideBanner(); }
  }
  function hideBanner() {
    bannerWanted = false;
    if (!AdMob || !bannerShown) return;
    bannerShown = false;
    AdMob.removeBanner().catch(() => {});
  }

  function showPrivacyOptions() {
    if (!AdMob) return Promise.resolve();
    return AdMob.showPrivacyOptionsForm().catch(() => {});
  }

  const initDone = AdMob ? init() : Promise.resolve();

  return {
    get available() { return !!AdMob; },
    get showing() { return showing; },
    get privacyOptionsRequired() { return privacyRequired; },
    initDone,
    showInterstitial,
    showRewarded,
    showPrivacyOptions,
    showBanner,
    hideBanner,
  };
})();
