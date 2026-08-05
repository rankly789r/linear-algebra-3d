/**
 * 场景 3.7 渲染器：秩与解的关系
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawPlane, drawPoint, drawDashedLine } from '../draw-utils.js';

export class RankSolutionRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;
        const group = this.sceneObjects;

        // 绘制三个方程平面
        if (sd.planes) {
            sd.planes.forEach(p => {
                const normal = new THREE.Vector3(...p.normal);
                group.add(drawPlane(normal, p.d, p.color, null, 0.2, 4));
            });
        }

        // 绘制 b 向量（来自原点）
        if (sd.b_vector) {
            const bVec = new THREE.Vector3(...sd.b_vector);
            group.add(drawVector(bVec, 0xffd700, 'b', null, 1.0));
        }

        // 绘制 b 在列空间上的投影
        if (sd.b_projection && sd.b_residual) {
            const bProj = new THREE.Vector3(...sd.b_projection);
            const bResidual = new THREE.Vector3(...sd.b_residual);

            // 投影向量（虚线）
            if (bProj.length() > 0.001) {
                group.add(drawDashedLine(new THREE.Vector3(0, 0, 0), bProj, 0x888888));
            }

            // 残差向量（从投影点指向 b，红色虚线）
            const bEnd = new THREE.Vector3(...sd.b_vector);
            if (bResidual.length() > 0.001) {
                group.add(drawDashedLine(bProj, bEnd, 0xef476f));
            }

            // 投影点
            group.add(drawPoint(bProj, 0x06d6a0, 0.07));
        }

        // 解点
        if (sd.solution_point) {
            const solPos = new THREE.Vector3(...sd.solution_point);
            if (sd.solution_type === 'unique') {
                group.add(drawPoint(solPos, 0xffd700, 0.13));
            } else if (sd.solution_type === 'infinite') {
                group.add(drawPoint(solPos, 0x06d6a0, 0.11));
            }
        }
    }
}
