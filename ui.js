// =========================
// G金額の表示形式
// =========================

function formatG(amount) {
    return amount.toLocaleString("ja-JP");
}

// =========================
// 安全なリッチテキスト表示
// 許可した要素・属性だけを新しいDOMとして組み立てます。
// =========================
window.setSafeRichContent = function (target, html) {
    if (!target) {
        return;
    }

    const allowedTags = new Set(["DIV", "STRONG", "BR", "SPAN", "IMG"]);
    const allowedTextAttributes = ["class", "alt", "title", "aria-label", "role"];

    function isSafeRelativeUrl(value) {
        const url = String(value || "").trim();
        return Boolean(url) &&
            !/^[a-z][a-z0-9+.-]*:/i.test(url) &&
            !url.startsWith("//") &&
            !/[\\\u0000-\u001f]/.test(url);
    }

    function appendSanitizedNode(sourceNode, destination) {
        if (sourceNode.nodeType === Node.TEXT_NODE) {
            destination.appendChild(document.createTextNode(sourceNode.nodeValue || ""));
            return;
        }

        if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const tagName = sourceNode.tagName.toUpperCase();
        if (!allowedTags.has(tagName)) {
            // 許可されないタグ自体は捨て、内部の通常テキストだけを残します。
            sourceNode.childNodes.forEach(child => appendSanitizedNode(child, destination));
            return;
        }

        const safeElement = document.createElement(tagName.toLowerCase());
        allowedTextAttributes.forEach(attributeName => {
            if (sourceNode.hasAttribute(attributeName)) {
                safeElement.setAttribute(attributeName, sourceNode.getAttribute(attributeName));
            }
        });

        if (tagName === "IMG") {
            const src = sourceNode.getAttribute("src");
            if (isSafeRelativeUrl(src)) {
                safeElement.setAttribute("src", src);
            }
        }

        // 現在の詳細パネルで必要な背景画像だけを許可します。
        const styleValue = sourceNode.getAttribute("style") || "";
        const backgroundMatch = styleValue.match(/background-image\s*:\s*url\(\s*(['"]?)(.*?)\1\s*\)/i);
        if (backgroundMatch && isSafeRelativeUrl(backgroundMatch[2])) {
            safeElement.style.backgroundImage = `url("${backgroundMatch[2].replace(/["\\]/g, "")}")`;
        }

        sourceNode.childNodes.forEach(child => appendSanitizedNode(child, safeElement));
        destination.appendChild(safeElement);
    }

    const parsed = new DOMParser().parseFromString(String(html ?? ""), "text/html");
    const fragment = document.createDocumentFragment();
    parsed.body.childNodes.forEach(node => appendSanitizedNode(node, fragment));
    target.replaceChildren(fragment);
};

// HTMLテンプレートからポップアップを生成します。
function getOrCreatePopupFromTemplate(popupId, templateId) {
    const existingPopup = document.getElementById(popupId);

    if (existingPopup) {
        return existingPopup;
    }

    const template = document.getElementById(templateId);
    const templateRoot = template?.content?.firstElementChild;

    if (!templateRoot) {
        console.error(`ポップアップテンプレートが見つかりません: ${templateId}`);
        return null;
    }

    const popup = templateRoot.cloneNode(true);
    popup.id = popupId;
    document.body.appendChild(popup);

    return popup;
}

// =========================
// PC：マップ左ドラッグ移動
// =========================

let mapMouseDragging = false;
let mapMouseDragMoved = false;

let mapMouseStartX = 0;
let mapMouseStartY = 0;

let mapMouseStartScrollLeft = 0;
let mapMouseStartScrollTop = 0;


function setupMapMouseDragUI() {

    const mapArea =
        document.querySelector(
            ".game-screen .map-area"
        );

    if (!mapArea) {
        return;
    }


    // =========================
    // 左ボタンを押したとき
    // =========================

    mapArea.addEventListener(
        "mousedown",
        function (event) {

            // 左クリック以外は対象外
            if (event.button !== 0) {
                return;
            }


            // マスの上から始めた場合は
            // 既存のマス操作を優先
            if (
                event.target.closest &&
                event.target.closest(".map-node")
            ) {
                return;
            }


            mapMouseDragging = true;
            mapMouseDragMoved = false;

            mapMouseStartX =
                event.clientX;

            mapMouseStartY =
                event.clientY;

            mapMouseStartScrollLeft =
                mapArea.scrollLeft;

            mapMouseStartScrollTop =
                mapArea.scrollTop;


            mapArea.style.cursor =
                "grabbing";

            event.preventDefault();

        }
    );


    // =========================
    // 左ドラッグ中
    // =========================

    mapArea.addEventListener(
        "mousemove",
        function (event) {

            if (!mapMouseDragging) {
                return;
            }


            const deltaX =
                event.clientX -
                mapMouseStartX;

            const deltaY =
                event.clientY -
                mapMouseStartY;


            // 少し動いたら
            // ドラッグ開始と判定
            if (
                Math.abs(deltaX) > 5 ||
                Math.abs(deltaY) > 5
            ) {
                mapMouseDragMoved = true;
            }


            if (!mapMouseDragMoved) {
                return;
            }


            mapArea.scrollLeft =
                mapMouseStartScrollLeft -
                deltaX;

            mapArea.scrollTop =
                mapMouseStartScrollTop -
                deltaY;


            event.preventDefault();

        }
    );


    // =========================
    // マウスを離したとき
    // =========================

    mapArea.addEventListener(
        "mouseup",
        function () {

            if (!mapMouseDragging) {
                return;
            }


            mapMouseDragging = false;

            mapArea.style.cursor =
                "";

        }
    );


    // =========================
    // マップ外で
    // マウスを離した場合
    // =========================

    document.addEventListener(
        "mouseup",
        function () {

            if (!mapMouseDragging) {
                return;
            }


            mapMouseDragging = false;

            mapArea.style.cursor =
                "";

        }
    );


    // =========================
    // ドラッグ終了直後の
    // マスクリック誤発火を防止
    // =========================

    mapArea.addEventListener(
        "click",
        function (event) {

            if (!mapMouseDragMoved) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();

            mapMouseDragMoved = false;

        },
        true
    );

}


// =========================
// PC：マップ左ドラッグ移動開始
// =========================

setupMapMouseDragUI();

// =========================
// PC：マウスホイールでマップ拡大縮小
// =========================

const MAP_INITIAL_ZOOM = 0.8;
let mapZoomUI = MAP_INITIAL_ZOOM;

const MAP_ZOOM_MIN = window.MapScene?.config.minZoom ?? 0.3;
const MAP_ZOOM_MAX = window.MapScene?.config.maxZoom ?? 2.2;


let mapZoomInteraction;


// =========================
// 現在のズーム倍率を取得
// =========================

function getMapZoomUI() {

    return mapZoomUI;

}


// =========================
// ズーム倍率を設定
// =========================

function setMapZoomUI(zoom) {
    mapZoomInteraction?.cancel(true);
    updateMapZoomUI(zoom);
}

function updateMapZoomUI(zoom, options = {}) {

    mapZoomUI =
        Math.max(
            window.MapScene?.getMinZoom() ?? MAP_ZOOM_MIN,
            Math.min(
                zoom,
                MAP_ZOOM_MAX
            )
        );

    if (options.preview) {
        if (window.MapScene?.isPortrait?.()) return;
        const board = document.getElementById('mapBoard');
        const translation = options.translateX || options.translateY
            ? `translate(${options.translateX || 0}px,${options.translateY || 0}px) ` : '';
        const transform = !translation && Math.abs(mapZoomUI - 1) < 1e-6
            ? 'none' : `${translation}scale(${mapZoomUI})`;
        if (board && board.style.transform !== transform) board.style.transform = transform;
        if (board) window.MapDetailLevel.setZoom(board, mapZoomUI, { preview: true });
        return;
    }
    applyMapZoomUI();
    window.localMatchSession?.cameraChanged();

}

function resetMapZoomUI() {
    mapZoomInteraction?.cancel();
    updateMapZoomUI(MAP_INITIAL_ZOOM);
}

function settleMapZoomUI() {
    mapZoomInteraction?.cancel(true);
}

function animateMapZoomResetUI(square, focus) {
    return mapZoomInteraction?.zoomToCenter(MAP_INITIAL_ZOOM, square, focus);
}


// =========================
// マップへズームを反映
// =========================

function applyMapZoomUI() {
    if (window.MapScene?.isPortrait?.()) return;

    const mapBoard =
        document.getElementById(
            "mapBoard"
        );


    if (!mapBoard) {
        return;
    }


    // =========================
    // マップ全体をズーム
    // =========================

    const transform = Math.abs(mapZoomUI - 1) < 1e-6
        ? 'none'
        : `scale(${mapZoomUI})`;
    if (mapBoard.style.transform !== transform) mapBoard.style.transform = transform;


    if (mapBoard.style.transformOrigin !== 'center center') mapBoard.style.transformOrigin = 'center center';

    window.MapScene?.setZoom(mapZoomUI);


    // 強調表示と、縮小時・画面外の描画をまとめて更新する。
    window.MapDetailLevel.setZoom(mapBoard, mapZoomUI);

}


// =========================
// PC：マウスホイールズーム
// =========================

function setupMapMouseWheelZoomUI() {

    // =========================
    // マップへイベントを登録
    // =========================

    function attachMapWheelZoom() {

        const mapArea =
            document.querySelector(
                ".game-screen .map-area"
            );


        if (!mapArea) {
            return false;
        }


        // =========================
        // マップボードが存在するか確認
        // =========================

        const mapBoard =
            document.getElementById(
                "mapBoard"
            );


        if (!mapBoard) {
            return false;
        }


        // =========================
        // 二重登録防止
        // =========================

        if (mapZoomInteraction?.board !== mapBoard) {
            mapZoomInteraction?.cancel();
            mapZoomInteraction = MapZoomInteraction.attach(mapArea, mapBoard, getMapZoomUI, updateMapZoomUI);
        }

        return true;

    }


    // =========================
    // 現在マップが存在するか確認
    // =========================

    if (
        attachMapWheelZoom()
    ) {

        return true;

    }


    // =========================
    // マップの生成を監視
    // =========================

    const observer =
        new MutationObserver(
            function () {

                if (
                    attachMapWheelZoom()
                ) {

                    observer.disconnect();

                }

            }
        );


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    return true;

}


// =========================
// 外部から使用できるようにする
// =========================

window.getMapZoomUI =
    getMapZoomUI;

window.setMapZoomUI =
    setMapZoomUI;

window.resetMapZoomUI = resetMapZoomUI;
window.settleMapZoomUI = settleMapZoomUI;
window.animateMapZoomResetUI = animateMapZoomResetUI;

window.applyMapZoomUI =
    applyMapZoomUI;


// =========================
// PC：マウスホイールズーム開始
// =========================

setupMapMouseWheelZoomUI();

// =========================
// マス詳細パネル
// =========================

let squareDetailPanel = null;


// =========================
// マス詳細パネルを作成
// =========================

function createSquareDetailPanel() {

    if (squareDetailPanel) {
        return squareDetailPanel;
    }

    const template =
        document.getElementById("squareDetailPanelTemplate");

    if (!template || !template.content.firstElementChild) {
        console.error("マス詳細パネルのテンプレートが見つかりません。");
        squareDetailPanel = null;
        return null;
    }

    squareDetailPanel =
        template.content.firstElementChild.cloneNode(true);

    squareDetailPanel.id = "squareDetailPanel";
    squareDetailPanel.style.display = "none";

    document.body.appendChild(
        squareDetailPanel
    );

    return squareDetailPanel;
}


// =========================
// マス詳細パネル取得
// =========================

function getSquareDetailPanel() {

    if (
        squareDetailPanel &&
        document.body.contains(
            squareDetailPanel
        )
    ) {
        return squareDetailPanel;
    }

    return createSquareDetailPanel();
}


function hideSquareDetail() {

    const panel =
        getSquareDetailPanel();

    if (!panel) {
        return;
    }

    // マス詳細の緑色の強調を解除
    document
        .querySelectorAll(".map-node.square-detail-highlight")
        .forEach(function (node) {
            node.classList.remove("square-detail-highlight");
        });

    // マス詳細パネルを閉じる
    panel.style.display = "none";
}


// =========================
// 金額表示
// =========================

function getSquareDetailPrice(
    price,
    applyMarket = true
) {

    if (
        typeof price !==
        "number"
    ) {
        return "";
    }

    return (
        ` ${formatG(applyMarket ? marketPrice(price) : price)}G`
    );
}


// =========================
// ショップ詳細
// =========================

function buildShopSquareDetail(
    square
) {

    const shopBox =
        SHOP_BOXES[
            square.typeId
        ];

    if (!shopBox) {

        return {
            title: "ショップ",
            content:
                "<div>購入できる商品はありません。</div>"
        };

    }

    const items =
        (shopBox.itemContents || [])
            .map(
                function (itemId) {

                    const item =
                        ITEM_CONTENTS[
                            itemId
                        ];

                    if (!item) {
                        return "";
                    }

                    return `
                        <div class="square-detail-item">
                            <strong>
                                ${item.name}
                            </strong>
                            <span>
                                ${getSquareDetailPrice(item.price)}
                            </span>
                        </div>
                    `;

                }
            )
            .filter(
                function (html) {
                    return html !== "";
                }
            )
            .join("");

    return {

        title:
            shopBox.name || "ショップ",

        content:
            items ||
            "<div>購入できる商品はありません。</div>"

    };
}


// =========================
// 魔法店詳細
// =========================

function buildMagicShopSquareDetail(
    square
) {

    const shopBox =
        SHOP_BOXES[
            square.typeId
        ];

    if (!shopBox) {

        return {
            title: "魔法店",
            content:
                "<div>購入できるものはありません。</div>"
        };

    }

    const powerItems =
        (shopBox.powerContents || [])
            .map(
                function (powerId) {

                    const power =
                        POWER_CONTENTS[
                            powerId
                        ];

                    if (!power) {
                        return "";
                    }

                    return `
                        <div class="square-detail-item">
                            <strong>
                                ${power.effect}
                            </strong>
                            <span>
                                ${getSquareDetailPrice(power.price, false)}
                            </span>
                        </div>
                    `;

                }
            )
            .filter(
                function (html) {
                    return html !== "";
                }
            )
            .join("");

    const magicItems =
        (shopBox.magicContents || [])
            .map(
                function (magicId) {

                    const magic =
                        MAGIC_CONTENTS[
                            magicId
                        ];

                    if (!magic) {
                        return "";
                    }

                    return `
                        <div class="square-detail-item">
                            <strong>
                                ${magic.name}
                            </strong>
                            <span>
                                ${getSquareDetailPrice(magic.price)}
                            </span>
                        </div>
                    `;

                }
            )
            .filter(
                function (html) {
                    return html !== "";
                }
            )
            .join("");

    return {

        title:
            shopBox.name || "魔法店",

        content: `

            <div class="square-detail-section-title">
    <img
        src="images/ui/icons/interface/mana.webp"
        alt="魔力"
        class="square-detail-section-icon"
    >
    魔力
</div>

            ${
                powerItems 
            }

            <div class="square-detail-section-title">
    <img
        src="images/ui/icons/interface/magic.webp"
        alt="魔法"
        class="square-detail-section-icon"
    >
    魔法
</div>

            ${
                magicItems 
            }

        `

    };
}


// =========================
// 資産マス詳細
// =========================

function buildAssetSquareDetail(
    square
) {

    const assetIds = [];

    (
        square.typeIds || []
    ).forEach(
        function (typeId) {

            const assetBox =
                ASSET_BOXES[
                    typeId
                ];

            if (!assetBox) {
                return;
            }

            (
                assetBox.contents || []
            ).forEach(
                function (assetId) {

                    assetIds.push(
                        assetId
                    );

                }
            );

        }
    );

    const assetTypeNames =
        (
            square.typeIds || []
        )
            .map(
                function (typeId) {

                    const assetBox =
                        ASSET_BOXES[
                            typeId
                        ];

                    return assetBox
                        ? assetBox.name
                        : null;

                }
            )
            .filter(
                function (name) {
                    return name;
                }
            );

   const assetItems =
    assetIds
        .flatMap(assetId => {
            const asset = ASSET_CONTENTS[assetId];
            return asset ? [{ ...asset, price: marketPrice(asset.price) }] : [];
        })
        .sort(compareAssetPurchaseOrder)
        .map(
            function (asset) {
                // =========================
                // 所有者アイコン
                // =========================

                let ownerIcon = "";

                if (
                    asset.owner !== null &&
                    asset.owner !== undefined
                ) {

                    ownerIcon = `
                        <div
                            class="square-detail-owner-icon"
                            style="
                                background-image:
                                    url('${getPlayerCharacterIcon(asset.owner)}');
                            "
                            aria-label="プレイヤー${asset.owner + 1}"
                        ></div>
                    `;

                }


                // =========================
                // 資産1行
                // =========================

               return `
    <div class="square-detail-item">

        <strong>
            ${asset.name}
        </strong>

        ${ownerIcon}

        <span>
            ${getSquareDetailPrice(asset.price, false)}
        </span>

    </div>
`;

            }
        )
        .join("");

    return {

        title:
            assetTypeNames.join(" / ") ||
            "資産",

        content:
            assetItems ||
            "<div>購入できる資産はありません。</div>"

    };
}

// =========================
// バイトマス詳細
// =========================
function buildJobSquareDetail(
    square
) {

    const jobData =
        getJobData(
            square.jobId
        );

    if (!jobData) {

        return {

            title:
                "バイトマス",

            content:
                "<div>バイト情報がありません。</div>"

        };

    }

    const currentWage =
        getCurrentJobWage(
            jobData.unitPrice
        );

    return {

        title:
            "バイトマス",

        content: `

            <div class="square-detail-item">

                <strong>
                    ${jobData.name}
                </strong>

                <span>
                    時給 ${formatG(currentWage)}G
                </span>

            </div>

        `

    };

}

// =========================
// ボスマス詳細
// =========================

function buildBossSquareDetail() {
    return {
        title:
            "ボスマス",
        content:`
            <div class="square-detail-description">
                ボスとの戦闘が行えます。
                <br>
                ◆ 報酬内容
                <br>
                ・到着ボーナス
                <br>
                ・ダメージボーナス
                <br>
                ・撃破ボーナス
            </div>  `
    };
}

// =========================
// 通常マス詳細
// =========================

function buildFixedSquareDetail(
    square
) {

    // =========================
    // マスのタイトル
    // =========================

    const fixedNames = {

        start:
            "スタートマス",

        money:
            "お金マス",

        monster:
            "モンスターマス",

        job:
            "バイトマス",

        treasure:
            "宝箱マス",

        shop:
            "ショップ",

        magic_shop:
            "魔法店",

        asset:
            "資産マス",

        worst:
            "最悪マス"

    };


    // =========================
    // マスの説明文
    // =========================
    // ★ここを自由にカスタマイズできます
    // =========================

    const fixedDescriptions = {

        start:
            "ここからゲームが始まります。<br>止まってもイベントはありません。",

        money:
            "ゴールドをランダムで獲得できます。",

        monster:
            "モンスターとの戦闘が発生します。<br>モンスターの種類はランダムです。<br>倒したあとは魔力またはゴールドの獲得が可能です。",

        job:
            "次の1ターンスキップすることでゴールドを獲得できます。",

        treasure:
            "宝箱からランダムでアイテムなどを獲得できます。",

        shop:
            "アイテムを購入できます。",

        magic_shop:
            "魔法や魔力を購入できます。",

        asset:
            "資産を購入できます。",

        worst:
            "最悪な出来事に遭遇します。"

    };


    // =========================
    // タイトル取得
    // =========================

    const title =
        fixedNames[
            square.type
        ] ||
        "マス";


    // =========================
    // 説明文取得
    // =========================

    const description =
        fixedDescriptions[
            square.type
        ] ||
        "";


    // =========================
    // 詳細データ
    // =========================

    return {

        title:
            title,

        content:
            `<div class="square-detail-description">
                ${description}
            </div>`

    };

}


// =========================
// マス詳細データ作成
// =========================

function buildSquareDetailData(
    square
) {

    if (!square) {
        return null;
    }


    // =========================
    // ボスマスか確認
    // =========================

    if (
        square.id ===
        currentBossSquareId
    ) {

        return buildBossSquareDetail();

    }


    switch (
        square.type
    ) {

        case "shop":

            return buildShopSquareDetail(
                square
            );

        case "magic_shop":

            return buildMagicShopSquareDetail(
                square
            );

        case "asset":

            return buildAssetSquareDetail(
                square
            );

        case "job":

         return buildJobSquareDetail(
        square
          );


        default:

            return buildFixedSquareDetail(
                square
            );

    }
}


// =========================
// マス詳細パネル表示
// =========================

function showSquareDetail(
    square
) {

    if (!square) {
        return;
    }

    const panel =
        getSquareDetailPanel();

    if (!panel) {
        return;
    }

    const title =
        panel.querySelector(
            ".square-detail-title"
        );

    const content =
        panel.querySelector(
            ".square-detail-content"
        );

    const closeButton =
        panel.querySelector(
            ".square-detail-close-button"
        );

    if (
        !title ||
        !content ||
        !closeButton
    ) {
        return;
    }

    const detailData =
        buildSquareDetailData(
            square
        );

    if (!detailData) {
        return;
    }

    title.textContent =
        detailData.title;

    window.setSafeRichContent(content, detailData.content);

    closeButton.onclick =
        function () {

            hideSquareDetail();

        };

    panel.style.display = "flex";
}


// =========================
// 外部公開
// =========================

window.showSquareDetail =
    showSquareDetail;

window.hideSquareDetail =
    hideSquareDetail;
