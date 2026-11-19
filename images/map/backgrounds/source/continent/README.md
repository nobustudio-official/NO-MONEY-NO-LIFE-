# 招き猫大陸の土台・800マス想定

2026-10-29。旧4枚の背景画像をマップの描画と先読みから外し、原画から抽出した招き猫の大陸をゲームへ配置。
元のPNGファイルは他の画面・過去デモが参照するため保持。ゲームのマップには表示しない。
既存201マスと256本の道は、ID・位置・接続を一切変更していない。新しいマスや道を作成していない。

## 今回の描写

- 草地：生成した小さな草地画像1枚（512×512 WebP、26,888バイト）を反転して繰り返す。
- 大陸：招き猫イラストから抽出した84点の輪郭。1つのベクトル形状で草地を切り抜くため、大判画像を生成・引き伸ばしていない。
- 海岸：薄い浅瀬と砂色の縁、右下方向の控えめな影。
- 湖：承認済みの位置に、少し傾いた小判型の水面。海の既存素材を再利用。
- 各地域の風景や建物等はこれから。今回は大陸の輪郭と草地の土台・湖を表示する段階。
- この土台の配置によって旧マスを移動していないため、旧マップの一部は海上や大陸の外側に見える。背景決定後の800マス配置時に整合させる。

## 広さの算定

実マップ201マス・256接続。つながるマス同士の距離は中央値144、25%点120、75%点160。
世界範囲9216×7424は維持。大陸の高さ約7168、幅約5766。原画の比率に合わせ、上下に128の余白を確保。
外周内面積32,844,074、湖を除く陸地面積30,682,107。
800×144²＝16,588,800に対し陸地は約1.85倍で、経路・景観の余白を取る目安となる。

正方格子でマスを実際に作ったわけではない。中央値からの面積試算であり、耳・上げた手・湖の周囲などの経路と、風景オブジェクトの占有面積によって実際の配置可能数は変わる。正式な800マスの配置・到達性確認は背景決定後に行う。
湖上にもマスを置ける既定方針だが、余裕をみるため今回の陸地面積からは湖を差し引いて計算した。
以前の600マスを目標とした記述より、今回の800マスの指定を優先する。

## 継続編集と検証

- layout.json / map-continent-data.js：世界座標、湖、面積・距離の計算結果。
- demos/map-lab/build-continent.py：輪郭を世界座標へ変換し、草地を容量を抑えた形式へ変換。
- map-scene.js：実際の描画。ゲーム本体のgame.jsは背景描画を呼び出すのみ。
- tests/map-scene-browser.cjs：実際のゲーム画面で背景・ズーム・カメラ・旧マス201個と256接続の維持を確認。
- 通常の自動テスト94件も成功。実プレイの見た目はユーザー確認待ち。

編集直前の5ファイルは restore-points/2026-10-29-before-cat-continent へ退避。大きな全体ZIPを増やしていない。
海と既存マップの旧背景がある状態へ戻すときは、この5ファイルを復元する。新規のmap-continent-data.jsは旧index.htmlからは読み込まれなくなる。
全体復元用「招き猫マップ制作前・ゲーム保全版」もPC内に保持。

## 草地の画像生成

組み込み image_gen 使用。元画像は草原3の左上区画。生成原画はOneDrive外のCodex生成画像フォルダーにあり、ゲーム用のWebPをこのフォルダーへ保存。
原画：C:/Users/uronw/.codex/generated_images/01a16876-1e4e-75e2-a55e-d4ed39c34a2e/exec-7172721d-50ff-4b75-8938-ca20cff307a4.png

使用プロンプト：

Use case: precise-object-edit. Reference is the approved grassland3 game terrain style. Create ONE seamlessly repeating ground-only grass texture in that exact yellow-green friendly illustrated chibi fantasy game style. Remove all trees, boulders, bushes, flowers, scenery groups, paths, markers and borders. Entire square is calm grassy ground, subtle broad overlapping lime and moss green patches and a very few tiny soft blade tufts. Same visual coarseness as the meadow in the reference at normal gameplay size, no increased realism, no photorealism or 3D, no noisy high-detail stippling. Uniform illumination, no vignette or framing, no shadows of offscreen objects, no sky or horizon. Edges tile seamlessly in both directions. This is a reusable base texture to fill a large cat-shaped continent via a separate vector coastline; do not draw a cat or island outline into the image. Square1024x1024 if possible. No text or UI.

