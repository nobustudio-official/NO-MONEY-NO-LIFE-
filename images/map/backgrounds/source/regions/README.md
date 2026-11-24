# 地域背景・草原の基準見本

2026-10-29。草原3のテイストを参照し、木・岩・花の透過素材を1枚生成。
モード：既存草原見本を参照した新規素材生成。透過背景。
原画はOneDrive外の生成フォルダに保存し、本体には透過WebP（480×419、34,398バイト）のみ配置。
元画像：C:/Users/uronw/.codex/generated_images/01a16876-1e4e-75e2-a55e-d4ed39c34a2e/exec-fe978d2b-4016-4421-bbc0-51248a972537.png
参照：demos/map-lab/assets/region-expansions-v1/grassland3/grassland3-01.png

生成指示：

Use case: stylized-concept. Asset: one reusable transparent background scenery cluster for an illustrated chibi fantasy board-game meadow. Match the accepted grassland3 art exactly: chunky rounded layered lime and forest green treetops, warm brown visible trunks, cream-gray rounded rocks and a few tiny white/yellow flowers. Draw THREE compact trees grouped asymmetrically with two small rocks and a few flowers at their roots, ALL in one connected compact scene. Same slightly oblique overhead game-map angle with visible trunks and side faces, top-left light and discreet lower-right contact shadows. Friendly clean outlines, simple flat gradients, no realistic foliage, no photorealism, no excessive detail. Cluster should remain readable when rendered about240x210 game pixels. Transparent ground outside the roots; no grass-colored rectangular backdrop, no floating island, no ground platform, no roads, no tiles, no characters, no text or border. Tree canopy clearly cut out with true alpha. Generous transparent margins. This is STATIC background scenery; no motion elements.

## 継続編集

- images/map/objects/optimized/grassland/tree-rock-cluster-70pct.webp：ゲーム内オブジェと草原背景で共有する軽量版素材。
- layout.json とプロジェクト直下の map-region-data.js：同一の配置データ。
- demos/map-lab/build-region-backgrounds.py：承認済みの9エリア位置を世界座標へ変換し、隣接地域が同じ曲線を共有する境界を生成。配置の乱数は固定。
- 表示240×210以内、9か所。元画像の縦横比を保ち、地面の余白を優先して疎らに配置。
- 森林・雪山・砂漠・火山の地面素材は [NATURE_V1.md](NATURE_V1.md) を参照。街・王都・古代遺跡はまだ草地の仮土台。地域間の自然な地形の接続は後工程。
- 動く草や噴火などは、道を配置した後の背景制作手順8で追加する。
- 地域境界を薄い線で表示中。boundaryGuides.visible で外せる。

2026-10-29：街・王都・古代遺跡の地面と湖専用水面を追加済み。[SETTLEMENT_V1.md](SETTLEMENT_V1.md)を参照。9エリアすべての地面が揃い、地域の自然な接続とオブジェクト配置は後工程。

2026-10-29：地域境界の接続を調整。[transitions-v1/README.md](transitions-v1/README.md)に方式・再作成・容量を記録。既存地面画像の縮尺を保って合成し、画像の色や描画内容は変更していない。

2026-10-29訂正：transitions-v1の計算マスク方式は不採用で本体から外した。現在は[painted-joins-v1/README.md](painted-joins-v1/README.md)の部分描画方式。最初の遺跡・雪山区画のみ反映し、残りは未制作。

2026-10-29：現行は[boundary-strips-v1/README.md](boundary-strips-v1/README.md)の境界だけの透過素材を配置する方式。9地域に適用。painted-joins-v1は採用見本として残すが、広い矩形画像を本体で表示する方式は共用素材へ置換した。
