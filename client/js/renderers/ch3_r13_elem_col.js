/**
 * ch3_r13 — 初等矩阵与列变换（右乘）渲染器
 *
 * 展示右乘初等矩阵 = 列变换的几何效果。
 * 实际渲染逻辑在 _elem_transform_base.js 的 ElemTransformBaseRenderer 中。
 */
import { ElemTransformBaseRenderer } from './_elem_transform_base.js';

export class Ch3R13ElemColRenderer extends ElemTransformBaseRenderer {
    static CONFIG = {
        color: 0xef476f,                    // AE: red
        storageKey: 'la_ch3r13_anim_auto',
    };
}
