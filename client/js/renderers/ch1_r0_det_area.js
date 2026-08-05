/**
 * 场景 1.0 渲染器：二阶行列式的几何意义
 *
 * 动画展示：单位正方形平滑变形为两个列向量张成的平行四边形。
 * 白色虚线 = 原始正方形（固定），彩色形状 = 动画中的变形。
 *
 * 重构于 2026-08-06：动画系统
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawDashedLine, COLORS } from '../draw-utils.js';

const EDGES_QUAD = [[0, 1], [1, 2], [2, 3], [3, 0]];
const FACES_QUAD = [[0, 1, 2], [0, 2, 3]];
const UNIT_SQUARE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];

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

/** 创建可动画的向量线段（从原点出发） */
function createAnimatableVectorLine(endPos, color) {
    const arr = new Float32Array([0, 0, 0, endPos[0], endPos[1], endPos[2]]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geom, mat);

    // 端点小球
    const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color })
    );
    dot.position.set(...endPos);

    const group = new THREE.Group();
    group.add(line);
    group.add(dot);

    group.update = function (end) {
        const a = line.geometry.attributes.position.array;
        a[3] = end[0]; a[4] = end[1]; a[5] = end[2];
        line.geometry.attributes.position.needsUpdate = true;
        dot.position.set(...end);
    };

    return group;
}


export class DetAreaRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const isDegenerate = sd.relation === 'collinear';
        const shapeColor = sd.det >= 0 ? 0x4cc9f0 : 0xef476f;

        // ─── 原始单位正方形（灰色虚线 ghost） ──────────
        const origRect = sd.shape_original || UNIT_SQUARE;
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            group.add(drawDashedLine(
                new THREE.Vector3(...origRect[i]),
                new THREE.Vector3(...origRect[j]),
                0x555555
            ));
        }

        // ─── 动画线框 + 面 ─────────────────────────────
        const alpha = isDegenerate ? 0.05 : 0.25;
        this._shapeWire = createUpdatableWireframe(origRect, EDGES_QUAD, shapeColor, 0.9);
        this._shapeFaces = createUpdatableFaces(origRect, FACES_QUAD, shapeColor, alpha);
        this._shapeTarget = sd.parallelogram?.vertices || origRect;
        this._shapeOriginal = origRect;

        group.add(this._shapeWire);
        group.add(this._shapeFaces);

        // ─── 动画向量 ──────────────────────────────────
        this._animVectors = [];
        const basisStarts = [[1, 0, 0], [0, 1, 0]];
        if (sd.vectors) {
            sd.vectors.forEach((v, i) => {
                const color = v.color;
                const vec = createAnimatableVectorLine(basisStarts[i] || [1, 0, 0], color);
                group.add(vec);
                this._animVectors.push({
                    vec,
                    start: basisStarts[i] || [1, 0, 0],
                    end: v.components,
                });
            });
        }

        // ─── 对角线虚线（动画结束后显示） ──────────────
        this._diagLine = null;
        if (!isDegenerate && sd.parallelogram?.diagonal) {
            const diag = sd.parallelogram.diagonal;
            const dg = new THREE.Group();
            const pts = [
                new THREE.Vector3(diag.start[0], diag.start[1], diag.start[2]),
                new THREE.Vector3(diag.end[0], diag.end[1], diag.end[2]),
            ];
            const geom = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineDashedMaterial({ color: 0x888888, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0 });
            const line = new THREE.Line(geom, mat);
            line.computeLineDistances();
            dg.add(line);
            group.add(dg);
            this._diagLine = dg;
        }

        // ─── det/area 标签 sprite ──────────────────────
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256; labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = sd.det >= 0 ? '#4cc9f0' : '#ef476f';
        ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`det(A) = ${sd.det.toFixed(2)}`, 128, 24);
        ctx.fillStyle = '#a0a0b8';
        ctx.font = '20px sans-serif';
        ctx.fillText(`面积 = ${sd.area.toFixed(2)}`, 128, 50);
        const texture = new THREE.CanvasTexture(labelCanvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(0, -0.8, 0);
        sprite.scale.set(2.5, 0.65, 1);
        group.add(sprite);

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimationButton();
        this._interpolateToT(1.0);
        if (this._diagLine) this._diagLine.children[0].material.opacity = 0.6;
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
            if (this._diagLine) this._diagLine.children[0].material.opacity = 0;
            this._startAnimation();
        });
        btnRow.appendChild(btn);
        body.insertBefore(btnRow, body.firstChild);
    }

    _startAnimation() {
        if (this._animating) return;
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;
        this._updateAnimButton('⟳ 动画中...', true);
        if (this._diagLine) this._diagLine.children[0].material.opacity = 0;
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
            requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);
            if (this._diagLine) this._diagLine.children[0].material.opacity = 0.6;
        }
    }

    _interpolateToT(t) {
        if (!this._shapeTarget || !this._shapeOriginal) return;

        // 插值形状
        const interp = this._shapeOriginal.map((v, i) => [
            v[0] + (this._shapeTarget[i][0] - v[0]) * t,
            v[1] + (this._shapeTarget[i][1] - v[1]) * t,
            0.001,
        ]);
        this._shapeWire.updateVertices(interp);
        this._shapeFaces.updateVertices(interp);

        // 插值向量
        if (this._animVectors) {
            this._animVectors.forEach(({ vec, start, end }) => {
                const p = [
                    start[0] + (end[0] - start[0]) * t,
                    start[1] + (end[1] - start[1]) * t,
                    start[2] + (end[2] - start[2]) * t,
                ];
                vec.update(p);
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
