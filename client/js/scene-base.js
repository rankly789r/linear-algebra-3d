/**
 * 场景渲染基类 — 每个场景的渲染逻辑继承此类。
 *
 * 子类需要实现:
 *   buildScene(data)   — 根据后端返回的 data 构建 3D 场景
 *
 * 基类负责:
 *   - 参数面板的生成与绑定（通过 PanelManager）
 *   - 预设按钮的处理
 *   - 验证面板的更新
 *   - 解信息展示
 *   - 矩阵数据展示
 */

import * as THREE from 'three';
import { computeScene } from './api.js';
import { updateMatrixDisplay } from './matrix-display.js';

/** 获取 panelManager 单例的便捷方法 */
function _pm() {
    return window.panelManager;
}

export class SceneRenderer {
    /**
     * @param {Object} meta - 场景元信息
     * @param {THREE.Scene} threeScene
     * @param {THREE.Camera} camera
     * @param {THREE.WebGLRenderer} renderer
     */
    constructor(meta, threeScene, camera, renderer) {
        this.meta = meta;
        this.threeScene = threeScene;
        this.camera = camera;
        this.renderer = renderer;
        this.params = {};
        this.sceneObjects = new THREE.Group();
        this.threeScene.add(this.sceneObjects);
        this._debounceTimer = null;
        this._isInitialLoad = true;
        this._cachedLectureKey = null;
        this._cachedLectureHTML = null;

        // 初始化默认参数
        if (meta.params) {
            for (const [key, def] of Object.entries(meta.params)) {
                this.params[key] = def.default;
            }
        }
    }

    /**
     * 构建 UI 面板（由 main.js switchScene 调用）
     * 面板 DOM 由 PanelManager 管理，此处只填充内容
     */
    buildUI() {
        this._updateSceneInfo();
        this._buildPresets();
        this._buildParams();
        this._showPanel('camera');
        this._showPanel('solution');
        this._showPanel('lecture');
        this._showPanel('verify');
        this._showPanel('matrix');
    }

    /** 初次计算并渲染 */
    async initialRender() {
        this._isInitialLoad = true;
        await this._computeAndRender(this.params, true);
        this._isInitialLoad = false;
    }

    /** 销毁本场景（清理 3D 对象和面板内容） */
    destroy() {
        // 清理 3D 对象
        while (this.sceneObjects.children.length > 0) {
            const child = this.sceneObjects.children[0];
            this._disposeRecursive(child);
            this.sceneObjects.remove(child);
        }
        // 清空动态面板内容
        const pm = _pm();
        if (pm) {
            ['solution', 'lecture', 'verify', 'matrix', 'presets', 'params'].forEach(id => {
                const p = pm.getPanel(id);
                if (p) p.body.innerHTML = '';
            });
        }
    }

    // ─── 面板辅助方法 ────────────────────────────────────

    /** 获取面板 */
    _panel(id) {
        const pm = _pm();
        return pm ? pm.getPanel(id) : null;
    }

    /** 显示面板 */
    _showPanel(id) {
        const p = this._panel(id);
        if (p) p.show();
    }

    /** 隐藏面板 */
    _hidePanel(id) {
        const p = this._panel(id);
        if (p) p.hide();
    }

    // ─── 场景信息 ────────────────────────────────────────

    _updateSceneInfo() {
        document.getElementById('scene-title').textContent = this.meta.title;
        document.getElementById('scene-desc').textContent = this.meta.description || '';
    }

    // ─── 预设按钮 ────────────────────────────────────────

    _buildPresets() {
        const panel = this._panel('presets');
        if (!panel) return;
        const body = panel.body;
        body.innerHTML = '';

        if (!this.meta.presets || this.meta.presets.length === 0) {
            panel.hide();
            return;
        }
        panel.show();

        this.meta.presets.forEach((preset) => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            if (preset.type) btn.classList.add(`type-${preset.type}`);
            btn.textContent = preset.label;

            btn.addEventListener('click', async () => {
                Object.assign(this.params, preset.params);
                this._syncParamsToUI();
                body.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await this._computeAndRender(this.params, true);
            });

            body.appendChild(btn);
        });
    }

    // ─── 参数滑块 ────────────────────────────────────────

    _buildParams() {
        const panel = this._panel('params');
        if (!panel) return;
        const body = panel.body;
        body.innerHTML = '';

        if (!this.meta.params || Object.keys(this.meta.params).length === 0) {
            panel.hide();
            return;
        }
        panel.show();

        for (const [key, def] of Object.entries(this.meta.params)) {
            const row = document.createElement('div');
            row.className = 'param-row';

            // 标签 + 当前值
            const labelDiv = document.createElement('div');
            labelDiv.className = 'param-label';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = def.label;
            labelDiv.appendChild(nameSpan);

            const valSpan = document.createElement('span');
            valSpan.className = 'param-value';
            valSpan.style.cssText = 'font-size:0.72rem;color:var(--accent);font-weight:600;';
            valSpan.dataset.paramValue = key;
            labelDiv.appendChild(valSpan);

            row.appendChild(labelDiv);

            // 输入行
            const inputRow = document.createElement('div');
            inputRow.className = 'param-input-row';

            if (def.type === 'choice') {
                const select = document.createElement('select');
                select.style.cssText = 'flex:1;padding:4px 6px;font-size:0.78rem;background:var(--bg-primary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);';
                def.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (opt === String(def.default)) option.selected = true;
                    select.appendChild(option);
                });
                select.addEventListener('change', async () => {
                    this.params[key] = select.value;
                    // 矩阵计算器：运算类型变化时，可能需要显示/隐藏 B 矩阵相关参数
                    if (key === 'operation') {
                        this._buildParams();
                    }
                    await this._computeAndRender(this.params, true);
                });
                inputRow.appendChild(select);
            } else if (def.type === 'matrix') {
                // 矩阵网格输入：动态尺寸
                // 若 key 形如 "matrix_A"，则从 this.params 中读取 A_rows / A_cols
                let rows = def.rows || 2;
                let cols = def.cols || 2;
                const suffixMatch = key.match(/^matrix_(.+)$/);
                if (suffixMatch) {
                    const suffix = suffixMatch[1];  // 例如 "A" 或 "B"
                    if (this.params[suffix + '_rows'] !== undefined) rows = this.params[suffix + '_rows'];
                    if (this.params[suffix + '_cols'] !== undefined) cols = this.params[suffix + '_cols'];
                }
                const grid = document.createElement('div');
                grid.className = 'matrix-input-grid';

                // 初始化或加载默认值
                if (!this.params[key] || !Array.isArray(this.params[key])) {
                    this.params[key] = def.default || Array.from({ length: rows }, () => Array(cols).fill(0));
                }

                for (let r = 0; r < rows; r++) {
                    const rowEl = document.createElement('div');
                    rowEl.className = 'matrix-input-row';
                    for (let c = 0; c < cols; c++) {
                        const input = document.createElement('input');
                        input.type = 'number';
                        input.step = 'any';
                        input.value = this.params[key][r]?.[c] ?? 0;
                        input.dataset.matrixKey = key;
                        input.dataset.row = r;
                        input.dataset.col = c;
                        input.addEventListener('input', () => {
                            if (!this.params[key]) this.params[key] = [];
                            if (!this.params[key][r]) this.params[key][r] = [];
                            this.params[key][r][c] = parseFloat(input.value) || 0;
                            this._throttleCompute();
                        });
                        input.addEventListener('change', async () => {
                            this._clearThrottle();
                            await this._computeAndRender(this.params, true);
                        });
                        rowEl.appendChild(input);
                    }
                    grid.appendChild(rowEl);
                }
                inputRow.appendChild(grid);
            } else {
                // 滑块
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = def.min;
                slider.max = def.max;
                slider.step = def.step || 0.1;
                slider.value = this.params[key] ?? def.default;
                slider.dataset.paramKey = key;

                slider.addEventListener('input', () => {
                    const val = def.type === 'int'
                        ? parseInt(slider.value)
                        : parseFloat(parseFloat(slider.value).toFixed(4));
                    this.params[key] = val;
                    // 即时更新数字输入框
                    const numInput = inputRow.querySelector('input[type="number"]');
                    if (numInput) numInput.value = val;
                    // 即时更新标签上的值
                    this._updateParamValueLabel(key, val);
                    // 节流调用后端
                    this._throttleCompute();
                });

                slider.addEventListener('change', async () => {
                    this._clearThrottle();
                    // 尺寸类参数变化时，重建参数面板以更新矩阵网格
                    if (key.endsWith('_rows') || key.endsWith('_cols')) {
                        this._buildParams();
                    }
                    await this._computeAndRender(this.params, true);
                });

                inputRow.appendChild(slider);

                // 数值输入
                const numInput = document.createElement('input');
                numInput.type = 'number';
                numInput.min = def.min;
                numInput.max = def.max;
                numInput.step = def.step || 0.1;
                numInput.value = this.params[key] ?? def.default;
                numInput.addEventListener('input', () => {
                    const val = def.type === 'int'
                        ? parseInt(numInput.value)
                        : parseFloat(parseFloat(numInput.value).toFixed(4));
                    if (!isNaN(val)) {
                        this.params[key] = val;
                        const s = inputRow.querySelector('input[type="range"]');
                        if (s) s.value = val;
                        this._updateParamValueLabel(key, val);
                        this._throttleCompute();
                    }
                });
                numInput.addEventListener('change', async () => {
                    this._clearThrottle();
                    await this._computeAndRender(this.params, true);
                });
                inputRow.appendChild(numInput);
            }

            row.appendChild(inputRow);
            body.appendChild(row);
        }

        // 初始化参数值标签
        this._syncParamValueLabels();
    }

    _updateParamValueLabel(key, val) {
        const span = document.querySelector(`[data-param-value="${key}"]`);
        if (span) {
            if (typeof val === 'number') {
                span.textContent = Number.isInteger(val) ? val : val.toFixed(2);
            } else {
                span.textContent = '';
            }
        }
    }

    _syncParamValueLabels() {
        for (const [key, val] of Object.entries(this.params)) {
            this._updateParamValueLabel(key, val);
        }
    }

    /** 将 this.params 的值同步回 UI 控件 */
    _syncParamsToUI() {
        const panel = this._panel('params');
        if (!panel || !this.meta.params) return;
        const body = panel.body;

        for (const [key, def] of Object.entries(this.meta.params)) {
            if (def.type === 'matrix') {
                // 同步矩阵网格输入
                const inputs = body.querySelectorAll(`input[data-matrix-key="${key}"]`);
                inputs.forEach(input => {
                    const r = parseInt(input.dataset.row);
                    const c = parseInt(input.dataset.col);
                    input.value = this.params[key]?.[r]?.[c] ?? 0;
                });
                continue;
            }
            const slider = body.querySelector(`input[type="range"][data-param-key="${key}"]`);
            if (slider) {
                slider.value = this.params[key];
                const row = slider.closest('.param-input-row');
                const numInput = row?.querySelector('input[type="number"]');
                if (numInput) numInput.value = this.params[key];
            }
        }
        this._syncParamValueLabels();
    }

    // ─── 矩阵显示 ────────────────────────────────────────

    _updateMatrixDisplay(data) {
        updateMatrixDisplay(this._panel('matrix'), data.scene_data?.matrices);
    }

    // ─── 解信息 ──────────────────────────────────────────

    _updateSolutionInfo(data) {
        const panel = this._panel('solution');
        if (!panel) return;

        if (data.solution_info) {
            panel.show();
            const info = data.solution_info;
            let html = '';
            if (info.type) {
                const typeLabels = { unique: '唯一解', none: '无解', infinite: '无穷多解' };
                html += `<span class="solution-type ${info.type}">${typeLabels[info.type] || info.type}</span>`;
            }
            if (info.description) {
                html += `<p style="margin-top:6px;">${info.description}</p>`;
            }
            if (info.details) {
                for (const [k, v] of Object.entries(info.details)) {
                    html += `<p style="margin-top:4px;font-size:0.76rem;color:var(--text-secondary);"><strong>${k}:</strong> ${v}</p>`;
                }
            }
            panel.body.innerHTML = html;
        } else {
            panel.body.innerHTML = '';
        }
    }

    // ─── 讲解面板（支持 KaTeX 数学公式） ────────────────

    _updateLecturePanel(data) {
        const panel = this._panel('lecture');
        if (!panel) return;

        if (!data.lecture || !data.lecture.sections || data.lecture.sections.length === 0) {
            panel.body.innerHTML = '';
            panel.hide();
            this._cachedLectureHTML = null;
            this._cachedLectureKey = null;
            return;
        }
        panel.show();

        // 缓存检查：相同数据跳过渲染
        const lectureKey = JSON.stringify(data.lecture);
        if (this._cachedLectureKey === lectureKey && this._cachedLectureHTML) {
            panel.body.innerHTML = this._cachedLectureHTML;
            return;
        }
        this._cachedLectureKey = lectureKey;

        let html = '';
        data.lecture.sections.forEach(sec => {
            html += `<div class="lecture-section">
                <div class="lecture-title">${sec.title}</div>
                <div class="lecture-content">`;
            // 解析 $...$ 和 $$...$$ 数学公式
            const parts = sec.content.split(/(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g);
            parts.forEach(part => {
                if (part.startsWith('$$')) {
                    const math = part.slice(2, -2).trim();
                    try {
                        if (typeof katex !== 'undefined') {
                            html += katex.renderToString(math, { displayMode: true, throwOnError: false });
                        } else {
                            html += `<pre style="color:var(--text-secondary);">${math}</pre>`;
                        }
                    } catch (e) {
                        html += `<pre style="color:var(--red);">${math}</pre>`;
                    }
                } else if (part.startsWith('$')) {
                    const math = part.slice(1, -1).trim();
                    try {
                        if (typeof katex !== 'undefined') {
                            html += katex.renderToString(math, { displayMode: false, throwOnError: false });
                        } else {
                            html += `<code>${math}</code>`;
                        }
                    } catch (e) {
                        html += `<code style="color:var(--red);">${math}</code>`;
                    }
                } else {
                    // 普通文本：支持 **粗体** 和换行
                    html += part
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br>');
                }
            });
            html += `</div></div>`;
        });
        this._cachedLectureHTML = html;
        panel.body.innerHTML = html;
    }

    // ─── 验证面板 ────────────────────────────────────────

    _updateVerifyPanel(data) {
        const panel = this._panel('verify');
        if (!panel) return;

        if (!data.verification || !data.verification.checks || data.verification.checks.length === 0) {
            panel.body.innerHTML = '';
            panel.setTitle('🔍 数学验证');
            return;
        }

        panel.show();
        const passed = data.verification.passed;
        panel.setTitle(`🔍 数学验证 ${passed ? '✅' : '❌'}`);

        let html = '';
        data.verification.checks.forEach(check => {
            html += `<div class="verify-check ${check.passed ? 'passed' : 'failed'}">
                <span class="icon">${check.passed ? '✓' : '✗'}</span> ${check.label}</div>`;
        });
        panel.body.innerHTML = html;
    }

    // ─── 节流计算 ────────────────────────────────────────

    _throttleCompute() {
        const now = performance.now();
        if (this._lastCompute && now - this._lastCompute < 80) {
            if (this._trailingTimer) clearTimeout(this._trailingTimer);
            this._trailingTimer = setTimeout(() => {
                this._lastCompute = performance.now();
                this._computeAndRender(this.params, false);
            }, 80);
            return;
        }
        if (this._trailingTimer) clearTimeout(this._trailingTimer);
        this._lastCompute = now;
        this._computeAndRender(this.params, false);
    }

    _clearThrottle() {
        if (this._trailingTimer) {
            clearTimeout(this._trailingTimer);
            this._trailingTimer = null;
        }
    }

    // ─── 核心：计算并渲染（双缓冲） ──────────────────────

    async _computeAndRender(params, showLoading = false) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const errorOverlay = document.getElementById('error-overlay');
        errorOverlay.style.display = 'none';

        // 延迟门：请求超过 200ms 才显示遮罩，避免短暂闪烁
        let loadingTimer = null;
        if (showLoading) {
            loadingTimer = setTimeout(() => {
                loadingOverlay.style.display = 'flex';
            }, 200);
        }

        try {
            const result = await computeScene(this.meta.id, params);

            // 请求返回，取消延迟遮罩
            if (loadingTimer) clearTimeout(loadingTimer);
            loadingOverlay.style.display = 'none';

            if (!result.success) {
                errorOverlay.style.display = 'block';
                document.getElementById('error-message').textContent = result.error || '未知错误';
                return;
            }

            // 双缓冲：构建新场景到新的 Group，然后一次性替换
            const oldGroup = this.sceneObjects;
            const newGroup = new THREE.Group();
            this.threeScene.add(newGroup);
            this.sceneObjects = newGroup;

            this.buildScene(result.data);

            // 移除旧场景
            this.threeScene.remove(oldGroup);
            this._disposeRecursive(oldGroup);

            // 更新面板
            this._updateSolutionInfo(result.data);
            this._updateLecturePanel(result.data);
            this._updateMatrixDisplay(result.data);
            this._updateVerifyPanel(result.data);

        } catch (err) {
            errorOverlay.style.display = 'block';
            document.getElementById('error-message').textContent = `渲染失败: ${err.message}`;
            console.error(err);
            loadingOverlay.style.display = 'none';
        }
    }

    // 子类重写此方法
    buildScene(data) {
        console.warn('buildScene() 未实现，数据:', data);
    }

    _disposeRecursive(obj) {
        if (!obj) return;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
        if (obj.children) {
            for (let i = obj.children.length - 1; i >= 0; i--) {
                this._disposeRecursive(obj.children[i]);
            }
        }
    }
}
