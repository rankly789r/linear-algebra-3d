/**
 * 场景 3.0 渲染器：秩的直观理解
 *
 * 动画展示：输入圆周平滑变形为变换后的形状。
 * 灰色虚线 = 原始单位圆（固定），彩色曲线 = 动画中的变形。
 *
 * 重构于 2026-08-06：改用 draw-utils + 动画系统
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawPoint, drawPlane, drawInfiniteLine, COLORS, createUpdatableWireframe } from '../draw-utils.js';

// ─── 固定输入网格点（总是这 9 个点，在 XY 平面） ───
const INPUT_GRID = [
    [0,0,0], [1,0,0], [-1,0,0], [0,1,0], [0,-1,0],
    [1,1,0], [1,-1,0], [-1,1,0], [-1,-1,0],
];

/** 生成闭环边索引 [0,1],[1,2],...,[n-1,0] */
function loopEdges(n) { return Array.from({ length: n }, (_, i) => [i, (i + 1) % n]); }


export class RankIntuitionRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const rank = sd.rank;

        // ─── 输入圆周（灰色虚线 ghost，固定不变） ──────────
        if (sd.input_circle && sd.input_circle.length > 0) {
            const inputPts3D = sd.input_circle.map(p => [p[0], p[1], 0]);
            const ghostWire = createUpdatableWireframe(inputPts3D, loopEdges(inputPts3D.length), 0x555555, 0.5);
            // 用虚线材质
            ghostWire.material = new THREE.LineDashedMaterial({ color: 0x555555, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.5 });
            ghostWire.computeLineDistances = function () {
                const arr = ghostWire.geometry.attributes.position.array;
                const count = arr.length / 3;
                const dists = new Float32Array(count);
                let d = 0;
                for (let i = 0; i < count; i++) {
                    dists[i] = d;
                    const a = i * 3, b = ((i + 1) % count) * 3;
                    const dx = arr[a] - arr[b], dy = arr[a+1] - arr[b+1], dz = arr[a+2] - arr[b+2];
                    d += Math.sqrt(dx*dx + dy*dy + dz*dz);
                }
                ghostWire.geometry.setAttribute('lineDistance', new THREE.BufferAttribute(dists, 1));
            };
            ghostWire.computeLineDistances();
            group.add(ghostWire);
        }

        // ─── 动画圆周（输入圆 → 输出圆） ──────────────────
        if (sd.input_circle && sd.output_circle && sd.output_circle.length > 0) {
            const input3D = sd.input_circle.map(p => [p[0], p[1], 0]);
            const circleColor = rank === 2 ? COLORS.vector1 : (rank === 1 ? COLORS.vector2 : 0x888888);

            this._circleWire = createUpdatableWireframe(input3D, loopEdges(input3D.length), circleColor, 0.9);
            this._animCircleSrc = input3D;
            this._animCircleDst = sd.output_circle;

            group.add(this._circleWire);

            // 圆周上的采样小球
            this._circleDots = [];
            input3D.forEach(v => {
                const dot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.05, 6, 6),
                    new THREE.MeshBasicMaterial({ color: COLORS.vector1 })
                );
                dot.position.set(...v);
                group.add(dot);
                this._circleDots.push(dot);
            });
        }

        // ─── 动画网格点 ──────────────────────────────────
        this._gridDots = [];
        if (sd.output_grid_points && sd.output_grid_points.length > 0) {
            INPUT_GRID.forEach(v => {
                const dot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.06, 6, 6),
                    new THREE.MeshBasicMaterial({ color: 0xffd93d })
                );
                dot.position.set(...v);
                group.add(dot);
                this._gridDots.push(dot);
            });
            this._animGridDst = sd.output_grid_points;
        }

        // ─── 秩标注（动画结束后显示） ────────────────────
        this._rankAnnotations = new THREE.Group();
        group.add(this._rankAnnotations);

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimControlUI('la_ch3r0_anim_auto');
        this._interpolateToT(1.0);
        this._showAnnotations();
    }

    // ═══════════════════════════════════════════════════════
    // 覆写 _computeAndRender
    // ═══════════════════════════════════════════════════════
    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI('la_ch3r0_anim_auto');
    }

    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);  // 先复位到初始状态
        this._clearAnnotations();
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;
        this._updateAnimButton('⟳ 动画中...', true);
        this._clearAnnotations();
        this._animFrame();
    }

    _animFrame() {
        if (!this._animating) return;
        const elapsed = performance.now() - this._animStartTime;
        let t = Math.min(elapsed * this.animSpeed / this._animDuration, 1.0);
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
            this._showAnnotations();
        }
    }

    _interpolateToT(t) {
        // 插值圆周
        if (this._circleWire && this._animCircleSrc && this._animCircleDst) {
            const interp = this._animCircleSrc.map((v, i) => [
                v[0] + (this._animCircleDst[i][0] - v[0]) * t,
                v[1] + (this._animCircleDst[i][1] - v[1]) * t,
                v[2] + (this._animCircleDst[i][2] - v[2]) * t,
            ]);
            this._circleWire.updateVertices(interp);
            if (this._circleDots) {
                this._circleDots.forEach((dot, i) => {
                    if (interp[i]) dot.position.set(interp[i][0], interp[i][1], interp[i][2]);
                });
            }
        }

        // 插值网格点
        if (this._gridDots && this._animGridDst) {
            this._gridDots.forEach((dot, i) => {
                const src = INPUT_GRID[i] || [0, 0, 0];
                const dst = this._animGridDst[i] || src;
                dot.position.set(
                    src[0] + (dst[0] - src[0]) * t,
                    src[1] + (dst[1] - src[1]) * t,
                    src[2] + (dst[2] - src[2]) * t,
                );
            });
        }
    }

    _clearAnnotations() {
        while (this._rankAnnotations.children.length > 0) {
            const c = this._rankAnnotations.children[0];
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
            this._rankAnnotations.remove(c);
        }
    }

    _showAnnotations() {
        this._clearAnnotations();
        const sd = this._animData;
        const rank = sd.rank;

        if (rank === 1 && sd.output_grid_points && sd.output_grid_points.length >= 2) {
            const p0 = new THREE.Vector3(...sd.output_grid_points[0]);
            const p1 = new THREE.Vector3(...sd.output_grid_points[1]);
            const dir = p1.clone().sub(p0);
            if (dir.length() > 0.001) {
                this._rankAnnotations.add(drawInfiniteLine(p0, dir, 0x888888, null, 8));
            }
        }

        if (rank === 2 && sd.output_circle && sd.output_circle.length >= 3) {
            const p0 = new THREE.Vector3(...sd.output_circle[0]);
            const p1 = new THREE.Vector3(...sd.output_circle[10]);
            const p2 = new THREE.Vector3(...sd.output_circle[20]);
            const v1 = p1.clone().sub(p0);
            const v2 = p2.clone().sub(p0);
            const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
            const d = normal.dot(p0);
            this._rankAnnotations.add(drawPlane(normal, d, COLORS.subSpace, null, 0.12, 5));
        }
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        this._updateAnimButton('🔄 重播动画', false);
        this._showAnnotations();
    }
}
