/**
 * 场景 3.1 渲染器：两个向量的关系
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawPlane, drawPoint, drawInfiniteLine } from '../draw-utils.js';

export class TwoVectorsRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd || !sd.vectors) return;

        const group = this.sceneObjects;

        // 绘制两个向量
        sd.vectors.forEach(v => {
            const vec = new THREE.Vector3(...v.components);
            group.add(drawVector(vec, v.color, v.label));
        });

        // 如果线性无关，显示它们张成的平面（半透明）
        if (sd.relation === 'independent' && sd.plane_normal) {
            const normal = new THREE.Vector3(...sd.plane_normal);
            const planeGroup = drawPlane(normal, 0, 0x9966ff, null, 0.15, 4);
            group.add(planeGroup);
        }

        // 如果线性相关（共线），画虚线强调
        if (sd.relation === 'dependent' && sd.vectors.length >= 2) {
            const v1 = new THREE.Vector3(...sd.vectors[0].components);
            const dir = v1.clone().normalize();
            group.add(drawInfiniteLine(new THREE.Vector3(0, 0, 0), dir, 0x888888, null, 5));
        }
    }
}
