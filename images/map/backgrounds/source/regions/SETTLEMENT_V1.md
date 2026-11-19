# 街・王都・古代遺跡・湖の地面 v1

2026-10-29。街・王都・古代遺跡は組み込み画像生成ツールで新規作成。参照は画風・素材感だけに使い、建物等のオブジェクトは生成していない。湖は採用済みlake2.pngを再利用し、新規生成していない。
中央の正方形切り出し・512×512縮小・WebP化のみ実施。原画はOneDrive外に保持。

|エリア|ゲーム用素材|容量|
|---|---|---|
|街|settlement-v1/town-ground.webp|58,530 bytes|
|王都|settlement-v1/capital-ground.webp|62,354 bytes|
|古代遺跡|settlement-v1/ruins-ground.webp|89,494 bytes|
|湖|settlement-v1/lake-ground.webp|47,116 bytes|

生成指示：

## town

原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-52d8318c-1869-4b10-919a-c0ff3f01e69b.png

参照：demos/map-lab/assets/town2.png

Use case: stylized-concept. Asset: one opaque repeatable square GROUND ONLY texture for a cute illustrated fantasy board game. Reference is style/material reference only, remove all perimeter objects. Match simplified rounded painted forms, medium coarse detail, same oblique top-down camera and uniform shallow perspective. No horizon, no vanishing point. Entire image uniform ground extending beyond all edges, no frame or central scene. Keep fine detail modest and game icons legible. No buildings, walls, trees, rocks, plants, characters, paths, route lines, text or UI. Light upper left. Town plaza ground: warm cream-beige small irregular rounded paving stones, soft outlines, subtle variation, like open center of reference, not diagonal grid with strong converging perspective.

## capital

原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-317d9111-27d7-4ef8-8445-5c5cdbeacd6a.png

参照：demos/map-lab/assets/town2.png

Use case: stylized-concept. Asset: one opaque repeatable square GROUND ONLY texture for a cute illustrated fantasy board game. Reference is style/material reference only, remove all perimeter objects. Match simplified rounded painted forms, medium coarse detail, same oblique top-down camera and uniform shallow perspective. No horizon, no vanishing point. Entire image uniform ground extending beyond all edges, no frame or central scene. Keep fine detail modest and game icons legible. No buildings, walls, trees, rocks, plants, characters, paths, route lines, text or UI. Light upper left. Royal capital plaza ground: elegant cool blue-gray and pale blue limestone square paving slabs with restrained cream accents, orderly modest blocks, clean regular paving. Same playful drawing language as reference, no emblems or ornaments, only ground. Distinct cool tones separate it from warm beige town.

## ruins

原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-57417215-85f7-452d-9846-26b14cc795ec.png

参照：demos/map-lab/assets/ruins2.png

Use case: stylized-concept. Asset: one opaque repeatable square GROUND ONLY texture for a cute illustrated fantasy board game. Reference is style/material reference only, remove all perimeter objects. Match simplified rounded painted forms, medium coarse detail, same oblique top-down camera and uniform shallow perspective. No horizon, no vanishing point. Entire image uniform ground extending beyond all edges, no frame or central scene. Keep fine detail modest and game icons legible. No buildings, walls, trees, rocks, plants, characters, paths, route lines, text or UI. Light upper left. Ancient ruins ground: aged warm gray-beige large flagstones with lightly chipped corners and thin cracks, restrained tiny moss tint only within cracks. No ruins objects, no crystals, no pedestals or symbols. Uniform open old stone floor.

## 湖

demos/map-lab/assets/lake2.pngを再利用。湖専用の明るい水面。元の小判形と位置は維持。陸上地域の境界線より上の層に表示し、内部には区切り線を描かない。

## 再変換

demos/map-lab/pack-nature-grounds.py に settlement-v1-sources.json と出力先名 settlement-v1 を渡す。通常の自然素材の出力先は引き続き nature-v1。
