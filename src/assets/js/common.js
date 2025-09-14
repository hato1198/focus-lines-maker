import { css as lightFont } from '/assets/fonts/ZenKakuGothicNew-Light.ttf?subsets';
import { css as regularFont } from '/assets/fonts/ZenKakuGothicNew-Regular.ttf?subsets';
import { css as mediumFont } from '/assets/fonts/ZenKakuGothicNew-Medium.ttf?subsets';

// @font-faceルールを定義する
const fontFaceCss = `
  @font-face {
    font-family: 'Zen Kaku Gothic New';
    src: url('${lightFont.url}');
    font-weight: 300;
    font-style: normal;
  }
  @font-face {
    font-family: 'Zen Kaku Gothic New';
    src: url('${regularFont.url}');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'Zen Kaku Gothic New';
    src: url('${mediumFont.url}');
    font-weight: 500;
    font-style: normal;
  }
`;
const styleEl = document.createElement('style');
styleEl.textContent = fontFaceCss;
document.head.appendChild(styleEl);

// フッターの年を更新
document.addEventListener('DOMContentLoaded', () => {
    (function() {
        // 新しい Date オブジェクトから今年の年を取得
        const currentYear = new Date().getFullYear();
        // span 要素にテキストとして挿入
        document.getElementById('year').textContent = currentYear;
    })();
});