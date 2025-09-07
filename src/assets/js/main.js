document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const imageLoader = document.getElementById('image-loader');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const uploadPrompt = document.getElementById('upload-prompt');
    const canvasContainer = document.getElementById('canvas-container');
    const workspace = document.querySelector('.workspace');
    const downloadBtn = document.getElementById('download-btn');

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

    let originalFileName = '';
    let originalImage = null;
    let focusState = {
        isDragging: false, isResizing: false,
        dragStartX: 0, dragStartY: 0,
        resizeDirection: null
    };

    // --- イベントリスナーの設定 ---
    imageLoader.addEventListener('change', handleImageUpload);
    downloadBtn.addEventListener('click', downloadImage);

    [focusShapeSelect, lineTypeSelect, lineColorInput, lineCountInput, lineThicknessInput, randomnessInput].forEach(el => {
        el.addEventListener('input', () => requestAnimationFrame(drawScene));
    });

    // マウス操作とタッチ操作の両方に対応
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
    
    // ウィンドウリサイズへの対応
    let resizeTimer;
    // 最後に記録したウィンドウ幅を保持
    let lastWindowWidth = window.innerWidth; 
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const currentWindowWidth = window.innerWidth;
            // 幅が変わった場合のみ再描画を実行する
            if (currentWindowWidth !== lastWindowWidth) {
                lastWindowWidth = currentWindowWidth; // 新しい幅を記録
                if (originalImage) {
                    setupCanvas();
                    drawScene();
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

    // ファイルを読み込み、画像として処理する共通関数
    function loadImageFile(file) {
        // 画像ファイル以外は処理しない
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください。');
            return;
        }

        originalFileName = file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
            originalImage = new Image();
            originalImage.onload = () => {
                setupCanvas();
                requestAnimationFrame(drawScene);
                uploadPrompt.classList.add('hidden');
                canvasContainer.classList.remove('hidden');
                downloadBtn.disabled = false;
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function setupCanvas() {
        const workspace = document.querySelector('.workspace');
        const maxW = workspace.clientWidth - 20;
        const maxH = workspace.clientHeight - 20;
        const scale = Math.min(maxW / originalImage.width, maxH / originalImage.height, 2);
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const displayWidth = canvas.width * scale;
        const displayHeight = canvas.height * scale;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        focusArea.style.top = '15%';
        focusArea.style.left = '15%';
        focusArea.style.width = '70%';
        focusArea.style.height = '70%';
        focusArea.classList.toggle('circle', focusShapeSelect.value === 'circle');
    }

    function drawScene() {
        if (!originalImage) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

        // --- 集中線の描画 ---
        drawFocusLines();
    }

    function drawFocusLines() {
        const w = canvas.width;
        const h = canvas.height;
        const focusRect = {
            x: focusArea.offsetLeft / canvasContainer.clientWidth * w,
            y: focusArea.offsetTop / canvasContainer.clientHeight * h,
            width: focusArea.offsetWidth / canvasContainer.clientWidth * w,
            height: focusArea.offsetHeight / canvasContainer.clientHeight * h,
        };
        const focusCenter = {
            x: focusRect.x + focusRect.width / 2,
            y: focusRect.y + focusRect.height / 2,
        };
        
        const lineCount = parseInt(lineCountInput.value);
        let lineThickness = parseFloat(lineThicknessInput.value);
        
        const referenceSize = (1920 + 1080) / 2;
        const imageAverageSize = (w + h) / 2;
        const sizeCorrectionFactor = imageAverageSize / referenceSize;
        lineThickness *= sizeCorrectionFactor;

        const isCircle = focusShapeSelect.value === 'circle';
        const lineType = lineTypeSelect.value;
        const randomAmount = parseFloat(randomnessInput.value);

        ctx.fillStyle = lineColorInput.value;
        ctx.strokeStyle = lineColorInput.value;
        ctx.lineWidth = Math.max(1, lineThickness * 0.08);

        const drawLoop = (callback) => {
            if (lineType === 'manga') {
                let i = 0;
                while (i < lineCount) {
                    // 1. 先に間隔を空ける
                    const baseGapSize = 5;
                    const gapVariation = (Math.random() - 0.5) * baseGapSize * 2 * randomAmount;
                    const gapSize = Math.round(Math.max(1, baseGapSize + gapVariation));
                    i += gapSize;

                    // 間隔を空けた結果、描写範囲を超えたらループを抜ける
                    if (i >= lineCount) break;

                    // 2. 次に線のグループを描写
                    const baseGroupSize = 5;
                    const groupVariation = (Math.random() - 0.5) * baseGroupSize * 2 * randomAmount;
                    const groupSize = Math.round(Math.max(1, baseGroupSize + groupVariation));
                    
                    for (let j = 0; j < groupSize && i < lineCount; j++, i++) {
                        callback(i, lineCount, randomAmount);
                    }
                }
            } else {
                for (let i = 0; i < lineCount; i++) {
                    callback(i, lineCount, randomAmount);
                }
            }
        };

        drawLoop((i, count, random) => {
            let angleOffset = 0;
            if (random > 0) {
                angleOffset = (Math.random() - 0.5) * random;
            }
            const angle = ((i + angleOffset) / count) * 2 * Math.PI;

            const buffer = Math.max(w, h);
            const outerBounds = {x: -buffer, y: -buffer, width: w + buffer*2, height: h + buffer*2};
            const outerPoint = getIntersectionWithRect(focusCenter, angle, outerBounds);
            if (!outerPoint) return;

            let innerPoint = isCircle ? getIntersectionWithEllipse(focusCenter, angle, focusRect) : getIntersectionWithRect(focusCenter, angle, focusRect);
            if (!innerPoint) return;
            
            if (random > 0) {
                const dx = innerPoint.x - focusCenter.x;
                const dy = innerPoint.y - focusCenter.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0) {
                    const randomScale = 1 + (random / 2) * (Math.random() * 2 - 1);
                    const newDist = dist * randomScale;
                    innerPoint.x = focusCenter.x + (dx / dist) * newDist;
                    innerPoint.y = focusCenter.y + (dy / dist) * newDist;
                }
            }
            
            if (lineType === 'halo') {
                ctx.beginPath();
                ctx.moveTo(innerPoint.x, innerPoint.y);
                ctx.lineTo(outerPoint.x, outerPoint.y);
                ctx.stroke();
            } else {
                const distance = Math.sqrt(Math.pow(outerPoint.x - innerPoint.x, 2) + Math.pow(outerPoint.y - innerPoint.y, 2));
                let baseWidth = (distance / imageAverageSize) * lineThickness;

                if (random > 0) {
                    baseWidth *= 1 + random * (Math.random() * 2 - 1);
                    baseWidth = Math.max(0, baseWidth);
                }

                const perpAngle = angle + Math.PI / 2;
                const dx = Math.cos(perpAngle) * baseWidth / 2;
                const dy = Math.sin(perpAngle) * baseWidth / 2;
                
                ctx.beginPath();
                ctx.moveTo(innerPoint.x, innerPoint.y);
                ctx.lineTo(outerPoint.x + dx, outerPoint.y + dy);
                ctx.lineTo(outerPoint.x - dx, outerPoint.y - dy);
                ctx.closePath();
                ctx.fill();
            }
        });
    }
    
    // ヘルパー関数群
    function getIntersectionWithRect(origin, angle, rect) {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const dist = Math.max(rect.width, rect.height) * 2;
        const ray = { x1: origin.x, y1: origin.y, x2: origin.x + cos * dist, y2: origin.y + sin * dist };
        const lines = [ { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y }, { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height }, { x1: rect.x, y1: rect.y + rect.height, x2: rect.x + rect.width, y2: rect.y + rect.height }, { x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height }];
        let closestIntersect = null, minDistSq = Infinity;
        for (const line of lines) {
            const den = (ray.x1 - ray.x2) * (line.y1 - line.y2) - (ray.y1 - ray.y2) * (line.x1 - line.x2);
            if (den === 0) continue;
            const t = ((ray.x1 - line.x1) * (line.y1 - line.y2) - (ray.y1 - line.y1) * (line.x1 - line.x2)) / den;
            const u = -((ray.x1 - ray.x2) * (ray.y1 - line.y1) - (ray.y1 - ray.y2) * (ray.x1 - line.x1)) / den;
            if (t > 0 && t < 1 && u > 0 && u < 1) {
                const pt = { x: ray.x1 + t * (ray.x2 - ray.x1), y: ray.y1 + t * (ray.y2 - ray.y1) };
                const dSq = Math.pow(pt.x - origin.x, 2) + Math.pow(pt.y - origin.y, 2);
                if (dSq < minDistSq) { minDistSq = dSq; closestIntersect = pt; }
            }
        }
        return closestIntersect;
    }
    function getIntersectionWithEllipse(origin, angle, rect) {
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const rx = rect.width / 2, ry = rect.height / 2;
        if(rx <= 0 || ry <= 0) return null;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const A = (cos * cos) / (rx * rx) + (sin * sin) / (ry * ry);
        const B = 2 * ((origin.x - center.x) * cos / (rx * rx) + (origin.y - center.y) * sin / (ry * ry));
        const C = ((origin.x - center.x)**2) / (rx * rx) + ((origin.y - center.y)**2) / (ry * ry) - 1;
        const discriminant = B * B - 4 * A * C;
        if (discriminant < 0) return null;
        const t = (-B + Math.sqrt(discriminant)) / (2 * A);
        return { x: origin.x + t * cos, y: origin.y + t * sin };
    }

    function downloadImage() {
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = '保存中……';
        downloadBtn.disabled = true;

        // canvas.toBlob() を使用して非同期で処理
        setTimeout(() => {
            canvas.toBlob(blob => {
                if (!blob) {
                    console.error('CanvasからBlobの生成に失敗しました。');
                    alert('画像の保存に失敗しました。');
                    downloadBtn.textContent = originalText;
                    downloadBtn.disabled = false;
                    return;
                }

                try {
                    const baseName = originalFileName.includes('.')
                        ? originalFileName.substring(0, originalFileName.lastIndexOf('.'))
                        : originalFileName;
                    
                    const newFileName = `${baseName}-focus.png`;
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
            }, 'image/png');
        }, 0);
    }

    // --- フォーカスエリアの操作ロジック ---
    function getClientCoords(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function handleInteractionStart(e) {
        if (e.type === 'touchstart') e.preventDefault();
        e.stopPropagation();
        const coords = getClientCoords(e);
        focusState.dragStartX = coords.x;
        focusState.dragStartY = coords.y;
        focusState.startLeft = focusArea.offsetLeft;
        focusState.startTop = focusArea.offsetTop;
        focusState.startWidth = focusArea.offsetWidth;
        focusState.startHeight = focusArea.offsetHeight;
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
        if (e.type === 'touchmove') e.preventDefault();
        const coords = getClientCoords(e);
        const dx = coords.x - focusState.dragStartX;
        const dy = coords.y - focusState.dragStartY;
        const parentWidth = canvasContainer.clientWidth;
        const parentHeight = canvasContainer.clientHeight;

        if (focusState.isDragging) {
            let newLeft = focusState.startLeft + dx;
            let newTop = focusState.startTop + dy;
            newLeft = Math.max(0, Math.min(newLeft, parentWidth - focusArea.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, parentHeight - focusArea.offsetHeight));
            focusArea.style.left = `${newLeft}px`;
            focusArea.style.top = `${newTop}px`;
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

            if (e.shiftKey && focusState.startHeight > 0) {
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

            if(newWidth > 20) {
                focusArea.style.left = `${newLeft}px`;
                focusArea.style.width = `${newWidth}px`;
            }
            if(newHeight > 20) {
                focusArea.style.top = `${newTop}px`;
                focusArea.style.height = `${newHeight}px`;
            }
        }
        checkCentering();
    }

    function handleInteractionEnd() {
        if (focusState.isDragging || focusState.isResizing) {
            requestAnimationFrame(drawScene);
        }
        focusState.isDragging = false;
        focusState.isResizing = false;
        document.body.style.cursor = ''; 
        focusArea.style.cursor = '';
        focusArea.classList.remove('centered');
        guideH.style.display = 'none';
        guideV.style.display = 'none';
    }

    function checkCentering() {
        const parentRect = canvasContainer.getBoundingClientRect();
        const areaRect = focusArea.getBoundingClientRect();
        const areaCenter = { x: focusArea.offsetLeft + areaRect.width / 2, y: focusArea.offsetTop + areaRect.height / 2 };
        const parentCenter = { x: parentRect.width / 2, y: parentRect.height / 2 };
        const snapThreshold = 5;
        const isHorizontallyCentered = Math.abs(parentCenter.x - areaCenter.x) < snapThreshold;
        const isVerticallyCentered = Math.abs(parentCenter.y - areaCenter.y) < snapThreshold;

        if (focusState.isResizing) {
            guideV.style.display = 'none';
            guideH.style.display = 'none';
        } else {
            guideV.style.display = isHorizontallyCentered ? 'block' : 'none';
            guideH.style.display = isVerticallyCentered ? 'block' : 'none';
        }

        if (isHorizontallyCentered) {
            guideV.style.left = `${parentCenter.x}px`;
            if (focusState.isDragging) focusArea.style.left = `${parentCenter.x - areaRect.width / 2}px`;
        }
        if (isVerticallyCentered) {
            guideH.style.top = `${parentCenter.y}px`;
            if (focusState.isDragging) focusArea.style.top = `${parentCenter.y - areaRect.height / 2}px`;
        }
    }
    
    focusShapeSelect.addEventListener('change', (e) => {
       focusArea.classList.toggle('circle', e.target.value === 'circle');
    });
});