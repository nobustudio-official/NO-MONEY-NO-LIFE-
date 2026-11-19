# 海の繰り返し背景 v1

2026-10-29。組み込み image_gen で生成した2枚を容量を抑えてゲームに実装。CLI/API未使用。

## 素材

- base.webp：海の下地、512×512。
- ripples.webp：透明な波模様、384×384。
- base-repeat.svg：下地を反転配置した1024×1024の繰り返し単位。
- ripples-repeat.svg：波模様を反転配置し、不透明度16%にした768×768の単位。
- assets.json：原画の場所・寸法・容量・不透明度。

実際にゲームで読み込むのは2つのSVG。画像データを内包し、描画用合計55,383バイト（約55KB）。
2枚のWebPは制作・再利用用に残す。元の生成PNGはOneDrive外のCodex生成画像フォルダーにあり、大きな原画をOneDriveへ重複保存していない。
反転配置は元画像の四辺が完全にはつながらない場合でも境界の画素が一致するため。海そのものの絵をプログラムで描き替えていない。

## 実装

map-scene.js：世界範囲9216×7424、背景生成と海のズーム追従を管理。
map-scene.css：表示範囲全体を覆う海。単一の背景を繰り返し、広い海を大量の画像要素で埋めない。
初回導入では既存4枚を上層に残した。その後、招き猫大陸の配置に伴い旧背景4枚をゲームの地図表示から外した。現在は草地・海岸線・小判型の湖を持つ招き猫大陸が上層にある。詳細は隣のcontinent/README.md。
既存201マス・経路・ゲーム状態は変更せず、新しいマス・道は作成しない。

最小縮小率0.1、最大2.2。中心を基準に拡大した際に左上がスクロール不能な負の座標へ出ないよう、拡大量に対応した余白を左右上下へ確保する。
ホイールでのズーム後もカーソル位置の地形を維持する。海の模様もズームとスクロールに追従する。
海はマップ領域の下地なので、陸地の外や最大限カメラを引いた表示でも枠全体に続く。

## 検証

tests/map-scene-browser.cjsで実際のゲームHTMLを別ブラウザへ読み込み確認。稼働中の対戦・サーバーには接続しない。
- 背景範囲9216×7424、既存マス201個、MAP_DATAは変更なし。
- 0.1・1・2.2倍で海の表示とスクロールを確認。
- 既存マップの左右端のマスへ、各倍率でカメラ移動できる。
- ホイールで1→1.1倍にした際のカーソル位置保持。
- 海の反転境界と繰り返し境界の比較画素差0。
- ページのJavaScriptエラーなし。
- 既存の自動テスト94件成功。

実際に人が行うオンライン対戦の見た目確認はユーザー確認待ち。海の色・模様の強さは確認後に調整できる。

## 復元

今回の編集直前の game.js・ui.js・style.css・index.html は restore-points/2026-10-29-before-ocean-layer に退避した。
大きな全体アーカイブは作り直していない。「招き猫マップ制作前・ゲーム保全版」はOneDrive外のPC内に保持。
ユーザー確認後に採用版の復元ポイントを記録する。

## 生成指示

### ocean-base

Use case: stylized-concept. Asset: seamless repeatable square ocean ground texture for a cute chibi fantasy board game map, seen from the same slightly oblique overhead view as chunky illustrated JRPG terrain. Entire canvas is ONLY open ocean water, no coastline, no land, no objects. Friendly clear mid-blue and turquoise-blue, restrained soft broad interlocking undulations and tiny sparse light-blue strokes indicating ripples. Flat illustrated color masses with subtle texture and clean smooth edges, NOT photorealistic, not realistic 3D water, not noisy sparkling water, no large white foam lines. Balanced medium contrast, gentle enough that colorful game icons remain readable above it. Uniform illumination and color density everywhere. Tileable on left-right and top-bottom, edges connect seamlessly. No center vignette, no horizon, no sky, no lighting gradient across canvas, no text or UI. Square1024x1024 if possible.

### ocean-ripples

Use case: stylized-concept. Asset: transparent square repeating ripple overlay for a cute illustrated fantasy board-game ocean. Transparent background with sparse small curved pale cyan and light-blue water ripple marks, about12 loose groups scattered evenly, individually short and gently wavy, quiet and friendly cartoon style. No ocean floor or colored background, no shadows or glowing haze, no white opaque background, no characters, boats, islands, fish or text. NO huge foam crests, no realistic water, no wave borders. Keep marks well separated and away from canvas edges so a repeated tile looks natural. Real alpha transparency, square1024x1024 if possible.

