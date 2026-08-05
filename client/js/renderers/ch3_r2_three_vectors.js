/**
 * 场景 3.2 渲染器：三个向量与张成空间
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawPlane, drawInfiniteLine } from '../draw-utils.js';

export class ThreeVectorsRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd || !sd.vectors) return;
        const group = this.sceneObjects;

        // 绘制三个向量
        const colors = [0xff6b6b, 0x4ecdc4, 0xffd93d];
        sd.vectors.forEach((v, i) => {
            const vec = new THREE.Vector3(...v.components);
            const opacity = v.independent ? 1.0 : 0.4;
            group.add(drawVector(vec, v.color, v.label, null, opacity));
        });

        // 如果只张成平面（秩=2），画半透明平面
        if (sd.span_type === 'plane' && sd.plane_normal) {
            const normal = new THREE.Vector3(...sd.plane_normal);
            const planeGroup = drawPlane(normal, 0, 0x9966ff, null, 0.18, 4);
            group.add(planeGroup);
        }

        // 如果只张成直线（秩=1），画虚线
        if (sd.span_type === 'line' && sd.vectors.length > 0) {
            const v0 = new THREE.Vector3(...sd.vectors[0].components);
            if (v0.length() > 0.001) {
                const dir = v0.clone().normalize();
                group.add(drawInfiniteLine(new THREE.Vector3(0, 0, 0), dir, 0x888888, null, 5));
            }
        }
    }
}
