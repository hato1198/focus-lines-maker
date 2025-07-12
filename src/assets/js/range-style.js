document.addEventListener('DOMContentLoaded', () => {
  const activeColor   = '#0056b3';
  const inactiveColor = '#dee2e6';

  // 背景更新ロジックを関数化
  function updateBackground(el) {
    const min   = Number(el.min);
    const max   = Number(el.max);
    const value = Number(el.value);
    const ratio = (max > min)
      ? (value - min) / (max - min) * 100
      : 0;
    el.style.background = `linear-gradient(90deg, ${activeColor} ${ratio}%, ${inactiveColor} ${ratio}%)`;
  }

  // すべての range を一括取得し、イベント登録＋初期描画
  const ranges = document.querySelectorAll('input[type="range"]');
  ranges.forEach(rangeEl => {
    rangeEl.addEventListener('input', () => updateBackground(rangeEl));
    updateBackground(rangeEl);  // 初期状態の反映
  });
});
