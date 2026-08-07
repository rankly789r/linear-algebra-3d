/**
 * 场景渲染器：逐列拆解——行与列的几何含义
 *
 * 动画展示：
 *   1. 基向量箭头从 e₁/e₂ 滑翔到变换后的 col₁/col₂
 *   2. 单位正方形变形为三种变换结果（列1单独 / 列2单独 / 完整）
 *   3. compare 模式下三个形状并排，虚线连接表示加法关系
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { createUpdatableWireframe, createUpdatableFaces, createAnimatableArrow, EDGES_QUAD, FACES_QUAD } from '../draw-utils.js';

const COL_COLORS = {
    col1: 0xff6b6b,   // 红色 —— 第 1 列
    col2: 0x4ecdc4,   // 青色 —— 第 2 列
    full: 0x4488ff,   // 蓝色 —— 完整变换
    ghost: 0x556677,  // 灰色 —— 原始形状
};


// ═══════════════════════════════════════════════════════════
// 场景渲染器
// ═══════════════════════════════════════════════════════════

export class ColumnDecomposeRenderer extends SceneRenderer {

    buildScene(data) {
        const d = data.scene_data;
        const mode = d.mode;

        // 清除上一次遗留的动画定时器
        if (this._animTimeout) {
            clearTimeout(this._animTimeout);
            this._animTimeout = null;
        }
        this._animating = false;
        this._animT = 0;  // 动画进度 0→1

        // ─── 偏移量（compare 模式时并排显示） ──────────────
        let offsetCol1 = 0, offsetCol2 = 0, offsetFull = 0;
        if (mode === 'compare') {
            offsetCol1 = -3.5;
            offsetCol2 = 3.5;
            offsetFull = 0;
        }

        const offsetVerts = (verts, dx) =>
            verts.map(v => [v[0] + dx, v[1], v[2]]);

        // ─── 可见性判断 ──────────────────────────────────
        const showCol1 = mode === 'compare' || mode === 'col1_only';
        const showCol2 = mode === 'compare' || mode === 'col2_only';
        const showFull = mode === 'compare' || mode === 'full';
        const showOriginal = mode !== 'compare';

        // ─── 原始正方形（计算偏移后版本） ────────────────
        const origAtOffset = (dx) => offsetVerts(d.shape_original, dx);
        const col1Target = offsetVerts(d.shape_col1, offsetCol1);
        const col2Target = offsetVerts(d.shape_col2, offsetCol2);
        const fullTarget = offsetVerts(d.shape_full, offsetFull);

        // ─── 保存动画数据 ────────────────────────────────
        this._animData = {
            arrows: [],
            shapes: [],
            dashedLines: null,
            mode,
            offsets: { offsetCol1, offsetCol2, offsetFull },
        };

        // ─── 原始基向量箭头（灰色半透明 ghost） ──────────
        const ghostColors = [0x555566, 0x555566];
        const ghostLabels = ['e₁', 'e₂'];
        const ghostPositions = [[1, 0, 0], [0, 1, 0]];

        this._ghostArrows = [];
        ghostPositions.forEach((pos, i) => {
            const arrow = createAnimatableArrow([...pos], ghostColors[i], ghostLabels[i]);
            // 替换为 ghost 材质（draw-utils 箭头为 Line + Sphere）
            arrow.children[0].material = new THREE.LineBasicMaterial({
                color: 0x555566, transparent: true, opacity: 0.4,
            });
            arrow.children[1].material = new THREE.MeshStandardMaterial({
                color: 0x555566, emissive: 0x333344, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.4,
            });
            this.sceneObjects.add(arrow);
            this._ghostArrows.push(arrow);
        });

        // ─── 动画箭头：列 1 和列 2 ──────────────────────
        const arrowColors = [COL_COLORS.col1, COL_COLORS.col2];
        const arrowLabels = ['col₁ = Ae₁', 'col₂ = Ae₂'];
        const arrowStarts = [[1, 0, 0], [0, 1, 0]];

        d.columns.forEach((colInfo, i) => {
            const arrow = createAnimatableArrow([...arrowStarts[i]], arrowColors[i], arrowLabels[i]);
            this.sceneObjects.add(arrow);
            this._animData.arrows.push({
                arrow,
                start: arrowStarts[i],
                end: colInfo.end,
            });
        });

        // ─── 原始形状 ghost（非 compare 模式） ────────────
        if (showOriginal) {
            const ghostWire = createUpdatableWireframe(
                d.shape_original, EDGES_QUAD, COL_COLORS.ghost, 0.45
            );
            this.sceneObjects.add(ghostWire);
        }

        // ─── 可动形状（线框 + 面） ──────────────────────
        // 每个形状在 t=0 时显示为单位正方形（在对应偏移位置），t=1 时到达目标

        if (showCol1) {
            const orig = origAtOffset(offsetCol1);
            const wire = createUpdatableWireframe(orig, EDGES_QUAD, COL_COLORS.col1, 1.0);
            const face = createUpdatableFaces(orig, FACES_QUAD, COL_COLORS.col1, 0.12);
            this.sceneObjects.add(wire);
            this.sceneObjects.add(face);
            this._animData.shapes.push({ wire, face, original: orig, target: col1Target });

            // 标签（显示在目标位置）
            this._addLabel(col1Target, COL_COLORS.col1, '仅第1列', offsetCol1);
        }

        if (showCol2) {
            const orig = origAtOffset(offsetCol2);
            const wire = createUpdatableWireframe(orig, EDGES_QUAD, COL_COLORS.col2, 1.0);
            const face = createUpdatableFaces(orig, FACES_QUAD, COL_COLORS.col2, 0.12);
            this.sceneObjects.add(wire);
            this.sceneObjects.add(face);
            this._animData.shapes.push({ wire, face, original: orig, target: col2Target });

            this._addLabel(col2Target, COL_COLORS.col2, '仅第2列', offsetCol2);
        }

        if (showFull) {
            const orig = origAtOffset(offsetFull);
            const wire = createUpdatableWireframe(orig, EDGES_QUAD, COL_COLORS.full, 1.0);
            const face = createUpdatableFaces(orig, FACES_QUAD, COL_COLORS.full, 0.15);
            this.sceneObjects.add(wire);
            this.sceneObjects.add(face);
            this._animData.shapes.push({ wire, face, original: orig, target: fullTarget });

            this._addLabel(fullTarget, COL_COLORS.full, '完整 = ⊕', offsetFull);
        }

        // ─── compare 模式虚线连接（动画结束后才显示） ────
        if (mode === 'compare') {
            const dashGroup = new THREE.Group();
            const dashMat = (color) => new THREE.LineDashedMaterial({
                color, dashSize: 0.4, gapSize: 0.25, transparent: true, opacity: 0,
            });

            // col1 → full 虚线
            for (let i = 0; i < 4; i++) {
                const pts = [
                    new THREE.Vector3(...col1Target[i]),
                    new THREE.Vector3(...fullTarget[i]),
                ];
                const geom = new THREE.BufferGeometry().setFromPoints(pts);
                const line = new THREE.Line(geom, dashMat(0x888888));
                line.computeLineDistances();
                dashGroup.add(line);
            }
            // col2 → full 虚线
            for (let i = 0; i < 4; i++) {
                const pts = [
                    new THREE.Vector3(...col2Target[i]),
                    new THREE.Vector3(...fullTarget[i]),
                ];
                const geom = new THREE.BufferGeometry().setFromPoints(pts);
                const line = new THREE.Line(geom, dashMat(0x888888));
                line.computeLineDistances();
                dashGroup.add(line);
            }

            this.sceneObjects.add(dashGroup);
            this._animData.dashedLines = dashGroup;
        }

        // ─── 原点小球 ─────────────────────────────────────
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        this.sceneObjects.add(dot);

        // ─── 根据开关状态决定是否自动播放 ────────────────
        if (this._isAnimAutoEnabled('la_ch0r1_anim_auto')) {
            this._animTimeout = setTimeout(() => this._startAnimation(), 350);
        } else {
            this._setToTarget();
        }
    }

    // ═══════════════════════════════════════════════════════
    // 覆写 _computeAndRender：在父类完成后重新添加动画 UI
    // ═══════════════════════════════════════════════════════

    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI('la_ch0r1_anim_auto');
    }

    // ═══════════════════════════════════════════════════════
    // 动画系统
    // ═══════════════════════════════════════════════════════

    /** 开始动画：从恒等变换插值到目标 */
    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);  // 先复位到初始状态
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1600;  // 1.6 秒

        this._updateAnimButton('⟳ 动画中...', true);

        // 隐藏虚线
        if (this._animData.dashedLines) {
            this._animData.dashedLines.children.forEach(line => {
                line.material.opacity = 0;
            });
        }

        this._animFrame();
    }

    _animFrame() {
        if (!this._animating) return;

        const elapsed = performance.now() - this._animStartTime;
        let t = Math.min(elapsed * this.animSpeed / this._animDuration, 1.0);

        // 缓出函数（ease-out cubic）
        t = 1 - Math.pow(1 - t, 3);

        this._animT = t;
        this._updateAnimProgress(t);
        this._interpolateToT(t);

        if (t < 1.0) {
            this._animFrameId = requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);

            // 显示虚线
            if (this._animData.dashedLines) {
                this._animData.dashedLines.children.forEach(line => {
                    line.material.opacity = 0.7;
                });
            }
        }
    }

    /** 将所有可动对象插值到参数 t（0=恒等, 1=目标） */
    _interpolateToT(t) {
        const ad = this._animData;
        if (!ad) return;

        // 插值箭头
        ad.arrows.forEach(({ arrow, start, end }) => {
            const pos = [
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
                start[2] + (end[2] - start[2]) * t,
            ];
            arrow.update(pos);
        });

        // 插值形状
        ad.shapes.forEach(({ wire, face, original, target }) => {
            const interp = original.map((v, i) => [
                v[0] + (target[i][0] - v[0]) * t,
                v[1] + (target[i][1] - v[1]) * t,
                v[2] + (target[i][2] - v[2]) * t,
            ]);
            wire.updateVertices(interp);
            face.updateVertices(interp);
        });

        // 虚线透明度：t > 0.85 时开始淡入
        if (ad.dashedLines) {
            const dashOpacity = t > 0.85 ? (t - 0.85) / 0.15 * 0.7 : 0;
            ad.dashedLines.children.forEach(line => {
                line.material.opacity = dashOpacity;
            });
        }
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        this._updateAnimButton('🔄 重播动画', false);
    }

    // ═══════════════════════════════════════════════════════
    // 标签辅助方法
    // ═══════════════════════════════════════════════════════

    /** 在形状上方添加说明标签 */
    _addLabel(shapeVerts, color, text, offsetX) {
        const cx = shapeVerts.reduce((s, v) => s + v[0], 0) / 4;
        const cy = shapeVerts.reduce((s, v) => s + v[1], 0) / 4;
        const maxY = Math.max(...shapeVerts.map(v => v[1]));

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 24);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture, transparent: true, depthTest: false,
        }));
        sprite.position.set(cx, maxY + 0.8, 0);
        sprite.scale.set(1.8, 0.35, 1);
        this.sceneObjects.add(sprite);
    }
}
