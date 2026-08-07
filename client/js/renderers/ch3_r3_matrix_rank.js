/**
 * 场景 3.3 渲染器：矩阵的秩 — 3×3 变换与立方体
 *
 * 动画展示：单位立方体平滑变形为变换后的形状。
 * 灰色虚线 = 原始立方体（不变），彩色实线 = 动画中的变形。
 *
 * 重构于 2026-08-06：改用 draw-utils + 动画系统
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawPoint, drawLine, drawDashedLine, COLORS, createUpdatableWireframe, createUpdatableFaces } from '../draw-utils.js';

const CUBE_EDGES = [
    [0,1],[0,2],[0,3],[1,4],[1,5],[2,4],
    [2,6],[3,5],[3,6],[4,7],[5,7],[6,7]
];

const CUBE_FACES = [
    [0,1,4],[0,4,2],  // 底面
    [3,5,7],[3,7,6],  // 顶面
    [0,1,5],[0,5,3],  // 前面
    [2,4,7],[2,7,6],  // 后面
    [0,2,6],[0,6,3],  // 左面
    [1,4,7],[1,7,5],  // 右面
];


export class MatrixRankRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const rank = sd.rank;

        // ─── 原始单位立方体（灰色虚线 ghost，保持不变） ───
        if (sd.original_edges) {
            sd.original_edges.forEach(edge => {
                const p1 = new THREE.Vector3(...edge.start);
                const p2 = new THREE.Vector3(...edge.end);
                group.add(drawDashedLine(p1, p2, 0x555555));
            });
        }

        // ─── 动画线框（从单位立方体 → 变换后形状） ────────
        const origVerts = sd.cube_vertices || [
            [0,0,0],[1,0,0],[0,1,0],[0,0,1],
            [1,1,0],[1,0,1],[0,1,1],[1,1,1]
        ];
        const targetVerts = sd.transformed_vertices;

        const edgeColor = rank === 3 ? COLORS.vector1
            : (rank === 2 ? COLORS.vector3 : COLORS.vector2);

        this._shapeWire = createUpdatableWireframe(origVerts, CUBE_EDGES, edgeColor, 0.9);
        this._shapeFaces = createUpdatableFaces(origVerts, CUBE_FACES, edgeColor, 0.15);
        this._animTarget = targetVerts;
        this._animOriginal = origVerts;

        group.add(this._shapeWire);
        group.add(this._shapeFaces);

        // ─── 动画顶点小球 ──────────────────────────────
        this._vertexDots = [];
        if (targetVerts) {
            origVerts.forEach(v => {
                const dot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.06, 8, 8),
                    new THREE.MeshBasicMaterial({ color: COLORS.vector1 })
                );
                dot.position.set(...v);
                group.add(dot);
                this._vertexDots.push(dot);
            });
        }

        // ─── 秩 < 3：半透明退化面（动画结束后淡入） ──────
        if (rank === 2 && targetVerts && targetVerts.length >= 5) {
            const pts = targetVerts.map(v => new THREE.Vector3(...v));
            const verts = new Float32Array([
                pts[0].x, pts[0].y, pts[0].z,
                pts[1].x, pts[1].y, pts[1].z,
                pts[4].x, pts[4].y, pts[4].z,
            ]);
            const shapeGeom = new THREE.BufferGeometry();
            shapeGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            const shapeMat = new THREE.MeshBasicMaterial({
                color: COLORS.vector3, side: THREE.DoubleSide,
                transparent: true, opacity: 0, depthWrite: false,
            });
            this._degenerateFace = new THREE.Mesh(shapeGeom, shapeMat);
            group.add(this._degenerateFace);
        }

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimControlUI('la_ch3r3_anim_auto');
        this._interpolateToT(1.0);
        if (this._degenerateFace) this._degenerateFace.material.opacity = 0.25;
    }

    // ═══════════════════════════════════════════════════════
    // 覆写 _computeAndRender：父类会清空 solution 面板
    // ═══════════════════════════════════════════════════════
    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI('la_ch3r3_anim_auto');
    }

    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);  // 先复位到初始状态
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;
        this._updateAnimButton('⟳ 动画中...', true);
        if (this._degenerateFace) this._degenerateFace.material.opacity = 0;
        this._animFrame();
    }

    _animFrame() {
        if (!this._animating) return;
        const elapsed = performance.now() - this._animStartTime;
        let t = Math.min(elapsed * this.animSpeed / this._animDuration, 1.0);
        t = 1 - Math.pow(1 - t, 3);  // ease-out cubic

        this._animT = t;
        this._interpolateToT(t);

        if (t < 1.0) {
            this._animFrameId = requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);
            if (this._degenerateFace) this._degenerateFace.material.opacity = 0.25;
        }
    }

    _interpolateToT(t) {
        if (!this._animTarget || !this._animOriginal) return;

        // 插值立方体顶点
        const interp = this._animOriginal.map((v, i) => [
            v[0] + (this._animTarget[i][0] - v[0]) * t,
            v[1] + (this._animTarget[i][1] - v[1]) * t,
            v[2] + (this._animTarget[i][2] - v[2]) * t,
        ]);
        this._shapeWire.updateVertices(interp);
        this._shapeFaces.updateVertices(interp);

        // 插值顶点小球
        if (this._vertexDots) {
            this._vertexDots.forEach((dot, i) => {
                if (interp[i]) {
                    dot.position.set(interp[i][0], interp[i][1], interp[i][2]);
                }
            });
        }
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        this._updateAnimButton('🔄 重播动画', false);
        if (this._degenerateFace) this._degenerateFace.material.opacity = 0.25;
    }
}
