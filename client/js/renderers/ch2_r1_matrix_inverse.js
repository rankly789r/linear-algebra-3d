/**
 * 场景 2.1 渲染器：逆矩阵的几何含义
 *
 * 动画展示：可逆时，A 变换后 A⁻¹ 完美还原；不可逆时，降维无法逆转。
 * 重构于 2026-08-06：动画系统
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';

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

function offsetVertices(vs, dx) {
    return vs.map(v => [v[0] + dx, v[1], v[2]]);
}


export class MatrixInverseRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        this._animShapes = [];

        if (sd.invertible && sd.shape_restored) {
            const offset = sd.offset || 3.0;

            // ─── 三形状动画 ──────────────────────────
            const shapeDefs = [
                { target: sd.shape_original, color: 0xffffff, opacity: 0.5, dx: -offset },
                { target: sd.shape_after_A, color: 0x4cc9f0, opacity: 0.7, dx: 0 },
                { target: sd.shape_restored, color: 0x06d6a0, opacity: 0.8, dx: offset },
            ];

            shapeDefs.forEach(def => {
                if (!def.target || def.target.length < 4) return;
                const orig = offsetVertices(UNIT_SQUARE, def.dx);
                const wire = createUpdatableWireframe(orig, EDGES_QUAD, def.color, def.opacity);
                const face = createUpdatableFaces(orig, FACES_QUAD, def.color, 0.12);
                group.add(wire);
                group.add(face);
                this._animShapes.push({ wire, face, original: orig, target: def.target });
            });

            // ─── 标签 ────────────────────────────────
            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 512; labelCanvas.height = 48;
            const ctx = labelCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('原始 □', 85, 30);
            ctx.fillStyle = '#4cc9f0'; ctx.fillText('A□', 256, 30);
            ctx.fillStyle = '#06d6a0'; ctx.fillText('A⁻¹(A□) = □', 427, 30);
            const texture = new THREE.CanvasTexture(labelCanvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            sprite.position.set(0, -2, -1);
            sprite.scale.set(7, 0.7, 1);
            group.add(sprite);

        } else {
            // ─── 不可逆：两形状 ──────────────────────
            const shapeDefs = [
                { target: sd.shape_original, color: 0xffffff, opacity: 0.5, dx: -2 },
                { target: sd.shape_after_A, color: 0xef476f, opacity: 0.7, dx: 2 },
            ];

            shapeDefs.forEach(def => {
                if (!def.target || def.target.length < 4) return;
                const orig = offsetVertices(UNIT_SQUARE, def.dx);
                const wire = createUpdatableWireframe(orig, EDGES_QUAD, def.color, def.opacity);
                const face = createUpdatableFaces(orig, FACES_QUAD, def.color, 0.12);
                group.add(wire);
                group.add(face);
                this._animShapes.push({ wire, face, original: orig, target: def.target });
            });

            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 512; labelCanvas.height = 64;
            const ctx = labelCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('原始 □', 128, 22);
            ctx.fillStyle = '#ef476f'; ctx.fillText('A□（降维）', 384, 22);
            ctx.fillStyle = '#ffd166'; ctx.font = '18px sans-serif';
            ctx.fillText('不可逆 —— 降维过程无法逆转', 256, 50);
            const texture = new THREE.CanvasTexture(labelCanvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            sprite.position.set(0, -2, -1);
            sprite.scale.set(7, 0.9, 1);
            group.add(sprite);
        }

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
        this._animDuration = 1500;
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
            requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);
        }
    }

    _interpolateToT(t) {
        if (!this._animShapes) return;
        this._animShapes.forEach(({ wire, face, original, target }) => {
            const interp = original.map((v, i) => [
                v[0] + (target[i][0] - v[0]) * t,
                v[1] + (target[i][1] - v[1]) * t,
                v[2] + (target[i][2] - v[2]) * t,
            ]);
            wire.updateVertices(interp);
            face.updateVertices(interp);
        });
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
