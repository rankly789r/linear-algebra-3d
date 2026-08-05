/**
 * 场景 3.6 渲染器：齐次 vs 非齐次方程组
 *
 * 重构于 2026-08-06：改用 draw-utils 统一绘图
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawPoint, drawLine, drawPlane, drawDashedLine, COLORS } from '../draw-utils.js';

export class HomogeneousRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;
        const group = this.sceneObjects;

        // ─── 非齐次方程的两个平面 ──────────────────────────
        if (sd.equation_planes) {
            sd.equation_planes.forEach(p => {
                const normal = new THREE.Vector3(...p.normal);
                group.add(drawPlane(normal, p.d, p.color, null, 0.25, 4));
            });
        }

        // ─── 齐次方程平面（穿过原点的半透明参考面） ────────
        if (sd.zero_planes) {
            sd.zero_planes.forEach(p => {
                const normal = new THREE.Vector3(...p.normal);
                group.add(drawPlane(normal, 0, p.color, null, 0.10, 4));
            });
        }

        // ─── 齐次解空间（穿过原点的子空间） ────────────────
        if (sd.null_points && sd.null_points.length > 0) {
            const nullDim = sd.null_dim;
            const pts = sd.null_points.map(p => new THREE.Vector3(...p));

            if (nullDim === 1 && pts.length >= 2) {
                // 穿过原点的一条直线
                group.add(drawLine(pts[0], pts[pts.length - 1], COLORS.subSpace));
                group.add(drawPoint(new THREE.Vector3(0, 0, 0), COLORS.subSpace, 0.1));
            } else if (nullDim >= 2 && pts.length >= 3) {
                // 穿过原点的一个平面
                const v1 = pts[1].clone().sub(pts[0]);
                const v2 = pts[2].clone().sub(pts[0]);
                const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
                group.add(drawPlane(normal, 0, COLORS.subSpace, null, 0.2, 4));
            }
        }

        // ─── 非齐次解空间（平移后的仿射空间） ──────────────
        if (sd.affine_points && sd.affine_points.length > 0 && sd.particular_solution) {
            const affinePts = sd.affine_points.map(p => new THREE.Vector3(...p));

            if (affinePts.length >= 2) {
                group.add(drawLine(affinePts[0], affinePts[affinePts.length - 1], 0x06d6a0));
            }

            // 特解点
            const particular = new THREE.Vector3(...sd.particular_solution);
            group.add(drawPoint(particular, 0x06d6a0, 0.11));

            // 从原点到特解的虚线（展示平移关系）
            const origin = new THREE.Vector3(0, 0, 0);
            group.add(drawDashedLine(origin, particular, 0x888888));

            // 原点
            group.add(drawPoint(origin, 0xffffff, 0.06));
        }
    }
}
