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
import { computeScene, askAI, generateNote } from './api.js';
import { updateMatrixDisplay } from './matrix-display.js';
import { saveChat, loadChat, clearChat } from './chat-store.js';

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
        this._isInitialLoad = true;
        this._cachedLectureKey = null;
        this._chatHistory = [];          // AI 聊天历史
        this._basicCollapsed = (() => {  // 基础讲解折叠状态（持久化）
            try { return localStorage.getItem('la_lecture_basic_collapsed') === '1'; }
            catch { return false; }
        })();
        this._aiCollapsed = (() => {     // AI 答疑折叠状态（持久化）
            try { return localStorage.getItem('la_lecture_ai_collapsed') === '1'; }
            catch { return false; }
        })();
        this.animSpeed = (() => {      // 全局动画播放速率
            try {
                const val = parseFloat(localStorage.getItem('la_anim_speed'));
                return (val >= 0.25 && val <= 3.0) ? val : 1.0;
            } catch { return 1.0; }
        })();
        this._subPanelOrder = (() => {  // 子面板排列顺序（持久化）
            try {
                const saved = localStorage.getItem('la_lecture_subpanel_order');
                return saved ? JSON.parse(saved) : ['ai', 'basic'];
            } catch { return ['ai', 'basic']; }
        })();

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
        // 从 IndexedDB 恢复聊天记录
        this._loadChatHistory();
    }

    /** 初次计算并渲染 */
    async initialRender() {
        this._isInitialLoad = true;
        await this._computeAndRender(this.params, true);
        this._isInitialLoad = false;
    }

    /** 销毁本场景（清理 3D 对象和面板内容） */
    destroy() {
        // 停止动画循环（防止访问已 dispose 的 geometry）
        this._animating = false;
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }
        // 清除节流定时器（防止对已销毁场景发起 _computeAndRender）
        if (this._trailingTimer) {
            clearTimeout(this._trailingTimer);
            this._trailingTimer = null;
        }
        // 清除动画启动定时器（防止延迟动画在销毁后启动）
        if (this._animTimeout) {
            clearTimeout(this._animTimeout);
            this._animTimeout = null;
        }
        if (this._animStartTimer) {
            clearTimeout(this._animStartTimer);
            this._animStartTimer = null;
        }
        // 清理 3D 对象
        while (this.sceneObjects.children.length > 0) {
            const child = this.sceneObjects.children[0];
            this._disposeRecursive(child);
            this.sceneObjects.remove(child);
        }
        // 保存聊天历史到 IndexedDB
        if (this._chatHistory.length > 0) {
            saveChat(this.meta.id, this._chatHistory);
        }
        this._chatHistory = [];
        // 清理子面板拖拽监听
        if (this._subPanelDragCleanup) {
            this._subPanelDragCleanup();
            this._subPanelDragCleanup = null;
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

    /** 显示面板（尊重用户显式隐藏的选择） */
    _showPanel(id) {
        const p = this._panel(id);
        if (p && !p._userHidden) p.show();
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

    /**
     * 扫描 meta.params，将 float/int 类型参数分类为矩阵组和"其他"。
     * 矩阵元素的 key 匹配前缀+两个数字后缀（如 a11, a23, mat33）。
     * 尺寸参数（_rows/_cols 结尾）归入"其他"。
     * @returns {{ groups: Array, otherKeys: string[] }}
     */
    _detectMatrixGroups() {
        if (!this.meta.params) return { groups: [], otherKeys: [] };

        const matrixElements = {};  // { prefix: [{key, def, row, col}, ...] } — 两位数后缀
        const vectorElements = {};  // { prefix: [{key, def, index}, ...] }   — 一位数后缀
        const otherKeys = [];

        for (const [key, def] of Object.entries(this.meta.params)) {
            if (def.type !== 'float' && def.type !== 'int') {
                otherKeys.push(key);
                continue;
            }
            if (key.endsWith('_rows') || key.endsWith('_cols')) {
                otherKeys.push(key);
                continue;
            }

            // 尝试匹配两位数后缀（矩阵元素）：a11, a23, b12 ...
            const m2 = key.match(/^([a-zA-Z]+[a-zA-Z0-9_]*?)(\d)(\d)$/);
            if (m2) {
                const prefix = m2[1];
                const row = parseInt(m2[2]);
                const col = parseInt(m2[3]);
                if (!matrixElements[prefix]) matrixElements[prefix] = [];
                matrixElements[prefix].push({ key, def, row, col });
                continue;
            }

            // 尝试匹配一位数后缀（向量元素）：b1, b2, x3 ...
            const m1 = key.match(/^([a-zA-Z]+[a-zA-Z0-9_]*?)(\d)$/);
            if (m1) {
                const prefix = m1[1];
                const index = parseInt(m1[2]);
                if (!vectorElements[prefix]) vectorElements[prefix] = [];
                vectorElements[prefix].push({ key, def, index });
                continue;
            }

            otherKeys.push(key);
        }

        const groups = [];

        // 处理两位数矩阵组
        for (const [prefix, elements] of Object.entries(matrixElements)) {
            if (elements.length < 2) {
                elements.forEach(e => otherKeys.push(e.key));
                continue;
            }
            const maxRow = Math.max(...elements.map(e => e.row));
            const maxCol = Math.max(...elements.map(e => e.col));
            elements.sort((a, b) => a.row - b.row || a.col - b.col);
            groups.push({
                prefix,
                label: `矩阵 ${prefix.toUpperCase()} (${maxRow}×${maxCol})`,
                elements,
                rows: maxRow,
                cols: maxCol,
            });
        }

        // 处理一位数向量组（列向量：N 个元素 = N×1）
        for (const [prefix, elements] of Object.entries(vectorElements)) {
            // 如果该前缀已存在两位数矩阵组，则一位数元素归入"其他"
            // （避免同一前缀拆成两组，例如既有 b11 又有 b1 时）
            if (matrixElements[prefix]) {
                elements.forEach(e => otherKeys.push(e.key));
                continue;
            }
            if (elements.length < 2) {
                elements.forEach(e => otherKeys.push(e.key));
                continue;
            }
            const maxIndex = Math.max(...elements.map(e => e.index));
            elements.sort((a, b) => a.index - b.index);
            // 转换为矩阵元素格式（列向量：row=index, col=1）
            const asMatrix = elements.map(e => ({
                key: e.key,
                def: e.def,
                row: e.index,
                col: 1,
            }));
            groups.push({
                prefix,
                label: `向量 ${prefix.toUpperCase()} (${maxIndex}×1)`,
                elements: asMatrix,
                rows: maxIndex,
                cols: 1,
            });
        }

        return { groups, otherKeys };
    }

    /** 读取当前场景的子面板折叠状态 */
    _loadGroupCollapsed(prefix) {
        try {
            const all = JSON.parse(localStorage.getItem('la_params_group_collapsed') || '{}');
            const scene = all[this.meta.id] || {};
            return !!scene[prefix];
        } catch { return false; }
    }

    /** 保存单组折叠状态 */
    _saveGroupCollapsed(prefix, collapsed) {
        try {
            const all = JSON.parse(localStorage.getItem('la_params_group_collapsed') || '{}');
            if (!all[this.meta.id]) all[this.meta.id] = {};
            all[this.meta.id][prefix] = collapsed;
            localStorage.setItem('la_params_group_collapsed', JSON.stringify(all));
        } catch {}
    }

    /** 读取当前场景某组的视图模式 */
    _loadViewMode(prefix) {
        try {
            const all = JSON.parse(localStorage.getItem('la_params_view_mode') || '{}');
            const scene = all[this.meta.id] || {};
            const v = scene[prefix];
            if (typeof v === 'string') return { mode: v };
            return v && v.mode ? v : { mode: 'all' };
        } catch { return { mode: 'all' }; }
    }

    /** 保存视图模式 */
    _saveViewMode(prefix, modeState) {
        try {
            const all = JSON.parse(localStorage.getItem('la_params_view_mode') || '{}');
            if (!all[this.meta.id]) all[this.meta.id] = {};
            all[this.meta.id][prefix] = modeState;
            localStorage.setItem('la_params_view_mode', JSON.stringify(all));
        } catch {}
    }

    /** 读取当前场景某组的自选勾选 */
    _loadPick(prefix) {
        try {
            const all = JSON.parse(localStorage.getItem('la_params_pick') || '{}');
            const scene = all[this.meta.id] || {};
            return scene[prefix] || [];
        } catch { return []; }
    }

    /** 保存自选勾选 */
    _savePick(prefix, picked) {
        try {
            const all = JSON.parse(localStorage.getItem('la_params_pick') || '{}');
            if (!all[this.meta.id]) all[this.meta.id] = {};
            all[this.meta.id][prefix] = picked;
            localStorage.setItem('la_params_pick', JSON.stringify(all));
        } catch {}
    }

    /**
     * 为单个参数创建滑块 + 数值输入 + 值标签，挂载到 container。
     * @returns {{ slider, numInput }} 供外部在 change 事件中联动
     */
    _renderSliderRow(container, key, def) {
        // 读取用户自定义参数范围
        let paramMin = def.min;
        let paramMax = def.max;
        try {
            const ranges = JSON.parse(localStorage.getItem('la_param_ranges') || '{}');
            const sceneRanges = ranges[this.meta.id];
            if (sceneRanges && sceneRanges[key]) {
                paramMin = sceneRanges[key].min ?? def.min;
                paramMax = sceneRanges[key].max ?? def.max;
            }
        } catch { /* ignore */ }

        const value = this.params[key] ?? def.default;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = paramMin;
        slider.max = paramMax;
        slider.step = def.step || 0.1;
        slider.value = value;
        slider.dataset.paramKey = key;
        slider.className = 'param-slider';

        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.min = paramMin;
        numInput.max = paramMax;
        numInput.step = def.step || 0.1;
        numInput.value = value;
        numInput.className = 'param-number';

        const valSpan = document.createElement('span');
        valSpan.className = 'param-value';
        valSpan.dataset.paramValue = key;

        // 双向联动
        slider.addEventListener('input', () => {
            const val = def.type === 'int'
                ? parseInt(slider.value)
                : parseFloat(parseFloat(slider.value).toFixed(4));
            this.params[key] = val;
            numInput.value = val;
            this._updateParamValueLabel(key, val);
            this._throttleCompute();
        });
        slider.addEventListener('change', async () => {
            this._clearThrottle();
            await this._computeAndRender(this.params, true);
        });
        numInput.addEventListener('input', () => {
            const val = def.type === 'int'
                ? parseInt(numInput.value)
                : parseFloat(parseFloat(numInput.value).toFixed(4));
            if (!isNaN(val)) {
                this.params[key] = val;
                slider.value = val;
                this._updateParamValueLabel(key, val);
                this._throttleCompute();
            }
        });
        numInput.addEventListener('change', async () => {
            this._clearThrottle();
            await this._computeAndRender(this.params, true);
        });

        container.appendChild(slider);
        container.appendChild(numInput);
        container.appendChild(valSpan);

        return { slider, numInput };
    }

    /** 渲染一个矩阵组的子面板 */
    _renderMatrixGroup(body, group) {
        const prefix = group.prefix;
        const collapsed = this._loadGroupCollapsed(prefix);
        const viewState = this._loadViewMode(prefix);
        const mode = viewState.mode || 'all';

        // ── 子面板容器 ──
        const subPanel = document.createElement('div');
        subPanel.className = 'param-sub-panel' + (collapsed ? ' collapsed' : '');
        subPanel.dataset.groupPrefix = prefix;

        // ── 标题栏 ──
        const header = document.createElement('div');
        header.className = 'param-sub-panel-header';

        const arrow = document.createElement('span');
        arrow.className = 'param-sub-panel-arrow';
        arrow.textContent = collapsed ? '▶' : '▼';

        const title = document.createElement('span');
        title.className = 'param-sub-panel-title';
        title.textContent = group.label;

        header.appendChild(title);

        // 视图模式下拉（在折叠按钮左侧）
        const viewSel = document.createElement('select');
        viewSel.className = 'param-view-select';
        ['all', 'row', 'col', 'pick'].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = { all: '全部', row: '按行', col: '按列', pick: '自选' }[m];
            if (m === mode) opt.selected = true;
            viewSel.appendChild(opt);
        });

        // 行/列号选择器（仅在按行/按列模式显示）
        const rcSel = document.createElement('select');
        rcSel.className = 'param-rc-select';
        rcSel.style.display = (mode === 'row' || mode === 'col') ? '' : 'none';
        const rcMax = mode === 'row' ? group.rows : group.cols;
        const rcVal = (mode === 'row' ? viewState.row : viewState.col) || 1;
        for (let i = 1; i <= rcMax; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = (mode === 'row' ? '行 ' : '列 ') + i;
            if (i === rcVal) opt.selected = true;
            rcSel.appendChild(opt);
        }

        header.appendChild(viewSel);
        header.appendChild(rcSel);
        header.appendChild(arrow);
        subPanel.appendChild(header);

        // 折叠/展开
        header.addEventListener('click', (e) => {
            if (e.target.tagName === 'SELECT') return;
            const nowC = !subPanel.classList.contains('collapsed');
            subPanel.classList.toggle('collapsed');
            arrow.textContent = nowC ? '▶' : '▼';
            this._saveGroupCollapsed(prefix, nowC);
        });

        // ── 内容区 ──
        const subBody = document.createElement('div');
        subBody.className = 'param-sub-panel-body';
        this._renderMatrixGroupBody(subBody, group, mode, rcVal);
        subPanel.appendChild(subBody);

        // 视图模式切换
        viewSel.addEventListener('change', () => {
            const newMode = viewSel.value;
            const newState = { mode: newMode };
            if (newMode === 'row') {
                newState.row = parseInt(rcSel.value) || 1;
            } else if (newMode === 'col') {
                newState.col = parseInt(rcSel.value) || 1;
            }
            rcSel.style.display = (newMode === 'row' || newMode === 'col') ? '' : 'none';
            this._saveViewMode(prefix, newState);
            // 重建行/列选择器选项
            if (newMode === 'row' || newMode === 'col') {
                const max = newMode === 'row' ? group.rows : group.cols;
                rcSel.innerHTML = '';
                for (let i = 1; i <= max; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = (newMode === 'row' ? '行 ' : '列 ') + i;
                    rcSel.appendChild(opt);
                }
            }
            this._renderMatrixGroupBody(subBody, group, newMode, newState.row || newState.col || 1);
        });

        rcSel.addEventListener('change', () => {
            const newMode = rcSel.parentElement.querySelector('.param-view-select').value;
            const newState = { mode: newMode };
            if (newMode === 'row') newState.row = parseInt(rcSel.value);
            else newState.col = parseInt(rcSel.value);
            this._saveViewMode(prefix, newState);
            this._renderMatrixGroupBody(subBody, group, newMode, newState.row || newState.col || 1);
        });

        body.appendChild(subPanel);
    }

    /** 按当前视图模式重绘矩阵组内容区 */
    _renderMatrixGroupBody(subBody, group, mode, rcVal) {
        subBody.innerHTML = '';

        if (mode === 'row') {
            // 按行：只显示指定行的元素
            const rowElements = group.elements.filter(e => e.row === rcVal);
            const grid = document.createElement('div');
            grid.className = 'param-matrix-grid';
            grid.style.gridTemplateColumns = `repeat(${group.cols}, 1fr)`;
            // 按 group.cols 遍历，空位放占位符
            for (let c = 1; c <= group.cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'param-grid-cell';
                const elem = rowElements.find(e => e.col === c);
                if (elem) {
                    const label = document.createElement('span');
                    label.className = 'param-cell-label';
                    label.textContent = elem.def.label;
                    cell.appendChild(label);
                    this._renderSliderRow(cell, elem.key, elem.def);
                }
                grid.appendChild(cell);
            }
            subBody.appendChild(grid);

        } else if (mode === 'col') {
            // 按列：只显示指定列的元素
            const colElements = group.elements.filter(e => e.col === rcVal);
            const grid = document.createElement('div');
            grid.className = 'param-matrix-grid';
            grid.style.gridTemplateColumns = '1fr';
            colElements.forEach(elem => {
                const cell = document.createElement('div');
                cell.className = 'param-grid-cell';
                const label = document.createElement('span');
                label.className = 'param-cell-label';
                label.textContent = elem.def.label;
                cell.appendChild(label);
                this._renderSliderRow(cell, elem.key, elem.def);
                grid.appendChild(cell);
            });
            subBody.appendChild(grid);

        } else if (mode === 'pick') {
            // 自选：上部勾选网格 + 下部仅显示勾选的滑块
            const picked = new Set(this._loadPick(group.prefix));
            if (picked.size === 0) {
                // 首次进入自选模式，默认全选
                group.elements.forEach(e => picked.add(e.key));
            }

            const pickGrid = document.createElement('div');
            pickGrid.className = 'param-pick-grid';
            pickGrid.style.gridTemplateColumns = `repeat(${group.cols}, 1fr)`;

            const onPickChange = () => {
                // 重建滑块区
                const sliderArea = subBody.querySelector('.param-pick-sliders');
                if (!sliderArea) return;
                sliderArea.innerHTML = '';
                const currentPicked = [];
                pickGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    if (cb.checked) currentPicked.push(cb.dataset.pickKey);
                });
                this._savePick(group.prefix, currentPicked);

                if (currentPicked.length === 0) {
                    const hint = document.createElement('div');
                    hint.className = 'param-pick-hint';
                    hint.textContent = '请在上方勾选需要调节的参数';
                    sliderArea.appendChild(hint);
                    return;
                }
                group.elements.forEach(elem => {
                    if (!currentPicked.includes(elem.key)) return;
                    const row = document.createElement('div');
                    row.className = 'param-row';
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'param-label';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'name';
                    nameSpan.textContent = elem.def.label;
                    labelDiv.appendChild(nameSpan);
                    row.appendChild(labelDiv);
                    const inputRow = document.createElement('div');
                    inputRow.className = 'param-input-row';
                    this._renderSliderRow(inputRow, elem.key, elem.def);
                    row.appendChild(inputRow);
                    sliderArea.appendChild(row);
                });
            };

            // 勾选网格
            for (const elem of group.elements) {
                const cell = document.createElement('label');
                cell.className = 'param-pick-cell';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.dataset.pickKey = elem.key;
                cb.checked = picked.has(elem.key);
                cb.addEventListener('change', onPickChange);
                cell.appendChild(cb);
                // 使用下标数字显示（如 ₁₁, ₂₃）
                const subscripts = '₀₁₂₃₄₅₆₇₈₉';
                const label = document.createElement('span');
                label.textContent = subscripts[elem.row] + subscripts[elem.col];
                cell.appendChild(label);
                pickGrid.appendChild(cell);
            }
            subBody.appendChild(pickGrid);

            const sliderArea = document.createElement('div');
            sliderArea.className = 'param-pick-sliders';
            subBody.appendChild(sliderArea);
            onPickChange();  // 触发初始渲染

        } else {
            // 全部模式：CSS Grid N 列
            const grid = document.createElement('div');
            grid.className = 'param-matrix-grid';
            grid.style.gridTemplateColumns = `repeat(${group.cols}, 1fr)`;
            group.elements.forEach(elem => {
                const cell = document.createElement('div');
                cell.className = 'param-grid-cell';
                const label = document.createElement('span');
                label.className = 'param-cell-label';
                label.textContent = elem.def.label;
                cell.appendChild(label);
                this._renderSliderRow(cell, elem.key, elem.def);
                grid.appendChild(cell);
            });
            subBody.appendChild(grid);
        }
    }

    /** 渲染"其他"参数组（非矩阵参数） */
    _renderOtherGroup(body, otherKeys) {
        const collapsed = this._loadGroupCollapsed('_other');
        const subPanel = document.createElement('div');
        subPanel.className = 'param-sub-panel' + (collapsed ? ' collapsed' : '');
        subPanel.dataset.groupPrefix = '_other';

        // 标题栏
        const header = document.createElement('div');
        header.className = 'param-sub-panel-header';
        const arrow = document.createElement('span');
        arrow.className = 'param-sub-panel-arrow';
        arrow.textContent = collapsed ? '▶' : '▼';
        const title = document.createElement('span');
        title.className = 'param-sub-panel-title';
        title.textContent = '其他参数';
        header.appendChild(title);
        header.appendChild(arrow);
        subPanel.appendChild(header);

        // 折叠/展开
        header.addEventListener('click', (e) => {
            if (e.target.tagName === 'SELECT') return;
            const nowC = !subPanel.classList.contains('collapsed');
            subPanel.classList.toggle('collapsed');
            arrow.textContent = nowC ? '▶' : '▼';
            this._saveGroupCollapsed('_other', nowC);
        });

        const subBody = document.createElement('div');
        subBody.className = 'param-sub-panel-body';

        otherKeys.forEach(key => {
            const def = this.meta.params[key];
            if (!def) return;
            const row = document.createElement('div');
            row.className = 'param-row';

            const labelDiv = document.createElement('div');
            labelDiv.className = 'param-label';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = def.label;
            labelDiv.appendChild(nameSpan);
            row.appendChild(labelDiv);

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
                    if (key === 'operation') this._buildParams();
                    await this._computeAndRender(this.params, true);
                });
                inputRow.appendChild(select);
            } else if (def.type === 'matrix') {
                let rows = def.rows || 2;
                let cols = def.cols || 2;
                const suffixMatch = key.match(/^matrix_(.+)$/);
                if (suffixMatch) {
                    const suffix = suffixMatch[1];
                    if (this.params[suffix + '_rows'] !== undefined) rows = this.params[suffix + '_rows'];
                    if (this.params[suffix + '_cols'] !== undefined) cols = this.params[suffix + '_cols'];
                }
                const grid = document.createElement('div');
                grid.className = 'matrix-input-grid';
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
                // float / int — 使用统一的滑块渲染
                const { slider } = this._renderSliderRow(inputRow, key, def);
                // 尺寸参数变化时重建面板以刷新矩阵网格
                if (key.endsWith('_rows') || key.endsWith('_cols')) {
                    slider.addEventListener('change', () => {
                        this._buildParams();
                    });
                }
            }

            row.appendChild(inputRow);
            subBody.appendChild(row);
        });

        subPanel.appendChild(subBody);
        body.appendChild(subPanel);
    }

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

        const { groups, otherKeys } = this._detectMatrixGroups();

        // 渲染矩阵组子面板
        groups.forEach(g => this._renderMatrixGroup(body, g));

        // 渲染"其他"参数组（仅当有非矩阵参数时）
        if (otherKeys.length > 0) {
            this._renderOtherGroup(body, otherKeys);
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
                // 兼容旧布局 (.param-input-row) 和新网格布局 (.param-grid-cell)
                const row = slider.closest('.param-input-row');
                const numInput = row?.querySelector('input[type="number"]')
                    || slider.parentElement?.querySelector('.param-number');
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

        // 使用专用容器，避免 innerHTML 全量替换误删动画按钮等子元素
        let container = panel.body.querySelector('[data-section="solution-info"]');
        if (!container) {
            container = document.createElement('div');
            container.dataset.section = 'solution-info';
            panel.body.appendChild(container);
        }

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
            container.innerHTML = html;
        } else {
            container.innerHTML = '';
        }
    }

    // ─── 动画控制（共享 UI：所有动画场景复用）────────────

    /** 读取动画自动播放开关 */
    _isAnimAutoEnabled(key) {
        try { return localStorage.getItem(key) === '1'; }
        catch { return false; }
    }

    /** 写入动画自动播放开关 */
    _setAnimAutoEnabled(key, val) {
        try { localStorage.setItem(key, val ? '1' : '0'); } catch {}
    }

    /**
     * 在 solution 面板中添加动画控制 UI（自动开关 + 手动播放按钮）。
     * 子类在 _computeAndRender 覆写中调用（super 之后）。
     * @param {string} storageKey - localStorage key
     */
    _addAnimControlUI(storageKey) {
        const panel = this._panel('solution');
        if (!panel) return;
        const body = panel.body;

        // 去重
        if (body.querySelector('.anim-control-row')) return;

        const row = document.createElement('div');
        row.className = 'anim-control-row';
        row.style.cssText = 'margin-bottom:8px;display:flex;gap:6px;';

        // ─── 自动动画开关 ───
        const autoEnabled = this._isAnimAutoEnabled(storageKey);
        const toggle = document.createElement('button');
        toggle.className = 'anim-auto-toggle';
        toggle.style.cssText =
            'padding:6px 10px;font-size:0.78rem;' +
            'background:' + (autoEnabled ? 'var(--accent)' : '#444') + ';' +
            'color:#fff;border:none;border-radius:4px;cursor:pointer;' +
            'white-space:nowrap;flex-shrink:0;';
        toggle.textContent = autoEnabled ? '⟳ 自动动画: 开' : '⟳ 自动动画: 关';
        toggle.addEventListener('click', () => {
            const nowOn = !this._isAnimAutoEnabled(storageKey);
            this._setAnimAutoEnabled(storageKey, nowOn);
            toggle.textContent = nowOn ? '⟳ 自动动画: 开' : '⟳ 自动动画: 关';
            toggle.style.background = nowOn ? 'var(--accent)' : '#444';
            if (nowOn && !this._animating && typeof this._startAnimation === 'function') {
                this._startAnimation();
            }
        });
        row.appendChild(toggle);

        // ─── 手动播放按钮 ───
        const playBtn = document.createElement('button');
        playBtn.className = 'anim-replay-btn';
        playBtn.textContent = '▶ 演示动画';
        playBtn.style.cssText =
            'padding:6px 14px;font-size:0.82rem;' +
            'background:var(--accent);color:#fff;border:none;' +
            'border-radius:4px;cursor:pointer;flex:1;';
        playBtn.addEventListener('click', () => {
            if (typeof this._startAnimation === 'function') this._startAnimation();
        });
        row.appendChild(playBtn);
        this._animBtn = playBtn;

        body.insertBefore(row, body.firstChild);

        // ─── 进度条滑块 ───
        const progressRow = document.createElement('div');
        progressRow.className = 'anim-progress-row';
        progressRow.style.cssText = 'margin-bottom:8px;display:flex;align-items:center;gap:6px;' +
            'padding:2px 0;';

        const progressSlider = document.createElement('input');
        progressSlider.type = 'range';
        progressSlider.className = 'anim-progress-slider';
        progressSlider.min = '0';
        progressSlider.max = '100';
        progressSlider.value = '0';
        progressSlider.style.cssText =
            'flex:1;height:4px;-webkit-appearance:none;appearance:none;' +
            'background:var(--border);border-radius:2px;outline:none;margin:0;';
        // 滑块进度条在此场景的 _updateAnimProgress 中实时更新

        const progressLabel = document.createElement('span');
        progressLabel.className = 'anim-progress-label';
        progressLabel.textContent = '0%';
        progressLabel.style.cssText =
            'min-width:32px;text-align:right;font-size:0.7rem;color:var(--text-secondary);';

        // 拖动进度条 → 暂停动画 + 跳转到对应帧
        progressSlider.addEventListener('input', () => {
            const t = parseInt(progressSlider.value) / 100;
            progressLabel.textContent = Math.round(t * 100) + '%';
            this._stopAnimation();
            // 跳到对应帧
            if (typeof this._interpolateToT === 'function') {
                this._interpolateToT(t);
            }
        });

        progressRow.appendChild(progressSlider);
        progressRow.appendChild(progressLabel);
        body.insertBefore(progressRow, row.nextSibling);

        // 保存引用供 _updateAnimProgress 使用
        this._animProgressSlider = progressSlider;
        this._animProgressLabel = progressLabel;
    }

    /**
     * 更新动画播放按钮的文字和状态。
     * @param {string} text - 按钮文字
     * @param {boolean} disabled - 是否禁用
     */
    _updateAnimButton(text, disabled) {
        const btn = this._animBtn;
        if (btn) {
            btn.textContent = text;
            btn.disabled = disabled;
            btn.style.opacity = disabled ? '0.6' : '1';
        }
    }

    /**
     * 更新动画进度条（每帧调用）。
     * @param {number} t - 动画进度 [0, 1]
     */
    _updateAnimProgress(t) {
        if (this._animProgressSlider) {
            const pct = Math.round(t * 100);
            this._animProgressSlider.value = pct;
            if (this._animProgressLabel) {
                this._animProgressLabel.textContent = pct + '%';
            }
        }
    }

    /**
     * 停止当前动画（取消帧回调 + 重置按钮状态）。
     * 在参数变化、预设切换、AI 应用参数导致 buildScene 重绘前调用。
     */
    _stopAnimation() {
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }
        if (this._animTimeout) {
            clearTimeout(this._animTimeout);
            this._animTimeout = null;
        }
        if (this._animStartTimer) {
            clearTimeout(this._animStartTimer);
            this._animStartTimer = null;
        }
        this._animating = false;
        this._updateAnimButton('▶ 演示动画', false);
    }

    // ─── 讲解面板（子面板：基础讲解 + AI 答疑）───────────

    _updateLecturePanel(data) {
        const panel = this._panel('lecture');
        if (!panel) return;
        panel.show();

        // 确保子面板 DOM 结构存在（首次创建）
        this._ensureSubPanels(panel);

        // 更新基础讲解内容
        const basicBody = panel.body.querySelector('[data-sub-panel="basic"] .lecture-sub-panel-body');
        if (basicBody) {
            if (data.lecture && data.lecture.sections && data.lecture.sections.length > 0) {
                const lectureKey = JSON.stringify(data.lecture);
                if (this._cachedLectureKey !== lectureKey) {
                    this._cachedLectureKey = lectureKey;
                    basicBody.innerHTML = this._renderLectureSections(data.lecture.sections);
                }
            } else {
                basicBody.innerHTML = '<p style="color:var(--text-muted);font-size:0.74rem;font-style:italic;padding:4px 0;">暂无讲解内容</p>';
                this._cachedLectureKey = null;
            }
        }

        // 更新 AI 聊天
        this._appendChatUI(panel);
    }

    /** 提取 lecture sections 的 KaTeX 渲染为 HTML */
    _renderLectureSections(sections) {
        let html = '';
        sections.forEach(sec => {
            html += `<div class="lecture-section">
                <div class="lecture-title">${sec.title}</div>
                <div class="lecture-content">`;
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
                    html += part
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br>');
                }
            });
            html += `</div></div>`;
        });
        return html;
    }

    /** 创建子面板 DOM 结构（仅首次调用） */
    _ensureSubPanels(panel) {
        if (panel.body.querySelector('.lecture-sub-panels')) return;

        panel.body.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'lecture-sub-panels';

        // 按持久化的顺序创建子面板
        for (const id of this._subPanelOrder) {
            if (id === 'basic') {
                container.appendChild(this._createSubPanel('basic', '📖 基础讲解', this._basicCollapsed));
            } else if (id === 'ai') {
                container.appendChild(this._createSubPanel('ai', '🤖 AI 答疑', this._aiCollapsed));
            }
        }

        panel.body.appendChild(container);
        this._bindSubPanelEvents(container);
    }

    /** 创建单个子面板 DOM */
    _createSubPanel(id, title, collapsed) {
        const el = document.createElement('div');
        el.className = 'lecture-sub-panel' + (collapsed ? ' collapsed' : '');
        el.dataset.subPanel = id;
        el.dataset.parentPanel = 'lecture';

        // 标题栏（拖拽把手）
        const header = document.createElement('div');
        header.className = 'lecture-sub-panel-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'lecture-sub-panel-title';
        titleSpan.textContent = title;
        header.appendChild(titleSpan);

        // 折叠按钮
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'lecture-sub-panel-collapse-btn';
        collapseBtn.textContent = collapsed ? '▼' : '▲';
        header.appendChild(collapseBtn);

        el.appendChild(header);

        // 内容区
        const body = document.createElement('div');
        body.className = 'lecture-sub-panel-body';
        el.appendChild(body);

        return el;
    }

    /** 绑定子面板的折叠事件 + 初始化拖拽排序 */
    _bindSubPanelEvents(container) {
        // 标记容器归属
        container.dataset.subPanelsOf = 'lecture';

        // 折叠按钮
        container.querySelectorAll('.lecture-sub-panel-collapse-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const subPanel = btn.closest('.lecture-sub-panel');
                const id = subPanel.dataset.subPanel;
                subPanel.classList.toggle('collapsed');
                const collapsed = subPanel.classList.contains('collapsed');
                btn.textContent = collapsed ? '▼' : '▲';

                if (id === 'basic') {
                    this._basicCollapsed = collapsed;
                    try { localStorage.setItem('la_lecture_basic_collapsed', collapsed ? '1' : '0'); } catch {}
                }
                if (id === 'ai') {
                    this._aiCollapsed = collapsed;
                    try { localStorage.setItem('la_lecture_ai_collapsed', collapsed ? '1' : '0'); } catch {}
                }
            });
        });

        // 拖拽排序
        this._initSubPanelDrag(container);
    }

    /** 根据 DOM 顺序同步 _subPanelOrder 并持久化 */
    _syncSubPanelOrder(container) {
        const ids = [...container.querySelectorAll('.lecture-sub-panel')]
            .map(el => el.dataset.subPanel)
            .filter(Boolean);
        if (ids.length >= 2) {
            this._subPanelOrder = ids;
            try {
                localStorage.setItem('la_lecture_subpanel_order', JSON.stringify(ids));
            } catch {}
        }
    }

    /** 初始化子面板拖拽排序 */
    _initSubPanelDrag(container) {
        let dragInfo = null;

        const onMouseDown = (e) => {
            // 只响应子面板标题栏的拖拽
            const header = e.target.closest('.lecture-sub-panel-header');
            if (!header) return;
            // 折叠按钮不触发拖拽
            if (e.target.closest('.lecture-sub-panel-collapse-btn')) return;

            const subPanel = header.closest('.lecture-sub-panel');
            if (!subPanel) return;
            // 只允许同容器内的子面板拖拽
            if (subPanel.dataset.parentPanel !== container.dataset.subPanelsOf) return;

            e.preventDefault();

            dragInfo = {
                subPanel,
                startY: e.clientY,
                moved: false,
                indicator: null,
            };

            subPanel.classList.add('dragging');
        };

        const onMouseMove = (e) => {
            if (!dragInfo) return;

            const dy = e.clientY - dragInfo.startY;
            // 死区：移动超过 6px 才开始拖拽
            if (Math.abs(dy) < 6 && !dragInfo.moved) return;
            dragInfo.moved = true;

            // 创建插入指示线
            if (!dragInfo.indicator) {
                dragInfo.indicator = document.createElement('div');
                dragInfo.indicator.className = 'sub-panel-insertion-indicator';
            }

            // 找到鼠标位置对应的插入点
            const siblings = [...container.querySelectorAll(
                '.lecture-sub-panel:not(.dragging)'
            )];
            let insertBefore = null;

            for (const sib of siblings) {
                const r = sib.getBoundingClientRect();
                if (e.clientY < r.top + r.height / 2) {
                    insertBefore = sib;
                    break;
                }
            }

            if (insertBefore) {
                container.insertBefore(dragInfo.indicator, insertBefore);
            } else {
                container.appendChild(dragInfo.indicator);
            }
        };

        const onMouseUp = () => {
            if (!dragInfo) return;

            const { subPanel, indicator, moved } = dragInfo;
            subPanel.classList.remove('dragging');

            if (indicator) {
                if (moved) {
                    container.insertBefore(subPanel, indicator);
                    this._syncSubPanelOrder(container);
                }
                indicator.remove();
            }

            dragInfo = null;
        };

        container.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // 保存清理函数，供 destroy() 调用
        this._subPanelDragCleanup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    // ─── AI 聊天 UI ────────────────────────────────────────

    /** 从 IndexedDB 恢复聊天记录 */
    async _loadChatHistory() {
        try {
            const msgs = await loadChat(this.meta.id);
            if (msgs && msgs.length > 0) {
                this._chatHistory = msgs;
                // 如果 AI 子面板已经存在，刷新显示
                const panel = this._panel('lecture');
                if (panel) {
                    const messagesDiv = panel.body.querySelector('.ai-chat-messages');
                    if (messagesDiv) this._renderChatMessages(messagesDiv);
                }
            }
        } catch {
            // IndexedDB 不可用时静默回退
        }
    }

    /**
     * 在 AI 答疑子面板中追加聊天界面。
     * 每次 _updateLecturePanel 后调用，挂载到 [data-sub-panel="ai"] 内部。
     */
    _appendChatUI(panel) {
        // 定位 AI 子面板内容区
        const aiBody = panel.body.querySelector('[data-sub-panel="ai"] .lecture-sub-panel-body');
        if (!aiBody) return;

        // 如果聊天容器已存在且仍在 DOM 中，只刷新消息渲染
        let container = aiBody.querySelector('.ai-chat-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ai-chat-container';

            // ── 标题行：AI 答疑 + 设置按钮 ──
            const headerRow = document.createElement('div');
            headerRow.className = 'ai-chat-header';

            const title = document.createElement('span');
            title.className = 'ai-chat-title';
            title.textContent = '🤖 AI 答疑';
            headerRow.appendChild(title);

            const settingsBtn = document.createElement('button');
            settingsBtn.className = 'ai-chat-settings-btn';
            settingsBtn.title = '设置 API Key';
            settingsBtn.textContent = '⚙️';
            settingsBtn.addEventListener('click', () => this._toggleApiKeySettings(container));
            headerRow.appendChild(settingsBtn);

            const exportBtn = document.createElement('button');
            exportBtn.className = 'ai-chat-settings-btn';
            exportBtn.title = 'AI 生成学习笔记';
            exportBtn.textContent = '🤖';
            exportBtn.style.marginLeft = '2px';
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._exportNote();
            });
            headerRow.appendChild(exportBtn);

            const clearBtn = document.createElement('button');
            clearBtn.className = 'ai-chat-settings-btn';
            clearBtn.title = '清空当前场景的对话';
            clearBtn.textContent = '🗑';
            clearBtn.style.marginLeft = '2px';
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要清空当前场景的所有对话记录吗？此操作不可撤销。')) {
                    this._chatHistory = [];
                    clearChat(this.meta.id);
                    this._renderChatMessages(container.querySelector('.ai-chat-messages'));
                }
            });
            headerRow.appendChild(clearBtn);

            container.appendChild(headerRow);

            // ── API Key 设置面板（默认隐藏）──
            const settingsPanel = document.createElement('div');
            settingsPanel.className = 'ai-chat-settings';
            settingsPanel.style.display = 'none';

            const settingsHint = document.createElement('div');
            settingsHint.className = 'ai-chat-settings-hint';
            settingsHint.innerHTML = '在 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com</a> 获取 Key，充值几块钱够用很久。';
            settingsPanel.appendChild(settingsHint);

            const settingsRow = document.createElement('div');
            settingsRow.className = 'ai-chat-settings-row';

            const keyInput = document.createElement('input');
            keyInput.type = 'password';
            keyInput.className = 'ai-chat-key-input';
            keyInput.placeholder = 'sk-...';
            // 从 localStorage 恢复已保存的 Key
            const savedKey = localStorage.getItem('la_deepseek_api_key');
            if (savedKey) keyInput.value = savedKey;

            const saveBtn = document.createElement('button');
            saveBtn.className = 'ai-chat-key-save-btn';
            saveBtn.textContent = '保存';
            saveBtn.addEventListener('click', () => {
                const newKey = keyInput.value.trim();
                if (newKey) {
                    localStorage.setItem('la_deepseek_api_key', newKey);
                    keyInput.value = newKey;
                    settingsPanel.style.display = 'none';
                    settingsBtn.classList.remove('active');
                    this._renderChatMessages(container.querySelector('.ai-chat-messages'));
                }
            });

            settingsRow.appendChild(keyInput);
            settingsRow.appendChild(saveBtn);
            settingsPanel.appendChild(settingsRow);
            container.appendChild(settingsPanel);

            // ── 消息列表 ──
            const messagesDiv = document.createElement('div');
            messagesDiv.className = 'ai-chat-messages';
            container.appendChild(messagesDiv);

            // ── 输入行 ──
            const inputRow = document.createElement('div');
            inputRow.className = 'ai-chat-input-row';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '向 AI 提问当前场景...';
            input.className = 'ai-chat-input';
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._sendChatMessage();
            });

            const btn = document.createElement('button');
            btn.className = 'ai-chat-send-btn';
            btn.textContent = '发送';
            btn.addEventListener('click', () => this._sendChatMessage());

            inputRow.appendChild(input);
            inputRow.appendChild(btn);
            container.appendChild(inputRow);
            aiBody.appendChild(container);
        }

        this._renderChatMessages(container.querySelector('.ai-chat-messages'));
    }

    /** 渲染聊天记录 */
    _renderChatMessages(messagesDiv) {
        if (!messagesDiv) return;
        messagesDiv.innerHTML = '';

        const hasKey = !!localStorage.getItem('la_deepseek_api_key');

        // 欢迎提示
        if (this._chatHistory.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'ai-chat-hint';
            if (!hasKey) {
                hint.innerHTML = '⚙️ 请先点击右上角齿轮图标设置 <strong>DeepSeek API Key</strong>（<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">获取 Key</a>），然后即可提问。';
            } else {
                hint.textContent = '💡 试试问：「这个矩阵的秩是多少？」「为什么有唯一解？」「秩和解的关系是什么？」';
            }
            messagesDiv.appendChild(hint);
            return;
        }

        this._chatHistory.forEach((msg, idx) => {
            const bubble = document.createElement('div');
            bubble.className = `ai-chat-message ${msg.role}`;

            if (msg.role === 'assistant') {
                // AI 消息需要 KaTeX 渲染
                const displayContent = msg.content || '';
                bubble.innerHTML = this._renderMarkdown(displayContent);
            } else {
                bubble.textContent = msg.content;
            }

            messagesDiv.appendChild(bubble);

            // 工具调用确认卡片（支持旧格式 toolCall 单数 + 新格式 toolCalls 数组）
            const toolCalls = msg.toolCalls || (msg.toolCall ? [msg.toolCall] : null);
            if (toolCalls && Array.isArray(toolCalls)) {
                toolCalls.forEach((tc) => {
                    if (tc.action === 'set_params' && tc._applied === undefined) {
                        const card = this._createToolCard(tc, idx);
                        messagesDiv.appendChild(card);
                    }
                });
            }
        });

        // 滚动到底部
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    /** 切换 API Key 设置面板的显示/隐藏 */
    _toggleApiKeySettings(container) {
        const panel = container.querySelector('.ai-chat-settings');
        const btn = container.querySelector('.ai-chat-settings-btn');
        if (!panel) return;
        const isVisible = panel.style.display !== 'none';
        if (isVisible) {
            panel.style.display = 'none';
            if (btn) btn.classList.remove('active');
        } else {
            panel.style.display = 'block';
            if (btn) btn.classList.add('active');
            // 展开时同步当前 localStorage 的值到输入框
            const keyInput = panel.querySelector('.ai-chat-key-input');
            const savedKey = localStorage.getItem('la_deepseek_api_key');
            if (keyInput && savedKey) keyInput.value = savedKey;
        }
    }

    /** 简单的 Markdown + LaTeX 渲染 */
    _renderMarkdown(text) {
        // ── 第0步：格式标准化 ────────────────────────────
        // 将 AI 可能输出的 \(...\) / \[...\] 转为 $...$ / $$...$$
        // 这样即使 AI 不遵守 system prompt，前端也能正确渲染
        let processed = text
            .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `$$${math.trim()}$$`)
            .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

        // 保护 LaTeX 公式：先将 $$...$$ 和 $...$ 替换为占位符
        const blocks = [];
        let idx = 0;

        // 先处理 $$...$$（显示公式）
        processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
            const key = `__KATEX_BLOCK_${idx}__`;
            blocks.push({ key, math: math.trim(), display: true });
            idx++;
            return key;
        });

        // 再处理 $...$（行内公式）
        processed = processed.replace(/\$([^\$]+?)\$/g, (_, math) => {
            const key = `__KATEX_INLINE_${idx}__`;
            blocks.push({ key, math: math.trim(), display: false });
            idx++;
            return key;
        });

        // HTML 转义
        processed = processed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 简单 Markdown：**粗体**、换行
        processed = processed
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        // 还原 LaTeX 公式
        blocks.forEach(({ key, math, display }) => {
            try {
                if (typeof katex !== 'undefined') {
                    const rendered = katex.renderToString(math, {
                        displayMode: display,
                        throwOnError: false,
                    });
                    processed = processed.replace(key, rendered);
                } else {
                    processed = processed.replace(key, `<code>${math}</code>`);
                }
            } catch (e) {
                processed = processed.replace(key, `<code style="color:var(--red);">${math}</code>`);
            }
        });

        return processed;
    }

    /**
     * 兜底解析：如果 AI 未通过 function calling 返回工具调用，
     * 但仍在回复中用 ```json 代码块输出了参数修改指令，此方法作为后备。
     * @deprecated 正式方案通过后端 tool_calls 字段传递，此方法仅作兜底。
     * @returns {{ text: string, toolCalls: Array|null }}
     */
    _parseToolCallFallback(reply) {
        const jsonBlockRe = /```json\s*(\{[^`]*"action"\s*:\s*"set_params"[^`]*\})\s*```/s;
        const match = reply.match(jsonBlockRe);
        if (!match) {
            return { text: reply, toolCalls: null };
        }
        try {
            const toolCall = JSON.parse(match[1]);
            const text = reply.replace(match[0], '').trim();
            return { text, toolCalls: [toolCall] };
        } catch {
            return { text: reply, toolCalls: null };
        }
    }

    /**
     * 创建工具调用确认卡片
     * @param {Object} toolCall - {action, reason, params}
     * @param {number} msgIdx - 消息在 _chatHistory 中的索引
     */
    _createToolCard(toolCall, msgIdx) {
        const card = document.createElement('div');
        card.className = 'ai-tool-card';

        const header = document.createElement('div');
        header.className = 'ai-tool-card-header';
        header.textContent = '🤖 AI 建议修改参数';
        card.appendChild(header);

        const reason = document.createElement('div');
        reason.className = 'ai-tool-card-reason';
        reason.textContent = toolCall.reason || '（未说明原因）';
        card.appendChild(reason);

        const paramsPreview = document.createElement('div');
        paramsPreview.className = 'ai-tool-card-params';
        paramsPreview.textContent = Object.entries(toolCall.params || {})
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
        card.appendChild(paramsPreview);

        const actions = document.createElement('div');
        actions.className = 'ai-tool-card-actions';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'ai-tool-apply-btn';
        applyBtn.textContent = '✓ 应用';
        applyBtn.addEventListener('click', async () => {
            applyBtn.disabled = true;
            applyBtn.textContent = '⏳';
            ignoreBtn.disabled = true;
            // 提前标记已处理，防止 _applyAIParams 内部触发的重渲染复活卡片
            toolCall._applied = true;
            await this._applyAIParams(toolCall.params, card);
        });

        const ignoreBtn = document.createElement('button');
        ignoreBtn.className = 'ai-tool-ignore-btn';
        ignoreBtn.textContent = '✗ 忽略';
        ignoreBtn.addEventListener('click', () => {
            toolCall._applied = true;
            card.remove();
        });

        actions.appendChild(applyBtn);
        actions.appendChild(ignoreBtn);
        card.appendChild(actions);

        return card;
    }

    /**
     * 应用 AI 提议的参数修改（带后端验证）
     * @param {Object} newParams - AI 提议的参数 {a11: 2, ...}
     * @param {HTMLElement} cardEl - 确认卡片元素，用于替换为结果
     */
    async _applyAIParams(newParams, cardEl) {
        // 确保 this.params 包含所有默认值
        if (this.meta.params) {
            for (const [key, def] of Object.entries(this.meta.params)) {
                if (!(key in this.params)) {
                    this.params[key] = def.default;
                }
            }
        }

        // 合并新参数到当前参数
        const merged = { ...this.params, ...newParams };

        try {
            const result = await computeScene(this.meta.id, merged);
            if (!result.success) {
                this._replaceToolCard(cardEl, 'error', `后端验证失败: ${result.error}`);
                return;
            }

            if (!result.data?.scene_data) {
                this._replaceToolCard(cardEl, 'error', '后端返回数据异常：缺少 scene_data');
                return;
            }

            // 更新参数
            Object.assign(this.params, newParams);
            // 同步 UI 滑块
            this._syncParamsToUI();

            // 更新场景（双缓冲，避免旧 3D 对象残留）
            this._lastComputeResult = result.data;

            const oldGroup = this.sceneObjects;
            const newGroup = new THREE.Group();
            this.threeScene.add(newGroup);
            this.sceneObjects = newGroup;

            this._stopAnimation();

            try {
                this.buildScene(result.data);
            } catch (buildErr) {
                this.threeScene.remove(newGroup);
                this._disposeRecursive(newGroup);
                this.sceneObjects = oldGroup;
                throw buildErr;
            }

            this.threeScene.remove(oldGroup);
            this._disposeRecursive(oldGroup);

            this._updateSolutionInfo(result.data);
            this._updateLecturePanel(result.data);
            this._updateVerifyPanel(result.data);
            this._updateMatrixDisplay(result.data);

            // 成功：直接移除确认卡片，3D 画面变化即为视觉反馈
            cardEl.remove();
        } catch (err) {
            this._replaceToolCard(cardEl, 'error', `应用失败: ${err.message}`);
        }
    }

    /** 将确认卡片替换为结果消息 */
    _replaceToolCard(cardEl, type, message) {
        const result = document.createElement('div');
        result.className = `ai-tool-result ${type}`;
        result.textContent = message;
        if (cardEl.parentNode) {
            cardEl.parentNode.replaceChild(result, cardEl);
        }
    }

    /** 发送聊天消息 */
    async _sendChatMessage() {
        const panel = this._panel('lecture');
        if (!panel) return;

        const input = panel.body.querySelector('.ai-chat-input');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // 检查 API Key
        const apiKey = localStorage.getItem('la_deepseek_api_key');
        if (!apiKey) {
            const container = panel.body.querySelector('.ai-chat-container');
            if (container) this._toggleApiKeySettings(container);
            return;
        }

        // 清空输入框
        input.value = '';
        input.disabled = true;
        const btn = panel.body.querySelector('.ai-chat-send-btn');
        if (btn) btn.disabled = true;

        // 追加用户消息
        this._chatHistory.push({ role: 'user', content: message });

        // 显示 loading
        this._chatHistory.push({ role: 'assistant', content: '__LOADING__' });
        const messagesDiv = panel.body.querySelector('.ai-chat-messages');
        this._renderChatMessages(messagesDiv);

        // 调用 AI API
        try {
            const result = await askAI(
                this.meta.id,
                this.params,
                message,
                this._chatHistory.filter(m => m.content !== '__LOADING__'),
                apiKey
            );

            // 移除 loading
            this._chatHistory.pop();

            if (result.success && result.data && result.data.reply) {
                let reply = result.data.reply || '';
                let toolCalls = result.data.tool_calls || null;

                // 兜底：如果结构化 tool_calls 为空，尝试正则解析旧格式
                if (!toolCalls) {
                    const fallback = this._parseToolCallFallback(reply);
                    reply = fallback.text;
                    toolCalls = fallback.toolCalls;
                }

                this._chatHistory.push({
                    role: 'assistant',
                    content: reply,
                    toolCalls: toolCalls,  // null 或 [{action, reason, params}, ...]
                });
            } else {
                this._chatHistory.push({
                    role: 'assistant',
                    content: `❌ ${result.error || 'AI 未返回回答'}`,
                });
            }
        } catch (err) {
            this._chatHistory.pop();
            this._chatHistory.push({
                role: 'assistant',
                content: `❌ 网络错误: ${err.message}`,
            });
        }

        this._renderChatMessages(messagesDiv);

        // 恢复输入
        input.disabled = false;
        if (btn) btn.disabled = false;
        input.focus();
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

        // 清除上一次的错误状态
        errorOverlay.style.display = 'none';
        errorOverlay.removeAttribute('data-retry-params');

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
                this._showError(result.error || '未知错误', params);
                return;
            }

            // 保存计算结果供导出等用途
            this._lastComputeResult = result.data;

            // 停止当前动画（防止动画帧回调操作已销毁的 geometry）
            this._stopAnimation();

            // 双缓冲：构建新场景到新的 Group，然后一次性替换
            const oldGroup = this.sceneObjects;
            const newGroup = new THREE.Group();
            this.threeScene.add(newGroup);
            this.sceneObjects = newGroup;

            try {
                this.buildScene(result.data);
            } catch (buildErr) {
                // 构建失败：回退 newGroup，恢复 oldGroup，避免空场景残留
                this.threeScene.remove(newGroup);
                this._disposeRecursive(newGroup);
                this.sceneObjects = oldGroup;
                throw buildErr;
            }

            // 移除旧场景
            this.threeScene.remove(oldGroup);
            this._disposeRecursive(oldGroup);

            // 更新面板
            this._updateSolutionInfo(result.data);
            this._updateLecturePanel(result.data);
            this._updateMatrixDisplay(result.data);
            this._updateVerifyPanel(result.data);

        } catch (err) {
            this._showError(`渲染失败: ${err.message}`, params);
            console.error(err);
            loadingOverlay.style.display = 'none';
        }
    }

    // 子类重写此方法
    buildScene(data) {
        console.warn('buildScene() 未实现，数据:', data);
    }

    /** 显示错误覆盖层（带重试和关闭按钮） */
    _showError(message, retryParams) {
        const errorOverlay = document.getElementById('error-overlay');
        document.getElementById('error-message').textContent = message;
        // 保存重试参数，供重试按钮使用
        if (retryParams) {
            errorOverlay.setAttribute('data-retry-params', JSON.stringify(retryParams));
        }
        errorOverlay.style.display = 'block';
        this._bindErrorButtons();
    }

    /** 绑定错误覆盖层按钮（仅首次） */
    _bindErrorButtons() {
        if (this._errorButtonsBound) return;
        this._errorButtonsBound = true;

        const retryBtn = document.getElementById('error-retry-btn');
        const closeBtn = document.getElementById('error-close-btn');
        const errorOverlay = document.getElementById('error-overlay');

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                const raw = errorOverlay.getAttribute('data-retry-params');
                if (raw) {
                    const params = JSON.parse(raw);
                    errorOverlay.style.display = 'none';
                    this._computeAndRender(params, true);
                }
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                errorOverlay.style.display = 'none';
            });
        }
    }

    // ─── 笔记导出 ──────────────────────────────────────────

    async _exportNote() {
        const data = this._lastComputeResult;
        if (!data) {
            alert('请先加载场景数据后再导出。');
            return;
        }

        const apiKey = localStorage.getItem('la_deepseek_api_key');
        if (!apiKey) {
            alert('请先在 AI 答疑设置中填入 DeepSeek API Key。');
            return;
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const title = this.meta.title || '未命名';
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-');

        // 构建 scene_data（与 chat 端点一致的格式）
        const sceneData = {
            ...data.scene_data,
            solution_info: data.solution_info,
            verification: data.verification,
            lecture: data.lecture,
            _scene_title: title,
            _scene_description: this.meta.description || '',
        };

        // 显示加载状态
        const panel = this._panel('lecture');
        const btn = panel?.body.querySelector('.ai-chat-settings-btn[title*="笔记"]');
        if (btn) {
            btn.textContent = '⏳';
            btn.disabled = true;
        }

        try {
            const result = await generateNote(
                this.meta.id,
                sceneData,
                this._chatHistory.filter(m => m.content !== '__LOADING__'),
                apiKey
            );

            if (result.success && result.data?.note) {
                // 触发下载
                const blob = new Blob([result.data.note], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `线性代数笔记_${safeTitle}_${dateStr}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                alert(`笔记生成失败: ${result.error || 'AI 未返回内容'}`);
            }
        } catch (err) {
            alert(`笔记生成失败: ${err.message}`);
        } finally {
            if (btn) {
                btn.textContent = '🤖';
                btn.disabled = false;
            }
        }
    }

    _disposeRecursive(obj) {
        if (!obj) return;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach(m => {
                // 释放材质上的纹理（CanvasTexture 等，防止内存泄漏）
                if (m.map) { m.map.dispose(); m.map = null; }
                if (m.emissiveMap) { m.emissiveMap.dispose(); m.emissiveMap = null; }
                if (m.alphaMap) { m.alphaMap.dispose(); m.alphaMap = null; }
                m.dispose();
            });
        }
        if (obj.children) {
            for (let i = obj.children.length - 1; i >= 0; i--) {
                this._disposeRecursive(obj.children[i]);
            }
        }
    }
}
