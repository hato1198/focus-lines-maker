document.addEventListener('DOMContentLoaded', () => {
    // Colorisの初期化と設定
    Coloris({
        alpha: true,
        swatches: [
            '#000000',
            '#ffffff',
            '#dc143c',
            '#ffe224',
            '#2dc73f',
            '#48cae4'
        ]
    });
    // ヘルプアイコンのクリック無効化
    document.querySelectorAll('.tooltip-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });

    // --- Web Worker の初期化 ---
    const worker = new Worker(new URL('./focus-lines-worker.js', import.meta.url), { type: 'module' });

    // --- DOM要素の取得 ---
    const selectImageBtn = document.getElementById('select-image-btn');
    const imageLoader = document.getElementById('image-loader');
    const canvas = document.getElementById('canvas');
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
    const uploadPrompt = document.getElementById('upload-prompt');
    const canvasContainer = document.getElementById('canvas-container');
    const workspace = document.querySelector('.workspace');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const changeImageBtn = document.getElementById('change-image-btn');

    // --- 設定項目の取得 ---
    const focusArea = document.getElementById('focus-area');
    const guideH = document.getElementById('guide-line-h');
    const guideV = document.getElementById('guide-line-v');
    const focusShapeSelect = document.getElementById('focus-shape');
    const lineTypeSelect = document.getElementById('line-type');
    const lineColorInput = document.getElementById('line-color');
    const lineCountInput = document.getElementById('line-count');
    const lineThicknessInput = document.getElementById('line-thickness');
    const randomnessInput = document.getElementById('randomness');

    // --- 初期値と状態管理 ---
    const defaultSettings = {
        focusShape: 'rectangle',
        lineType: 'normal',
        lineColor: '#000000',
        lineCount: '210',
        lineThickness: '60',
        randomness: '0.5'
    };
    let originalFileName = '';
    let originalFileType = 'image/png';
    let originalImage = null;
    let focusState = {
        isDragging: false, isResizing: false,
        dragStartX: 0, dragStartY: 0,
        resizeDirection: null,
        parentWidth: 0, parentHeight: 0,
        areaWidth: 0, areaHeight: 0
    };
    let moveRafId = null;

    // --- Worker 描画スロットリング ---
    let workerBusy = false;
    let drawPending = false;
    worker.addEventListener('message', (e) => {
        if (e.data.type === 'drawDone') {
            workerBusy = false;
            if (drawPending) {
                drawPending = false;
                postDrawMessage();
            }
        }
    });

    // --- イベントリスナーの設定 ---
    if (selectImageBtn) {
        selectImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            imageLoader.click();
        });
    }
    imageLoader.addEventListener('change', handleImageUpload);
    downloadBtn.addEventListener('click', downloadImage);
    resetBtn.addEventListener('click', resetSettings);
    changeImageBtn.addEventListener('click', () => imageLoader.click());

    [focusShapeSelect, lineTypeSelect, lineCountInput, lineThicknessInput, randomnessInput].forEach(el => {
        el.addEventListener('input', () => postDrawMessage());
    });

    lineColorInput.addEventListener('input', () => postDrawMessage());

    focusArea.addEventListener('mousedown', handleInteractionStart);
    document.addEventListener('mousemove', handleInteractionMove);
    document.addEventListener('mouseup', handleInteractionEnd);
    focusArea.addEventListener('touchstart', handleInteractionStart, { passive: false });
    document.addEventListener('touchmove', handleInteractionMove, { passive: false });
    document.addEventListener('touchend', handleInteractionEnd);

    workspace.addEventListener('dragenter', handleDragEnter, false);
    workspace.addEventListener('dragover', handleDragOver, false);
    workspace.addEventListener('dragleave', handleDragLeave, false);
    workspace.addEventListener('drop', handleDrop, false);

    let resizeTimer;
    let lastWindowWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const currentWindowWidth = window.innerWidth;
            if (currentWindowWidth !== lastWindowWidth) {
                lastWindowWidth = currentWindowWidth;
                if (originalImage) {
                    setupCanvas();
                    postDrawMessage();
                }
            }
        }, 250);
    });

    // --- 主要な関数 ---
    function handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        workspace.classList.add('drag-over');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        workspace.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        workspace.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            loadImageFile(files[0]);
        }
    }

    function handleImageUpload(e) {
        const files = e.target.files;
        if (files.length > 0) {
            loadImageFile(files[0]);
        }
    }

    async function loadImageFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください。');
            return;
        }

        originalFileName = file.name;
        originalFileType = file.type;

        try {
            const imageBitmap = await createImageBitmap(file);
            originalImage = imageBitmap;

            // Worker に画像を転送 (コピーを作成して転送)
            const bitmapForWorker = await createImageBitmap(file);
            worker.postMessage({ type: 'setImage', image: bitmapForWorker }, [bitmapForWorker]);

            uploadPrompt.classList.add('hidden');
            canvasContainer.classList.remove('hidden');
            downloadBtn.disabled = false;
            resetBtn.disabled = false;
            changeImageBtn.disabled = false;

            setupCanvas();
            postDrawMessage();
        } catch (e) {
            console.error('Image loading failed:', e);
            alert('画像の読み込みに失敗しました。');
        }
    }

    function setupCanvas() {
        const workspace = document.querySelector('.workspace');
        const maxW = workspace.clientWidth - 20;
        const maxH = workspace.clientHeight - 20;
        const scale = Math.min(maxW / originalImage.width, maxH / originalImage.height, 2);
        const canvasWidth = originalImage.width;
        const canvasHeight = originalImage.height;
        const displayWidth = canvasWidth * scale;
        const displayHeight = canvasHeight * scale;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        worker.postMessage({ type: 'resize', width: canvasWidth, height: canvasHeight });
        focusArea.style.top = '15%';
        focusArea.style.left = '15%';
        focusArea.style.width = '70%';
        focusArea.style.height = '70%';
        focusArea.classList.toggle('circle', focusShapeSelect.value === 'circle');
    }

    function postDrawMessage() {
        if (!originalImage) return;

        if (workerBusy) {
            drawPending = true;
            return;
        }

        workerBusy = true;

        const w = originalImage.width;
        const h = originalImage.height;
        const cw = canvasContainer.clientWidth;
        const ch = canvasContainer.clientHeight;
        const focusRect = {
            x: focusArea.offsetLeft / cw * w,
            y: focusArea.offsetTop / ch * h,
            width: focusArea.offsetWidth / cw * w,
            height: focusArea.offsetHeight / ch * h,
        };

        worker.postMessage({
            type: 'draw',
            params: {
                focusRect,
                lineCount: parseInt(lineCountInput.value),
                lineThickness: parseFloat(lineThicknessInput.value),
                lineColor: lineColorInput.value,
                lineType: lineTypeSelect.value,
                randomAmount: parseFloat(randomnessInput.value),
                isCircle: focusShapeSelect.value === 'circle',
            }
        });
    }

    function resetSettings() {
        focusShapeSelect.value = defaultSettings.focusShape;
        lineTypeSelect.value = defaultSettings.lineType;
        lineColorInput.value = defaultSettings.lineColor;
        lineColorInput.dispatchEvent(new Event('input', { bubbles: true }));
        lineCountInput.value = defaultSettings.lineCount;
        lineThicknessInput.value = defaultSettings.lineThickness;
        randomnessInput.value = defaultSettings.randomness;

        document.querySelectorAll('input[type="range"]').forEach(el => {
            el.dispatchEvent(new Event('input'));
        });

        focusArea.style.top = '15%';
        focusArea.style.left = '15%';
        focusArea.style.width = '70%';
        focusArea.style.height = '70%';
        focusArea.classList.toggle('circle', defaultSettings.focusShape === 'circle');

        postDrawMessage();
    }

    function downloadImage() {
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = '保存中……';
        downloadBtn.disabled = true;

        const isJpeg = originalFileType === 'image/jpeg';
        const fileExtension = isJpeg ? 'jpg' : 'png';
        const mimeType = isJpeg ? 'image/jpeg' : 'image/png';

        const handleDownload = (e) => {
            if (e.data.type !== 'downloadReady') return;
            worker.removeEventListener('message', handleDownload);

            const blob = e.data.blob;
            if (!blob) {
                console.error('WorkerからBlobの生成に失敗しました。');
                alert('画像の保存に失敗しました。');
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
                return;
            }

            try {
                const baseName = originalFileName.includes('.')
                    ? originalFileName.substring(0, originalFileName.lastIndexOf('.'))
                    : originalFileName;

                const newFileName = `${baseName}-focus.${fileExtension}`;
                const link = document.createElement('a');
                link.download = newFileName;
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            } catch (e) {
                console.error('画像のダウンロードに失敗しました。', e);
                alert('画像の保存に失敗しました。');
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        };

        worker.addEventListener('message', handleDownload);
        worker.postMessage({ type: 'download', mimeType });
    }

    // --- フォーカスエリアの操作ロジック ---
    function getClientCoords(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function handleInteractionStart(e) {
        if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
        e.stopPropagation();
        const coords = getClientCoords(e);
        focusState.dragStartX = coords.x;
        focusState.dragStartY = coords.y;
        focusState.startLeft = focusArea.offsetLeft;
        focusState.startTop = focusArea.offsetTop;
        focusState.startWidth = focusArea.offsetWidth;
        focusState.startHeight = focusArea.offsetHeight;
        focusState.parentWidth = canvasContainer.clientWidth;
        focusState.parentHeight = canvasContainer.clientHeight;
        focusState.areaWidth = focusState.startWidth;
        focusState.areaHeight = focusState.startHeight;
        if (e.target.classList.contains('resize-handle')) {
            focusState.isResizing = true;
            focusState.resizeDirection = e.target.dataset.direction;
            focusState.aspectRatio = focusState.startWidth / focusState.startHeight;
        } else {
            focusState.isDragging = true;
        }
    }

    function handleInteractionMove(e) {
        if (!focusState.isDragging && !focusState.isResizing) return;
        if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
        const coords = getClientCoords(e);
        focusState.lastMoveCoords = coords;
        focusState.lastMoveShiftKey = e.shiftKey;

        if (moveRafId) return;
        moveRafId = requestAnimationFrame(() => {
            moveRafId = null;
            applyInteractionMove();
        });
    }

    function applyInteractionMove() {
        const coords = focusState.lastMoveCoords;
        if (!coords) return;
        const dx = coords.x - focusState.dragStartX;
        const dy = coords.y - focusState.dragStartY;
        const parentWidth = focusState.parentWidth;
        const parentHeight = focusState.parentHeight;

        if (focusState.isDragging) {
            let newLeft = focusState.startLeft + dx;
            let newTop = focusState.startTop + dy;
            newLeft = Math.max(0, Math.min(newLeft, parentWidth - focusState.areaWidth));
            newTop = Math.max(0, Math.min(newTop, parentHeight - focusState.areaHeight));
            focusArea.style.left = `${newLeft}px`;
            focusArea.style.top = `${newTop}px`;
            checkCentering(newLeft, newTop, focusState.areaWidth, focusState.areaHeight, parentWidth, parentHeight);
        } else if (focusState.isResizing) {
            let cursorStyle = 'default';
            switch (focusState.resizeDirection) {
                case 'nw':
                case 'se':
                    cursorStyle = 'nwse-resize';
                    break;
                case 'ne':
                case 'sw':
                    cursorStyle = 'nesw-resize';
                    break;
            }
            document.body.style.cursor = cursorStyle;
            focusArea.style.cursor = cursorStyle;

            let newLeft = focusState.startLeft, newTop = focusState.startTop;
            let newWidth = focusState.startWidth, newHeight = focusState.startHeight;

            if (focusState.resizeDirection.includes('e')) newWidth = focusState.startWidth + dx;
            if (focusState.resizeDirection.includes('w')) {
                newWidth = focusState.startWidth - dx;
                newLeft = focusState.startLeft + dx;
            }
            if (focusState.resizeDirection.includes('s')) newHeight = focusState.startHeight + dy;
            if (focusState.resizeDirection.includes('n')) {
                newHeight = focusState.startHeight - dy;
                newTop = focusState.startTop + dy;
            }

            if (focusState.lastMoveShiftKey && focusState.startHeight > 0) {
                const originalAspectRatio = focusState.startWidth / focusState.startHeight;
                const newAspectRatio = Math.abs(newWidth) / Math.abs(newHeight);
                if (newAspectRatio > originalAspectRatio) {
                    newHeight = newWidth / originalAspectRatio;
                } else {
                    newWidth = newHeight * originalAspectRatio;
                }
                if (focusState.resizeDirection.includes('n')) {
                    newTop = focusState.startTop + focusState.startHeight - newHeight;
                }
                if (focusState.resizeDirection.includes('w')) {
                    newLeft = focusState.startLeft + focusState.startWidth - newWidth;
                }
            }

            if (newLeft < 0) {
                newWidth += newLeft;
                newLeft = 0;
            }
            if (newTop < 0) {
                newHeight += newTop;
                newTop = 0;
            }
            if (newLeft + newWidth > parentWidth) {
                newWidth = parentWidth - newLeft;
            }
            if (newTop + newHeight > parentHeight) {
                newHeight = parentHeight - newTop;
            }

            if (newWidth > 20) {
                focusArea.style.left = `${newLeft}px`;
                focusArea.style.width = `${newWidth}px`;
                focusState.areaWidth = newWidth;
            }
            if (newHeight > 20) {
                focusArea.style.top = `${newTop}px`;
                focusArea.style.height = `${newHeight}px`;
                focusState.areaHeight = newHeight;
            }
            checkCentering(newLeft, newTop, focusState.areaWidth, focusState.areaHeight, parentWidth, parentHeight);
        }
    }

    function handleInteractionEnd() {
        if (focusState.isDragging || focusState.isResizing) {
            if (moveRafId) {
                cancelAnimationFrame(moveRafId);
                moveRafId = null;
                applyInteractionMove();
            }
            postDrawMessage();
        }
        focusState.isDragging = false;
        focusState.isResizing = false;
        focusState.lastMoveCoords = null;
        document.body.style.cursor = '';
        focusArea.style.cursor = '';
        focusArea.classList.remove('centered');
        guideH.style.display = 'none';
        guideV.style.display = 'none';
    }

    function checkCentering(areaLeft, areaTop, areaWidth, areaHeight, parentWidth, parentHeight) {
        const areaCenterX = areaLeft + areaWidth / 2;
        const areaCenterY = areaTop + areaHeight / 2;
        const parentCenterX = parentWidth / 2;
        const parentCenterY = parentHeight / 2;
        const snapThreshold = 5;
        const isHorizontallyCentered = Math.abs(parentCenterX - areaCenterX) < snapThreshold;
        const isVerticallyCentered = Math.abs(parentCenterY - areaCenterY) < snapThreshold;

        if (focusState.isResizing) {
            guideV.style.display = 'none';
            guideH.style.display = 'none';
        } else {
            guideV.style.display = isHorizontallyCentered ? 'block' : 'none';
            guideH.style.display = isVerticallyCentered ? 'block' : 'none';
        }

        if (isHorizontallyCentered) {
            guideV.style.left = `${parentCenterX}px`;
            if (focusState.isDragging) focusArea.style.left = `${parentCenterX - areaWidth / 2}px`;
        }
        if (isVerticallyCentered) {
            guideH.style.top = `${parentCenterY}px`;
            if (focusState.isDragging) focusArea.style.top = `${parentCenterY - areaHeight / 2}px`;
        }
    }

    focusShapeSelect.addEventListener('change', (e) => {
        focusArea.classList.toggle('circle', e.target.value === 'circle');
    });
});