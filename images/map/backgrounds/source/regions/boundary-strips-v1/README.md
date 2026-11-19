# 境界用の透過素材 v1

2026-10-29。画像生成スキル／組み込み画像生成ツールで作画した境界だけの帯。地面画像は変更しない。

## 構成

雪3、砂2、草2、舗装2、火山地面1、岸辺1の11ファイル。合計459,326バイト（約0.46MB）。元の広い接続画像406,302バイト1枚に近い容量で、全エリアに再利用する。

雪の最終3種類は、下地を含まないsnow-a原画を3分割して作成。草の最終2種類もgrass-a原画の2区間を使う。一部の初回生成案には石床が含まれていたため不採用。背景に依存しない絵だけを使う。
画像処理は透明余白のトリミング、区間の切り出し、縮小・WebP化のみ。透明度や色を塗り直していない。原画はOneDrive外に保持。source.jsonではなくsources.jsonに採用原画と切り出し区間を記録。

## 描画

- 地域の共通境界をデータから取り出し、描画可能な陸上部分だけ抽出する。海上・湖内に隠れた境界は描かない。
- 同じ曲線に短い素材を配置。接線で向きを、地面の内外判定で上下を合わせ、種類を交替させて重ねる。長い1枚を強く曲げて引き伸ばさない。
- 両端だけ5%の透明度を調整して素材をつなぐ。地面同士のぼかし合成は使わない。
- 各区間は隣接する2地域と大陸輪郭で切り抜き、別エリアへ大きく飛び出さないようにする。湖岸は閉じた小判形、海岸は大陸輪郭へ同じ岸辺素材を配置する。
- 見える境界のガイド線は素材で置き換える。湖内部に陸上の区切りは出さない。
- 計算した配置は静止表示。操作・ゲーム状態・マス・道の接続は変更しない。

## 継続編集

map-boundary-strips.js：材質の選択、向き、間隔、表示。
library.json：画像・大きさ・基準位置・間隔。
demos/map-lab/pack-boundary-strips.py：原画から再変換。
demos/map-lab/build-region-backgrounds.py：隣接ペアと素材の設定を本体データへ組み込む。
docs/MAP_BOUNDARY_INVENTORY.md：全エリアの対応一覧。
以前の広い遺跡・雪山画像は比較資料として保持し、本体の先読み・表示からは外す。

## 生成指示の共通部

Use case: stylized-concept. Asset: a reusable TRANSPARENT boundary ribbon sprite for a cute hand-painted fantasy board-game map, used many times along a curve. One continuous low narrow horizontal ground-material edge spanning from LEFT canvas edge to RIGHT canvas edge. Actual alpha transparent above and below the irregular ribbon, no background plane, no scene. Flat oblique top-down view, medium-coarse painterly cartoon detail like reference, NOT photoreal, NO horizon. Overall 3:1 wide canvas; ribbon centered horizontally around mid-height, occupying at most half the canvas height. Left and right ends are flat cut-throughs of the same repeating pattern, never rounded end caps. No isolated decorative objects, rocks, vegetation clumps, structures, characters, text, UI, cast shadow below the entire image, or visible solid rectangular backing. The material on the TOP side owns the edge and extends slightly DOWN into the neighboring material; lower edge has clear irregular hand-drawn shapes and small contact shadows. This must be drawn illustration, not blurred or faded textures. No perspective shrinking along the ribbon. 

## 各生成案

### snow-a

Snow edge variant A: soft ivory white snow with pale icy-blue shallow undercuts, small rounded scallops, a few tiny snow crumbs below. Upper fringe irregular and thin, central snow lip solid to cover an underlying material boundary. Match the snow lip of reference, extract just the snow shapes and their thin contact shading, NO paving or green ground.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-ea4f2d4d-88a8-4bfa-bd28-1162de15c721.png

### snow-b

Snow edge variant B: same snow style and colors, slightly longer low drifts alternating with small nicks and three small detached snow flecks below, no large piles.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-1ab98c4c-8cdd-4cb4-a118-5c349018362b.png

### snow-c

Snow edge variant C: same snow style, restrained asymmetrical wavy edge with some flatter sections, tiny powder fragments, no large mounds.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-226a1265-4552-4a53-8b08-e02056fd7267.png

### sand-a

Sand edge variant A: warm golden beige thin windblown sand lip, tiny golden grains spilling below, shallow uneven scalloped edge with understated ocher contact shading, no dunes or stones. Thin dispersed upper fringe blends naturally into existing golden sand ground by shape, no transparency blur.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-20ace991-cb23-4786-b3f4-23f95081dcdf.png

### sand-b

Sand edge variant B: warm beige low sand drift with longer smooth stretches and a few short ripple notches, fine sparse grains below, no dunes or objects.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-6bf9c061-79bd-451e-8812-f66c282fb178.png

### grass-a

Meadow ground edge variant A: a FLAT low irregular ribbon of lime and medium-green turf, tiny short flat pointed grass fringe along lower edge, broken green flecks on both sides. Do not draw standing bundles, trees or bushes. Match the grass in reference; a ground edge, not an object.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-1d86f29c-0301-4759-b04f-f6eba327e021.png

### grass-b

Meadow ground edge variant B: same lime/medium-green flat turf colors, longer small turf lobes alternating with tiny tapered grass marks, thin subtle olive contact edge, no standing objects.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-8900d6d7-d7c8-4bb4-8452-16dbdcaf956a.png

### stone-a

Paving ground edge variant A: a thin uneven warm gray-beige row of flush rounded paving slab edges with chipped outlines, shallow gray joints and a few tiny stone chips below. Low FLAT edge, not a vertical wall or curb. No ground plane beyond this narrow ribbon.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-5da423a5-2d26-445d-8542-909958f61e20.png

### stone-b

Paving ground edge variant B: same warm gray-beige flat chipped paving edges, varied slab widths and soft shallow joint lines, subtle broken edges, no tall rocks, wall or curb.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-62c4beb1-9e60-4fd5-bade-f7588eee4ae8.png

### basalt-a

Volcanic ground edge: narrow flat ribbon of purple charcoal cooled basalt, irregular chipped outline and shallow dark cracks, just a few tiny reddish-brown lines, NO lava river or glowing border, no standing rocks or volcanoes.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-88d5a674-d3ed-4bbc-b657-9ae06da66adf.png

### shore-a

Lake shore edge: a narrow pale sand ribbon with a few shallow turquoise water wisps along LOWER edge, irregular shoreline scallops, top-side sand blends by broken flecks, soft thin underwater contact edge. No rocks, waves cresting vertically, objects or ground rectangle.

生成原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-0f9e5a9a-b285-496b-a997-374c21f57b06.png

外周の海岸は砂のみの素材を使用する。湖用の青い水面部分を急な海岸角の陸上へ持ち込まないため。湖岸には水の縁を含む岸辺素材を使用。

急な海岸角では、海岸線から内側約28pxの帯状範囲だけを表示する。短い画像の矩形部分が内陸へ飛び出すのを防ぐ。ぼかし・画像生成の追加ではなく、共通する輪郭データによる切り抜き。
