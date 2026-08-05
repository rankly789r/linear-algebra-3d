/**
 * 场景渲染器：矩阵的列——线性变换的密码
 *
 * 核心直觉可视化：
 *   标准基向量 e₁, e₂, (e₃) 经过矩阵 A 变换后，
 *   分别移动到 A 的第 1, 2, (3) 列的位置。
 *
 * 包含动画功能：点击「重播动画」观看基向量从原位置滑翔到变换后位置。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { COLORS } from '../draw-utils.js';

// 基向量颜色（对应 X/Y/Z 轴颜色）
const BASIS_COLORS = [
    0xff6b6b,  // e₁ → 暖红
    0x4ecdc4,  // e₂ → 青绿
    0xffd93d,  // e₃ → 金黄
];

const BASIS_LABELS_3D = ['e₁ → 第1列', 'e₂ → 第2列', 'e₃ → 第3列'];
const BASIS_LABELS_2D = ['e₁ → 第1列', 'e₂ → 第2列'];

/**
 * 创建可更新的箭头（用于动画）
 * 箭头从原点出发，指向 endPoint
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

    // 标签
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
    sprite.scale.set(1.6, 0.4, 1);
    group.add(sprite);

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

        sprite.position.set(0, len + coneHeight + 0.3, 0);
    };

    return group;
}

/**
 * 创建形状线框（可更新顶点）
 * @param {number[][]} vertices - 初始顶点
 * @param {number[][]} edgePairs - 边索引对 [[i,j], ...]
 * @param {number} color
 * @param {number} opacity
 */
function createUpdatableWireframe(vertices, edgePairs, color, opacity = 1.0) {
    // 展开边为线段顶点
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

    // 更新函数
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
 * 创建半透明面（可更新顶点）
 */
function createUpdatableFaces(vertices, faceIndices, color, opacity = 0.2) {
    const group = new THREE.Group();

    faceIndices.forEach(face => {
        const triVerts = face.map(i => new THREE.Vector3(...vertices[i]));
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

    // 更新函数：重建所有面
    group.updateVertices = function (newVertices) {
        // 清除旧面
        while (group.children.length > 0) {
            const child = group.children[0];
            child.geometry.dispose();
            child.material.dispose();
            group.remove(child);
        }
        // 重建新面
        faceIndices.forEach(face => {
            const triVerts = face.map(i => new THREE.Vector3(...newVertices[i]));
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

    return group;
}


export class MatrixColumnsRenderer extends SceneRenderer {

    buildScene(data) {
        const d = data.scene_data;
        this._animData = d;  // 保存数据供动画使用
        this._animT = 1.0;    // 动画进度 0→1
        this._animating = false;

        // 复原原始形状顶点索引
        const is3D = d.mode === '3x3';

        // ─── 原始基向量（虚线效果：灰色半透明） ──────────
        this._ghostArrows = [];
        const basisOrig = is3D
            ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
            : [[1, 0, 0], [0, 1, 0]];
        const basisLabels = is3D ? BASIS_LABELS_3D : BASIS_LABELS_2D;

        basisOrig.forEach((v, i) => {
            const arrow = createAnimatableArrow(0x555566, '', 0.6);
            arrow.update(new THREE.Vector3(...v));
            // 用虚线材质替换柱身
            arrow.children[0].material = new THREE.MeshStandardMaterial({
                color: 0x555566, emissive: 0x333344, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.4,
            });
            arrow.children[1].material = new THREE.MeshStandardMaterial({
                color: 0x555566, emissive: 0x333344, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.4,
            });
            // 原始基向量标签
            this._addSpriteLabel(arrow, ['e₁', 'e₂', 'e₃'][i], new THREE.Vector3(...v), '#888899');
            this.sceneObjects.add(arrow);
            this._ghostArrows.push(arrow);
        });

        // ─── 变换后的基向量（彩色实线箭头） ──────────────
        this._basisArrows = [];
        d.columns.forEach((colInfo, i) => {
            const color = BASIS_COLORS[i];
            const label = is3D ? BASIS_LABELS_3D[i] : BASIS_LABELS_2D[i];
            const arrow = createAnimatableArrow(color, label, 1.3);
            // 初始位置：从原始基向量开始（动画从 t=0 开始）
            arrow.update(new THREE.Vector3(...colInfo.start));
            this.sceneObjects.add(arrow);
            this._basisArrows.push({ arrow, start: colInfo.start, end: colInfo.end });
        });

        // ─── 原始形状（白色线框） ─────────────────────────
        if (is3D) {
            const cubeEdges = [
                [0, 1], [1, 2], [2, 3], [3, 0],  // 底面
                [4, 5], [5, 6], [6, 7], [7, 4],  // 顶面
                [0, 4], [1, 5], [2, 6], [3, 7],  // 竖边
            ];
            this._ghostShape = createUpdatableWireframe(
                d.shape_original, cubeEdges, 0x556677, 0.5
            );
            this._shapeWire = createUpdatableWireframe(
                d.shape_original, cubeEdges, 0x88aacc, 0.9
            );

            const cubeFaces = [
                [0, 1, 2], [0, 2, 3],  // 底面
                [4, 5, 6], [4, 6, 7],  // 顶面
                [0, 1, 5], [0, 5, 4],  // 前面
                [2, 3, 7], [2, 7, 6],  // 后面
                [0, 3, 7], [0, 7, 4],  // 左面
                [1, 2, 6], [1, 6, 5],  // 右面
            ];
            this._shapeFaces = createUpdatableFaces(
                d.shape_original, cubeFaces, 0x4488cc, 0.15
            );
        } else {
            const squareEdges = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
            this._ghostShape = createUpdatableWireframe(
                d.shape_original, squareEdges, 0x556677, 0.5
            );
            this._shapeWire = createUpdatableWireframe(
                d.shape_original, [[0, 1], [1, 2], [2, 3], [3, 0]], 0x88aacc, 0.9
            );

            const squareFaces = [[0, 1, 2], [0, 2, 3]];
            this._shapeFaces = createUpdatableFaces(
                d.shape_original, squareFaces, 0x4488cc, 0.2
            );
        }

        this.sceneObjects.add(this._ghostShape);
        this.sceneObjects.add(this._shapeWire);
        this.sceneObjects.add(this._shapeFaces);

        // ─── 原点小球 ─────────────────────────────────────
        const originDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        this.sceneObjects.add(originDot);

        // ─── 动画按钮 ─────────────────────────────────────
        this._addAnimationButton();

        // 每次数据更新都自动播放动画
        setTimeout(() => this._startAnimation(), 300);
    }

    /** 添加一个 sprite 标签到箭头组 */
    _addSpriteLabel(group, text, position, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = colorHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 24);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture, transparent: true, depthTest: false,
        }));
        sprite.scale.set(0.6, 0.25, 1);
        sprite.position.set(0, position.length() + 0.4, 0);
        group.add(sprite);
    }

    /** 在 solution 面板中添加动画按钮 */
    _addAnimationButton() {
        const panel = this._panel('solution');
        if (!panel) return;
        const body = panel.body;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-bottom:8px;';

        const btn = document.createElement('button');
        btn.textContent = '▶ 演示动画';
        btn.style.cssText = 'padding:6px 14px;font-size:0.82rem;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;width:100%;';
        btn.addEventListener('click', () => this._startAnimation());
        btnRow.appendChild(btn);
        body.insertBefore(btnRow, body.firstChild);
    }

    /** 开始动画：从恒等变换插值到目标矩阵 */
    _startAnimation() {
        if (this._animating) return;
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;  // 1.5 秒

        // 禁用动画按钮
        const panel = this._panel('solution');
        if (panel) {
            const btn = panel.body.querySelector('button');
            if (btn) {
                btn.textContent = '⟳ 动画中...';
                btn.disabled = true;
                btn.style.opacity = '0.6';
            }
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
            // 恢复按钮
            const panel = this._panel('solution');
            if (panel) {
                const btn = panel.body.querySelector('button');
                if (btn) {
                    btn.textContent = '🔄 重播动画';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            }
        }
    }

    /** 将所有可动对象插值到参数 t（0=恒等, 1=目标） */
    _interpolateToT(t) {
        if (!this._animData) return;

        // 插值基向量箭头
        this._basisArrows.forEach(({ arrow, start, end }) => {
            const s = new THREE.Vector3(...start);
            const e = new THREE.Vector3(...end);
            const pos = s.clone().lerp(e, t);
            arrow.update(pos);
        });

        // 插值形状顶点
        const orig = this._animData.shape_original;
        const target = this._animData.shape_transformed;
        const interp = orig.map((v, i) => [
            v[0] + (target[i][0] - v[0]) * t,
            v[1] + (target[i][1] - v[1]) * t,
            v[2] + (target[i][2] - v[2]) * t,
        ]);

        this._shapeWire.updateVertices(interp);
        this._shapeFaces.updateVertices(interp);

        // 原始形状始终不变（ghost）
        // this._ghostShape 不需要更新
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        // 更新按钮文字
        const panel = this._panel('solution');
        if (panel) {
            const btn = panel.body.querySelector('button');
            if (btn) {
                btn.textContent = '🔄 重播动画';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    }
}
