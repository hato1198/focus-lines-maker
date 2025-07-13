document.addEventListener('DOMContentLoaded', () => {
  const activeColor   = '#0056b3';
  const inactiveColor = '#dee2e6';
  // CSSで定義されているスライダーのつまみの幅 / 2 (px)
  // （スライダーの端につまみの端がくる可能性とスライダーの端につまみの中心がくる可能性を考慮し、
  // 　間をとる。つまみが大きいので少しズレても隠れる。）
  const thumbWidth = 9;

  // 背景更新ロジックを関数化
  function updateBackground(el) {
    // スライダー要素の実際のピクセル幅を取得
    const trackWidth = el.offsetWidth;
    
    const min = Number(el.min);
    const max = Number(el.max);
    const value = Number(el.value);

    // 現在の値が全体のどの位置にあるかを0から1の範囲で計算
    const valueRatio = (max > min) ? (value - min) / (max - min) : 0;

    // つまみの中心がトラックのどこに来るべきかを計算
    // 1. つまみが移動できる範囲は (trackWidth - thumbWidth)
    // 2. 現在のつまみの左端の位置は valueRatio * (trackWidth - thumbWidth)
    // 3. つまみの中心は、左端の位置 + 半径 (thumbWidth / 2)
    const thumbCenterPosition = valueRatio * (trackWidth - thumbWidth) + (thumbWidth / 2);
    
    // つまみの中心位置を、トラック全体の幅に対する割合(%)に変換
    const fillPercentage = (thumbCenterPosition / trackWidth) * 100;

    el.style.background = `linear-gradient(90deg, ${activeColor} ${fillPercentage}%, ${inactiveColor} ${fillPercentage}%)`;
  }

  // すべての range を一括取得し、イベント登録＋初期描画
  const ranges = document.querySelectorAll('input[type="range"]');
  ranges.forEach(rangeEl => {
    rangeEl.addEventListener('input', () => updateBackground(rangeEl));
    updateBackground(rangeEl); // 初期状態の反映
  });

  // ウィンドウリサイズ時にも背景を再計算する
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ranges.forEach(rangeEl => {
        updateBackground(rangeEl);
      });
    }, 100);
  });
});