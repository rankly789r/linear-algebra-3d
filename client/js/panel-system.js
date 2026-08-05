/**
 * 可拖拽停靠面板系统 — DockPanel / DockZone / PanelManager
 *
 * 纯 UI 模块，不依赖 Three.js 或任何场景逻辑。
 * 场景渲染器通过 PanelManager 获取面板引用并填充内容。
 */

// ─── DockPanel ────────────────────────────────────────────────

class DockPanel {
    /**
     * @param {{ id: string, title: string, collapsible?: boolean, defaultCollapsed?: boolean }} config
     */
    constructor({ id, title, collapsible = true, defaultCollapsed = false }) {
        this.id = id;
        this.title = title;
        this.collapsible = collapsible;
        this.collapsed = defaultCollapsed;
        this.zone = null;       // DockZone 引用
        this.el = null;         // .dock-panel 根元素
        this.body = null;       // .panel-body 内容区
        this._header = null;    // .panel-header
        this._collapseBtn = null;
        this._resizeHandleH = null;  // 底部手柄（调高度，始终存在）
        this._resizeHandleW = null;  // 右侧手柄（调宽度，仅横向区域显示）
        this._customSize = null;     // 用户拖拽设置的自定义尺寸 { width, height }
        this._snapFlashTimer = null;
    }

    /**
     * 创建 DOM 结构并返回根元素
     */
    createElement() {
        const el = document.createElement('div');
        el.className = 'dock-panel';
        el.dataset.panelId = this.id;

        // 面板头部（拖拽把手）
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.draggable = true;
        header.title = '拖拽移动 | 双击折叠';

        // 拖拽把手图标
        const grip = document.createElement('span');
        grip.className = 'panel-grip';
        grip.textContent = '⋮⋮';
        header.appendChild(grip);

        // 标题
        const titleSpan = document.createElement('span');
        titleSpan.className = 'panel-title';
        titleSpan.textContent = this.title;
        header.appendChild(titleSpan);

        // 折叠按钮
        if (this.collapsible) {
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'panel-collapse-btn';
            collapseBtn.title = '折叠/展开';
            collapseBtn.textContent = this.collapsed ? '▶' : '▼';
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
            header.appendChild(collapseBtn);
            this._collapseBtn = collapseBtn;
        }

        // 双击头部折叠
        header.addEventListener('dblclick', (e) => {
            e.preventDefault();
            this.toggle();
        });

        el.appendChild(header);
        this._header = header;

        // 面板内容区
        const body = document.createElement('div');
        body.className = 'panel-body';
        el.appendChild(body);
        this.body = body;

        // Resize 手柄：底部（调高度，所有面板都有）
        const resizeH = document.createElement('div');
        resizeH.className = 'panel-resize-handle panel-resize-vertical';
        resizeH.title = '拖拽调整高度';
        el.appendChild(resizeH);
        this._resizeHandleH = resizeH;
        this._bindResizeEvents(resizeH, 'height');

        // Resize 手柄：右侧（调宽度，仅横向区域显示）
        const resizeW = document.createElement('div');
        resizeW.className = 'panel-resize-handle panel-resize-horizontal';
        resizeW.title = '拖拽调整宽度';
        resizeW.style.display = 'none';  // 默认隐藏，进入横向区域时显示
        el.appendChild(resizeW);
        this._resizeHandleW = resizeW;
        this._bindResizeEvents(resizeW, 'width');

        // 恢复已保存的自定义尺寸
        this._restoreSize();

        // 初始状态
        if (this.collapsed) {
            el.classList.add('collapsed');
        }

        this.el = el;
        return el;
    }

    // ─── Resize 功能 ──────────────────────────────────────

    /**
     * 为手柄绑定拖拽 resize 事件
     * @param {HTMLElement} handle - resize 手柄 DOM 元素
     * @param {'width'|'height'} dimension - 调整的维度
     */
    _bindResizeEvents(handle, dimension) {
        if (!handle) return;

        let startX, startY, startSize;
        let resizing = false;

        const cursorMap = { width: 'ew-resize', height: 'ns-resize' };

        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            resizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startSize = dimension === 'width' ? this.el.offsetWidth : this.el.offsetHeight;
            this.el.classList.add('resizing');

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = cursorMap[dimension];
        };

        const onMouseMove = (e) => {
            if (!resizing) return;
            const delta = dimension === 'width'
                ? e.clientX - startX
                : e.clientY - startY;

            if (dimension === 'width') {
                let newWidth = Math.max(200, Math.min(800, startSize + delta));
                newWidth = this._applySnap(newWidth, 'width');
                this._customSize = { width: newWidth, height: this._customSize?.height || null };
                this.el.style.width = newWidth + 'px';
                this.el.style.minWidth = newWidth + 'px';
            } else {
                let newHeight = Math.max(60, startSize + delta);
                newHeight = this._applySnap(newHeight, 'height');
                const bodyMaxH = Math.max(60, newHeight - this._header.offsetHeight - 12);
                this._customSize = { width: this._customSize?.width || null, height: newHeight };
                this.el.style.height = newHeight + 'px';
                this.body.style.maxHeight = bodyMaxH + 'px';
            }
        };

        const onMouseUp = () => {
            if (!resizing) return;
            resizing = false;
            this.el.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';

            this._saveSize();
        };

        handle.addEventListener('mousedown', onMouseDown);
    }

    /**
     * 尺寸吸附：将当前尺寸吸附到相邻面板的对应尺寸
     * @param {number} currentSize - 当前像素值
     * @param {'width'|'height'} dimension - 吸附的维度
     * @returns {number} 吸附后的尺寸
     */
    _applySnap(currentSize, dimension) {
        if (!this.zone) return currentSize;
        const SNAP_THRESHOLD = 10; // 吸附阈值（像素）

        let bestSnap = null;
        let bestDist = Infinity;

        for (const sibling of this.zone.panels) {
            if (sibling === this || !sibling.el || sibling.el.style.display === 'none') continue;

            // 跳过已手动设置尺寸的兄弟面板（它们尺寸可能不同）
            const siblingSize = dimension === 'width'
                ? sibling.el.offsetWidth
                : sibling.el.offsetHeight;

            if (siblingSize <= 0) continue;

            const dist = Math.abs(currentSize - siblingSize);
            if (dist < SNAP_THRESHOLD && dist < bestDist) {
                bestDist = dist;
                bestSnap = siblingSize;
            }
        }

        if (bestSnap !== null) {
            // 吸附时短暂高亮
            this._flashSnapIndicator();
            return bestSnap;
        }
        return currentSize;
    }

    /** 吸附瞬间的视觉反馈 */
    _flashSnapIndicator() {
        if (this._snapFlashTimer) return; // 防抖
        this.el.style.transition = 'none';
        this.el.style.boxShadow = '0 0 0 2px rgba(76, 201, 240, 0.5)';
        this._snapFlashTimer = setTimeout(() => {
            this.el.style.boxShadow = '';
            this.el.style.transition = '';
            this._snapFlashTimer = null;
        }, 150);
    }

    _getResizeCursor() {
        const isHorizontal = this.zone && this.zone.orientation === 'horizontal';
        return isHorizontal ? 'ew-resize' : 'ns-resize';
    }

    _saveSize() {
        if (!this._customSize) return;
        try {
            const allSizes = JSON.parse(localStorage.getItem('la_panel_sizes') || '{}');
            allSizes[this.id] = this._customSize;
            localStorage.setItem('la_panel_sizes', JSON.stringify(allSizes));
        } catch (e) { /* ignore */ }
    }

    _restoreSize() {
        try {
            const allSizes = JSON.parse(localStorage.getItem('la_panel_sizes') || '{}');
            const saved = allSizes[this.id];
            if (saved) {
                this._customSize = saved;
                if (saved.width) {
                    this.el.style.width = saved.width + 'px';
                    this.el.style.minWidth = saved.width + 'px';
                }
                if (saved.height) {
                    this.el.style.height = saved.height + 'px';
                    const bodyMaxH = Math.max(60, saved.height - 36);
                    this.body.style.maxHeight = bodyMaxH + 'px';
                }
            }
        } catch (e) { /* ignore */ }
    }

    /** 根据所在 zone 的方向显示/隐藏手柄 */
    _updateResizeOrientation() {
        const isHorizontal = this.zone && this.zone.orientation === 'horizontal';
        // 底部手柄始终显示（所有区域都支持调高度）
        if (this._resizeHandleH) {
            this._resizeHandleH.style.display = '';
        }
        // 右侧手柄仅在横向区域显示（调宽度）
        if (this._resizeHandleW) {
            this._resizeHandleW.style.display = isHorizontal ? '' : 'none';
        }
    }

    /** 切换折叠/展开 */
    toggle() {
        if (this.collapsed) {
            this.expand();
        } else {
            this.collapse();
        }
        // 通知 PanelManager 保存状态
        if (typeof window !== 'undefined' && window.panelManager) {
            window.panelManager.saveLayout();
        }
    }

    collapse() {
        if (!this.collapsible || this.collapsed) return;
        this.collapsed = true;
        this.el.classList.add('collapsed');
        if (this._collapseBtn) this._collapseBtn.textContent = '▶';
    }

    expand() {
        if (!this.collapsible || !this.collapsed) return;
        this.collapsed = false;
        this.el.classList.remove('collapsed');
        if (this._collapseBtn) this._collapseBtn.textContent = '▼';
    }

    setCollapsed(val) {
        if (val) this.collapse();
        else this.expand();
    }

    show() {
        this.el.style.display = '';
    }

    hide() {
        this.el.style.display = 'none';
    }

    setTitle(text) {
        this.title = text;
        const titleEl = this._header?.querySelector('.panel-title');
        if (titleEl) titleEl.textContent = text;
    }
}


// ─── DockZone ──────────────────────────────────────────────────

class DockZone {
    /**
     * @param {{ id: string, element: HTMLElement, orientation?: 'vertical'|'horizontal' }} config
     */
    constructor({ id, element, orientation = 'vertical' }) {
        this.id = id;
        this.el = element;
        this.orientation = orientation;
        this.panels = [];           // DockPanel[]，按显示顺序
        this._indicator = null;     // 拖拽插入指示线
    }

    /** 在指定位置插入面板（index 省略则追加到末尾） */
    addPanel(panel, index) {
        if (panel.zone && panel.zone !== this) {
            panel.zone.removePanel(panel);
        }

        if (index === undefined || index >= this.panels.length) {
            this.panels.push(panel);
            this.el.appendChild(panel.el);
        } else {
            const clampedIndex = Math.max(0, index);
            this.panels.splice(clampedIndex, 0, panel);
            const refChild = this.el.children[clampedIndex];
            this.el.insertBefore(panel.el, refChild || null);
        }

        panel.zone = this;
        panel.el.style.display = '';  // 确保可见
        panel._updateResizeOrientation();  // 根据区域方向调整 resize 手柄
        // 如果面板 body 已有 data-orientation（由 matrix-display 设置），
        // 则更新它以匹配新区域方向，CSS 会自动重新排版
        if (panel.body && panel.body.dataset.orientation) {
            panel.body.dataset.orientation = this.orientation;
        }
        this._updateEmptyState();
    }

    /** 从区域中移除面板 */
    removePanel(panel) {
        const idx = this.panels.indexOf(panel);
        if (idx === -1) return;

        this.panels.splice(idx, 1);
        if (panel.el.parentElement === this.el) {
            this.el.removeChild(panel.el);
        }
        panel.zone = null;
        this._updateEmptyState();
    }

    getPanelIndex(panel) {
        return this.panels.indexOf(panel);
    }

    /** 区域内移动面板到新位置 */
    movePanel(panel, toIndex) {
        const fromIdx = this.panels.indexOf(panel);
        if (fromIdx === -1) return;

        this.panels.splice(fromIdx, 1);
        const clampedTo = Math.max(0, Math.min(toIndex, this.panels.length));
        this.panels.splice(clampedTo, 0, panel);

        // 移动 DOM
        const refChild = this.el.children[clampedTo];
        this.el.insertBefore(panel.el, refChild || null);
    }

    isEmpty() {
        return this.panels.length === 0;
    }

    _updateEmptyState() {
        if (this.isEmpty()) {
            this.el.classList.add('empty');
        } else {
            this.el.classList.remove('empty');
        }
    }

    // ─── 拖拽事件处理 ─────────────────────────────────────

    _onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.el.classList.add('drag-over');

        const index = this._getInsertionIndex(e);
        this._showInsertionIndicator(index);
    }

    _onDragLeave(e) {
        // 只在真正离开 zone 时清除
        if (!this.el.contains(e.relatedTarget)) {
            this.el.classList.remove('drag-over');
            this._clearInsertionIndicator();
        }
    }

    _onDrop(e) {
        e.preventDefault();
        this.el.classList.remove('drag-over');
        this._clearInsertionIndicator();

        const panelId = e.dataTransfer.getData('text/plain');
        if (!panelId) return;

        const index = this._getInsertionIndex(e);
        if (window.panelManager) {
            window.panelManager.movePanel(panelId, this.id, index);
        }
    }

    /** 根据鼠标位置计算面板应插入的索引 */
    _getInsertionIndex(e) {
        if (this.panels.length === 0) return 0;

        const isVertical = this.orientation === 'vertical';
        const mousePos = isVertical ? e.clientY : e.clientX;

        for (let i = 0; i < this.panels.length; i++) {
            const rect = this.panels[i].el.getBoundingClientRect();
            const mid = isVertical
                ? rect.top + rect.height / 2
                : rect.left + rect.width / 2;

            if (mousePos < mid) return i;
        }
        return this.panels.length;
    }

    /** 在指定位置显示插入指示线 */
    _showInsertionIndicator(index) {
        this._clearInsertionIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'insertion-indicator';
        indicator.style.cssText = this.orientation === 'vertical'
            ? 'height:3px;flex-shrink:0;'
            : 'width:3px;flex-shrink:0;';

        if (index >= this.panels.length) {
            this.el.appendChild(indicator);
        } else {
            const targetPanel = this.panels[index];
            this.el.insertBefore(indicator, targetPanel.el);
        }
        this._indicator = indicator;
    }

    _clearInsertionIndicator() {
        if (this._indicator) {
            this._indicator.remove();
            this._indicator = null;
        }
    }
}


// ─── PanelManager（单例）───────────────────────────────────────

class PanelManager {
    constructor() {
        /** @type {Map<string, DockZone>} */
        this.zones = new Map();
        /** @type {Map<string, DockPanel>} */
        this.panels = new Map();
        this._dragState = { panelId: null, sourceZoneId: null };
        this._saveTimer = null;
    }

    /**
     * 初始化面板系统
     * @param {{ zones: Array, panels: Array }} config
     */
    init({ zones, panels }) {
        // 1. 创建停靠区
        for (const zc of zones) {
            const zone = new DockZone({
                id: zc.id,
                element: zc.element,
                orientation: zc.orientation || 'vertical',
            });
            this.zones.set(zc.id, zone);

            // 绑定拖放事件
            zone.el.addEventListener('dragover', (e) => zone._onDragOver(e));
            zone.el.addEventListener('dragleave', (e) => zone._onDragLeave(e));
            zone.el.addEventListener('drop', (e) => zone._onDrop(e));
        }

        // 2. 尝试加载已保存的布局
        const savedLayout = this.loadLayout();

        // 3. 创建面板
        const layoutMap = savedLayout?.panels || {};
        for (const pc of panels) {
            const panel = new DockPanel({
                id: pc.id,
                title: pc.title,
                collapsible: pc.collapsible !== false,
                defaultCollapsed: pc.defaultCollapsed || false,
            });
            panel.createElement();
            this.panels.set(pc.id, panel);

            // 应用保存的折叠状态
            if (layoutMap[pc.id]?.collapsed) {
                panel.setCollapsed(true);
            }
        }

        // 4. 将面板放入区域
        // 先按 savedLayout 中的顺序放入
        if (savedLayout) {
            // 按区域分组排序
            const zoneOrderMap = {};
            for (const [panelId, info] of Object.entries(layoutMap)) {
                const zoneId = info.zone;
                if (!zoneOrderMap[zoneId]) zoneOrderMap[zoneId] = [];
                zoneOrderMap[zoneId].push({ panelId, order: info.order ?? 0 });
            }
            for (const [zoneId, items] of Object.entries(zoneOrderMap)) {
                items.sort((a, b) => a.order - b.order);
                const zone = this.zones.get(zoneId);
                if (!zone) continue;
                for (const item of items) {
                    const panel = this.panels.get(item.panelId);
                    if (panel) zone.addPanel(panel);
                }
            }
        }

        // 5. 把尚未放入任何区域的面板放入默认区域
        for (const pc of panels) {
            const panel = this.panels.get(pc.id);
            if (!panel) continue;
            if (panel.zone) continue; // 已在某个区域中

            const defaultZone = this.zones.get(pc.defaultZone || 'right');
            if (defaultZone) {
                defaultZone.addPanel(panel);
            } else {
                // 回退到第一个可用区域
                const firstZone = this.zones.values().next().value;
                if (firstZone) firstZone.addPanel(panel);
            }
        }

        // 6. 绑定全局拖拽事件
        this._bindDragEvents();
    }

    /** 获取面板 */
    getPanel(id) {
        return this.panels.get(id);
    }

    /** 获取区域 */
    getZone(id) {
        return this.zones.get(id);
    }

    /** 移动面板到指定区域 */
    movePanel(panelId, targetZoneId, index) {
        const panel = this.panels.get(panelId);
        const targetZone = this.zones.get(targetZoneId);
        if (!panel || !targetZone) return;

        // 如果目标区域就是当前区域，则是排序操作
        if (panel.zone === targetZone) {
            targetZone.movePanel(panel, index);
        } else {
            // 跨区域移动
            targetZone.addPanel(panel, index);
        }

        this.saveLayout();
    }

    /** 保存当前布局到 localStorage */
    saveLayout() {
        // 防抖 150ms
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._doSave(), 150);
    }

    _doSave() {
        const layout = { version: 1, panels: {} };
        for (const [id, panel] of this.panels) {
            layout.panels[id] = {
                zone: panel.zone?.id || 'right',
                order: panel.zone ? panel.zone.getPanelIndex(panel) : 0,
                collapsed: panel.collapsed,
            };
        }
        try {
            localStorage.setItem('la_panel_layout', JSON.stringify(layout));
        } catch (e) {
            // localStorage 不可用，静默忽略
        }
    }

    /** 从 localStorage 加载布局 */
    loadLayout() {
        try {
            const raw = localStorage.getItem('la_panel_layout');
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.version === 1 && data.panels) return data;
        } catch (e) {
            // 损坏的数据，忽略
        }
        return null;
    }

    /** 重置为默认布局 */
    resetLayout() {
        try {
            localStorage.removeItem('la_panel_layout');
        } catch (e) { /* ignore */ }
    }

    // ─── 全局拖拽事件 ─────────────────────────────────────

    _bindDragEvents() {
        for (const [id, panel] of this.panels) {
            const header = panel._header;
            if (!header) continue;

            header.addEventListener('dragstart', (e) => this._onDragStart(e, panel));
            header.addEventListener('dragend', (e) => this._onDragEnd(e, panel));
        }
    }

    _onDragStart(e, panel) {
        this._dragState.panelId = panel.id;
        this._dragState.sourceZoneId = panel.zone?.id || null;

        e.dataTransfer.setData('text/plain', panel.id);
        e.dataTransfer.effectAllowed = 'move';

        // 轻量拖拽影像
        const ghost = document.createElement('div');
        ghost.style.cssText = `
            position:fixed;top:-100px;left:-100px;
            padding:6px 14px;background:#0f3460;color:#4cc9f0;
            border:1px solid #4cc9f0;border-radius:4px;
            font-size:12px;white-space:nowrap;pointer-events:none;
        `;
        ghost.textContent = panel.title;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 80, 14);
        requestAnimationFrame(() => ghost.remove());

        panel.el.classList.add('dragging');
    }

    _onDragEnd(e, panel) {
        panel.el.classList.remove('dragging');
        this._dragState = { panelId: null, sourceZoneId: null };

        // 清除所有区域的拖拽指示
        for (const [_, zone] of this.zones) {
            zone.el.classList.remove('drag-over');
            zone._clearInsertionIndicator();
        }
    }
}


// ─── 导出单例 ──────────────────────────────────────────────────

export const panelManager = new PanelManager();
