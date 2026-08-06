/**
 * 设置菜单模块 — 面板可见性、网格渲染、参数范围、颜色主题。
 *
 * 从 main.js 提取，通过 `initSettingsMenu({ scene, panelManager, ... })` 初始化。
 * 所有设置相关的 UI 和持久化逻辑集中于此模块。
 */

import * as THREE from 'three';

// ─── 模块级状态 ────────────────────────────────────────────

let gridHelper = null;
let gridRange = 5;
let _scene = null;

// ─── 网格管理 ──────────────────────────────────────────────

function _loadGridSettings() {
    const defaults = { range: 5 };
    try {
        const saved = JSON.parse(localStorage.getItem('la_grid_settings') || '{}');
        // 兼容旧格式 {size, divisions} → 转为 {range}
        if (saved.range == null && saved.size != null) {
            return { range: Math.round(saved.size / 2) };
        }
        return { ...defaults, ...saved };
    } catch { return defaults; }
}

function _saveGridSettings(range) {
    try { localStorage.setItem('la_grid_settings', JSON.stringify({ range })); } catch {}
}

function updateGridRenderer(range) {
    if (gridHelper) {
        _scene.remove(gridHelper);
        gridHelper.geometry.dispose();
        if (Array.isArray(gridHelper.material)) {
            gridHelper.material.forEach(m => m.dispose());
        } else if (gridHelper.material) {
            gridHelper.material.dispose();
        }
    }
    gridRange = range;
    const size = range * 2;
    gridHelper = new THREE.GridHelper(size, size, 0x333355, 0x222240);
    gridHelper.rotation.x = -Math.PI / 2;
    gridHelper.renderOrder = -1;
    gridHelper.material.depthWrite = false;
    _scene.add(gridHelper);
}

// ─── 主入口 ────────────────────────────────────────────────

/**
 * 初始化设置菜单。在 Three.js scene 创建后调用一次。
 *
 * @param {Object} opts
 * @param {THREE.Scene} opts.scene - Three.js 场景（网格管理和背景色同步需要）
 * @param {import('./panel-system.js').PanelManager} opts.panelManager - 面板管理器
 * @param {Function} opts.getSceneMeta - (sceneName) => meta
 * @param {Function} opts.getSceneName - () => currentSceneName
 * @param {Function} opts.getRenderer - () => currentSceneRenderer
 */
export function initSettingsMenu({ scene, panelManager, getSceneMeta, getSceneName, getRenderer }) {
    _scene = scene;

    // ── 初始化网格 ──────────────────────────────────────────

    gridRange = _loadGridSettings().range ?? 5;
    gridHelper = new THREE.GridHelper(gridRange * 2, gridRange * 2, 0x333355, 0x222240);
    gridHelper.rotation.x = -Math.PI / 2;
    gridHelper.renderOrder = -1;
    gridHelper.material.depthWrite = false;
    scene.add(gridHelper);

    // ── DOM 引用 ────────────────────────────────────────────

    const toggleBtn = document.getElementById('settings-toggle');
    const menu = document.getElementById('settings-menu');
    if (!toggleBtn || !menu) return;

    // ── 可管理的面板列表（从 PanelManager 动态获取，避免硬编码）──
    const panelDefs = panelManager.getPanels().map(p => ({ id: p.id, label: p.title }));

    // ═══════════════════════════════════════════════════════
    // 1. 面板可见性子菜单
    // ═══════════════════════════════════════════════════════

    const panelList = document.getElementById('settings-panel-list');
    const savedVis = _loadPanelVisibility();

    panelDefs.forEach(def => {
        const row = document.createElement('div');
        row.className = 'settings-panel-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = savedVis[def.id] !== false;
        cb.dataset.panelId = def.id;

        const label = document.createElement('label');
        label.textContent = def.label;

        cb.addEventListener('change', () => {
            _applyPanelVisibility(def.id, cb.checked);
            _savePanelVisibility();
        });

        row.appendChild(cb);
        row.appendChild(label);
        row.addEventListener('click', (e) => {
            if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
        });
        panelList.appendChild(row);
        _applyPanelVisibility(def.id, cb.checked);
    });

    function _loadPanelVisibility() {
        try { return JSON.parse(localStorage.getItem('la_panel_visibility') || '{}'); }
        catch { return {}; }
    }

    function _savePanelVisibility() {
        const state = {};
        panelList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            state[cb.dataset.panelId] = cb.checked;
        });
        localStorage.setItem('la_panel_visibility', JSON.stringify(state));
    }

    function _applyPanelVisibility(panelId, visible) {
        const panel = panelManager.getPanel(panelId);
        if (!panel) return;
        panel._userHidden = !visible;
        visible ? panel.show() : panel.hide();
    }

    // ═══════════════════════════════════════════════════════
    // 2. 网格渲染距离子菜单
    // ═══════════════════════════════════════════════════════

    const gridBody = document.getElementById('settings-grid-body');
    const gridRangeSlider = (function buildGridUI() {
        const gs = _loadGridSettings();
        const currentRange = gs.range ?? 5;

        const row = document.createElement('div');
        row.className = 'settings-grid-row';

        const lbl = document.createElement('label');
        lbl.textContent = '可视范围';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '3'; slider.max = '50'; slider.step = '1';
        slider.value = currentRange;

        const valSpan = document.createElement('span');
        valSpan.className = 'settings-grid-value';
        valSpan.textContent = '±' + currentRange;

        slider.addEventListener('input', () => {
            const range = parseInt(slider.value);
            valSpan.textContent = '±' + range;
            updateGridRenderer(range);
        });
        // 松手后才持久化，避免拖动时频繁写 localStorage 导致卡顿
        slider.addEventListener('change', () => {
            _saveGridSettings(parseInt(slider.value));
        });

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(valSpan);
        gridBody.appendChild(row);

        return slider;  // 暴露给重置按钮
    })();

    // ═══════════════════════════════════════════════════════
    // 3. 参数范围子菜单（随场景动态刷新）
    // ═══════════════════════════════════════════════════════

    const paramRangesBody = document.getElementById('settings-param-ranges-body');

    function _loadParamRanges() {
        try { return JSON.parse(localStorage.getItem('la_param_ranges') || '{}'); }
        catch { return {}; }
    }

    function _saveParamRanges(ranges) {
        try { localStorage.setItem('la_param_ranges', JSON.stringify(ranges)); }
        catch {}
    }

    function refreshParamRangeUI() {
        paramRangesBody.innerHTML = '';
        const sceneName = getSceneName();
        if (!sceneName) {
            paramRangesBody.innerHTML = '<div class="settings-panel-item" style="color:var(--text-muted);font-style:italic;">请先选择一个场景</div>';
            return;
        }

        const meta = getSceneMeta(sceneName);
        if (!meta || !meta.params) return;

        const allRanges = _loadParamRanges();
        const sceneRanges = allRanges[sceneName] || {};
        let hasParams = false;

        for (const [key, def] of Object.entries(meta.params)) {
            if (def.type !== 'float' && def.type !== 'int') continue;
            hasParams = true;

            const row = document.createElement('div');
            row.className = 'settings-paramrange-row';

            const label = document.createElement('span');
            label.className = 'settings-paramrange-label';
            label.textContent = def.label;
            label.title = def.label;

            const curRange = sceneRanges[key] || {};
            const curMin = curRange.min ?? def.min;
            const curMax = curRange.max ?? def.max;

            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.className = 'settings-paramrange-input';
            minInput.value = curMin;
            minInput.step = def.step || 0.1;

            const sep = document.createElement('span');
            sep.className = 'settings-paramrange-sep';
            sep.textContent = '~';

            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.className = 'settings-paramrange-input';
            maxInput.value = curMax;
            maxInput.step = def.step || 0.1;

            const applyChange = () => {
                const allRanges = _loadParamRanges();
                if (!allRanges[sceneName]) allRanges[sceneName] = {};
                allRanges[sceneName][key] = {
                    min: parseFloat(minInput.value) ?? def.min,
                    max: parseFloat(maxInput.value) ?? def.max,
                };
                _saveParamRanges(allRanges);
                // 重建当前场景的参数面板以应用新范围
                const renderer = getRenderer();
                if (renderer && typeof renderer._buildParams === 'function') {
                    renderer._buildParams();
                }
            };

            minInput.addEventListener('change', applyChange);
            maxInput.addEventListener('change', applyChange);

            row.appendChild(label);
            row.appendChild(minInput);
            row.appendChild(sep);
            row.appendChild(maxInput);
            paramRangesBody.appendChild(row);
        }

        if (!hasParams) {
            paramRangesBody.innerHTML = '<div class="settings-panel-item" style="color:var(--text-muted);font-style:italic;">当前场景无参数</div>';
        }
    }

    // 暴露给 switchScene 调用
    window._refreshParamRangeUI = refreshParamRangeUI;

    // ═══════════════════════════════════════════════════════
    // 4. 颜色主题子菜单
    // ═══════════════════════════════════════════════════════

    const colorsBody = document.getElementById('settings-colors-body');

    const colorDefs = [
        { varName: '--accent',       label: '主题色',    cssProp: 'accent',       defHex: '#4cc9f0' },
        { varName: '--bg-primary',   label: '主背景',    cssProp: 'bgPrimary',    defHex: '#1a1a2e', isBg: true },
        { varName: '--bg-secondary', label: '次背景',    cssProp: 'bgSecondary',  defHex: '#16213e', isBg: true },
        { varName: '--bg-nav',       label: '导航栏背景', cssProp: 'bgNav',       defHex: '#10101c', isBg: true },
        { varName: '--green',        label: '绿色（验证通过）', cssProp: 'green',  defHex: '#06d6a0' },
        { varName: '--red',          label: '红色（验证失败）', cssProp: 'red',    defHex: '#ef476f' },
    ];

    const DEFAULT_COLORS = {};
    colorDefs.forEach(d => { DEFAULT_COLORS[d.cssProp] = d.defHex; });

    // 仅从 localStorage 读取用户保存的颜色，不使用 getComputedStyle（避免模块执行时机问题导致读到空值）
    function _loadColorTheme() {
        try { return JSON.parse(localStorage.getItem('la_color_theme') || '{}'); }
        catch { return {}; }
    }

    function _saveColorTheme(colors) {
        try { localStorage.setItem('la_color_theme', JSON.stringify(colors)); } catch {}
    }

    function _applyColors(colors) {
        colorDefs.forEach(d => {
            const val = colors[d.cssProp];
            if (val) document.documentElement.style.setProperty(d.varName, val);
        });
        // 同步 Three.js 背景色
        const bgColor = colors.bgPrimary;
        if (bgColor) {
            scene.background = new THREE.Color(bgColor);
            scene.fog = new THREE.Fog(bgColor, 12, 30);
        }
    }

    function _getCurrentColor(cssProp) {
        // 优先返回用户保存的值，否则用默认值（不依赖 getComputedStyle）
        const saved = _loadColorTheme();
        return saved[cssProp] || DEFAULT_COLORS[cssProp];
    }

    // 恢复用户保存的颜色 — 仅当 localStorage 中有保存值时才覆盖 CSS 变量
    const savedColors = _loadColorTheme();
    colorDefs.forEach(d => {
        const val = savedColors[d.cssProp];
        if (val) document.documentElement.style.setProperty(d.varName, val);
    });

    // 应用 Three.js 背景色（scene 已就绪，无需延迟回调）
    const savedBg = savedColors.bgPrimary;
    if (savedBg) {
        scene.background = new THREE.Color(savedBg);
        scene.fog = new THREE.Fog(savedBg, 12, 30);
    }

    colorDefs.forEach(d => {
        const row = document.createElement('div');
        row.className = 'settings-color-row';

        const label = document.createElement('label');
        label.textContent = d.label;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = _getCurrentColor(d.cssProp);

        const hexSpan = document.createElement('span');
        hexSpan.className = 'color-hex';
        hexSpan.textContent = _getCurrentColor(d.cssProp);

        colorInput.addEventListener('input', () => {
            hexSpan.textContent = colorInput.value;
            const all = _loadColorTheme();
            all[d.cssProp] = colorInput.value;
            _saveColorTheme(all);
            _applyColors(all);
        });

        row.appendChild(label);
        row.appendChild(colorInput);
        row.appendChild(hexSpan);
        colorsBody.appendChild(row);
    });

    // ═══════════════════════════════════════════════════════
    // 5. 重置按钮
    // ═══════════════════════════════════════════════════════

    const resetRow = document.createElement('div');
    resetRow.className = 'settings-reset-row';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-reset-btn';
    resetBtn.textContent = '恢复默认设置';
    resetBtn.addEventListener('click', () => {
        // 重置网格（默认 ±5，10×10 格，每格=1单位）
        updateGridRenderer(5);
        _saveGridSettings(5);
        if (gridRangeSlider) {
            gridRangeSlider.value = 5;
            gridBody.querySelector('.settings-grid-value').textContent = '±5';
        }

        // 重置颜色（清除 localStorage 记录 + 移除所有 inline style 覆盖，回到 CSS :root 默认值）
        _saveColorTheme({});
        colorDefs.forEach(d => {
            document.documentElement.style.removeProperty(d.varName);
        });
        scene.background = new THREE.Color(DEFAULT_COLORS.bgPrimary);
        scene.fog = new THREE.Fog(DEFAULT_COLORS.bgPrimary, 12, 30);
        // 更新颜色选择器
        colorsBody.querySelectorAll('input[type="color"]').forEach((inp, i) => {
            inp.value = colorDefs[i].defHex;
            colorsBody.querySelectorAll('.color-hex')[i].textContent = colorDefs[i].defHex;
        });

        // 重置参数范围
        _saveParamRanges({});
        refreshParamRangeUI();

        // 重置面板可见性（先设值再保存，避免保存中间状态）
        panelList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
            _applyPanelVisibility(cb.dataset.panelId, true);
        });
        _savePanelVisibility();
    });
    resetRow.appendChild(resetBtn);
    menu.appendChild(resetRow);

    // ═══════════════════════════════════════════════════════
    // 6. 菜单交互：折叠/展开 + 打开/关闭
    // ═══════════════════════════════════════════════════════

    // 恢复折叠状态
    const savedCollapsed = (() => {
        try { return JSON.parse(localStorage.getItem('la_settings_collapsed') || '{}'); }
        catch { return {}; }
    })();

    // 初始折叠状态应用（默认全部折叠）
    menu.querySelectorAll('.settings-l1').forEach(l1 => {
        const section = l1.dataset.section;
        if (savedCollapsed[section] === false) {
            // 展开
            const container = menu.querySelector(`.settings-l2-container[data-section="${section}"]`);
            if (container) container.style.display = 'block';
            l1.classList.add('expanded');
        }
    });

    // 一级菜单折叠/展开（事件代理）
    menu.addEventListener('click', (e) => {
        const l1 = e.target.closest('.settings-l1');
        if (!l1) return;
        const section = l1.dataset.section;
        const container = menu.querySelector(`.settings-l2-container[data-section="${section}"]`);
        if (!container) return;

        const isExpanded = container.style.display !== 'none';
        if (isExpanded) {
            container.style.display = 'none';
            l1.classList.remove('expanded');
        } else {
            container.style.display = 'block';
            l1.classList.add('expanded');
        }
        // 持久化折叠状态
        const collapsed = {};
        menu.querySelectorAll('.settings-l2-container').forEach(c => {
            collapsed[c.dataset.section] = c.style.display === 'none';
        });
        try { localStorage.setItem('la_settings_collapsed', JSON.stringify(collapsed)); } catch {}
    });

    // 点击按钮切换菜单显示
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = menu.style.display !== 'none';
        menu.style.display = isVisible ? 'none' : 'block';
        // 打开菜单时刷新参数范围 UI（因为可能切换了场景）
        if (!isVisible) refreshParamRangeUI();
    });

    // 点击空白处关闭菜单
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== toggleBtn) {
            menu.style.display = 'none';
        }
    });
}
