# 遺跡の岸：石積み側面 v1

## 全エリアへの展開（2026-10-29）

組み込み画像生成で5枚の専用側面PNGを追加。生成指示は [GENERATION_PROMPTS.json](GENERATION_PROMPTS.json)。これらは地面画像ではない。SVGの表示範囲で中央の帯だけを使い、原画の画素は加工していない。

| 画像 | 使用先 | 素材 |
|---|---|---|
| soil-cliff.png | 草原・森林 | 根、小石、土の層 |
| city-cliff.png | 街・王都 | 青灰色の石積み |
| sandstone-cliff.png | 砂漠 | 砂岩、堆積層 |
| snow-cliff.png | 雪山 | 雪の上端と露出した岩 |
| basalt-cliff.png | 火山 | 紫灰色の割れた岩盤 |
| ruins-masonry.png | 遺跡 | 既存の採用済み石積み |

現在の共通配置は `map-island-banks.js`、素材の原寸・表示範囲は `map-cliff-materials.js`。繰り返し幅360、厚み26。全周の形は地面と共通で、水面への影も同じ輪郭から描く。湖の水面は維持し、湖岸では周囲の陸の素材を使う。

以下は遺跡素材の初回作成記録。現在の描画は上記の共通モジュールへ移行済み。

2026-10-29。会話内の承認済み岸イラスト（exec-94469ae5-2dad-4acf-b19e-637f7a995dd1.png）の遺跡側を参照し、組み込み画像生成ツールで専用素材を制作。

採用画像：`ruins-masonry.png`、2172×724、透過PNG。生成原稿のコピーで、画素の加工はしていない。SVG内のviewBox `0 187 2172 331` で中央の石積みのみ表示。元の透明余白と微小な余分な画素をゲームに表示しない。

配置：`map-region-background.js` の `ruinsBankArt`。繰り返し幅360、側面高さ26ワールド単位。境界の弧長で模様を連続させ、横方向を岸の接線、縦方向を画面下向きへ変換する。石の画像を岸に沿わせる処理と、上端のハイライト・側面下部の陰影・水際の影は別々に調整できる。

現在は遺跡全体の共通輪郭から厚みを作り、大陸外周と地域境界の手前向きの岸へ貼る。他地域の仮側面は変更しない。上面の地面画像と道・マスも維持。

生成時の指示全文（built-in image_gen、参照画像あり、transparent_background=true）：

Create a game production TEXTURE ASSET derived from the RUINS STONE BANK SIDE FACE in the reference. Reference is style/material only. Output one straight HORIZONTAL STRIP of ancient warm beige sandstone masonry, straight-on elevation, zero perspective, zero tilt, two staggered rows of chunky irregular hand-painted stones. Match reference exactly in artistic character: softly rounded chipped stone edges, warm cream top-edge highlights, golden beige rough faces, subtle mottled mineral texture, deep olive-brown mortar crevices with very sparse moss, cool dark lower edge ambient shading. Not flat vector or photorealistic. Wide short strip, width around 6 times height. Strip fills almost entire width, vertically centered. Two rows ONLY, each block around one tenth of total strip width. Top and bottom edges straight overall with modest chips, no huge overhangs. Left and right edges designed to join when repeated (stones and mortar continue at same row heights). Entire object is ONLY THE VERTICAL STONE SIDE WALL TEXTURE, no ground/top surface, no water, no vegetation, no landscape, no UI, no text. Genuinely transparent background outside the horizontal strip. This will be draped along a curved island edge in a fantasy board game; keep side face texture clear and strong at small game resolution.
