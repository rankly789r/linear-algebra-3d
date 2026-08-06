/**
 * 场景 2.0 渲染器：矩阵乘法的几何含义
 *
 * 动画展示：四个正方形从原始形状平滑变形到各自变换结果。
 * 白色 □ = 原始（不变），蓝色 = B变换，绿色 = A(B(□))，黄色 = (AB)□。
 *
 * 重构于 2026-08-06：动画系统
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';

const EDGES_QUAD = [[0, 1], [1, 2], [2, 3], [3, 0]];
const FACES_QUAD = [[0, 1, 2], [0, 2, 3]];

// ═══════════════════════════════════════════════════════════
// 工厂函数
// ═══════════════════════════════════════════════════════════

function createUpdatableWireframe(vertices, edgePairs, color, opacity) {
    const positions = [];
    edgePairs.forEach(([i, j]) => {
        positions.push(...vertices[i], ...vertices[j]);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: true });
    const lines = new THREE.LineSegments(geom, mat);

    lines.updateVertices = function (newVertices) {
        const arr = geom.attributes.position.array;
        let idx = 0;
        edgePairs.forEach(([i, j]) => {
            arr[idx] = newVertices[i][0]; arr[idx+1] = newVertices[i][1]; arr[idx+2] = newVertices[i][2];
            arr[idx+3] = newVertices[j][0]; arr[idx+4] = newVertices[j][1]; arr[idx+5] = newVertices[j][2];
            idx += 6;
        });
        geom.attributes.position.needsUpdate = true;
    };
    return lines;
}

function createUpdatableFaces(vertices, faceIndices, color, opacity) {
    const group = new THREE.Group();
    const buildFaces = (verts) => {
        while (group.children.length > 0) {
            const c = group.children[0]; c.geometry.dispose(); c.material.dispose(); group.remove(c);
        }
        faceIndices.forEach(face => {
            const tv = face.map(i => new THREE.Vector3(...verts[i]));
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tv.flatMap(v => [v.x, v.y, v.z])), 3));
            geom.setIndex([0, 1, 2]);
            geom.computeVertexNormals();
            const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: false });
            group.add(new THREE.Mesh(geom, mat));
        });
    };
    buildFaces(vertices);
    group.updateVertices = buildFaces;
    return group;
}

/** 创建原始→目标的偏移单位正方形 */
function offsetSquare(vs, dx) {
    return vs.map(v => [v[0] + dx, v[1], v[2]]);
}

/** 创建可动画的向量箭头（简单版：原点出发的线段 + 端点小球） */
function createAnimatableVector(endPos, color, labelText) {
    const group = new THREE.Group();

    // 线段
    const geom = new THREE.BufferGeometry();
    const arr = new Float32Array([0, 0, 0, endPos[0], endPos[1], endPos[2]]);
    geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geom, mat);
    group.add(line);

    // 端点小球
    const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color })
    );
    dot.position.set(...endPos);
    group.add(dot);

    // 标签
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 64, 24);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.set(endPos[0], endPos[1] + 0.3, endPos[2]);
    sprite.scale.set(1.2, 0.45, 1);
    group.add(sprite);

    group.update = function (end) {
        const a = line.geometry.attributes.position.array;
        a[3] = end[0]; a[4] = end[1]; a[5] = end[2];
        line.geometry.attributes.position.needsUpdate = true;
        dot.position.set(...end);
        sprite.position.set(end[0], end[1] + 0.3, end[2]);
    };

    return group;
}


export class MatrixMultiplyRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const sep = sd.separation || 3.5;

        const unitSquare = [
            [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        ];

        // ─── 形状动画数据 ──────────────────────────────
        const shapeDefs = [
            { key: 'original', color: 0xffffff, opacity: 0.5, offset: 0,
              target: sd.shape_original || unitSquare },
            { key: 'B', color: 0x4cc9f0, opacity: 0.7, offset: sep,
              target: sd.shape_B },
            { key: 'A_of_B', color: 0x06d6a0, opacity: 0.7, offset: sep * 2,
              target: sd.shape_A_of_B },
            { key: 'C', color: 0xffd166, opacity: 0.8, offset: sep * 3,
              target: sd.shape_C },
        ];

        this._animShapes = [];

        shapeDefs.forEach(def => {
            if (!def.target || def.target.length < 4) return;
            const orig = offsetSquare(unitSquare, def.offset);
            const wire = createUpdatableWireframe(orig, EDGES_QUAD, def.color, def.opacity);
            const face = createUpdatableFaces(orig, FACES_QUAD, def.color, 0.12);
            group.add(wire);
            group.add(face);
            this._animShapes.push({ wire, face, original: orig, target: def.target });
        });

        // ─── 样本向量 ──────────────────────────────────
        const sv = sd.sample_vector;
        this._animVectors = [];
        if (sv) {
            const vecDefs = [
                { end: sv.original, color: 0xffffff, label: 'v' },
                { end: sv.B_result, color: 0x4cc9f0, label: 'Bv' },
                { end: sv.A_of_B_result, color: 0x06d6a0, label: 'A(Bv)' },
                { end: sv.C_result, color: 0xffd166, label: '(AB)v' },
            ];
            vecDefs.forEach(def => {
                if (!def.end) return;
                const originPos = [0, 0, 0];
                const vec = createAnimatableVector(originPos, def.color, def.label);
                group.add(vec);
                this._animVectors.push({ vec, start: originPos, end: def.end });
            });
        }

        // ─── 每个形状的独立标签 sprite ──────────────────
        const labelDefs = [
            { text: '原始', color: 0xffffff, shapeIdx: 0 },
            { text: 'B', color: 0x4cc9f0, shapeIdx: 1 },
            { text: 'A(B)', color: 0x06d6a0, shapeIdx: 2 },
            { text: 'AB', color: 0xffd166, shapeIdx: 3 },
        ];
        labelDefs.forEach(def => {
            if (!this._animShapes[def.shapeIdx]) return;
            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 192; labelCanvas.height = 48;
            const ctx = labelCanvas.getContext('2d');
            ctx.fillStyle = '#' + def.color.toString(16).padStart(6, '0');
            ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.text, 96, 24);
            const texture = new THREE.CanvasTexture(labelCanvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            // 初始位置：形状中心下方
            const shape = this._animShapes[def.shapeIdx];
            const cx = shape.original.reduce((s, v) => s + v[0], 0) / shape.original.length;
            const minY = Math.min(...shape.original.map(v => v[1]));
            sprite.position.set(cx, minY - 0.7, -1);
            sprite.scale.set(1.8, 0.45, 1);
            group.add(sprite);
            shape.labelSprite = sprite;
        });

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimationButton();
        this._interpolateToT(1.0);
    }

    // ═══════════════════════════════════════════════════════
    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimationButton();
    }

    _addAnimationButton() {
        const panel = this._panel('solution');
        if (!panel) return;
        const body = panel.body;
        if (body.querySelector('.anim-replay-btn')) return;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-bottom:8px;';
        const btn = document.createElement('button');
        btn.className = 'anim-replay-btn';
        btn.textContent = '▶ 演示动画';
        btn.style.cssText = 'padding:6px 14px;font-size:0.82rem;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;width:100%;';
        btn.addEventListener('click', () => {
            this._interpolateToT(0);
            this._startAnimation();
        });
        btnRow.appendChild(btn);
        body.insertBefore(btnRow, body.firstChild);
    }

    _startAnimation() {
        if (this._animating) return;
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1600;
        this._updateAnimButton('⟳ 动画中...', true);
        this._animFrame();
    }

    _animFrame() {
        if (!this._animating) return;
        const elapsed = performance.now() - this._animStartTime;
        let t = Math.min(elapsed / this._animDuration, 1.0);
        t = 1 - Math.pow(1 - t, 3);

        this._animT = t;
        this._interpolateToT(t);

        if (t < 1.0) {
            this._animFrameId = requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);
        }
    }

    _interpolateToT(t) {
        // 插值形状（每个形状独立插值）
        if (this._animShapes) {
            this._animShapes.forEach(({ wire, face, original, target, labelSprite }) => {
                const interp = original.map((v, i) => [
                    v[0] + (target[i][0] - v[0]) * t,
                    v[1] + (target[i][1] - v[1]) * t,
                    v[2] + (target[i][2] - v[2]) * t,
                ]);
                wire.updateVertices(interp);
                face.updateVertices(interp);
                // 标签吸附：跟随形状重心移动
                if (labelSprite) {
                    const cx = interp.reduce((s, v) => s + v[0], 0) / interp.length;
                    const minY = Math.min(...interp.map(v => v[1]));
                    labelSprite.position.set(cx, minY - 0.7, -1);
                }
            });
        }

        // 插值向量
        if (this._animVectors) {
            this._animVectors.forEach(({ vec, start, end }) => {
                const interp = [
                    start[0] + (end[0] - start[0]) * t,
                    start[1] + (end[1] - start[1]) * t,
                    start[2] + (end[2] - start[2]) * t,
                ];
                vec.update(interp);
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
}
