/**
 * ch3_r12 — 初等矩阵与行变换（左乘）渲染器
 *
 * 展示左乘初等矩阵 = 行变换的几何效果。
 * 实际渲染逻辑在 _elem_transform_base.js 的 ElemTransformBaseRenderer 中。
 */
import { ElemTransformBaseRenderer } from './_elem_transform_base.js';

export class Ch3R12ElemRowRenderer extends ElemTransformBaseRenderer {
    static CONFIG = {
        colors: [0x4cc9f0, 0xffd166],       // A: blue, EA: yellow
        arrowLabel: '左乘 E',
        storageKey: 'la_ch3r12_anim_auto',
    };
}
