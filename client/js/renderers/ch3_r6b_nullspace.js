/**
 * 场景 3.6B 渲染器：齐次方程组的零空间
 * 展示三张过原点的平面，它们的交集 = 零空间。
 * r(A) 越低，零空间越大。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import {
    drawPlane, drawInfiniteLine, drawPoint, createLabel, COLORS
} from '../draw-utils.js';

export class NullspaceRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;

        // ─── 三张齐次平面（都过原点） ─────────────────
        const planeColors = [COLORS.plane1, COLORS.plane2, COLORS.plane3];
        const planeLabels = ['π₁', 'π₂', 'π₃'];

        sd.planes.forEach((plane, i) => {
            if (!plane.valid) return;

            const normal = new THREE.Vector3(...plane.normal);
            // 画过原点的平面（d=0），scene 参数传 null
            group.add(drawPlane(normal, 0, planeColors[i], null, 0.18, 6));

            // 在法向量方向偏移放置标签（浮在平面上方）
            const labelPos = normal.clone().multiplyScalar(2.5);
            group.add(createLabel(planeLabels[i], labelPos, '#ffffff'));
        });

        // ─── 零空间高亮 ──────────────────────────────
        const ns = sd.nullspace;

        if (ns.type === 'line' && ns.direction) {
            // 零空间是一条过原点的直线
            const dir = new THREE.Vector3(...ns.direction);
            group.add(drawInfiniteLine(
                new THREE.Vector3(0, 0, 0), dir, COLORS.subSpace, null, 6
            ));

            // 在直线上两个方向各放一个端点小球
            const pt = dir.clone().multiplyScalar(3);
            group.add(drawPoint(pt, COLORS.subSpace, 0.08));
            group.add(drawPoint(pt.clone().multiplyScalar(-1), COLORS.subSpace, 0.08));

            // 标注
            const midDir = dir.clone();
            // 找一个与 dir 垂直的方向来偏移标签
            const offset = new THREE.Vector3(
                Math.abs(dir.x) < 0.9 ? 1 : 0,
                Math.abs(dir.y) < 0.9 ? 1 : 0,
                Math.abs(dir.z) < 0.9 ? 1 : 0
            ).normalize().multiplyScalar(0.8);
            group.add(createLabel(
                `零空间 = 直线\ndim = ${ns.dim}`,
                pt.clone().add(offset),
                '#9966ff'
            ));

        } else if (ns.type === 'plane' && ns.normal) {
            // 零空间是一张过原点的平面
            const normal = new THREE.Vector3(...ns.normal);
            // 比三张平面更不透明的紫色平面
            group.add(drawPlane(normal, 0, COLORS.subSpace, null, 0.32, 6));

            // 标注
            group.add(createLabel(
                `零空间 = 平面\ndim = ${ns.dim}`,
                normal.clone().multiplyScalar(1.5),
                '#9966ff'
            ));

        } else {
            // 零空间 = {0}，仅在原点画一个高亮小球
            const origin = new THREE.Vector3(0, 0, 0);
            group.add(drawPoint(origin, COLORS.subSpace, 0.14));
            group.add(createLabel(
                '零空间 = {0}\ndim = 0（只有零解）',
                new THREE.Vector3(0.5, 0.8, 0),
                '#9966ff'
            ));
        }

        // ─── 秩标注 ──────────────────────────────────
        const nullityLabel = sd.nullity > 0
            ? `nullity=${sd.nullity} → 无穷多解`
            : `nullity=0 → 只有零解`;
        const labelColor = sd.nullity > 0 ? '#44ff44' : '#44aaff';
        group.add(createLabel(
            `r(A)=${sd.rank_A}  ${nullityLabel}`,
            new THREE.Vector3(0, -3.8, 0),
            labelColor
        ));
    }
}
