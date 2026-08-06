/**
 * 主入口 — Three.js 场景初始化、相机控制、场景切换、面板系统。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeScene } from './api.js';
import { SceneRenderer } from './scene-base.js';
import { panelManager } from './panel-system.js';

// ─── 面板系统初始化 ──────────────────────────────────────

panelManager.init({
    zones: [
        { id: 'left',   element: document.getElementById('dock-left'),   orientation: 'vertical' },
        { id: 'right',  element: document.getElementById('dock-right'),  orientation: 'vertical' },
        { id: 'top',    element: document.getElementById('dock-top'),    orientation: 'horizontal' },
        { id: 'bottom', element: document.getElementById('dock-bottom'), orientation: 'horizontal' },
    ],
    panels: [
        { id: 'scenenav', title: '📐 场景目录', defaultZone: 'left',  collapsible: true, defaultCollapsed: false },
        { id: 'presets',  title: '📌 预设情形', defaultZone: 'right', collapsible: true, defaultCollapsed: false },
        { id: 'params',   title: '🎚 参数调节', defaultZone: 'right', collapsible: true, defaultCollapsed: false },
        { id: 'camera',   title: '📷 视角控制', defaultZone: 'right', collapsible: true, defaultCollapsed: false },
        { id: 'solution', title: '📊 分析结果', defaultZone: 'right', collapsible: true, defaultCollapsed: false },
        { id: 'lecture',  title: '📖 讲解',     defaultZone: 'right', collapsible: true, defaultCollapsed: false },
        { id: 'verify',   title: '🔍 数学验证', defaultZone: 'right', collapsible: true, defaultCollapsed: true },
        { id: 'matrix',   title: '📋 矩阵数据', defaultZone: 'top',   collapsible: true, defaultCollapsed: false },
    ],
});

// 暴露给 scene-base.js 使用
window.panelManager = panelManager;

// ─── 构建场景导航面板（一次性） ──────────────────────────

(function buildNavPanel() {
    const navPanel = panelManager.getPanel('scenenav');
    if (!navPanel) return;
    navPanel.body.innerHTML = `
        <input class="scene-search" placeholder="🔍 搜索场景..." autocomplete="off">
        <div class="menu-label">基础概念</div>
        <button class="scene-btn" data-scene="ch0_r0_matrix_columns">矩阵的列——线性变换的密码</button>
        <button class="scene-btn" data-scene="ch0_r1_column_decompose">逐列拆解——行与列的几何含义</button>

        <div class="menu-label">第1章 行列式</div>
        <button class="scene-btn" data-scene="ch1_r0_det_area">1.0 二阶行列式的几何意义</button>
        <button class="scene-btn" data-scene="ch1_r1_det_volume">1.1 三阶行列式与平行六面体</button>
        <button class="scene-btn" data-scene="ch1_r2_det_properties">1.2 行列式的性质</button>
        <button class="scene-btn" data-scene="ch1_r3_permutation">排列、对换与空间定向</button>

        <div class="menu-label">第2章 矩阵及其运算</div>
        <button class="scene-btn" data-scene="ch2_r0_matrix_multiply">2.0 矩阵乘法的几何含义</button>
        <button class="scene-btn" data-scene="ch2_r1_matrix_inverse">2.1 逆矩阵的几何含义</button>
        <button class="scene-btn" data-scene="ch2_r2_matrix_transpose">2.2 转置与对称矩阵</button>
        <button class="scene-btn" data-scene="ch2_r3_ax_eq_b">行视图与列视图</button>
        <button class="scene-btn" data-scene="ch2_r4_cramer">克拉默法则：解=体积比</button>

        <div class="menu-label">第3章 矩阵的秩与线性方程组</div>
        <div class="menu-label" style="font-size:0.7rem;opacity:0.7;margin-top:-6px;">秩的概念</div>
        <button class="scene-btn" data-scene="ch3_r0_rank_intuition">3.0 秩的直观理解</button>
        <button class="scene-btn" data-scene="ch3_r3_matrix_rank">3.3 矩阵的秩</button>
        <button class="scene-btn" data-scene="ch3_r8_rank_properties">3.8 秩的性质</button>

        <div class="menu-label" style="font-size:0.7rem;opacity:0.7;margin-top:2px;">向量与线性关系</div>
        <button class="scene-btn" data-scene="ch3_r1_two_vectors">3.1 两个向量的关系</button>
        <button class="scene-btn" data-scene="ch3_r2_three_vectors">3.2 三个向量与张成空间</button>

        <div class="menu-label" style="font-size:0.7rem;opacity:0.7;margin-top:2px;">线性方程组</div>
        <button class="scene-btn" data-scene="ch3_r4_2x2_system">3.4 2×2 方程组</button>
        <button class="scene-btn" data-scene="ch3_r5_3x3_system">3.5 3×3 方程组</button>
        <button class="scene-btn" data-scene="ch3_r6_homogeneous">3.6 齐次 vs 非齐次</button>
        <button class="scene-btn" data-scene="ch3_r7_rank_solution">3.7 秩与解的关系</button>

        <div class="menu-label" style="font-size:0.7rem;opacity:0.7;margin-top:2px;">初等变换</div>
        <button class="scene-btn" data-scene="ch3_r9_gaussian">高斯消元法的几何过程</button>
        <button class="scene-btn" data-scene="ch3_r12_elem_row">初等矩阵与行变换（左乘）</button>
        <button class="scene-btn" data-scene="ch3_r13_elem_col">初等矩阵与列变换（右乘）</button>

        <div class="menu-label">矩阵计算工具</div>
        <button class="scene-btn" data-scene="matrix_calculator">矩阵计算器</button>
    `;
})();

// ─── 场景搜索过滤 ────────────────────────────────────────

(function initSceneSearch() {
    const navPanel = panelManager.getPanel('scenenav');
    if (!navPanel) return;

    const input = navPanel.body.querySelector('.scene-search');
    if (!input) return;

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        const buttons = navPanel.body.querySelectorAll('.scene-btn');
        const labels = navPanel.body.querySelectorAll('.menu-label');

        buttons.forEach(btn => {
            const match = !query || btn.textContent.toLowerCase().includes(query);
            btn.style.display = match ? '' : 'none';
        });

        // 隐藏分组标签（如果该组下没有可见按钮）
        labels.forEach(label => {
            let next = label.nextElementSibling;
            let hasVisible = false;
            while (next && !next.classList.contains('menu-label')) {
                if (next.classList.contains('scene-btn') && next.style.display !== 'none') {
                    hasVisible = true;
                    break;
                }
                next = next.nextElementSibling;
            }
            label.style.display = hasVisible || !query ? '' : 'none';
        });
    });

    // Ctrl+K / Ctrl+F 聚焦搜索框
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
            if (e.key === 'f' && document.activeElement?.tagName === 'INPUT') return;
            e.preventDefault();
            input.focus();
            input.select();
        }
    });
})();

// ─── 键盘快捷键 ──────────────────────────────────────────

let currentSceneName = null;

(function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 忽略输入框内的按键（但放行 Escape 和特定组合键）
        const tag = document.activeElement?.tagName;
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

        // 获取当前可见的场景按钮列表（考虑搜索过滤）
        const getVisibleButtons = () => {
            const all = document.querySelectorAll('.scene-btn');
            return Array.from(all).filter(b => b.style.display !== 'none');
        };

        // R — 重置相机（总是触发）
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            animateCamera([7, -7, 5], [0, 0, 0]);
            return;
        }

        // Space — 重播动画（仅在非输入框时触发）
        if (e.key === ' ' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const btn = document.querySelector('.anim-replay-btn');
            if (btn) btn.click();
            return;
        }

        // 以下快捷键在输入框内不触发
        if (isInput) return;

        // 1~5 — 快速切换预设
        if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const idx = parseInt(e.key) - 1;
            const panel = panelManager.getPanel('presets');
            if (panel) {
                const btns = panel.body.querySelectorAll('.preset-btn');
                if (btns[idx]) btns[idx].click();
            }
            return;
        }

        // [ / ] — 上下一个场景（跨章）
        if ((e.key === '[' || e.key === ']') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const visible = getVisibleButtons();
            if (visible.length === 0) return;
            const current = visible.findIndex(b => b.classList.contains('active'));
            const nextIdx = e.key === ']'
                ? (current + 1) % visible.length
                : (current - 1 + visible.length) % visible.length;
            const target = visible[nextIdx];
            if (target) switchScene(target.dataset.scene);
            return;
        }

        // ↑ / ↓ — 在同组场景内上下导航，Enter 加载
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const visible = getVisibleButtons();
            if (visible.length === 0) return;
            // 取消当前高亮
            visible.forEach(b => b.classList.remove('kb-hover'));
            const currentIdx = visible.findIndex(b => b.classList.contains('active'));
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            const nextIdx = ((currentIdx >= 0 ? currentIdx : 0) + delta + visible.length) % visible.length;
            visible[nextIdx].classList.add('kb-hover');
            visible[nextIdx].scrollIntoView({ block: 'nearest' });
            return;
        }

        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const hovered = document.querySelector('.scene-btn.kb-hover');
            if (hovered) switchScene(hovered.dataset.scene);
            return;
        }

        // Escape — 清除键盘高亮
        if (e.key === 'Escape') {
            document.querySelectorAll('.scene-btn.kb-hover').forEach(b => b.classList.remove('kb-hover'));
            return;
        }
    });
})();

// ─── 构建相机面板内容（一次性） ──────────────────────────

(function buildCameraPanel() {
    const camPanel = panelManager.getPanel('camera');
    if (!camPanel) return;

    camPanel.body.innerHTML = `
        <div class="camera-btns">
            <button class="cam-btn" data-view="default">默认 3D</button>
            <button class="cam-btn" data-view="top">俯视 XY</button>
            <button class="cam-btn" data-view="front">正视 XZ</button>
            <button class="cam-btn" data-view="side">正视 YZ</button>
        </div>
        <div class="camera-btns" style="margin-top:6px;">
            <button class="cam-btn axis-toggle-btn" id="axis-toggle" title="显示/隐藏坐标轴">👁 隐藏坐标轴</button>
        </div>
    `;
})();

// ─── 面板显示管理菜单 ────────────────────────────────────

(function initPanelVisibilityMenu() {
    const toggleBtn = document.getElementById('panel-vis-toggle');
    const menu = document.getElementById('panel-vis-menu');
    const list = document.getElementById('panel-vis-list');
    if (!toggleBtn || !menu || !list) return;

    // 可管理的面板列表（id → 显示名）
    const panelDefs = [
        { id: 'scenenav', label: '📐 场景目录' },
        { id: 'presets',  label: '📌 预设情形' },
        { id: 'params',   label: '🎚 参数调节' },
        { id: 'camera',   label: '📷 视角控制' },
        { id: 'solution', label: '📊 分析结果' },
        { id: 'lecture',  label: '📖 讲解' },
        { id: 'verify',   label: '🔍 数学验证' },
        { id: 'matrix',   label: '📋 矩阵数据' },
    ];

    // 恢复保存的状态
    const saved = _loadPanelVisibility();

    // 构建菜单项
    panelDefs.forEach(def => {
        const row = document.createElement('div');
        row.className = 'panel-vis-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = saved[def.id] !== false; // 默认全部显示
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
            if (e.target !== cb) {
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            }
        });
        list.appendChild(row);

        // 应用初始状态
        _applyPanelVisibility(def.id, cb.checked);
    });

    // 点击按钮切换菜单显示
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    // 点击空白处关闭菜单
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== toggleBtn) {
            menu.style.display = 'none';
        }
    });

    function _loadPanelVisibility() {
        try {
            return JSON.parse(localStorage.getItem('la_panel_visibility') || '{}');
        } catch {
            return {};
        }
    }

    function _savePanelVisibility() {
        const state = {};
        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            state[cb.dataset.panelId] = cb.checked;
        });
        localStorage.setItem('la_panel_visibility', JSON.stringify(state));
    }

    function _applyPanelVisibility(panelId, visible) {
        const panel = panelManager.getPanel(panelId);
        if (!panel) return;
        panel._userHidden = !visible;
        if (visible) {
            panel.show();
        } else {
            panel.hide();
        }
    }
})();

// ─── 场景渲染器注册 ──────────────────────────────────────

import { TwoVectorsRenderer } from './renderers/ch3_r1_two_vectors.js';
import { TwoByTwoSystemRenderer } from './renderers/ch3_r4_2x2_system.js';
import { ThreeVectorsRenderer } from './renderers/ch3_r2_three_vectors.js';
import { ThreeByThreeSystemRenderer } from './renderers/ch3_r5_3x3_system.js';
import { RankIntuitionRenderer } from './renderers/ch3_r0_rank_intuition.js';
import { MatrixRankRenderer } from './renderers/ch3_r3_matrix_rank.js';
import { HomogeneousRenderer } from './renderers/ch3_r6_homogeneous.js';
import { RankSolutionRenderer } from './renderers/ch3_r7_rank_solution.js';
import { RankPropertiesRenderer } from './renderers/ch3_r8_rank_properties.js';
import { MatrixCalculatorRenderer } from './renderers/matrix_calculator.js';
import { MatrixColumnsRenderer } from './renderers/ch0_r0_matrix_columns.js';
import { ColumnDecomposeRenderer } from './renderers/ch0_r1_column_decompose.js';
import { DetAreaRenderer } from './renderers/ch1_r0_det_area.js';
import { DetVolumeRenderer } from './renderers/ch1_r1_det_volume.js';
import { DetPropertiesRenderer } from './renderers/ch1_r2_det_properties.js';
import { MatrixMultiplyRenderer } from './renderers/ch2_r0_matrix_multiply.js';
import { MatrixInverseRenderer } from './renderers/ch2_r1_matrix_inverse.js';
import { MatrixTransposeRenderer } from './renderers/ch2_r2_matrix_transpose.js';
import { Ch3R12ElemRowRenderer } from './renderers/ch3_r12_elem_row.js';
import { Ch3R13ElemColRenderer } from './renderers/ch3_r13_elem_col.js';
import { Ch2R3AxEqBRenderer } from './renderers/ch2_r3_ax_eq_b.js';
import { Ch2R4CramerRenderer } from './renderers/ch2_r4_cramer.js';
import { Ch3R9GaussianRenderer } from './renderers/ch3_r9_gaussian.js';
import { Ch1R3PermutationRenderer } from './renderers/ch1_r3_permutation.js';

const SCENE_RENDERERS = {
    'ch0_r0_matrix_columns': MatrixColumnsRenderer,
    'ch0_r1_column_decompose': ColumnDecomposeRenderer,
    'ch3_r1_two_vectors': TwoVectorsRenderer,
    'ch3_r4_2x2_system': TwoByTwoSystemRenderer,
    'ch3_r2_three_vectors': ThreeVectorsRenderer,
    'ch3_r5_3x3_system': ThreeByThreeSystemRenderer,
    'ch3_r0_rank_intuition': RankIntuitionRenderer,
    'ch3_r3_matrix_rank': MatrixRankRenderer,
    'ch3_r6_homogeneous': HomogeneousRenderer,
    'ch3_r7_rank_solution': RankSolutionRenderer,
    'ch3_r8_rank_properties': RankPropertiesRenderer,
    'matrix_calculator': MatrixCalculatorRenderer,
    'ch1_r0_det_area': DetAreaRenderer,
    'ch1_r1_det_volume': DetVolumeRenderer,
    'ch1_r2_det_properties': DetPropertiesRenderer,
    'ch1_r3_permutation': Ch1R3PermutationRenderer,
    'ch2_r0_matrix_multiply': MatrixMultiplyRenderer,
    'ch2_r1_matrix_inverse': MatrixInverseRenderer,
    'ch2_r2_matrix_transpose': MatrixTransposeRenderer,
    'ch2_r3_ax_eq_b': Ch2R3AxEqBRenderer,
    'ch2_r4_cramer': Ch2R4CramerRenderer,
    'ch3_r12_elem_row': Ch3R12ElemRowRenderer,
    'ch3_r13_elem_col': Ch3R13ElemColRenderer,
    'ch3_r9_gaussian': Ch3R9GaussianRenderer,
};

// ─── Three.js 初始化 ─────────────────────────────────────

const canvas = document.getElementById('three-canvas');
const viewer = document.getElementById('viewer');

// WebGL 可用性检测：不支持时显示友好提示而非白屏
const hasWebGL = (() => {
    try {
        const testCanvas = document.createElement('canvas');
        return !!(testCanvas.getContext('webgl2') || testCanvas.getContext('webgl'));
    } catch (e) { return false; }
})();
if (!hasWebGL) {
    document.getElementById('loading-overlay').style.display = 'none';
    viewer.insertAdjacentHTML('afterbegin',
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#ef476f;z-index:100;">' +
        '<p style="font-size:1.2rem;margin-bottom:8px;">⚠️ 您的浏览器不支持 WebGL</p>' +
        '<p style="font-size:0.85rem;color:#a0a0b8;">请使用最新版 Chrome、Edge 或 Firefox 打开</p>' +
        '</div>');
    throw new Error('WebGL not available');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
viewer.addEventListener('contextmenu', e => e.preventDefault());
viewer.addEventListener('mousedown', e => { if (e.button === 2) e.preventDefault(); });
viewer.addEventListener('mouseup', e => { if (e.button === 2) e.preventDefault(); });
viewer.addEventListener('auxclick', e => { if (e.button === 2) e.preventDefault(); });
document.addEventListener('wheel', e => {
    // 面板内部的滚轮放行，让面板滚动条正常工作
    if (e.target.closest('.panel-body')) return;
    // 3D 视图区域的滚轮交给 OrbitControls 处理缩放
    if (e.target.closest('#viewer')) e.preventDefault();
}, { passive: false });

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 12, 30);

const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 50);
camera.up.set(0, 0, 1);  // Z轴向上
camera.position.set(7, -7, 5);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0.5);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.5;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.85;
controls.update();

// ─── 基础场景元素 ────────────────────────────────────────

scene.add(new THREE.AmbientLight(0x404060, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 坐标轴（放入命名组，支持显隐切换）
const axisGroup = new THREE.Group();
axisGroup.name = 'coordinateAxes';
axisGroup.add(createAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(6, 0, 0), 0xff4444, 'X'));
axisGroup.add(createAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 6, 0), 0x44ff44, 'Y'));
axisGroup.add(createAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 6), 0x4488ff, 'Z'));
scene.add(axisGroup);

// XY 参考网格（Z轴向上，地面为XY平面）
// renderOrder=-1 + depthWrite=false：网格先渲染但不写入深度缓冲，
// 避免与用户绘制的图形产生 z-fighting 闪烁
const grid = new THREE.GridHelper(10, 10, 0x333355, 0x222240);
grid.rotation.x = -Math.PI / 2;
grid.renderOrder = -1;
grid.material.depthWrite = false;
scene.add(grid);

const originDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
scene.add(originDot);

// ─── 画布尺寸 ────────────────────────────────────────────

function resize() {
    const rect = viewer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    renderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ─── 动画循环（页面不可见时暂停渲染） ──

let currentSceneRenderer = null;
let animFrameId = null;
let animRunning = true;

function animate() {
    if (!animRunning) return;
    animFrameId = requestAnimationFrame(animate);
    resize();  // 每帧同步 canvas 尺寸，确保 CSS transition 期间平滑跟随
    controls.update();
    renderer.render(scene, camera);
}

function startAnimation() {
    if (animRunning) return;
    animRunning = true;
    animate();
}

function stopAnimation() {
    animRunning = false;
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

// 页面可见性变化时自动暂停/恢复渲染
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAnimation();
    } else {
        startAnimation();
    }
});

animate();

// ─── 坐标轴工具函数 ──────────────────────────────────────

function createAxis(start, end, color, label) {
    const group = new THREE.Group();
    const dir = end.clone().sub(start);
    const len = dir.length();
    const mid = start.clone().add(dir.clone().multiplyScalar(0.5));
    const dirNorm = dir.normalize();

    const cylGeom = new THREE.CylinderGeometry(0.03, 0.03, len, 8);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
    const cyl = new THREE.Mesh(cylGeom, mat);
    cyl.position.copy(mid);
    const axisY = new THREE.Vector3(0, 1, 0);
    cyl.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(axisY, dirNorm));
    group.add(cyl);

    const coneGeom = new THREE.ConeGeometry(0.08, 0.2, 8);
    const cone = new THREE.Mesh(coneGeom, mat);
    cone.position.copy(end);
    cone.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(axisY, dirNorm));
    group.add(cone);

    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 32, 32);
    const texture = new THREE.CanvasTexture(cv);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.position.copy(end.clone().add(dirNorm.clone().multiplyScalar(0.4)));
    sprite.scale.set(0.6, 0.6, 1);
    group.add(sprite);

    return group;
}

// ─── 相机动画 ────────────────────────────────────────────

function animateCamera(targetPos, targetLookAt) {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = new THREE.Vector3(...targetPos);
    const endTarget = new THREE.Vector3(...targetLookAt);
    const duration = 800;
    const startTime = performance.now();

    function anim(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1.0);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startTarget, endTarget, ease);
        controls.update();
        if (t < 1) requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);
}

// ─── 坐标轴显隐 ──────────────────────────────────────────

let axesVisible = true;
function toggleAxes() {
    axesVisible = !axesVisible;
    axisGroup.visible = axesVisible;
    const btn = document.getElementById('axis-toggle');
    if (btn) {
        btn.textContent = axesVisible ? '👁 隐藏坐标轴' : '👁 显示坐标轴';
        btn.style.opacity = axesVisible ? '1' : '0.6';
    }
}

// ─── 侧栏折叠 ────────────────────────────────────────────

function initSidebarToggle() {
    const leftCol = document.getElementById('left-column');
    const rightCol = document.getElementById('right-column');
    const toggleLeft = document.getElementById('toggle-left');
    const toggleRight = document.getElementById('toggle-right');

    // 从 localStorage 恢复折叠状态
    const saved = (() => {
        try { return JSON.parse(localStorage.getItem('la_sidebar_collapsed') || '{}'); }
        catch (e) { return {}; }
    })();

    function setCollapsed(col, btn, collapsed, arrowClosed, arrowOpen) {
        if (collapsed) {
            col.classList.add('collapsed');
            btn.textContent = arrowClosed;
            btn.title = '展开' + (col === leftCol ? '左栏' : '右栏');
        } else {
            col.classList.remove('collapsed');
            btn.textContent = arrowOpen;
            btn.title = '收起' + (col === leftCol ? '左栏' : '右栏');
        }
    }

    // 初始状态：左栏 ◀ 收起时变 ▶，右栏 ▶ 收起时变 ◀
    setCollapsed(leftCol, toggleLeft, !!saved.left, '▶', '◀');
    setCollapsed(rightCol, toggleRight, !!saved.right, '◀', '▶');

    function save() {
        try {
            localStorage.setItem('la_sidebar_collapsed', JSON.stringify({
                left: leftCol.classList.contains('collapsed'),
                right: rightCol.classList.contains('collapsed'),
            }));
        } catch (e) { /* ignore */ }
    }

    toggleLeft.addEventListener('click', () => {
        const collapsed = leftCol.classList.toggle('collapsed');
        setCollapsed(leftCol, toggleLeft, collapsed, '▶', '◀');
        save();
    });

    toggleRight.addEventListener('click', () => {
        const collapsed = rightCol.classList.toggle('collapsed');
        setCollapsed(rightCol, toggleRight, collapsed, '◀', '▶');
        save();
    });
}

initSidebarToggle();

// ─── 全局事件代理：相机按钮 + 坐标轴切换 ──────────────────

document.addEventListener('click', (e) => {
    // 相机视角按钮
    const camBtn = e.target.closest('.cam-btn[data-view]');
    if (camBtn) {
        const view = camBtn.dataset.view;
        const camPresets = {
            'default': { pos: [7, -7, 5], target: [0, 0, 0] },
            'top':     { pos: [0, 0, 10], target: [0, 0, 0] },
            'front':   { pos: [0, -10, 0], target: [0, 0, 0] },
            'side':    { pos: [10, 0, 0],  target: [0, 0, 0] },
        };
        const preset = camPresets[view];
        if (preset) animateCamera(preset.pos, preset.target);
        return;
    }

    // 坐标轴切换按钮
    if (e.target.closest('#axis-toggle')) {
        toggleAxes();
        return;
    }
});

// ─── 场景切换 ────────────────────────────────────────────

const sceneButtons = document.querySelectorAll('.scene-btn');

// ─── 面包屑导航 ────────────────────────────────────────────

function getBreadcrumb(sceneName) {
    const sections = {
        ch3_r0: '秩的概念', ch3_r3: '秩的概念', ch3_r8: '秩的概念',
        ch3_r1: '向量与线性关系', ch3_r2: '向量与线性关系',
        ch3_r4: '线性方程组', ch3_r5: '线性方程组', ch3_r6: '线性方程组', ch3_r7: '线性方程组',
        ch3_r9: '初等变换', ch3_r12: '初等变换', ch3_r13: '初等变换',
    };
    const chapters = {
        ch0: '基础概念', ch1: '第1章 行列式', ch2: '第2章 矩阵及其运算',
        ch3: '第3章 矩阵的秩与线性方程组',
    };

    if (sceneName === 'matrix_calculator') return '工具 › 矩阵计算器';

    const prefix = sceneName.substring(0, 2); // ch0, ch1, ch2, ch3
    const chapter = chapters[prefix] || '';
    // 匹配 ch3_r0 这种路由前缀
    const sectionKey = Object.keys(sections).find(k => sceneName.startsWith(k));
    const section = sectionKey ? sections[sectionKey] : '';

    if (chapter && section) return `${chapter} › ${section}`;
    if (chapter) return chapter;
    return '';
}

function updateBreadcrumb(sceneName) {
    const el = document.getElementById('scene-breadcrumb');
    if (!el) return;
    const bc = getBreadcrumb(sceneName);
    el.textContent = bc;
    el.style.display = bc ? '' : 'none';
}

async function switchScene(sceneName) {
    currentSceneName = sceneName;
    // 高亮当前菜单
    sceneButtons.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.scene-btn.kb-hover').forEach(b => b.classList.remove('kb-hover'));
    const btn = document.querySelector(`[data-scene="${sceneName}"]`);
    if (btn) btn.classList.add('active');

    // 销毁当前场景
    if (currentSceneRenderer) {
        currentSceneRenderer.destroy();
    }

    // 显示加载
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('error-overlay').style.display = 'none';

    try {
        const meta = getSceneMeta(sceneName);
        updateBreadcrumb(sceneName);

        const RendererClass = SCENE_RENDERERS[sceneName];
        if (RendererClass) {
            currentSceneRenderer = new RendererClass(meta, scene, camera, renderer);
        } else {
            currentSceneRenderer = new SceneRenderer(meta, scene, camera, renderer);
        }

        currentSceneRenderer.buildUI();
        await currentSceneRenderer.initialRender();

        localStorage.setItem('la_current_scene', sceneName);

    } catch (err) {
        console.error('场景切换失败:', err);
        const errorOverlay = document.getElementById('error-overlay');
        document.getElementById('error-message').textContent = `场景加载失败: ${err.message}`;
        errorOverlay.setAttribute('data-retry-scene', sceneName);
        errorOverlay.style.display = 'block';
        // 确保重试/关闭按钮已绑定（首次绑定，后续跳过）
        if (!errorOverlay._switchSceneRetryBound) {
            errorOverlay._switchSceneRetryBound = true;
            document.getElementById('error-retry-btn')?.addEventListener('click', () => {
                const retryScene = errorOverlay.getAttribute('data-retry-scene');
                if (retryScene) {
                    errorOverlay.style.display = 'none';
                    switchScene(retryScene);
                }
            });
            document.getElementById('error-close-btn')?.addEventListener('click', () => {
                errorOverlay.style.display = 'none';
            });
        }
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// ─── 场景元信息 ──────────────────────────────────────────

function getSceneMeta(sceneName) {
    const metas = {
        'ch3_r0_rank_intuition': {
            id: 'ch3_r0_rank_intuition',
            title: '3.0 秩的直观理解',
            description: '矩阵作为一个线性变换，观察它如何把空间中的向量"压扁"到更低维度。秩就是变换后空间的维数。',
            params: {
                a11: { label: 'a₁₁', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a31: { label: 'a₃₁', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a32: { label: 'a₃₂', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
            },
            presets: [
                { label: '秩=2（满秩）', type: 'unique', params: { a11: 1, a12: 0, a21: 0, a22: 1, a31: 0, a32: 0 } },
                { label: '秩=1（压到一条线）', type: 'degenerate', params: { a11: 1, a12: 2, a21: 1, a22: 2, a31: 1, a32: 2 } },
                { label: '秩=0（零矩阵）', type: 'none', params: { a11: 0, a12: 0, a21: 0, a22: 0, a31: 0, a32: 0 } },
            ]
        },
        'ch3_r1_two_vectors': {
            id: 'ch3_r1_two_vectors',
            title: '3.1 两个向量的关系',
            description: '观察两个向量。若共线则线性相关（一个可被另一个表示），不共线则线性无关。',
            params: {
                v1x: { label: 'v₁ x', type: 'float', default: 2, min: -10, max: 10, step: 0.1 },
                v1y: { label: 'v₁ y', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v1z: { label: 'v₁ z', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v2x: { label: 'v₂ x', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v2y: { label: 'v₂ y', type: 'float', default: 3, min: -10, max: 10, step: 0.1 },
                v2z: { label: 'v₂ z', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
            },
            presets: [
                { label: '线性无关', type: 'unique', params: { v1x: 2, v1y: 0, v1z: 0, v2x: 0, v2y: 3, v2z: 0 } },
                { label: '线性相关（共线）', type: 'degenerate', params: { v1x: 2, v1y: 0, v1z: 0, v2x: 4, v2y: 0, v2z: 0 } },
                { label: '反向共线', type: 'degenerate', params: { v1x: 2, v1y: 0, v1z: 0, v2x: -3, v2y: 0, v2z: 0 } },
                { label: '三维不共面', type: 'unique', params: { v1x: 2, v1y: 1, v1z: 0, v2x: 0, v2y: 2, v2z: 1 } },
            ]
        },
        'ch3_r2_three_vectors': {
            id: 'ch3_r2_three_vectors',
            title: '3.2 三个向量与张成空间',
            description: '三个向量能否张成整个 R³？若不共面则张成三维空间，若共面则只张成一个平面。',
            params: {
                v1x: { label: 'v₁ x', type: 'float', default: 2, min: -10, max: 10, step: 0.1 },
                v1y: { label: 'v₁ y', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v1z: { label: 'v₁ z', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v2x: { label: 'v₂ x', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v2y: { label: 'v₂ y', type: 'float', default: 3, min: -10, max: 10, step: 0.1 },
                v2z: { label: 'v₂ z', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v3x: { label: 'v₃ x', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v3y: { label: 'v₃ y', type: 'float', default: 0, min: -10, max: 10, step: 0.1 },
                v3z: { label: 'v₃ z', type: 'float', default: 3, min: -10, max: 10, step: 0.1 },
            },
            presets: [
                { label: '张成 R³（无关）', type: 'unique', params: { v1x: 2, v1y: 0, v1z: 0, v2x: 0, v2y: 3, v2z: 0, v3x: 0, v3y: 0, v3z: 3 } },
                { label: '共面（秩=2）', type: 'degenerate', params: { v1x: 2, v1y: 0, v1z: 0, v2x: 0, v2y: 3, v2z: 0, v3x: 2, v3y: 3, v3z: 0 } },
                { label: '共线（秩=1）', type: 'none', params: { v1x: 2, v1y: 0, v1z: 0, v2x: 4, v2y: 0, v2z: 0, v3x: -2, v3y: 0, v3z: 0 } },
            ]
        },
        'ch3_r3_matrix_rank': {
            id: 'ch3_r3_matrix_rank',
            title: '3.3 矩阵的秩',
            description: '输入一个 3×3 矩阵，观察它将单位立方体变换成什么形状。秩决定了变换后形状的"真实维数"。',
            params: {
                a11: { label: 'a₁₁', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a13: { label: 'a₁₃', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a23: { label: 'a₂₃', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a31: { label: 'a₃₁', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a32: { label: 'a₃₂', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a33: { label: 'a₃₃', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
            },
            presets: [
                { label: 'r=3（满秩）', type: 'unique', params: { a11:1,a12:0,a13:0, a21:0,a22:1,a23:0, a31:0,a32:0,a33:1 } },
                { label: 'r=2（压成面）', type: 'degenerate', params: { a11:1,a12:0,a13:0, a21:0,a22:1,a23:0, a31:1,a32:1,a33:0 } },
                { label: 'r=1（压成线）', type: 'none', params: { a11:1,a12:2,a13:3, a21:1,a22:2,a23:3, a31:1,a32:2,a33:3 } },
                { label: 'r(A)=r(Aᵀ)验证', type: 'unique', params: { a11:1,a12:2,a13:0, a21:3,a22:1,a23:4, a31:0,a32:0,a33:0 } },
            ]
        },
        'ch3_r4_2x2_system': {
            id: 'ch3_r4_2x2_system',
            title: '3.4 2×2 线性方程组',
            description: '两个未知数，两个方程——在平面上就是两条直线。它们可能交于一点（唯一解）、平行（无解）、或重合（无穷解）。',
            params: {
                a1: { label: 'a₁', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
                b1: { label: 'b₁', type: 'float', default: -1, min: -5, max: 5, step: 0.1 },
                c1: { label: 'c₁', type: 'float', default: 1, min: -10, max: 10, step: 0.1 },
                a2: { label: 'a₂', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                b2: { label: 'b₂', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                c2: { label: 'c₂', type: 'float', default: 3, min: -10, max: 10, step: 0.1 },
            },
            presets: [
                { label: '唯一解', type: 'unique', params: { a1: 2, b1: -1, c1: 1, a2: 1, b2: 1, c2: 3 } },
                { label: '无解（平行）', type: 'none', params: { a1: 1, b1: 1, c1: 2, a2: 1, b2: 1, c2: 5 } },
                { label: '无穷解（重合）', type: 'infinite', params: { a1: 1, b1: 1, c1: 2, a2: 2, b2: 2, c2: 4 } },
                { label: '垂直相交', type: 'unique', params: { a1: 1, b1: 0, c1: 2, a2: 0, b2: 1, c2: 3 } },
            ]
        },
        'ch3_r5_3x3_system': {
            id: 'ch3_r5_3x3_system',
            title: '3.5 3×3 线性方程组',
            description: '三个未知数，三个方程——在空间中就是三个平面。它们可能交于一点、一线、一面，或没有公共交点。',
            params: {
                a11:{label:'a₁₁',type:'float',default:1,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a13:{label:'a₁₃',type:'float',default:0,min:-5,max:5,step:0.1},
                b1:{label:'b₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:1,min:-5,max:5,step:0.1},
                a23:{label:'a₂₃',type:'float',default:0,min:-5,max:5,step:0.1},
                b2:{label:'b₂',type:'float',default:2,min:-5,max:5,step:0.1},
                a31:{label:'a₃₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a32:{label:'a₃₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a33:{label:'a₃₃',type:'float',default:1,min:-5,max:5,step:0.1},
                b3:{label:'b₃',type:'float',default:2,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: '唯一解（一点）', type: 'unique', params: { a11:1,a12:0,a13:0,b1:2, a21:0,a22:1,a23:0,b2:2, a31:0,a32:0,a33:1,b3:2 } },
                { label: '无穷解（一线）', type: 'infinite', params: { a11:1,a12:0,a13:0,b1:2, a21:0,a22:1,a23:0,b2:2, a31:1,a32:1,a33:0,b3:4 } },
                { label: '无解（三柱不相交）', type: 'none', params: { a11:1,a12:0,a13:0,b1:2, a21:0,a22:1,a23:0,b2:2, a31:1,a32:1,a33:0,b3:0 } },
                { label: '无解（平行平面）', type: 'none', params: { a11:1,a12:1,a13:1,b1:2, a21:1,a22:1,a23:1,b2:5, a31:0,a32:0,a33:1,b3:2 } },
            ]
        },
        'ch3_r6_homogeneous': {
            id: 'ch3_r6_homogeneous',
            title: '3.6 齐次 vs 非齐次方程组',
            description: '齐次方程组 Ax=0 的解空间是穿过原点的子空间。非齐次方程组 Ax=b 的解（如果存在）是这个子空间的平移。',
            params: {
                a11:{label:'a₁₁',type:'float',default:1,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:1,min:-5,max:5,step:0.1},
                a13:{label:'a₁₃',type:'float',default:1,min:-5,max:5,step:0.1},
                b1:{label:'b₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:1,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:-1,min:-5,max:5,step:0.1},
                a23:{label:'a₂₃',type:'float',default:0,min:-5,max:5,step:0.1},
                b2:{label:'b₂',type:'float',default:0,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: 'r(A)=2, 齐次→点', type: 'unique', params: { a11:1,a12:1,a13:1,b1:0, a21:1,a22:-1,a23:0,b2:0 } },
                { label: 'r(A)=1, 齐次→面', type: 'infinite', params: { a11:1,a12:1,a13:1,b1:0, a21:2,a22:2,a23:2,b2:0 } },
                { label: '非齐次有解→平移', type: 'unique', params: { a11:1,a12:1,a13:1,b1:2, a21:1,a22:-1,a23:0,b2:0 } },
                { label: '非齐次无解', type: 'none', params: { a11:1,a12:1,a13:1,b1:2, a21:2,a22:2,a23:2,b2:5 } },
            ]
        },
        'ch3_r7_rank_solution': {
            id: 'ch3_r7_rank_solution',
            title: '3.7 秩与解的关系',
            description: 'r(A) vs r(A|b) 的几何含义。当 r(A)=r(A|b) 时有解，r(A)<r(A|b) 时无解。',
            params: {
                a11:{label:'a₁₁',type:'float',default:1,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:1,min:-5,max:5,step:0.1},
                a13:{label:'a₁₃',type:'float',default:0,min:-5,max:5,step:0.1},
                b1:{label:'b₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:1,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:-1,min:-5,max:5,step:0.1},
                a23:{label:'a₂₃',type:'float',default:1,min:-5,max:5,step:0.1},
                b2:{label:'b₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a31:{label:'a₃₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a32:{label:'a₃₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a33:{label:'a₃₃',type:'float',default:1,min:-5,max:5,step:0.1},
                b3:{label:'b₃',type:'float',default:2,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: 'r(A)=r(A|b)=3 唯一解', type: 'unique', params: { a11:1,a12:0,a13:0,b1:2, a21:0,a22:1,a23:0,b2:2, a31:0,a32:0,a33:1,b3:2 } },
                { label: 'r(A)=r(A|b)=2 无穷解', type: 'infinite', params: { a11:1,a12:1,a13:0,b1:2, a21:1,a22:-1,a23:0,b2:0, a31:0,a32:0,a33:0,b3:0 } },
                { label: 'r(A)=2 < r(A|b)=3 无解', type: 'none', params: { a11:1,a12:0,a13:0,b1:2, a21:0,a22:1,a23:0,b2:2, a31:1,a32:1,a33:0,b3:5 } },
            ]
        },
        'ch3_r8_rank_properties': {
            id: 'ch3_r8_rank_properties',
            title: '3.8 秩的性质可视化',
            description: '可视化验证秩的性质：r(A)=r(Aᵀ)、r(AB)≤min(r(A),r(B)) 等。',
            params: {
                a11:{label:'a₁₁',type:'float',default:1,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:2,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:3,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:1,min:-5,max:5,step:0.1},
                a31:{label:'a₃₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a32:{label:'a₃₂',type:'float',default:0,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: 'r(A)=r(Aᵀ)', type: 'unique', params: { a11:1,a12:2, a21:3,a22:1, a31:0,a32:0 } },
                { label: 'r(AB)≤min(r(A),r(B))', type: 'unique', params: { a11:1,a12:0, a21:0,a22:1, a31:0,a32:0 } },
                { label: 'AB=0矩阵', type: 'degenerate', params: { a11:1,a12:0, a21:0,a22:0, a31:0,a32:0 } },
            ]
        },

        'ch0_r0_matrix_columns': {
            id: 'ch0_r0_matrix_columns',
            title: '矩阵的列——线性变换的密码',
            description: '矩阵的每一列，就是对应标准基向量变换后的坐标。看到 e₁→第1列、e₂→第2列，你就看懂了矩阵。',
            params: {
                mode: { label: '变换维度', type: 'choice', default: '2x2', options: ['2x2', '3x3'] },
                a11: { label: 'a₁₁ (列1.x)', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂ (列2.x)', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁ (列1.y)', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂ (列2.y)', type: 'float', default: 3, min: -5, max: 5, step: 0.1 },
                a13: { label: 'a₁₃ (列3.x)', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a23: { label: 'a₂₃ (列3.y)', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a31: { label: 'a₃₁ (列1.z)', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a32: { label: 'a₃₂ (列2.z)', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a33: { label: 'a₃₃ (列3.z)', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
            },
            presets: [
                { label: '2×2 恒等变换', type: 'unique', params: { mode:'2x2', a11:1,a12:0,a21:0,a22:1 } },
                { label: '2×2 旋转 90°', type: 'unique', params: { mode:'2x2', a11:0,a12:-1,a21:1,a22:0 } },
                { label: '2×2 剪切变换', type: 'unique', params: { mode:'2x2', a11:1,a12:1.5,a21:0,a22:1 } },
                { label: '2×2 降维（秩=1）', type: 'degenerate', params: { mode:'2x2', a11:1,a12:2,a21:1,a22:2 } },
                { label: '3×3 恒等变换', type: 'unique', params: { mode:'3x3', a11:1,a12:0,a13:0, a21:0,a22:1,a23:0, a31:0,a32:0,a33:1 } },
                { label: '3×3 各向拉伸', type: 'unique', params: { mode:'3x3', a11:2,a12:0,a13:0, a21:0,a22:1.5,a23:0, a31:0,a32:0,a33:3 } },
                { label: '3×3 降维（秩=2）', type: 'degenerate', params: { mode:'3x3', a11:1,a12:0,a13:0, a21:0,a22:1,a23:0, a31:1,a32:1,a33:0 } },
            ]
        },

        'ch0_r1_column_decompose': {
            id: 'ch0_r1_column_decompose',
            title: '逐列拆解——行与列的几何含义',
            description: '把矩阵拆成列：第1列只响应x坐标，第2列只响应y坐标，两者叠加就是完整变换。红色=仅列1，绿色=仅列2，蓝色=完整。',
            params: {
                mode: { label: '显示模式', type: 'choice', default: 'compare', options: ['compare', 'full', 'col1_only', 'col2_only'] },
                a11: { label: 'a₁₁ (列1.x)', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂ (列2.x)', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁ (列1.y)', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂ (列2.y)', type: 'float', default: 3, min: -5, max: 5, step: 0.1 },
            },
            presets: [
                { label: '标准拉伸', type: 'unique', params: { mode:'compare', a11:2,a12:0,a21:0,a22:3 } },
                { label: '剪切变换', type: 'unique', params: { mode:'compare', a11:1,a12:1.5,a21:0,a22:1 } },
                { label: '旋转 90°', type: 'unique', params: { mode:'compare', a11:0,a12:-1,a21:1,a22:0 } },
                { label: '秩=1（列成比例）', type: 'degenerate', params: { mode:'compare', a11:1,a12:2,a21:1,a22:2 } },
            ]
        },

        'ch1_r0_det_area': {
            id: 'ch1_r0_det_area',
            title: '1.0 二阶行列式的几何意义',
            description: '2×2 行列式的几何含义：两个列向量张成的平行四边形的（有向）面积。',
            params: {
                a11: { label: 'a₁₁', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂', type: 'float', default: 3, min: -5, max: 5, step: 0.1 },
            },
            presets: [
                { label: '标准矩形（逆时针）', type: 'unique', params: { a11:2,a12:0,a21:0,a22:3 } },
                { label: '倾斜平行四边形', type: 'unique', params: { a11:3,a12:1,a21:1,a22:2 } },
                { label: '顺时针（det<0）', type: 'degenerate', params: { a11:1,a12:3,a21:2,a22:0 } },
                { label: '共线（det=0）', type: 'none', params: { a11:2,a12:4,a21:1,a22:2 } },
            ]
        },

        'ch1_r1_det_volume': {
            id: 'ch1_r1_det_volume',
            title: '1.1 三阶行列式与平行六面体',
            description: '3×3 行列式的几何含义：三个列向量张成的平行六面体的（有向）体积。',
            params: {
                a11:{label:'a₁₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a13:{label:'a₁₃',type:'float',default:0,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:2,min:-5,max:5,step:0.1},
                a23:{label:'a₂₃',type:'float',default:0,min:-5,max:5,step:0.1},
                a31:{label:'a₃₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a32:{label:'a₃₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a33:{label:'a₃₃',type:'float',default:2,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: '单位立方体（det=1）', type: 'unique', params: { a11:1,a12:0,a13:0, a21:0,a22:1,a23:0, a31:0,a32:0,a33:1 } },
                { label: '拉伸（det=6）', type: 'unique', params: { a11:2,a12:0,a13:0, a21:0,a22:3,a23:0, a31:0,a32:0,a33:1 } },
                { label: '共面（det=0）', type: 'none', params: { a11:1,a12:0,a13:0, a21:0,a22:1,a23:0, a31:1,a32:1,a33:0 } },
                { label: '左手系（det<0）', type: 'degenerate', params: { a11:2,a12:0,a13:0, a21:0,a22:1,a23:0, a31:0,a32:0,a33:-2 } },
            ]
        },

        'ch1_r2_det_properties': {
            id: 'ch1_r2_det_properties',
            title: '1.2 行列式的性质',
            description: '可视化验证行列式的核心性质：行交换变号、倍乘缩放、倍加不变、det(Aᵀ)=det(A) 等。',
            params: {
                property: { label: '行列式性质', type: 'choice', default: 'swap_rows', options: ['swap_rows','scale_row','add_row','transpose','scalar_multiply'] },
                a11:{label:'a₁₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a13:{label:'a₁₃',type:'float',default:0,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:2,min:-5,max:5,step:0.1},
                a23:{label:'a₂₃',type:'float',default:0,min:-5,max:5,step:0.1},
                a31:{label:'a₃₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a32:{label:'a₃₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a33:{label:'a₃₃',type:'float',default:3,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: '交换行（变号）', type: 'unique', params: { property:'swap_rows', a11:2,a12:0,a13:0, a21:0,a22:3,a23:0, a31:0,a32:0,a33:1 } },
                { label: '倍乘（det×3）', type: 'unique', params: { property:'scale_row', a11:2,a12:0,a13:0, a21:0,a22:1,a23:0, a31:0,a32:0,a33:1 } },
                { label: '倍加不变', type: 'unique', params: { property:'add_row', a11:2,a12:1,a13:0, a21:0,a22:3,a23:0, a31:0,a32:0,a33:1 } },
                { label: 'det(Aᵀ)=det(A)', type: 'unique', params: { property:'transpose', a11:2,a12:1,a13:0, a21:0,a22:3,a23:1, a31:0,a32:0,a33:2 } },
            ]
        },

        'ch2_r0_matrix_multiply': {
            id: 'ch2_r0_matrix_multiply',
            title: '2.0 矩阵乘法的几何含义',
            description: '矩阵乘法代表线性变换的复合：C=AB 意味着先做 B 变换，再做 A 变换。',
            params: {
                a11:{label:'A a₁₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a12:{label:'A a₁₂',type:'float',default:-1,min:-5,max:5,step:0.1},
                a21:{label:'A a₂₁',type:'float',default:1,min:-5,max:5,step:0.1},
                a22:{label:'A a₂₂',type:'float',default:0,min:-5,max:5,step:0.1},
                b11:{label:'B b₁₁',type:'float',default:2,min:-5,max:5,step:0.1},
                b12:{label:'B b₁₂',type:'float',default:0,min:-5,max:5,step:0.1},
                b21:{label:'B b₂₁',type:'float',default:0,min:-5,max:5,step:0.1},
                b22:{label:'B b₂₂',type:'float',default:1,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: '旋转复合', type: 'unique', params: { a11:0,a12:-1,a21:1,a22:0, b11:1,b12:0,b21:0,b22:2 } },
                { label: 'AB ≠ BA', type: 'unique', params: { a11:1,a12:2,a21:0,a22:1, b11:1,b12:0,b21:1,b22:1 } },
                { label: '投影×旋转', type: 'degenerate', params: { a11:1,a12:0,a21:0,a22:0, b11:0,b12:-1,b21:1,b22:0 } },
            ]
        },

        'ch2_r1_matrix_inverse': {
            id: 'ch2_r1_matrix_inverse',
            title: '2.1 逆矩阵的几何含义',
            description: '逆矩阵 A⁻¹ 代表 A 变换的逆向操作。det(A)=0 时无法逆转。',
            params: {
                a11:{label:'a₁₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:0,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:0,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:1,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: '缩放（可逆）', type: 'unique', params: { a11:2,a12:0,a21:0,a22:0.5 } },
                { label: '旋转（可逆）', type: 'unique', params: { a11:0,a12:-1,a21:1,a22:0 } },
                { label: '投影（不可逆）', type: 'none', params: { a11:1,a12:0,a21:0,a22:0 } },
                { label: '一般可逆矩阵', type: 'unique', params: { a11:1,a12:2,a21:3,a22:4 } },
            ]
        },

        'ch2_r2_matrix_transpose': {
            id: 'ch2_r2_matrix_transpose',
            title: '2.2 转置与对称矩阵',
            description: '转置 Aᵀ 的几何本质：⟨Av, w⟩ = ⟨v, Aᵀw⟩。验证对称/正交/反对称矩阵的特性。',
            params: {
                a11:{label:'a₁₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:1,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:-1,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:3,min:-5,max:5,step:0.1},
            },
            presets: [
                { label: '对称矩阵 A=Aᵀ', type: 'unique', params: { a11:2,a12:1,a21:1,a22:3 } },
                { label: '正交矩阵 Aᵀ=A⁻¹', type: 'unique', params: { a11:0,a12:-1,a21:1,a22:0 } },
                { label: '非对称一般矩阵', type: 'unique', params: { a11:2,a12:3,a21:-1,a22:1 } },
                { label: '反对称 Aᵀ=-A', type: 'degenerate', params: { a11:0,a12:2,a21:-2,a22:0 } },
            ]
        },

        'matrix_calculator': {
            id: 'matrix_calculator',
            title: '矩阵计算器',
            description: '输入矩阵，选择运算类型（乘法、求逆、伴随、转置、行列式），实时计算并显示结果。',
            params: {
                operation: { label: '运算类型', type: 'choice', default: 'multiply', options: ['multiply', 'inverse', 'adjoint', 'transpose', 'determinant'] },
                A_rows: { label: '矩阵 A 行数', type: 'int', default: 2, min: 1, max: 5, step: 1 },
                A_cols: { label: '矩阵 A 列数', type: 'int', default: 2, min: 1, max: 5, step: 1 },
                B_rows: { label: '矩阵 B 行数', type: 'int', default: 2, min: 1, max: 5, step: 1 },
                B_cols: { label: '矩阵 B 列数', type: 'int', default: 2, min: 1, max: 5, step: 1 },
                matrix_A: { label: '矩阵 A', type: 'matrix', rows: 2, cols: 2, default: [[1, 0], [0, 1]] },
                matrix_B: { label: '矩阵 B', type: 'matrix', rows: 2, cols: 2, default: [[1, 0], [0, 1]] },
            },
            presets: [
                { label: '2×2 乘法', type: 'unique', params: { operation:'multiply', A_rows:2,A_cols:2, B_rows:2,B_cols:2, matrix_A:[[2,1],[0,3]], matrix_B:[[1,0],[2,4]] } },
                { label: '3×3 求逆', type: 'unique', params: { operation:'inverse', A_rows:3,A_cols:3, matrix_A:[[1,2,0],[0,1,1],[1,0,1]] } },
                { label: '非方阵乘法', type: 'unique', params: { operation:'multiply', A_rows:2,A_cols:3, B_rows:3,B_cols:2, matrix_A:[[1,0,2],[0,3,1]], matrix_B:[[1,0],[2,1],[0,3]] } },
                { label: '奇异矩阵（不可逆）', type: 'none', params: { operation:'inverse', A_rows:2,A_cols:2, matrix_A:[[1,2],[2,4]] } },
                { label: '行列式计算', type: 'unique', params: { operation:'determinant', A_rows:3,A_cols:3, matrix_A:[[2,1,0],[1,3,1],[0,1,2]] } },
            ]
        },
        'ch1_r3_permutation': {
            id: 'ch1_r3_permutation',
            title: '排列、对换与空间定向',
            description: '为什么交换两行行列式变号？一次对换=空间翻转=定向反转。观察平行四边形翻转前后det符号变化。',
            params: {
                a11: { label: 'a₁₁', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁', type: 'float', default: 0, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂', type: 'float', default: 3, min: -5, max: 5, step: 0.1 },
            },
            presets: [
                { label: '对换翻转定向（det变号）', type: 'unique', params: { a11:2,a12:1,a21:0,a22:3 } },
                { label: '两列反向（det<0）', type: 'unique', params: { a11:1,a12:3,a21:2,a22:1 } },
                { label: '两列共线（det=0）', type: 'degenerate', params: { a11:2,a12:4,a21:1,a22:2 } },
            ]
        },
        'ch2_r4_cramer': {
            id: 'ch2_r4_cramer',
            title: '克拉默法则：解=体积比',
            description: '克拉默法则的几何：三个平行四边形并排，面积比=解。x₁=面积(A₁)/面积(A), x₂=面积(A₂)/面积(A)。',
            params: {
                a11: { label: 'a₁₁', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂', type: 'float', default: 3, min: -5, max: 5, step: 0.1 },
                b1: { label: 'b₁', type: 'float', default: 4, min: -10, max: 10, step: 0.1 },
                b2: { label: 'b₂', type: 'float', default: 6, min: -10, max: 10, step: 0.1 },
            },
            presets: [
                { label: '标准案例', type: 'unique', params: { a11:2,a12:1,a21:1,a22:3,b1:4,b2:6 } },
                { label: 'b 与 a₁ 同方向', type: 'unique', params: { a11:2,a12:1,a21:1,a22:3,b1:4,b2:2 } },
                { label: '正交基（面积=1）', type: 'unique', params: { a11:1,a12:0,a21:0,a22:1,b1:2,b2:3 } },
                { label: 'det(A)=0（不可用）', type: 'none', params: { a11:1,a12:2,a21:2,a22:4,b1:3,b2:6 } },
            ]
        },
        'ch2_r3_ax_eq_b': {
            id: 'ch2_r3_ax_eq_b',
            title: '行视图与列视图',
            description: 'Ax=b 的两种视角：行视图（直线的交点=解）vs 列视图（b=列向量的线性组合）。双重视角并排对比。',
            params: {
                a11: { label: 'a₁₁', type: 'float', default: 2, min: -5, max: 5, step: 0.1 },
                a12: { label: 'a₁₂', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a21: { label: 'a₂₁', type: 'float', default: 1, min: -5, max: 5, step: 0.1 },
                a22: { label: 'a₂₂', type: 'float', default: 3, min: -5, max: 5, step: 0.1 },
                b1: { label: 'b₁', type: 'float', default: 4, min: -10, max: 10, step: 0.1 },
                b2: { label: 'b₂', type: 'float', default: 6, min: -10, max: 10, step: 0.1 },
            },
            presets: [
                { label: '唯一解', type: 'unique', params: { a11:2,a12:1,a21:1,a22:3,b1:4,b2:6 } },
                { label: '无解（平行线）', type: 'none', params: { a11:1,a12:1,a21:1,a22:1,b1:2,b2:5 } },
                { label: '无穷解（重合线）', type: 'infinite', params: { a11:1,a12:1,a21:2,a22:2,b1:2,b2:4 } },
                { label: '垂直相交', type: 'unique', params: { a11:1,a12:0,a21:0,a22:1,b1:2,b2:3 } },
                { label: '列向量共线（奇异）', type: 'degenerate', params: { a11:2,a12:4,a21:1,a22:2,b1:6,b2:3 } },
            ]
        },
        'ch3_r9_gaussian': {
            id: 'ch3_r9_gaussian',
            title: '高斯消元法的几何过程',
            description: '消元=旋转平面到最简位置，保持交点不变。并排对比消元前后的三平面系统。',
            params: {
                a11:{label:'a₁₁',type:'float',default:2,min:-5,max:5,step:0.1},
                a12:{label:'a₁₂',type:'float',default:1,min:-5,max:5,step:0.1},
                a13:{label:'a₁₃',type:'float',default:-1,min:-5,max:5,step:0.1},
                a21:{label:'a₂₁',type:'float',default:-3,min:-5,max:5,step:0.1},
                a22:{label:'a₂₂',type:'float',default:-1,min:-5,max:5,step:0.1},
                a23:{label:'a₂₃',type:'float',default:2,min:-5,max:5,step:0.1},
                a31:{label:'a₃₁',type:'float',default:-2,min:-5,max:5,step:0.1},
                a32:{label:'a₃₂',type:'float',default:1,min:-5,max:5,step:0.1},
                a33:{label:'a₃₃',type:'float',default:2,min:-5,max:5,step:0.1},
                b1:{label:'b₁',type:'float',default:1,min:-10,max:10,step:0.1},
                b2:{label:'b₂',type:'float',default:6,min:-10,max:10,step:0.1},
                b3:{label:'b₃',type:'float',default:6,min:-10,max:10,step:0.1},
            },
            presets: [
                { label: '典型3×3方程组', type: 'unique', params: { a11:2,a12:1,a13:-1,a21:-3,a22:-1,a23:2,a31:-2,a32:1,a33:2,b1:1,b2:6,b3:6 } },
                { label: '唯一解（简单）', type: 'unique', params: { a11:1,a12:1,a13:1,a21:0,a22:1,a23:1,a31:0,a32:0,a33:1,b1:6,b2:3,b3:1 } },
                { label: '无解', type: 'none', params: { a11:1,a12:1,a13:1,a21:1,a22:1,a23:1,a31:1,a32:1,a33:1,b1:1,b2:2,b3:3 } },
            ]
        },
        'ch3_r12_elem_row': {
            id: 'ch3_r12_elem_row',
            title: '初等矩阵与行变换（左乘）',
            description: '左乘初等矩阵 = 行变换。观察三种初等矩阵（交换/倍乘/倍加）对 3D 形状的几何效果。',
            params: {
                dim: { label: '矩阵维度', type: 'choice', default: 3, options: [2, 3] },
                elem_type: { label: '初等变换类型', type: 'choice', default: 'swap', options: ['swap', 'scale', 'add'] },
                i: { label: '行索引 i（0-based）', type: 'int', default: 0, min: 0, max: 2, step: 1 },
                j: { label: '行索引 j（0-based）', type: 'int', default: 1, min: 0, max: 2, step: 1 },
                k: { label: '倍数 k', type: 'float', default: 2.0, min: -5.0, max: 5.0, step: 0.1 },
                matrix_A: { label: '矩阵 A', type: 'matrix', rows: 3, cols: 3, default: [[1,0,0],[0,1,0],[0,0,1]] },
            },
            presets: [
                { label: '交换前两行（翻转）', type: 'unique', params: { dim:3, elem_type:'swap', i:0, j:1, k:1, matrix_A:[[1,0,0],[0,1,0],[0,0,1]] } },
                { label: '第0行×2（拉伸）', type: 'unique', params: { dim:3, elem_type:'scale', i:0, j:0, k:2, matrix_A:[[1,0,0],[0,1,0],[0,0,1]] } },
                { label: '第1行+第0行×1.5（剪切）', type: 'unique', params: { dim:3, elem_type:'add', i:1, j:0, k:1.5, matrix_A:[[1,0,0],[0,1,0],[0,0,1]] } },
                { label: '2×2 行交换', type: 'unique', params: { dim:2, elem_type:'swap', i:0, j:1, matrix_A:[[2,1],[0,3]] } },
                { label: '2×2 剪切', type: 'unique', params: { dim:2, elem_type:'add', i:1, j:0, k:1, matrix_A:[[2,1],[0,3]] } },
            ]
        },
        'ch3_r13_elem_col': {
            id: 'ch3_r13_elem_col',
            title: '初等矩阵与列变换（右乘）',
            description: '右乘初等矩阵 = 列变换。对比左乘和右乘对 3D 形状的不同效果。右乘改变定义域的坐标（基的选择）。',
            params: {
                dim: { label: '矩阵维度', type: 'choice', default: 3, options: [2, 3] },
                elem_type: { label: '初等变换类型', type: 'choice', default: 'swap', options: ['swap', 'scale', 'add'] },
                i: { label: '列索引 i（0-based）', type: 'int', default: 0, min: 0, max: 2, step: 1 },
                j: { label: '列索引 j（0-based）', type: 'int', default: 1, min: 0, max: 2, step: 1 },
                k: { label: '倍数 k', type: 'float', default: 2.0, min: -5.0, max: 5.0, step: 0.1 },
                matrix_A: { label: '矩阵 A', type: 'matrix', rows: 3, cols: 3, default: [[1,0,0],[0,2,0],[0,0,1]] },
            },
            presets: [
                { label: '交换前两列（翻转）', type: 'unique', params: { dim:3, elem_type:'swap', i:0, j:1, matrix_A:[[1,0,0],[0,2,0],[0,0,1]] } },
                { label: '第0列×2（拉伸）', type: 'unique', params: { dim:3, elem_type:'scale', i:0, k:2, matrix_A:[[1,0,0],[0,2,0],[0,0,1]] } },
                { label: '第1列+第0列×1.5（剪切）', type: 'unique', params: { dim:3, elem_type:'add', i:1, j:0, k:1.5, matrix_A:[[1,0,0],[0,2,0],[0,0,1]] } },
                { label: '2×2 列交换', type: 'unique', params: { dim:2, elem_type:'swap', i:0, j:1, matrix_A:[[2,1],[0,3]] } },
            ]
        },
    };
    return metas[sceneName] || { id: sceneName, title: sceneName, description: '', params: {}, presets: [] };
}

// ─── 场景按钮事件 ────────────────────────────────────────

sceneButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const sceneName = btn.dataset.scene;
        if (sceneName) switchScene(sceneName);
    });
});

// ─── 自动恢复 ────────────────────────────────────────────

const restoreScene = document.documentElement.dataset.restoreScene;
if (restoreScene) {
    switchScene(restoreScene);
} else {
    switchScene('ch3_r1_two_vectors');
}
