/**
 * 场景 1.4 渲染器：按行列展开的几何 — 余子式与三重积
 *
 * 展示 det([a,b,c]) = a·(b×c)
 * b×c = 法向量 n，其三个分量恰好是 a 列的代数余子式。
 * 展开公式 = 点积，错行展开 = 0（垂直）。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import {
    drawVector, drawLine, drawDashedLine, drawPoint, createLabel, COLORS,
} from '../draw-utils.js';

export class CofactorRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;

        const col_a = new THREE.Vector3(...sd.columns.a.components);
        const col_b = new THREE.Vector3(...sd.columns.b.components);
        const col_c = new THREE.Vector3(...sd.columns.c.components);
        const n_bc = new THREE.Vector3(...sd.normal.components);
        const a_proj = new THREE.Vector3(...sd.a_proj_n);
        const n_norm = sd.normal.norm;
        const hasNormal = n_norm > 1e-10;

        // ─── 底面平行四边形（b 和 c 张成） ─────────────────
        this._drawParallelogramBase(group, col_b, col_c);

        // ─── b、c 向量 ──────────────────────────────────
        group.add(drawVector(col_b, COLORS.vector2, 'b', null));
        group.add(drawVector(col_c, COLORS.vector3, 'c', null));

        // ─── 法向量 n = b×c（余子式向量） ──────────────
        if (hasNormal) {
            group.add(drawVector(n_bc, COLORS.subSpace, 'n=b×c', null, 0.9));
            // 法向量方向的半透明辅助线（从原点沿 n 方向延伸）
            const n_unit = n_bc.clone().normalize();
            const n_tip = n_bc.clone();
            // 画一个稍长一点的线段帮助看方向
            group.add(drawLine(
                new THREE.Vector3(0, 0, 0),
                n_tip,
                COLORS.subSpace,
                null,
                2.5,
            ));
        }

        // ─── a 向量 ─────────────────────────────────────
        group.add(drawVector(col_a, COLORS.vector1, 'a', null, 1.0));

        // ─── 投影关系：a 的 tip → n 线上的垂足 ──────────
        if (hasNormal && a_proj.length() > 0.001) {
            // 虚线：从 a 的尖端垂直连到 n 线上的投影点
            group.add(drawDashedLine(col_a, a_proj, 0xaaaaaa));
            // 投影点高亮
            group.add(drawPoint(a_proj, COLORS.subSpace, 0.06));
            // 标注
            const midPoint = col_a.clone().add(a_proj).multiplyScalar(0.5);
            group.add(createLabel(
                `高=${sd.height.toFixed(2)}`,
                midPoint,
                '#aaaaaa'
            ));
        }

        // ─── 平行六面体线框 ─────────────────────────────
        this._drawParallelepiped(group, sd.shape);

        // ─── 底面内分量（a 在底面上的投影） ─────────────
        if (hasNormal) {
            const a_in_base = new THREE.Vector3(...sd.a_in_base);
            if (a_in_base.length() > 0.01) {
                // 半透明虚线显示 a 在底面上的分量
                group.add(drawDashedLine(
                    new THREE.Vector3(0, 0, 0),
                    a_in_base,
                    0x888888,
                ));
                group.add(createLabel('底面分量', a_in_base.clone().multiplyScalar(0.6), '#888888'));
            }
        }

        // ─── 底面积标注 ─────────────────────────────────
        const baseCenter = col_b.clone().add(col_c).multiplyScalar(0.5);
        group.add(createLabel(
            `底面积 = ${sd.base_area.toFixed(2)}`,
            baseCenter,
            '#4ecdc4'
        ));

        // ─── 底部信息栏 ─────────────────────────────────
        let infoText;
        if (hasNormal) {
            const cof = sd.cofactors;
            infoText = `det = ${sd.det_A.toFixed(2)}`
                + `\n展开公式: a·n = ${sd.det_via_dot.toFixed(2)}`
                + `\n余子式: [${cof[0].toFixed(1)}, ${cof[1].toFixed(1)}, ${cof[2].toFixed(1)}]`
                + `\n错行 b·n = ${sd.wrong_exp_b.toFixed(2)}  c·n = ${sd.wrong_exp_c.toFixed(2)}`;
        } else {
            infoText = `det = 0（底面退化）`
                + `\nn = b×c = (0,0,0)`
                + `\n所有余子式 = 0`;
        }
        group.add(createLabel(infoText, new THREE.Vector3(0, -4.5, 0), '#ffffff'));
    }

    /**
     * 画 b 和 c 张成的底面平行四边形（半透明面 + 边线）。
     */
    _drawParallelogramBase(group, b, c) {
        const O = new THREE.Vector3(0, 0, 0);
        const bc = b.clone().add(c);

        // 半透明面
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array([
            O.x, O.y, O.z,
            b.x, b.y, b.z,
            bc.x, bc.y, bc.z,
            O.x, O.y, O.z,
            bc.x, bc.y, bc.z,
            c.x, c.y, c.z,
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.computeVertexNormals();
        const mat = new THREE.MeshBasicMaterial({
            color: COLORS.plane2,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
        });
        group.add(new THREE.Mesh(geom, mat));

        // 边线
        group.add(drawLine(O, b, COLORS.plane2, null, 1.5));
        group.add(drawLine(b, bc, COLORS.plane2, null, 1.5));
        group.add(drawLine(bc, c, COLORS.plane2, null, 1.5));
        group.add(drawLine(c, O, COLORS.plane2, null, 1.5));
    }

    /**
     * 画平行六面体的线框图。
     */
    _drawParallelepiped(group, shape) {
        if (!shape.vertices || !shape.edges) return;
        const v = shape.vertices;

        shape.edges.forEach(([ai, bi]) => {
            const start = new THREE.Vector3(v[ai][0], v[ai][1], v[ai][2]);
            const end = new THREE.Vector3(v[bi][0], v[bi][1], v[bi][2]);
            const mat = new THREE.LineBasicMaterial({
                color: 0x4cc9f0,
                transparent: true,
                opacity: 0.6,
            });
            const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
            group.add(new THREE.Line(geom, mat));
        });
    }
}
