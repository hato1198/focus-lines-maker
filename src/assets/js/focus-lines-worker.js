/** @type {OffscreenCanvas} */
let canvas = null;
/** @type {OffscreenCanvasRenderingContext2D} */
let ctx = null;
/** @type {ImageBitmap} */
let currentImage = null;

self.addEventListener('message', async (e) => {
    const { type } = e.data;

    switch (type) {
        case 'init':
            canvas = e.data.canvas;
            ctx = canvas.getContext('2d');
            break;

        case 'setImage':
            currentImage = e.data.image;
            break;

        case 'resize':
            canvas.width = e.data.width;
            canvas.height = e.data.height;
            break;

        case 'draw':
            draw(e.data.params);
            break;

        case 'download': {
            const blob = await canvas.convertToBlob({
                type: e.data.mimeType
            });
            self.postMessage({ type: 'downloadReady', blob });
            break;
        }
    }
});

function draw(params) {
    if (!currentImage || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(currentImage, 0, 0, w, h);
    drawFocusLines(params, w, h);
}

function drawFocusLines(params, w, h) {
    const { focusRect, lineCount, lineColor, lineType, randomAmount, isCircle } = params;
    let { lineThickness } = params;

    const focusCenter = {
        x: focusRect.x + focusRect.width / 2,
        y: focusRect.y + focusRect.height / 2,
    };

    const referenceSize = (1920 + 1080) / 2;
    const imageAverageSize = (w + h) / 2;
    const sizeCorrectionFactor = imageAverageSize / referenceSize;
    lineThickness *= sizeCorrectionFactor;

    ctx.fillStyle = lineColor;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = Math.max(1, lineThickness * 0.08);

    const drawLoop = (callback) => {
        if (lineType === 'manga') {
            let i = 0;
            while (i < lineCount) {
                const baseGapSize = 5;
                const gapVariation = (Math.random() - 0.5) * baseGapSize * 2 * randomAmount;
                const gapSize = Math.round(Math.max(1, baseGapSize + gapVariation));
                i += gapSize;

                if (i >= lineCount) break;

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
        const outerBounds = { x: -buffer, y: -buffer, width: w + buffer * 2, height: h + buffer * 2 };
        const outerPoint = getIntersectionWithRect(focusCenter, angle, outerBounds);
        if (!outerPoint) return;

        let innerPoint = isCircle ? getIntersectionWithEllipse(focusCenter, angle, focusRect) : getIntersectionWithRect(focusCenter, angle, focusRect);
        if (!innerPoint) return;

        if (random > 0) {
            const dx = innerPoint.x - focusCenter.x;
            const dy = innerPoint.y - focusCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
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

// --- ヘルパー関数群 ---
function getIntersectionWithRect(origin, angle, rect) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dist = Math.max(rect.width, rect.height) * 2;
    const ray = { x1: origin.x, y1: origin.y, x2: origin.x + cos * dist, y2: origin.y + sin * dist };
    const lines = [{ x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y }, { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height }, { x1: rect.x, y1: rect.y + rect.height, x2: rect.x + rect.width, y2: rect.y + rect.height }, { x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height }];
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
    if (rx <= 0 || ry <= 0) return null;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const A = (cos * cos) / (rx * rx) + (sin * sin) / (ry * ry);
    const B = 2 * ((origin.x - center.x) * cos / (rx * rx) + (origin.y - center.y) * sin / (ry * ry));
    const C = ((origin.x - center.x) ** 2) / (rx * rx) + ((origin.y - center.y) ** 2) / (ry * ry) - 1;
    const discriminant = B * B - 4 * A * C;
    if (discriminant < 0) return null;
    const t = (-B + Math.sqrt(discriminant)) / (2 * A);
    return { x: origin.x + t * cos, y: origin.y + t * sin };
}
