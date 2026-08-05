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

const COL_COLORS = {
    col1: 0xff6b6b,   // 红色 —— 第 1 列
    col2: 0x4ecdc4,   // 青色 —— 第 2 列
    full: 0x4488ff,   // 蓝色 —— 完整变换
    ghost: 0x556677,  // 灰色 —— 原始形状
};

const EDGES_QUAD = [[0, 1], [1, 2], [2, 3], [3, 0]];
const FACES_QUAD = [[0, 1, 2], [0, 2, 3]];

// ═══════════════════════════════════════════════════════════
// 辅助函数：可更新对象（动画用）
// ═══════════════════════════════════════════════════════════

/**
 * 创建可动画的箭头
 * 箭头初始沿 Y 轴，通过 update(endPoint) 设置方向和长度
 */
function createAnimatableArrow(color, labelText, thickness = 1.0) {
    const group = new THREE.Group();

    const bodyRadius = 0.06 * thickness;
    const coneRadius = 0.16 * thickness;
    const coneHeight = 0.35 * thickness;

    // 柱身（初始长度 1，沿 Y 轴）
    const bodyGeom = new THREE.CylinderGeometry(bodyRadius, bodyRadius, 1, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.4,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.set(0, 0.5, 0);
    group.add(body);

    // 锥头
    const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 12);
    const coneMat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.7,
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.set(0, 1, 0);
    group.add(cone);

    // 标签 sprite
    if (labelText) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, 128, 32);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture, transparent: true, depthTest: false,
        }));
        sprite.scale.set(1.8, 0.45, 1);
        group.add(sprite);
        group._labelSprite = sprite;
    }

    // 更新函数：设置箭头终点
    group.update = function (endPoint) {
        const dir = endPoint.clone().normalize();
        const len = endPoint.length();
        const up = new THREE.Vector3(0, 1, 0);

        if (len < 0.001) {
            group.visible = false;
            return;
        }
        group.visible = true;

        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        group.setRotationFromQuaternion(quat);

        body.scale.y = len;
        body.position.y = len / 2;

        cone.position.y = len;

        if (group._labelSprite) {
            group._labelSprite.position.set(0, len + coneHeight + 0.35, 0);
        }
    };

    return group;
}

/**
 * 创建可更新顶点的线框
 * @param {number[][]} vertices - 初始顶点 [[x,y,z], ...]
 * @param {number[][]} edgePairs - 边索引对 [[i,j], ...]
 */
function createUpdatableWireframe(vertices, edgePairs, color, opacity = 1.0) {
    const positions = [];
    edgePairs.forEach(([i, j]) => {
        positions.push(...vertices[i], ...vertices[j]);
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(positions), 3));

    const mat = new THREE.LineBasicMaterial({
        color, transparent: opacity < 1, opacity, depthTest: true,
    });
    const lines = new THREE.LineSegments(geom, mat);

    lines.updateVertices = function (newVertices) {
        const arr = geom.attributes.position.array;
        let idx = 0;
        edgePairs.forEach(([i, j]) => {
            arr[idx] = newVertices[i][0];
            arr[idx + 1] = newVertices[i][1];
            arr[idx + 2] = newVertices[i][2];
            arr[idx + 3] = newVertices[j][0];
            arr[idx + 4] = newVertices[j][1];
            arr[idx + 5] = newVertices[j][2];
            idx += 6;
        });
        geom.attributes.position.needsUpdate = true;
    };

    return lines;
}

/**
 * 创建可更新顶点的半透明面
 */
function createUpdatableFaces(vertices, faceIndices, color, opacity = 0.18) {
    const group = new THREE.Group();

    const buildFaces = (verts) => {
        // 清除旧面
        while (group.children.length > 0) {
            const child = group.children[0];
            child.geometry.dispose();
            child.material.dispose();
            group.remove(child);
        }
        // 重建面
        faceIndices.forEach(face => {
            const triVerts = face.map(i => new THREE.Vector3(...verts[i]));
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position',
                new THREE.BufferAttribute(new Float32Array(
                    triVerts.flatMap(v => [v.x, v.y, v.z])
                ), 3));
            geom.setIndex([0, 1, 2]);
            geom.computeVertexNormals();

            const mat = new THREE.MeshStandardMaterial({
                color, side: THREE.DoubleSide, transparent: true,
                opacity, depthWrite: false,
            });
            group.add(new THREE.Mesh(geom, mat));
        });
    };

    buildFaces(vertices);

    group.updateVertices = function (newVertices) {
        buildFaces(newVertices);
    };

    return group;
}


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
            const arrow = createAnimatableArrow(ghostColors[i], ghostLabels[i], 0.6);
            arrow.update(new THREE.Vector3(...pos));
            // 替换为半透明材质
            arrow.children[0].material = new THREE.MeshStandardMaterial({
                color: 0x555566, emissive: 0x333344, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.4,
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
            const arrow = createAnimatableArrow(arrowColors[i], arrowLabels[i], 1.3);
            // 初始指向原始基向量位置（t=0）
            arrow.update(new THREE.Vector3(...arrowStarts[i]));
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

        // ─── 启动动画 ─────────────────────────────────────
        this._animTimeout = setTimeout(() => this._startAnimation(), 350);
    }

    // ═══════════════════════════════════════════════════════
    // 覆写 _computeAndRender：在父类完成后重新添加动画按钮
    // （父类的 _updateSolutionInfo 会 wipe innerHTML）
    // ═══════════════════════════════════════════════════════

    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimationButton();
    }

    // ═══════════════════════════════════════════════════════
    // 动画系统
    // ═══════════════════════════════════════════════════════

    /** 在 solution 面板中添加动画按钮 */
    _addAnimationButton() {
        const panel = this._panel('solution');
        if (!panel) return;
        const body = panel.body;

        // 避免重复添加
        if (body.querySelector('.anim-replay-btn')) return;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-bottom:8px;';

        const btn = document.createElement('button');
        btn.className = 'anim-replay-btn';
        btn.textContent = '▶ 演示动画';
        btn.style.cssText = 'padding:6px 14px;font-size:0.82rem;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;width:100%;';
        btn.addEventListener('click', () => {
            // 重置到起点再播放
            this._interpolateToT(0);
            this._startAnimation();
        });
        btnRow.appendChild(btn);
        body.insertBefore(btnRow, body.firstChild);
    }

    /** 开始动画：从恒等变换插值到目标 */
    _startAnimation() {
        if (this._animating) return;
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
        let t = Math.min(elapsed / this._animDuration, 1.0);

        // 缓出函数（ease-out cubic）
        t = 1 - Math.pow(1 - t, 3);

        this._animT = t;
        this._interpolateToT(t);

        if (t < 1.0) {
            requestAnimationFrame(() => this._animFrame());
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
            const s = new THREE.Vector3(...start);
            const e = new THREE.Vector3(...end);
            const pos = s.clone().lerp(e, t);
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

    _updateAnimButton(text, disabled) {
        const panel = this._panel('solution');
        if (!panel) return;
        const btn = panel.body.querySelector('.anim-replay-btn');
        if (btn) {
            btn.textContent = text;
            btn.disabled = disabled;
            btn.style.opacity = disabled ? '0.6' : '1';
        }
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
