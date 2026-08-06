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
import { computeScene, askAI } from './api.js';
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
        this._isInitialLoad = true;
        this._cachedLectureKey = null;
        this._cachedLectureHTML = null;
        this._chatHistory = [];          // AI 聊天历史
        this._lectureCollapsed = false;  // 基础讲解折叠状态

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
        // 清理 3D 对象
        while (this.sceneObjects.children.length > 0) {
            const child = this.sceneObjects.children[0];
            this._disposeRecursive(child);
            this.sceneObjects.remove(child);
        }
        // 清空聊天历史
        this._chatHistory = [];
        this._lectureCollapsed = false;
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

    // ─── 讲解面板（支持 KaTeX 数学公式 + 可折叠）───────

    _updateLecturePanel(data) {
        const panel = this._panel('lecture');
        if (!panel) return;

        // 无基础讲解内容时，清空讲解区但保留 AI 聊天
        if (!data.lecture || !data.lecture.sections || data.lecture.sections.length === 0) {
            panel.show();
            panel.body.innerHTML = '';
            this._cachedLectureHTML = null;
            this._cachedLectureKey = null;
            this._appendChatUI(panel);
            return;
        }
        panel.show();

        // 缓存检查：相同数据跳过渲染
        const lectureKey = JSON.stringify(data.lecture);
        if (this._cachedLectureKey === lectureKey && this._cachedLectureHTML) {
            panel.body.innerHTML = this._cachedLectureHTML;
            this._bindLectureCollapse(panel);
            this._appendChatUI(panel);
            return;
        }
        this._cachedLectureKey = lectureKey;

        // 渲染 lecture sections
        let sectionsHTML = '';
        data.lecture.sections.forEach(sec => {
            sectionsHTML += `<div class="lecture-section">
                <div class="lecture-title">${sec.title}</div>
                <div class="lecture-content">`;
            const parts = sec.content.split(/(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g);
            parts.forEach(part => {
                if (part.startsWith('$$')) {
                    const math = part.slice(2, -2).trim();
                    try {
                        if (typeof katex !== 'undefined') {
                            sectionsHTML += katex.renderToString(math, { displayMode: true, throwOnError: false });
                        } else {
                            sectionsHTML += `<pre style="color:var(--text-secondary);">${math}</pre>`;
                        }
                    } catch (e) {
                        sectionsHTML += `<pre style="color:var(--red);">${math}</pre>`;
                    }
                } else if (part.startsWith('$')) {
                    const math = part.slice(1, -1).trim();
                    try {
                        if (typeof katex !== 'undefined') {
                            sectionsHTML += katex.renderToString(math, { displayMode: false, throwOnError: false });
                        } else {
                            sectionsHTML += `<code>${math}</code>`;
                        }
                    } catch (e) {
                        sectionsHTML += `<code style="color:var(--red);">${math}</code>`;
                    }
                } else {
                    sectionsHTML += part
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br>');
                }
            });
            sectionsHTML += `</div></div>`;
        });

        // 构建完整 HTML：折叠栏 + 讲解内容
        const arrow = this._lectureCollapsed ? '▼' : '▲';
        const bodyDisplay = this._lectureCollapsed ? 'style="display:none"' : '';
        const fullHTML =
            `<div class="lecture-collapse-bar">
                <button class="lecture-collapse-btn">📖 基础讲解 ${arrow}</button>
            </div>
            <div class="lecture-body" ${bodyDisplay}>${sectionsHTML}</div>`;

        this._cachedLectureHTML = fullHTML;
        panel.body.innerHTML = fullHTML;

        // 绑定折叠事件
        this._bindLectureCollapse(panel);

        // 追加 AI 聊天 UI
        this._appendChatUI(panel);
    }

    /** 绑定基础讲解的折叠/展开按钮 */
    _bindLectureCollapse(panel) {
        const btn = panel.body.querySelector('.lecture-collapse-btn');
        if (!btn) return;
        // 用标记避免重复绑定
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';

        btn.addEventListener('click', () => {
            this._lectureCollapsed = !this._lectureCollapsed;
            const body = panel.body.querySelector('.lecture-body');
            if (body) {
                body.style.display = this._lectureCollapsed ? 'none' : '';
            }
            btn.textContent = `📖 基础讲解 ${this._lectureCollapsed ? '▼' : '▲'}`;
        });
    }

    // ─── AI 聊天 UI ────────────────────────────────────────

    /**
     * 在讲解面板底部追加聊天界面。
     * 每次 _updateLecturePanel 后调用，确保 innerHTML 不会意外清除聊天 UI。
     */
    _appendChatUI(panel) {
        // 如果聊天容器已存在且仍在 DOM 中，只刷新消息渲染
        let container = panel.body.querySelector('.ai-chat-container');
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
            panel.body.appendChild(container);
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
                bubble.innerHTML = this._renderMarkdown(msg.content);
            } else {
                bubble.textContent = msg.content;
            }

            messagesDiv.appendChild(bubble);
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
                this._chatHistory.push({ role: 'assistant', content: result.data.reply });
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
