'use strict';
// 表示言語（日本語 / 英語）。端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替えも可能
const I18N = (() => {
  const dict = {
    ja: {
      'doc.title': '孤軍奮闘小早川',
      'title.pre': '慶長五年九月十五日　関ヶ原',
      'title.sub': '',
      'title.story': '<p>松尾山に陣取る小早川秀秋、東軍への寝返りを決す。</p>'
        + '<p>されどその企ては石田方に露見し、眼下の西軍が押し寄せる。<br>しびれを切らした徳川方もまた、小早川を攻め始めた——。</p>'
        + '<p>東も西も、すべてが敵。<b>赤備えの一騎</b>、斬って駆けて、関ヶ原の全武将を討ち果たせ。</p>'
        + '<p class="note">※徳川家康を討っても、戦は終わらぬ。<br>これは、死に場所を見つける戦である。</p>',
      'title.start': '出　陣',
      'ctl.move': '矢印：移動',
      'ctl.sword': '左クリック：刀（3連で回転斬り・弾丸を弾く）',
      'ctl.spear': '右クリック：槍（駆けながら突けば突撃）',
      'ctl.dash': '駆（ダッシュ・敵を蹴散らす）',
      'ctl.pause': '一時停止',
      'ctl.touch': '左側をなぞって移動／右の「刀」「槍」で攻撃／「駆」長押しでダッシュ',
      'sound.on': '音：入', 'sound.off': '音：切',
      'legal.privacy': 'プライバシーポリシー',
      'legal.adSettings': '広告の設定',
      'url.privacy': 'https://techgym.jp/privacy-policy/',
      'load.default': '読み込み中……',
      'load.terrain': '関ヶ原の地形を測量中……',
      'load.paint': '野山を描いております……',

      'hud.name': '小早川秀秋 <small>赤備え</small>',
      'hud.hp': '体力', 'hud.dash': '駆',
      'hud.sword': '刀', 'hud.spear': '槍',
      'hud.gens': '討取武将', 'hud.sols': '斬った兵', 'hud.time': '奮戦',
      'hud.pause': '止',
      'tb.sword': '刀', 'tb.spear': '槍', 'tb.dash': '駆',
      'side.W': '西', 'side.E': '東',
      'fx.parry': '弾', 'fx.charge': '突撃！', 'fx.winded': '息切れ',

      'pause.head': '陣中休息', 'pause.resume': '再び戦う',
      'cont.head': 'まだ死ねぬ……',
      'cont.lead': '広告を見れば、一度だけ体力満タンで戦場に戻れる。',
      'cont.watch': '広告を見て復活する',
      'cont.loading': '広告を読み込み中……',
      'cont.fail': '広告を読み込めませんでした',
      'cont.giveUp': 'ここを死に場所とする',

      'res.pre': '孤軍奮闘小早川　戦果',
      'res.dead': '討　死', 'res.clear': '孤軍奮闘、成れり',
      'res.gens': '討ち取った武将', 'res.sols': '斬った兵', 'res.time': '奮戦時間', 'res.ieyasu': '徳川家康',
      'res.ieyasuDead': '討ち取った（されど戦は終わらず）', 'res.ieyasuAlive': '健在',
      'res.placeDead': '{p}討死', 'res.placeClear': '関ヶ原の野にて、ただ一人立つ',
      'res.rank': '【{r}】',
      'res.retry': '再び出陣', 'res.title': 'タイトルへ',
      'share.x': '𝕏 でシェア', 'share.line': 'LINEで送る', 'share.fb': 'Facebook',
      'share.native': '共有する', 'share.copy': '結果をコピー', 'share.copied': 'コピーしました', 'share.prompt': 'コピーしてください',
      'share.head': '『孤軍奮闘小早川』',
      'share.title': '孤軍奮闘小早川', 'share.dialog': '戦果を共有',
      'share.clear': '小早川秀秋、関ヶ原の全武将{t}人を討ち果たす！',
      'share.dead': '小早川秀秋、{p}討死。',
      'share.stats': '討ち取った武将 {n}/{t}・斬った兵 {s}・奮戦 {time}',
      'share.ieyasu': '家康を討つも、戦は終わらず。',
      'share.rank': '称号【{r}】',
      'share.tags': '#孤軍奮闘小早川 #関ヶ原',

      'ev.0': '慶長五年九月十五日　正午　松尾山',
      'ev.1': '小早川秀秋、東軍への寝返りを決す——',
      'ev.2': 'されど、その企て、石田方に露見せり！',
      'ev.3': '石田三成「金吾め、やはり裏切ったか！ 討ち取れぃ！」',
      'ev.4': '四方は敵ばかり……斬って、駆けて、生き延びよ！',
      'ev.5': 'ドドーン！　家康の「問鉄砲」が松尾山に撃ちかけられた！',
      'ev.6': '徳川家康「あの小倅、いつまで迷うておる！ 構わぬ、攻め潰せ！」',
      'ev.7': '東西両軍、ことごとく敵となる。孤立無援——',
      'msg.attackW': '【西軍】{name}隊、攻め寄せる！',
      'msg.attackE': '【東軍】{name}隊、攻め寄せる！',
      'msg.killed': '{name} を討ち取った！（{k}/{t}）',
      'msg.avenge': '東軍諸将「大御所の仇じゃ！ 小早川を逃がすな！」',
      'ban.dead': '小早川秀秋、討死',
      'ban.kill': '{name}、討ち取ったり！', 'ban.killSub': '残る武将 {n}',
      'ban.ieyasu': '徳川家康、討ち取ったり！', 'ban.ieyasuSub': '……されど戦は終わらぬ。東軍の諸将、なお健在なり',
      'ban.clear': '孤軍奮闘、ここに成れり', 'ban.clearSub': '関ヶ原の諸将、ことごとく討ち果たす',
      'ban.revive': '小早川秀秋、再起！', 'ban.reviveSub': 'まだ死に場所はここではない',

      'place.river': '{p}の流れにて',
      'place.mtIn': '{p}の山中にて', 'place.mtFoot': '{p}の麓にて',
      'place.at': '{p}にて', 'place.near': '{p}近くの野にて',

      'rank.clear': '天下無双・孤軍の覇者', 'jisei.clear': '討ちも討ったり関ヶ原　松尾の風に名を残す',
      'rank.30': '鬼金吾', 'jisei.30': '鬼と呼ばれて本望なり　裏切り者の名は血に洗う',
      'rank.20': '関ヶ原の修羅', 'jisei.20': '東も西もなかりけり　ただ一騎にて駆け抜けし',
      'rank.10': '松尾山の荒武者', 'jisei.10': '迷いし心は捨てにけり　槍一筋に生きた午後',
      'rank.3': '意地の一騎駆け', 'jisei.3': '寝返りの汚名を晴らさんと　赤き鎧で駆けにけり',
      'rank.0': '裏切り者の末路', 'jisei.0': '迷うてばかりの十九年　死に場所だけは選べたか',
    },
    en: {
      'doc.title': 'Kobayakawa: Lone Samurai',
      'title.pre': 'Sekigahara — October 21, 1600',
      'title.sub': 'KOBAYAKAWA: LONE SAMURAI',
      'title.story': '<p>On Mt. Matsuo, the warlord Kobayakawa Hideaki has resolved to betray the Western Army and join the East.</p>'
        + '<p>But Ishida\'s side has discovered the plot, and the Western troops below are storming up the mountain.<br>Out of patience, Tokugawa\'s Eastern Army has turned on Kobayakawa too—</p>'
        + '<p>East and West, everyone is your enemy. <b>A lone rider in crimson armor</b>: cut, ride, and slay every general at Sekigahara.</p>'
        + '<p class="note">* Slaying Tokugawa Ieyasu does not end the battle.<br>This is a battle to find where you will die.</p>',
      'title.start': 'RIDE OUT',
      'ctl.move': 'Arrows: Move',
      'ctl.sword': 'Left click: Sword (3rd swing spins, deflects bullets)',
      'ctl.spear': 'Right click: Spear (thrust while dashing to charge)',
      'ctl.dash': 'Dash (gallop through foot soldiers)',
      'ctl.pause': 'Pause',
      'ctl.touch': 'Drag on the left to move / SWORD and SPEAR buttons to attack / hold DASH to gallop',
      'sound.on': 'Sound: On', 'sound.off': 'Sound: Off',
      'legal.privacy': 'Privacy Policy',
      'legal.adSettings': 'Ad settings',
      'url.privacy': 'https://techgym.jp/privacy-policy-en/',
      'load.default': 'Loading…',
      'load.terrain': 'Surveying the terrain of Sekigahara…',
      'load.paint': 'Painting the hills and fields…',

      'hud.name': 'Kobayakawa Hideaki <small>Crimson Armor</small>',
      'hud.hp': 'HP', 'hud.dash': 'Dash',
      'hud.sword': 'Sw', 'hud.spear': 'Sp',
      'hud.gens': 'Generals', 'hud.sols': 'Soldiers', 'hud.time': 'Time',
      'hud.pause': 'II',
      'tb.sword': 'SWORD', 'tb.spear': 'SPEAR', 'tb.dash': 'DASH',
      'side.W': 'W', 'side.E': 'E',
      'fx.parry': 'Parry', 'fx.charge': 'Charge!', 'fx.winded': 'Winded',

      'pause.head': 'A Moment\'s Rest', 'pause.resume': 'Fight On',
      'cont.head': 'Not yet…',
      'cont.lead': 'Watch an ad to return to battle once with full health.',
      'cont.watch': 'Watch an ad to revive',
      'cont.loading': 'Loading ad…',
      'cont.fail': 'Couldn\'t load the ad',
      'cont.giveUp': 'Let this be where I die',

      'res.pre': 'Battle Record',
      'res.dead': 'FALLEN', 'res.clear': 'The Lone Stand Prevails',
      'res.gens': 'Generals slain', 'res.sols': 'Soldiers cut down', 'res.time': 'Time in battle', 'res.ieyasu': 'Tokugawa Ieyasu',
      'res.ieyasuDead': 'Slain (yet the battle went on)', 'res.ieyasuAlive': 'Alive',
      'res.placeDead': 'Fell {p}', 'res.placeClear': 'Standing alone on the fields of Sekigahara',
      'res.rank': '— {r} —',
      'res.retry': 'Ride Out Again', 'res.title': 'Title',
      'share.x': 'Share on 𝕏', 'share.line': 'Send via LINE', 'share.fb': 'Facebook',
      'share.native': 'Share', 'share.copy': 'Copy result', 'share.copied': 'Copied!', 'share.prompt': 'Copy this text',
      'share.head': 'KOBAYAKAWA: LONE SAMURAI',
      'share.title': 'Kobayakawa: Lone Samurai', 'share.dialog': 'Share your result',
      'share.clear': 'Kobayakawa Hideaki slew all {t} generals at Sekigahara!',
      'share.dead': 'Kobayakawa Hideaki fell {p}.',
      'share.stats': 'Generals slain {n}/{t} · Soldiers cut down {s} · Fought {time}',
      'share.ieyasu': 'Slew Ieyasu, yet the battle went on.',
      'share.rank': 'Rank: {r}',
      'share.tags': '#KobayakawaLoneSamurai #Sekigahara',

      'ev.0': 'Noon, October 21, 1600 — Mt. Matsuo, Sekigahara',
      'ev.1': 'Kobayakawa Hideaki resolves to defect to the Eastern Army—',
      'ev.2': 'But Ishida\'s side has discovered the betrayal!',
      'ev.3': 'Ishida Mitsunari: "Kingo, you traitor! I knew it! Cut him down!"',
      'ev.4': 'Enemies on every side… Cut, ride, and survive!',
      'ev.5': 'BOOM! Ieyasu\'s guns fire a warning volley at Mt. Matsuo!',
      'ev.6': 'Tokugawa Ieyasu: "How long will that whelp dither? Enough — crush him!"',
      'ev.7': 'Both armies are now your enemies. You stand alone—',
      'msg.attackW': '[West] {name}\'s troops attack!',
      'msg.attackE': '[East] {name}\'s troops attack!',
      'msg.killed': 'You slew {name}! ({k}/{t})',
      'msg.avenge': 'Eastern generals: "Avenge our lord! Don\'t let Kobayakawa escape!"',
      'ban.dead': 'Kobayakawa Hideaki has fallen',
      'ban.kill': '{name} is slain!', 'ban.killSub': '{n} generals remain',
      'ban.ieyasu': 'Tokugawa Ieyasu is slain!', 'ban.ieyasuSub': '…yet the battle goes on. The Eastern generals still stand.',
      'ban.clear': 'The Lone Stand Prevails', 'ban.clearSub': 'Every general at Sekigahara has fallen',
      'ban.revive': 'Kobayakawa rises again!', 'ban.reviveSub': 'This is not yet the place to die',

      'place.river': 'in the waters of the {p}',
      'place.mtIn': 'on {p}', 'place.mtFoot': 'at the foot of {p}',
      'place.at': 'at {p}', 'place.near': 'in the fields near {p}',

      'rank.clear': 'Peerless Under Heaven', 'jisei.clear': 'I cut down all of Sekigahara; my name rides the wind of Matsuo.',
      'rank.30': 'Demon Kingo', 'jisei.30': 'Let them call me a demon. A traitor\'s name is washed in blood.',
      'rank.20': 'Asura of Sekigahara', 'jisei.20': 'There was no East, no West — only one rider racing through.',
      'rank.10': 'Wild Warrior of Mt. Matsuo', 'jisei.10': 'I cast my doubts aside: one spear, one afternoon.',
      'rank.3': 'A Lone Charge of Pride', 'jisei.3': 'To wash away a traitor\'s name, I rode in crimson armor.',
      'rank.0': 'A Traitor\'s End', 'jisei.0': 'Nineteen years of wavering — at least I chose where to die.',
    },
  };

  const STORE_KEY = 'kobayakawa_lang';
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* 保存不可 */ }
  const deviceLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
  let lang = dict[saved] ? saved : (/^ja\b/i.test(deviceLang) ? 'ja' : 'en');
  const listeners = [];

  // t('msg.killed', { name: '島左近', k: 1, t: 41 }) → '島左近 を討ち取った！（1/41）'
  function t(key, vars) {
    let s = dict[lang][key];
    if (s === undefined) s = dict.ja[key];
    if (s === undefined) return key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  }

  // 武将・地名など、データに英語名（en）があれば英語のときに使う
  function name(o) { return lang === 'en' && o.en ? o.en : o.name; }

  // data-i18n（文字）/ data-i18n-html（タグを含む）/ data-i18n-href（リンク先）の付いた要素を書き換える
  function apply() {
    document.documentElement.lang = lang;
    document.body.classList.toggle('lang-en', lang === 'en');
    document.title = t('doc.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.href = t(el.dataset.i18nHref); });
    document.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('on', el.dataset.lang === lang));
  }

  function setLang(l) {
    if (!dict[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* 保存不可 */ }
    apply();
    listeners.forEach((f) => f(l));
  }

  return {
    t, name, apply, setLang,
    get lang() { return lang; },
    onChange(f) { listeners.push(f); },
  };
})();
const t = I18N.t;
