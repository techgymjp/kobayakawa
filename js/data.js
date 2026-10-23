'use strict';
// 関ヶ原 戦場データ（1単位 ≒ 1m 程度の縮尺。x=東, y=南）
// 慶長五年九月十五日 正午ごろ、小早川秀秋が松尾山で寝返りを決した時点の布陣を基にしている。

const WORLD = { W: 4800, H: 3600 };

// ---- 地形（標高は盆地底を 0 とした相対値）----
const HILLS = [
  // 松尾山（小早川陣）と南西の山並み
  { x: 650, y: 3050, rx: 360, ry: 320, h: 165 },
  { x: 380, y: 3350, rx: 420, ry: 380, h: 175 },
  { x: 950, y: 3480, rx: 320, ry: 260, h: 120 },
  { x: 1000, y: 2760, rx: 220, ry: 150, h: 40 },
  // 山中村の台地（大谷陣）
  { x: 830, y: 2160, rx: 230, ry: 190, h: 45 },
  // 笹尾山（石田陣）
  { x: 1050, y: 470, rx: 160, ry: 130, h: 58 },
  { x: 860, y: 300, rx: 260, ry: 200, h: 90 },
  // 天満山（北・南）
  { x: 1380, y: 1180, rx: 150, ry: 130, h: 28 },
  { x: 1280, y: 1600, rx: 170, ry: 150, h: 32 },
  { x: 1320, y: 1390, rx: 120, ry: 120, h: 18 },
  // 丸山（黒田陣・狼煙場）
  { x: 1880, y: 440, rx: 85, ry: 80, h: 22 },
  // 桃配山（家康最初の陣）
  { x: 4100, y: 1950, rx: 170, ry: 130, h: 40 },
  // 南宮山（毛利・吉川・安国寺・長束）
  { x: 4250, y: 3000, rx: 560, ry: 460, h: 280, rot: -0.3 },
  { x: 4720, y: 3250, rx: 450, ry: 420, h: 220 },
  { x: 3800, y: 3330, rx: 380, ry: 330, h: 150 },
  { x: 4550, y: 2650, rx: 260, ry: 200, h: 60 },
  // 南側の低い山並み（伊勢街道の谷を残す）
  { x: 1700, y: 3620, rx: 380, ry: 260, h: 90 },
  { x: 2350, y: 3700, rx: 420, ry: 280, h: 70 },
  { x: 3450, y: 3700, rx: 300, ry: 250, h: 95 },
  // 東北の山
  { x: 4550, y: 650, rx: 520, ry: 420, h: 150 },
  { x: 4050, y: 260, rx: 480, ry: 300, h: 140 },
  { x: 3300, y: 120, rx: 500, ry: 260, h: 120 },
];
// 北辺（伊吹山麓）と西辺（今須の山地）を自動生成
for (let x = 0; x <= WORLD.W; x += 300) {
  const pass = x > 950 && x < 1350; // 北国街道の谷
  HILLS.push({ x, y: -80, rx: 330, ry: 300, h: pass ? 60 : 140 + 40 * Math.sin(x * 0.004) });
}
for (let y = 0; y <= WORLD.H; y += 300) {
  const pass = y > 1850 && y < 2300; // 中山道（今須峠）
  HILLS.push({ x: -80, y, rx: 300, ry: 330, h: pass ? 55 : 170 });
}

const RIVERS = [
  { name: '藤古川', en: 'Fujiko River', w: 16, pts: [[560, 0], [700, 600], [820, 1200], [960, 1750], [1060, 2150], [1150, 2550], [1250, 3000], [1300, 3600]] },
  { name: '寺谷川', en: 'Teradani River', w: 11, pts: [[1650, 150], [1640, 700], [1690, 1300], [1720, 1900], [1660, 2600], [1600, 3600]] },
  { name: '相川', en: 'Ai River', w: 13, pts: [[2350, 100], [2400, 800], [2500, 1500], [2650, 2200], [2850, 2900], [2950, 3600]] },
];

const ROADS = [
  { name: '中山道', en: 'Nakasendō Road', w: 13, pts: [[0, 2080], [600, 2060], [1060, 2070], [1500, 1950], [2000, 1800], [2550, 1720], [3100, 1780], [3700, 1900], [4300, 2000], [4800, 2050]] },
  { name: '北国街道', en: 'Hokkoku Road', w: 10, pts: [[2550, 1720], [2200, 1400], [1800, 1000], [1450, 650], [1200, 300], [1100, 0]] },
  { name: '伊勢街道', en: 'Ise Road', w: 10, pts: [[2550, 1720], [2750, 2200], [3000, 2800], [3200, 3600]] },
];

const VILLAGES = [
  { name: '関ヶ原宿', en: 'Sekigahara Post Town', x: 2560, y: 1690, r: 130, n: 18 },
  { name: '山中村', en: 'Yamanaka Village', x: 820, y: 2390, r: 90, n: 8 },
  { name: '小池村', en: 'Koike Village', x: 1560, y: 760, r: 70, n: 6 },
  { name: '松尾村', en: 'Matsuo Village', x: 1260, y: 2820, r: 80, n: 6 },
  { name: '野上', en: 'Nogami', x: 3800, y: 1880, r: 100, n: 9 },
  { name: '垂井', en: 'Tarui', x: 4660, y: 2080, r: 110, n: 11 },
  { name: '宮代', en: 'Miyashiro', x: 4080, y: 2480, r: 80, n: 6 },
];

// 地名ラベル（討死の場所判定にも使う）
const LANDMARKS = [
  { name: '松尾山', en: 'Mt. Matsuo', x: 650, y: 3050, kind: 'mt' },
  { name: '笹尾山', en: 'Mt. Sasao', x: 1050, y: 470, kind: 'mt' },
  { name: '北天満山', en: 'North Mt. Tenma', x: 1380, y: 1180, kind: 'mt' },
  { name: '南天満山', en: 'South Mt. Tenma', x: 1280, y: 1600, kind: 'mt' },
  { name: '南宮山', en: 'Mt. Nangu', x: 4250, y: 2980, kind: 'mt' },
  { name: '桃配山', en: 'Mt. Momokubari', x: 4100, y: 1950, kind: 'mt' },
  { name: '丸山', en: 'Maruyama Hill', x: 1880, y: 440, kind: 'mt' },
  { name: '陣場野', en: 'Jinbano', x: 2800, y: 1300, kind: 'pl' },
  { name: '関ヶ原宿', en: 'Sekigahara Post Town', x: 2560, y: 1690, kind: 'pl' },
  { name: '山中村', en: 'Yamanaka Village', x: 820, y: 2390, kind: 'pl' },
  { name: '小池村', en: 'Koike Village', x: 1560, y: 760, kind: 'pl' },
  { name: '松尾村', en: 'Matsuo Village', x: 1260, y: 2820, kind: 'pl' },
  { name: '不破関', en: 'Fuwa Barrier', x: 1150, y: 2150, kind: 'pl' },
  { name: '決戦地', en: 'the Decisive Battle Site', x: 1450, y: 700, kind: 'pl' },
  { name: '野上', en: 'Nogami', x: 3800, y: 1880, kind: 'pl' },
  { name: '垂井', en: 'Tarui', x: 4660, y: 2080, kind: 'pl' },
  { name: '宮代', en: 'Miyashiro', x: 4080, y: 2480, kind: 'pl' },
  { name: '伊吹山麓', en: 'the Ibuki foothills', x: 2600, y: 200, kind: 'mt' },
  { name: '藤古川', en: 'Fujiko River', x: 900, y: 1500, kind: 'rv' },
  { name: '寺谷川', en: 'Teradani River', x: 1700, y: 2200, kind: 'rv' },
  { name: '相川', en: 'Ai River', x: 2600, y: 2050, kind: 'rv' },
  { name: '中山道', en: 'Nakasendō Road', x: 3300, y: 1830, kind: 'rd' },
  { name: '北国街道', en: 'Hokkoku Road', x: 1960, y: 1140, kind: 'rd' },
  { name: '伊勢街道', en: 'Ise Road', x: 2930, y: 2700, kind: 'rd' },
];

// ---- 布陣 ----
// side: W=西軍(石田方) / E=東軍(徳川方)
// n=兵数, g=鉄砲足軽数, hp=武将体力, pow=武将攻撃力, brave=猛将（自ら突撃してくる）
const UNITS = [
  // ===== 西軍 =====
  { name: '石田三成', en: 'Ishida Mitsunari', side: 'W', x: 1050, y: 470, k: '石', bg: '#f2f0e6', fg: '#111', n: 14, g: 4, hp: 420, pow: 16, boss: true },
  { name: '島左近', en: 'Shima Sakon', side: 'W', x: 1260, y: 560, k: '島', bg: '#222', fg: '#eee', n: 9, g: 1, hp: 380, pow: 20, brave: true },
  { name: '蒲生郷舎', en: 'Gamō Satoie', side: 'W', x: 1180, y: 700, k: '蒲', bg: '#6b4a2b', fg: '#fff', n: 6, g: 1, hp: 200, pow: 14 },
  { name: '島津義弘', en: 'Shimazu Yoshihiro', side: 'W', x: 1500, y: 880, k: '十', bg: '#f4f4f4', fg: '#111', n: 10, g: 3, hp: 440, pow: 22, brave: true },
  { name: '島津豊久', en: 'Shimazu Toyohisa', side: 'W', x: 1600, y: 960, k: '十', bg: '#f4f4f4', fg: '#111', n: 6, g: 1, hp: 260, pow: 18, brave: true },
  { name: '小西行長', en: 'Konishi Yukinaga', side: 'W', x: 1400, y: 1180, k: '小', bg: '#e6d3a0', fg: '#333', n: 10, g: 2, hp: 280, pow: 15 },
  { name: '宇喜多秀家', en: 'Ukita Hideie', side: 'W', x: 1280, y: 1600, k: '宇', bg: '#6d2b7d', fg: '#fff', n: 14, g: 3, hp: 380, pow: 17, boss: true },
  { name: '明石全登', en: 'Akashi Takenori', side: 'W', x: 1480, y: 1660, k: '明', bg: '#4b3b7a', fg: '#fff', n: 8, g: 1, hp: 280, pow: 18, brave: true },
  { name: '大谷吉継', en: 'Ōtani Yoshitsugu', side: 'W', x: 880, y: 2150, k: '大', bg: '#ddd8c0', fg: '#222', n: 10, g: 2, hp: 320, pow: 17, boss: true },
  { name: '大谷吉治', en: 'Ōtani Yoshiharu', side: 'W', x: 1000, y: 2020, k: '大', bg: '#ddd8c0', fg: '#622', n: 5, g: 0, hp: 180, pow: 13 },
  { name: '戸田勝成', en: 'Toda Katsushige', side: 'W', x: 1180, y: 2040, k: '戸', bg: '#557a8a', fg: '#fff', n: 5, g: 1, hp: 180, pow: 13 },
  { name: '平塚為広', en: 'Hiratsuka Tamehiro', side: 'W', x: 1230, y: 2230, k: '平', bg: '#8a6a3a', fg: '#fff', n: 5, g: 0, hp: 200, pow: 15, brave: true },
  { name: '脇坂安治', en: 'Wakisaka Yasuharu', side: 'W', x: 1060, y: 2600, k: '脇', bg: '#355a7a', fg: '#fff', n: 6, g: 1, hp: 180, pow: 13 },
  { name: '朽木元綱', en: 'Kutsuki Mototsuna', side: 'W', x: 900, y: 2640, k: '朽', bg: '#6a6a3a', fg: '#fff', n: 5, g: 0, hp: 160, pow: 12 },
  { name: '小川祐忠', en: 'Ogawa Suketada', side: 'W', x: 1220, y: 2700, k: '祐', bg: '#3a6a6a', fg: '#fff', n: 5, g: 1, hp: 160, pow: 12 },
  { name: '赤座直保', en: 'Akaza Naoyasu', side: 'W', x: 1380, y: 2580, k: '赤', bg: '#a83a3a', fg: '#fff', n: 4, g: 0, hp: 150, pow: 12 },
  { name: '毛利秀元', en: 'Mōri Hidemoto', side: 'W', x: 4250, y: 2950, k: '毛', bg: '#f8f8f8', fg: '#111', n: 12, g: 3, hp: 360, pow: 17, boss: true },
  { name: '吉川広家', en: 'Kikkawa Hiroie', side: 'W', x: 3950, y: 2700, k: '吉', bg: '#2f4f2f', fg: '#fff', n: 8, g: 2, hp: 260, pow: 15 },
  { name: '安国寺恵瓊', en: 'Ankokuji Ekei', side: 'W', x: 4420, y: 2720, k: '安', bg: '#c0a060', fg: '#222', n: 6, g: 1, hp: 180, pow: 12 },
  { name: '長束正家', en: 'Natsuka Masaie', side: 'W', x: 4560, y: 2560, k: '束', bg: '#6a4a8a', fg: '#fff', n: 6, g: 1, hp: 180, pow: 13 },
  { name: '長宗我部盛親', en: 'Chōsokabe Morichika', side: 'W', x: 4650, y: 2350, k: '宗', bg: '#1d1d1d', fg: '#fff', n: 10, g: 2, hp: 320, pow: 18, brave: true },

  // ===== 東軍 =====
  { name: '徳川家康', en: 'Tokugawa Ieyasu', side: 'E', x: 2800, y: 1300, k: '葵', bg: '#f5f5f0', fg: '#111', n: 18, g: 6, hp: 650, pow: 20, boss: true, ieyasu: true },
  { name: '本多忠勝', en: 'Honda Tadakatsu', side: 'E', x: 2420, y: 1560, k: '本', bg: '#111', fg: '#f5d000', n: 8, g: 1, hp: 480, pow: 26, brave: true },
  { name: '井伊直政', en: 'Ii Naomasa', side: 'E', x: 1980, y: 1390, k: '井', bg: '#c0201a', fg: '#f5d000', n: 10, g: 2, hp: 360, pow: 20, brave: true },
  { name: '松平忠吉', en: 'Matsudaira Tadayoshi', side: 'E', x: 2090, y: 1540, k: '松', bg: '#f0f0f0', fg: '#222', n: 8, g: 1, hp: 240, pow: 15 },
  { name: '福島正則', en: 'Fukushima Masanori', side: 'E', x: 1830, y: 1840, k: '福', bg: '#2a3f8f', fg: '#fff', n: 12, g: 3, hp: 360, pow: 19, brave: true },
  { name: '黒田長政', en: 'Kuroda Nagamasa', side: 'E', x: 1860, y: 470, k: '黒', bg: '#151515', fg: '#fff', n: 10, g: 3, hp: 320, pow: 17 },
  { name: '竹中重門', en: 'Takenaka Shigekado', side: 'E', x: 1980, y: 600, k: '竹', bg: '#4a7a3a', fg: '#fff', n: 5, g: 1, hp: 170, pow: 12 },
  { name: '田中吉政', en: 'Tanaka Yoshimasa', side: 'E', x: 1760, y: 700, k: '田', bg: '#8a3a3a', fg: '#fff', n: 7, g: 2, hp: 220, pow: 14 },
  { name: '細川忠興', en: 'Hosokawa Tadaoki', side: 'E', x: 1920, y: 820, k: '細', bg: '#3a3a6a', fg: '#fff', n: 10, g: 2, hp: 300, pow: 17 },
  { name: '加藤嘉明', en: 'Katō Yoshiaki', side: 'E', x: 2010, y: 980, k: '加', bg: '#b0a020', fg: '#222', n: 7, g: 1, hp: 240, pow: 16 },
  { name: '筒井定次', en: 'Tsutsui Sadatsugu', side: 'E', x: 2060, y: 1130, k: '筒', bg: '#5a5a5a', fg: '#fff', n: 7, g: 1, hp: 200, pow: 13 },
  { name: '生駒一正', en: 'Ikoma Kazumasa', side: 'E', x: 2220, y: 1000, k: '生', bg: '#3a5a3a', fg: '#fff', n: 5, g: 1, hp: 170, pow: 12 },
  { name: '織田有楽斎', en: 'Oda Urakusai', side: 'E', x: 2190, y: 1250, k: '織', bg: '#d4a020', fg: '#222', n: 5, g: 1, hp: 160, pow: 11 },
  { name: '寺沢広高', en: 'Terazawa Hirotaka', side: 'E', x: 1930, y: 2060, k: '寺', bg: '#6a3a2a', fg: '#fff', n: 6, g: 1, hp: 180, pow: 13 },
  { name: '藤堂高虎', en: 'Tōdō Takatora', side: 'E', x: 1720, y: 2260, k: '藤', bg: '#262626', fg: '#fff', n: 9, g: 2, hp: 280, pow: 17 },
  { name: '京極高知', en: 'Kyōgoku Takatomo', side: 'E', x: 1870, y: 2420, k: '京', bg: '#4a4a8a', fg: '#fff', n: 7, g: 1, hp: 220, pow: 14 },
  { name: '山内一豊', en: 'Yamauchi Kazutoyo', side: 'E', x: 3500, y: 2260, k: '山', bg: '#2a6a5a', fg: '#fff', n: 8, g: 2, hp: 220, pow: 14 },
  { name: '有馬豊氏', en: 'Arima Toyouji', side: 'E', x: 3660, y: 2150, k: '有', bg: '#7a2a5a', fg: '#fff', n: 6, g: 1, hp: 180, pow: 13 },
  { name: '浅野幸長', en: 'Asano Yoshinaga', side: 'E', x: 3740, y: 2450, k: '浅', bg: '#8a6a1a', fg: '#fff', n: 8, g: 2, hp: 240, pow: 15 },
  { name: '池田輝政', en: 'Ikeda Terumasa', side: 'E', x: 3950, y: 2300, k: '池', bg: '#1a4a8a', fg: '#fff', n: 10, g: 2, hp: 280, pow: 16 },
];

const PLAYER_START = { x: 760, y: 2860 };
