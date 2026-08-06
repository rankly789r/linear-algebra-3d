/**
 * ch2_r3 — 矩阵方程的行视图与列视图渲染器
 *
 * 左半：行视图 — 两条直线 + 交点
 * 右半：列视图 — 列向量 a₁, a₂ + 分解 x₁a₁ + x₂a₂ = b
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawInfiniteLine, drawPoint, drawDashedLine, COLORS } from '../draw-utils.js';

export class Ch2R3AxEqBRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;

        // ─── 分隔平面 ─────────────────────────
        // 左半(行视图) x<0 | 右半(列视图) x>0
        const sepX = 0;

        // 分隔虚线
        group.add(drawDashedLine(
            new THREE.Vector3(sepX, -6, 0),
            new THREE.Vector3(sepX, 6, 0),
            0x444466
        ));

        // ─── 左侧：行视图（直线+交点）─────────
        this._buildRowView(group, sd, -6);

        // ─── 右侧：列视图（向量+分解）─────────
        this._buildColumnView(group, sd, 4);

        // ─── 标签 Sprites ────────────────────
        this._addLabel(group, "行视图：直线交点 = 解", -3, 4.5, 0x4cc9f0);
        this._addLabel(group, "列视图：b = x₁a₁ + x₂a₂", 3, 4.5, 0x06d6a0);
    }

    _buildRowView(group, sd, centerX) {
        const lines = sd.row_lines || [];
        const intersection = sd.intersection;

        const colors = [0x4cc9f0, 0x06d6a0];  // line1=blue, line2=green

        lines.forEach((line, idx) => {
            const dir = new THREE.Vector3(line.direction[0], line.direction[1], 0);
            const pt = new THREE.Vector3(
                line.point[0] + centerX, line.point[1], 0
            );
            const color = colors[idx % colors.length];

            // 画无限直线
            group.add(drawInfiniteLine(pt, dir, color, null, 6));

            // 法向量标签
            const normal = line.normal;
            if (normal) {
                const normalLen = Math.sqrt(normal[0] ** 2 + normal[1] ** 2);
                if (normalLen > 0.01) {
                    const nDir = new THREE.Vector3(normal[0] / normalLen, normal[1] / normalLen, 0);
                    // 从原点画法向量方向（指示直线的哪一侧）
                    const nStart = new THREE.Vector3(centerX, 0, 0);
                    const nArrow = new THREE.ArrowHelper(nDir, nStart, 0.8, color, 0.15, 0.1);
                    group.add(nArrow);
                }
            }
        });

        // 交点
        if (intersection) {
            const pt = new THREE.Vector3(
                intersection[0] + centerX, intersection[1], 0
            );
            group.add(drawPoint(pt, 0xffd166, 0.15));

            // 交点虚线投影到坐标轴
            group.add(drawDashedLine(
                new THREE.Vector3(intersection[0] + centerX, intersection[1], 0),
                new THREE.Vector3(centerX, intersection[1], 0),
                0x666688
            ));
            group.add(drawDashedLine(
                new THREE.Vector3(intersection[0] + centerX, intersection[1], 0),
                new THREE.Vector3(intersection[0] + centerX, 0, 0),
                0x666688
            ));

            // 坐标轴标签
            this._addSmallLabel(group, `x₁=${intersection[0].toFixed(1)}`,
                intersection[0] + centerX, -0.3, 0xffd166);
            this._addSmallLabel(group, `x₂=${intersection[1].toFixed(1)}`,
                centerX - 0.5, intersection[1], 0xffd166);
        }
    }

    _buildColumnView(group, sd, centerX) {
        const vectors = sd.col_vectors || [];
        const decomp = sd.decomposition;

        if (vectors.length < 3) return;

        // a₁ (蓝色)
        const a1 = vectors[0].vector;
        group.add(drawVector(
            new THREE.Vector3(a1[0], a1[1], 0),
            0x4cc9f0, 'a₁', group, 1.0
        ));

        // a₂ (绿色)
        const a2 = vectors[1].vector;
        group.add(drawVector(
            new THREE.Vector3(a2[0], a2[1], 0),
            0x06d6a0, 'a₂', group, 1.0
        ));

        if (decomp) {
            const comp1 = decomp.comp1;  // x₁a₁
            const comp2 = decomp.comp2;  // x₂a₂

            // 分解线：从原点画 x₁a₁ (虚线蓝)
            if (Math.abs(decomp.x1) > 0.01) {
                group.add(drawDashedLine(
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(comp1[0], comp1[1], 0),
                    0x4cc9f0
                ));
            }

            // 从 x₁a₁ 的终点画 x₂a₂ (虚线绿)
            if (Math.abs(decomp.x2) > 0.01) {
                group.add(drawDashedLine(
                    new THREE.Vector3(comp1[0], comp1[1], 0),
                    new THREE.Vector3(comp1[0] + comp2[0], comp1[1] + comp2[1], 0),
                    0x06d6a0
                ));
            }

            // 平行四边形补全线（x₂a₂ 从原点，x₁a₁ 从 x₂a₂ 终点）
            if (Math.abs(decomp.x2) > 0.01) {
                group.add(drawDashedLine(
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(comp2[0], comp2[1], 0),
                    0x06d6a0
                ));
            }
            if (Math.abs(decomp.x1) > 0.01) {
                group.add(drawDashedLine(
                    new THREE.Vector3(comp2[0], comp2[1], 0),
                    new THREE.Vector3(comp1[0] + comp2[0], comp1[1] + comp2[1], 0),
                    0x4cc9f0
                ));
            }

            // 系数标签
            this._addSmallLabel(group, `${decomp.x1.toFixed(1)}×a₁`,
                comp1[0] / 2, comp1[1] / 2 + 0.2, 0x4cc9f0);
            if (Math.abs(decomp.x2) > 0.01) {
                this._addSmallLabel(group, `${decomp.x2.toFixed(1)}×a₂`,
                    comp1[0] + comp2[0] / 2, comp1[1] + comp2[1] / 2 + 0.2, 0x06d6a0);
            }
        }

        // b (黄色，最后画确保在顶层)
        const b = vectors[2].vector;
        if (b) {
            const bStart = new THREE.Vector3(0, 0, 0);
            const bEnd = new THREE.Vector3(b[0], b[1], 0);
            const bDir = new THREE.Vector3().subVectors(bEnd, bStart);
            const bLen = bDir.length();
            if (bLen > 0.01) {
                const arrow = new THREE.ArrowHelper(
                    bDir.normalize(), bStart, bLen, 0xffd166, 0.2, 0.12
                );
                group.add(arrow);
            }

            // b 端点球
            if (bLen > 0.01) {
                group.add(drawPoint(
                    new THREE.Vector3(b[0], b[1], 0),
                    0xffd166, 0.12
                ));
            }
        }

        // 原点标记
        group.add(drawPoint(
            new THREE.Vector3(0, 0, 0),
            0xffffff, 0.06
        ));
    }

    _addLabel(group, text, x, y, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(text, 256, 28);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(x, y, -0.5);
        sprite.scale.set(5, 0.55, 1);
        group.add(sprite);
    }

    _addSmallLabel(group, text, x, y, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(text, 128, 22);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(x, y, 0.1);
        sprite.scale.set(2.5, 0.45, 1);
        group.add(sprite);
    }
}
