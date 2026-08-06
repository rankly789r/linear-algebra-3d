/**
 * 场景 1.0 渲染器：从方程到平面的几何对应
 * 展示线性方程与 3D 平面的对应关系，以及两平面相交的几何含义。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawPlane, drawInfiniteLine, createLabel, COLORS } from '../draw-utils.js';

export class EquationToPlaneRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;

        // ─── 绘制平面 ──────────────────────────────────
        const planeColors = [COLORS.plane1, COLORS.plane2];
        const planeLabels = ['π₁', 'π₂'];

        sd.planes.forEach((plane, i) => {
            if (!plane.valid) return;

            const normal = new THREE.Vector3(...plane.normal);
            group.add(drawPlane(normal, plane.d, planeColors[i], 0.35, 7));

            // 在平面中心附近放置标签
            const normSq = normal.lengthSq();
            if (normSq > 1e-10) {
                const center = normal.clone().multiplyScalar(plane.d / normSq);
                group.add(createLabel(planeLabels[i], center, '#ffffff'));
            }
        });

        // ─── 绘制交线 ──────────────────────────────────
        const inter = sd.intersection;

        if (inter.type === 'line' && inter.point && inter.direction) {
            // 绘制交线（双向延伸的金色直线）
            const pt = new THREE.Vector3(...inter.point);
            const dir = new THREE.Vector3(...inter.direction);
            group.add(drawInfiniteLine(pt, dir, COLORS.solution, 8));

            // 交线上的标注点
            group.add(createLabel('交线（解）', pt, '#ffd700'));
        }

        if (inter.type === 'none' && sd.planes[0].valid && sd.planes[1].valid) {
            // 平行无交——在两个平面中心各放一个标注
            sd.planes.forEach((plane, i) => {
                if (!plane.valid) return;
                const n = new THREE.Vector3(...plane.normal);
                const normSq = n.lengthSq();
                if (normSq > 1e-10) {
                    const c = n.clone().multiplyScalar(plane.d / normSq);
                    group.add(createLabel('无交点', c, '#ff6b6b'));
                }
            });
        }
    }
}
