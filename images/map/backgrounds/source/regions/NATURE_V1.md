# 自然エリアの地面素材 v1

2026-10-29。組み込み画像生成ツールを使用。参照画像の画風・素材感を使い、木や岩などのオブジェクトを除いた地面のみを新規生成。
原画はOneDrive外に保存。ゲーム用は中央を正方形に切り出し512×512へ縮小、WebPへ変換（描画内容の追加・加工なし）。
4素材合計147,702バイト。繰り返しの継ぎ目はSVG内で画像を反転して一致させる。地域間の自然な接続は後工程。

再生成用のプロンプト：

## forest

出力：nature-v1/forest-ground.webp

原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-f0c17879-c26b-4491-9d81-f823b19ef85b.png

参照：demos/map-lab/assets/forest1.png

Use case: stylized-concept. Asset: one opaque square repeatable GROUND ONLY texture for a cute illustrated Japanese fantasy board game. Reference image is a STYLE AND MATERIAL reference only; remove all perimeter decorations. Match reference's simplified painted shapes and medium coarse detail density, no photorealism. Camera sees flat ground at the same oblique top-down angle, no horizon, no perspective vanishing point. Fill the entire image uniformly with small ground markings, no central clearing, no frame, no border. Even lighting upper left. No trees, bushes, buildings, objects, rocks, flowers, paths, roads, runes, nodes, characters, text or UI. No large unique features; seamless-looking edges. Forest floor: deep moss-green grass with soft rounded dark olive patches and restrained cool green mottling. Clearly darker and cooler than meadow, avoid near-black. Only ground surface; do NOT add leaves or vegetation objects.

## snow

出力：nature-v1/snow-ground.webp

原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-e6c8d6e8-1509-4e76-b0fc-f5fd2aefafc5.png

参照：demos/map-lab/assets/snow1.png

Use case: stylized-concept. Asset: one opaque square repeatable GROUND ONLY texture for a cute illustrated Japanese fantasy board game. Reference image is a STYLE AND MATERIAL reference only; remove all perimeter decorations. Match reference's simplified painted shapes and medium coarse detail density, no photorealism. Camera sees flat ground at the same oblique top-down angle, no horizon, no perspective vanishing point. Fill the entire image uniformly with small ground markings, no central clearing, no frame, no border. Even lighting upper left. No trees, bushes, buildings, objects, rocks, flowers, paths, roads, runes, nodes, characters, text or UI. No large unique features; seamless-looking edges. Snowfield ground: soft ivory white snow, very pale icy blue shallow depressions, rounded simplified snow texture, broad flat walkable ground. No mountains or ice objects, no tracks.

## desert

出力：nature-v1/desert-ground.webp

原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-2ab057af-8476-433e-91a5-4ddf86a96145.png

参照：demos/map-lab/assets/desert3.png

Use case: stylized-concept. Asset: one opaque square repeatable GROUND ONLY texture for a cute illustrated Japanese fantasy board game. Reference image is a STYLE AND MATERIAL reference only; remove all perimeter decorations. Match reference's simplified painted shapes and medium coarse detail density, no photorealism. Camera sees flat ground at the same oblique top-down angle, no horizon, no perspective vanishing point. Fill the entire image uniformly with small ground markings, no central clearing, no frame, no border. Even lighting upper left. No trees, bushes, buildings, objects, rocks, flowers, paths, roads, runes, nodes, characters, text or UI. No large unique features; seamless-looking edges. Desert ground: warm golden beige sand with low shallow softly curved wind ripples and occasional tiny grain markings. Uniform small-scale waves, no dunes rising high, no rocks or cacti.

## volcano

出力：nature-v1/volcano-ground.webp

原画：C:\Users\uronw\.codex\generated_images\01a16876-1e4e-75e2-a55e-d4ed39c34a2e\exec-029c8ba5-a499-47e4-bcb8-cb1a77d11afd.png

参照：demos/map-lab/assets/volcano3.png

Use case: stylized-concept. Asset: one opaque square repeatable GROUND ONLY texture for a cute illustrated Japanese fantasy board game. Reference image is a STYLE AND MATERIAL reference only; remove all perimeter decorations. Match reference's simplified painted shapes and medium coarse detail density, no photorealism. Camera sees flat ground at the same oblique top-down angle, no horizon, no perspective vanishing point. Fill the entire image uniformly with small ground markings, no central clearing, no frame, no border. Even lighting upper left. No trees, bushes, buildings, objects, rocks, flowers, paths, roads, runes, nodes, characters, text or UI. No large unique features; seamless-looking edges. Volcanic ground: muted purple charcoal cooled basalt with small rounded stone-surface mottling, a few extremely thin dim reddish fissures, no bright lava rivers, no volcano cones, no objects. Keep game icons readable above it.
