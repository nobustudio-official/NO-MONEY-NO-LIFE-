# 遺跡・雪山の部分描画 v1

2026-10-29。画像生成スキル／組み込み画像生成ツールの編集モードを使用。

従来の計算マスクで地面全体をぼかして合成する方法はユーザーの意図に合わず、不採用。本体の読み込みと描画から外した。
元のゲーム背景を世界座標2600,1280・1536×1024で切り出し、遺跡と雪山の接続部をイラストとして描き直した。石床に積もる雪の形、小さな雪の塊、縁の陰影を追加。縮尺とカメラは元画像と一致させる。
原画：C:/Users/uronw/.codex/generated_images/01a16876-1e4e-75e2-a55e-d4ed39c34a2e/exec-8f38f45a-dae0-4993-87fd-ed7fea3b4e43.png
ゲーム用：ruins-snow.webp（1536×1024、406,302バイト）。形式変換のみ実施。
配置：layout.json。描画：map-region-background.js。通常倍率で1画像ピクセル＝1世界座標単位。
雪と石の境界自体は描画した形をそのまま表示。矩形素材の外縁32pxだけ貼り合わせ用に透明度を調整し、雪の形をぼかす処理は使っていない。
確認用ガイドは未制作の接続に残す。描き直した部分ではイラストを上に重ね、古い直線を出さない。湖は従来どおり最上層に置き、湖内部には境界線を表示しない。

## 生成指示

Use case: precise-object-edit. EDIT TARGET: the supplied actual game-background crop, exactly 1536x1024, world rectangle x2600,y1280,width1536,height1024. This is not a new landscape illustration. Preserve the camera angle, object scale, stone block sizes, colors, light, and positions of all existing textures. Redraw ONLY the long diagonal snow/ruins material junction running from pixel(428,332) at the coastal inlet to pixel(1107,853), and a small part of the snow/green-floor junction at that shared endpoint. Replace the perfectly straight clipped edge with a HAND-PAINTED irregular snow accumulation boundary: rounded softly scalloped low snow banks lying OVER and BETWEEN the existing paving blocks, patches of thin powder on some adjacent stones, narrow blue-gray shaded undersides where snow rests on stone, scattered small islands of melting snow farther onto the ruins. There must be visible solid snow shapes, not blurred texture blending or transparency gradients. Maintain exact continuation of existing stone joints through the unsnowed portions. Treat this as flat ground in a cute illustrated fantasy board game, same simplified medium-detail illustration style, NOT photorealistic, NOT isometric perspective. The replacement occupies only about 160 pixels each side of that diagonal, with uneven natural small excursions. Preserve every pixel outside that local junction band as closely as possible, especially the sea and coastal inlet, large open snowfield, bottom/left paving, green ground on right, and all four image edges. No new rocks, vegetation, structures, mountains, cliffs, road routes, characters, text, frame, or UI. The snow lip must look like intentional drawn ground geography and have the same original texture density. Keep output exact 3:2 landscape framing and full-image registration for direct placement back into the game.

## 制作の継続

demos/map-lab/render-boundary-reference.cjs で実ゲームの背景だけを切り出す。新しい地域の接続も同様に元画像を編集し、1区画ずつ登録する。既存の背景を全域生成し直さない。
他の地域境界はまだ部分描画をしていない。一般的なぼかし合成は取り消しており、残りは硬い境界の仮表示へ戻した。
この遺跡・雪山の描き直しを基準として、残りの組み合わせを順に制作する。
