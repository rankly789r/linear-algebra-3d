/**
 * 场景 3.7B 渲染器：列空间与解的存在性
 * 展示 Col(A)（列向量张成的空间）、b 向量、以及 b 在列空间上的投影与残差。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import {
    drawVector, drawPlane, drawInfiniteLine,
    drawPoint, drawDashedLine, createLabel, COLORS
} from '../draw-utils.js';

export class ColSpaceRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;

        // ─── 列空间（平面 / 直线） ─────────────────────
        const cs = sd.col_space;

        if (cs.type === 'plane' && cs.normal) {
            // rank=2: 列空间是过原点的平面
            const normal = new THREE.Vector3(...cs.normal);
            group.add(drawPlane(normal, 0, COLORS.subSpace, 0.22, 7));

            // 在平面中心附近标注
            group.add(createLabel(
                `Col(A) = 平面\nr(A)=${sd.rank_A}`,
                new THREE.Vector3(0, 0, 0),
                '#9966ff'
            ));

        } else if (cs.type === 'line' && cs.direction) {
            // rank=1: 列空间是过原点的直线
            const dir = new THREE.Vector3(...cs.direction);
            group.add(drawInfiniteLine(
                new THREE.Vector3(0, 0, 0), dir, COLORS.subSpace, 7
            ));

            group.add(createLabel(
                `Col(A) = 直线\nr(A)=${sd.rank_A}`,
                dir.clone().multiplyScalar(3),
                '#9966ff'
            ));
        }
        // rank=0 不画任何东西（原点）

        // ─── 列向量 ──────────────────────────────────
        const colColors = [COLORS.vector1, COLORS.vector2];
        sd.columns.forEach((col, i) => {
            const v = new THREE.Vector3(...col.components);
            if (v.length() > 1e-8) {
                group.add(drawVector(v, colColors[i], col.label));
            }
        });

        // ─── b 向量 ──────────────────────────────────
        const bEnd = new THREE.Vector3(...sd.b_vec.components);
        if (bEnd.length() > 1e-8) {
            group.add(drawVector(bEnd, COLORS.solution, 'b'));
        }

        // ─── 投影与残差 ──────────────────────────────
        const proj = sd.projection;
        if (proj && proj.point) {
            const projPt = new THREE.Vector3(...proj.point);

            // 投影向量（从原点指向投影点，用子空间色）
            if (projPt.length() > 1e-6) {
                group.add(drawVector(projPt, COLORS.subSpace, 'proj(A)b'));
            }

            // 投影点（金色小球）
            group.add(drawPoint(projPt, COLORS.solution, 0.08));

            // 残差（从投影点到 b 的虚线）
            if (proj.residual_norm > 1e-6) {
                group.add(drawDashedLine(projPt, bEnd, 0xff4444));

                // 残差标注
                const mid = projPt.clone().add(bEnd).multiplyScalar(0.5);
                group.add(createLabel(`残差\n${proj.residual_norm.toFixed(2)}`, mid, '#ff4444'));
            }
        }

        // ─── 秩标注 ──────────────────────────────────
        const rankLabel = sd.rank_equal
            ? `r(A)=r(A|b)=${sd.rank_A} ✓ 有解`
            : `r(A)=${sd.rank_A} < r(A|b)=${sd.rank_Ab} ✗ 无解`;
        const labelColor = sd.rank_equal ? '#44ff44' : '#ff4444';
        group.add(createLabel(rankLabel, new THREE.Vector3(0, -3.5, 0), labelColor));
    }
}
