/**
 * 场景 3.8 渲染器：秩的性质可视化
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawLine, drawPoint } from '../draw-utils.js';

export class RankPropertiesRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;
        const group = this.sceneObjects;

        // 绘制变换后的圆周
        if (sd.circle_transformed && sd.circle_transformed.length > 0) {
            const pts = sd.circle_transformed.map(p => new THREE.Vector3(...p));
            const rankA = sd.rank_A;
            const color = rankA === 2 ? 0x4cc9f0 : (rankA === 1 ? 0xff6b6b : 0x888888);

            for (let i = 0; i < pts.length; i++) {
                const j = (i + 1) % pts.length;
                group.add(drawLine(pts[i], pts[j], color));
            }

            // 采样点标记
            const step = Math.max(1, Math.floor(pts.length / 8));
            for (let i = 0; i < pts.length; i += step) {
                group.add(drawPoint(pts[i], color, 0.05));
            }
        }

        // 绘制 A 的列向量
        if (sd.col_vectors_A) {
            const colors = [0xff6b6b, 0x4ecdc4];
            sd.col_vectors_A.forEach((v, i) => {
                const vec = new THREE.Vector3(...v);
                if (vec.length() > 0.001) {
                    group.add(drawVector(vec, colors[i % colors.length], `c${i+1}`, null, 0.9));
                }
            });
        }

        // 秩信息标注（用小文字 sprite 在角落）
        // 由 solution_info 面板显示，这里只需几何
    }
}
