/**
 * 矩阵显示工具模块 — 统一的矩阵 KaTeX 渲染与自适应排版
 *
 * 使用方式：
 *   import { updateMatrixDisplay } from './matrix-display.js';
 *   updateMatrixDisplay(panel, matrices);
 *
 * 排版由 CSS 的 `.panel-body[data-orientation="horizontal"]` /
 * `.panel-body[data-orientation="vertical"]` 控制。
 * DockZone.addPanel() 在面板移动时自动更新 data-orientation。
 *
 * 所有 9 个场景的矩阵显示都通过此模块，保证行为一致。
 */

/**
 * 将矩阵数据渲染到面板 body 中
 * @param {import('./panel-system.js').DockPanel} panel - 矩阵面板实例
 * @param {Array<{label: string, symbol: string, data: number[][]}>} [matrices] - 矩阵数据
 */
export function updateMatrixDisplay(panel, matrices) {
    if (!panel) return;

    if (!matrices || matrices.length === 0) {
        panel.hide();
        return;
    }
    panel.show();

    // 设置 data-orientation，CSS 据此自动选择横排/竖排
    // 面板被拖到其他区域时，DockZone.addPanel() 会更新此值
    const isHorizontal = panel.zone && panel.zone.orientation === 'horizontal';
    panel.body.dataset.orientation = isHorizontal ? 'horizontal' : 'vertical';

    let html = '';
    matrices.forEach(m => {
        const rows = m.data.map(row =>
            row.map(v => {
                if (Number.isInteger(v)) return v.toString();
                return parseFloat(v.toFixed(4)).toString();
            }).join(' & ')
        ).join(' \\\\ ');

        const latex = `${m.symbol} = \\begin{pmatrix} ${rows} \\end{pmatrix}`;

        try {
            if (typeof katex === 'undefined') {
                html += `<div class="matrix-item">
                    <div class="matrix-label">${m.label}</div>
                    <div class="matrix-katex" style="color:var(--text-secondary);">KaTeX 加载中...</div>
                </div>`;
                return;
            }
            const rendered = katex.renderToString(latex, { throwOnError: false, displayMode: true });
            html += `<div class="matrix-item">
                <div class="matrix-label">${m.label}</div>
                <div class="matrix-katex">${rendered}</div>
            </div>`;
        } catch (e) {
            html += `<div class="matrix-item">
                <div class="matrix-label">${m.label}</div>
                <div class="matrix-katex" style="color:var(--red);">渲染错误</div>
            </div>`;
        }
    });

    panel.body.innerHTML = html;
}
