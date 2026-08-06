# 工作日志：标签吸附、空心方框、浏览器缓存与启动脚本修复

> 2026年8月6日 · 本次会话聚焦两个用户报告的 Bug 和一个基础设施问题。

---

## 一、Bug 1：3D 标注位置不跟随形状动画（标签吸附）

### 现象

在 ch2_r0（矩阵乘法）、ch2_r1（逆矩阵）、ch3_r12（初等行变换）、ch3_r13（初等列变换）、matrix_calculator 等动画场景中，3D 形状（平行四边形/长方体）发生变换后，其名称标签仍停留在原位——多个形状重叠后用户无法分辨谁是谁。

### 根因

标签通过 `THREE.Sprite` 实现（Canvas 2D 绘制文字 → 贴到 Sprite）。旧代码中 sprite 的 `position` 是硬编码的固定坐标：

```js
// ❌ 旧代码：固定位置
sprite.position.set(offsetX, -2.8, -1);
```

动画只更新了形状的顶点位置（`wire.updateVertices()` / `face.updateVertices()`），但没有更新 sprite 的位置。

### 修复方案

**一、标签位置改为基于形状重心计算**（而非硬编码坐标）：

```js
// ✅ 新代码：重心定位
const cx = unitVerts.reduce((s, v) => s + v[0], 0) / unitVerts.length;
const minY = Math.min(...unitVerts.map(v => v[1]));
sprite.position.set(cx, minY - 0.7, -1);
```

**二、把 labelSprite 引用存入 `_animShapes`**，在 `_interpolateToT()` 中随形状顶点插值同步更新：

```js
// 每个形状对象增加 labelSprite 字段
this._animShapes.push({ wire, face, unitVerts, transformedVerts, labelSprite: null });

// _interpolateToT() 中：
if (labelSprite) {
    const cx = interp.reduce((s, v) => s + v[0], 0) / interp.length;
    const minY = Math.min(...interp.map(v => v[1]));
    labelSprite.position.set(cx, minY - 0.7, -1);
}
```

**三、多形状场景中，每个形状各自一个独立标签**（而非一个合并标签）：

- ch2_r0：4 个形状 → 4 个独立标签（「原始」「B」「A(B)」「AB」）
- ch2_r1 可逆分支：3 个形状 → 3 个独立标签（「原始」「A」「A^{-1}(A)」）
- ch2_r1 不可逆分支：2 个形状 → 2 个独立标签（「原始」「A（降维）」）

### 修改文件

| 文件 | 改动 |
|------|------|
| `client/js/renderers/ch2_r0_matrix_multiply.js` | 拆分合并标签为 4 个独立标签 + 重心定位 + labelSprite 追踪 |
| `client/js/renderers/ch2_r1_matrix_inverse.js` | 可逆/不可逆分支各自独立标签 + labelSprite 追踪 |
| `client/js/renderers/ch3_r12_elem_row.js` | 重心定位 + labelSprite 追踪 |
| `client/js/renderers/ch3_r13_elem_col.js` | 重心定位 + labelSprite 追踪 |
| `client/js/renderers/matrix_calculator.js` | 重心定位 + labelSprite 追踪 |

---

## 二、Bug 2：矩阵名称显示为空心方框（□ tofu）

### 现象

用户反馈矩阵名字在 3D 区域中显示为空心方框（□），如「Aᵀ」的转置符号、「A⁻¹」的上标等。

### 根因分析（逐字符排查）

Canvas 2D 的 `fillText()` 使用 `sans-serif` 字体。在 Windows 上，`sans-serif` 实际映射为 **Arial**。Arial 字体**不包含**以下 Unicode 区段的字形：

| 字符 | Unicode | 所在区段 | Arial 支持？ |
|------|---------|----------|-------------|
| `ᵀ` (上标大写 T) | U+1D40 | 语音学扩展（Phonetic Extensions） | ❌ 不在 Arial 中 |
| `⁻` (上标减号) | U+207B | 上标下标（Superscripts and Subscripts） | ⚠️ 部分系统缺失 |
| `⟨` `⟩` (尖括号) | U+27E8/U+27E9 | 杂项数学符号-A | ❌ 不在 Arial 中 |
| `✓` `✗` (对号叉号) | U+2713/U+2717 | 丁贝符（Dingbats） | ❌ 不在 Arial 中 |
| `□` (空心方框) | U+25A1 | 几何形状（Geometric Shapes） | ⚠️ 部分系统缺失 |

**核心教训**：Canvas 2D 没有字体回退（font fallback）机制——如果当前字体没有某个字形，直接渲染成空心方框（tofu □），不会像浏览器 DOM 那样自动切换到有该字形的字体。

特别地，`ᵀ`（U+1D40, MODIFIER LETTER CAPITAL T）属于 Plane 1 / SMP（辅助多语言平面），绝大多数西文字体都不覆盖此区段。

### 修复方案

**原则：3D 标签只用 ASCII 字符 + 中文常用字**，避免使用以下类别的 Unicode：

- 数学字母数字符号（Mathematical Alphanumeric Symbols, U+1D400–U+1D7FF）
- 语音学扩展（Phonetic Extensions, U+1D00–U+1D7F）
- 杂项数学符号（Miscellaneous Mathematical Symbols, U+27C0–U+27EF）
- 上标下标区的特殊符号

具体替换：

| 场景 | 旧内容 | 新内容 |
|------|--------|--------|
| ch2_r2（转置） | `'Aᵀw'` | `'A^T w'` |
| ch2_r2（转置） | `'⟨Av,w⟩'` | `'<Av,w>'` |
| ch2_r2（转置） | `'✓'` / `'✗'` | `'OK'` / `'X'` |
| ch2_r1（逆矩阵） | `'A⁻¹(A)'` | `'A^{-1}(A)'` |

### 修改文件

| 文件 | 改动 |
|------|------|
| `client/js/renderers/ch2_r2_matrix_transpose.js` | 替换所有非 ASCII 标签字符 |
| `client/js/renderers/ch2_r1_matrix_inverse.js` | 上标符号替换为 LaTeX 风格 |

### 未来预防

新增任何 3D 标签时，自检：这个字符串里有没有非 ASCII 字符？如果有，它在你当前系统的 Arial 字体里能显示吗？不确定就用 ASCII 替代。

---

## 三、浏览器缓存问题（start.bat 打开的是旧界面）

### 现象

- VSCode 内置浏览器（Simple Browser）看到的是新版界面
- `start.bat` 打开的外部浏览器（Chrome/Edge）看到的是旧界面
- 无痕窗口（Ctrl+Shift+N）看到新版——确认是缓存问题
- 用户按 F12 找不到 Network 标签（因为 VSCode Simple Browser 没有完整 DevTools）

### 根因链路（三层缓存）

```
index.html（无 Cache-Control）
  → 浏览器缓存了旧版 index.html
    → 旧版 index.html 里 <script src="main.js"> 没有 ?v=3 版本号
      → 浏览器用缓存的旧版 main.js
        → main.js 的 import 链也都是旧版
```

**缺失的环节**：服务器只在 `/client/{file_path}` 路径上设置了 `Cache-Control: no-store`，但根路由 `/`（返回 index.html）没有设置任何缓存头。

### 修复

**1. 根路由加上缓存控制头**（[server/main.py](server/main.py)）：

```python
@app.get("/")
async def root():
    headers = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
    }
    return FileResponse(CLIENT_DIR / "index.html", headers=headers)
```

**2. index.html 中 main.js 加上版本号**：

```html
<script type="module" src="/client/js/main.js?v=3"></script>
```

**3. 整条链路的缓存控制现在齐全**：

```
GET /                          → Cache-Control: no-store  ← 本次新增
GET /client/js/main.js?v=3     → Cache-Control: no-store
GET /client/js/renderers/*.js  → Cache-Control: no-store
GET /client/css/style.css      → Cache-Control: no-store
```

### 注意事项

- ES module 的 `import` 语句由浏览器自动发起请求，不走 `<script>` 标签——但只要服务器返回了正确的 `Cache-Control` 头，浏览器就不会缓存
- 用户第一次修复后仍可能需要 **Ctrl+Shift+R** 硬刷新一次，因为旧缓存可能还在浏览器内存中。此后不再需要。

---

## 四、start.bat 重写（乱码 + 启动失败）

### 问题 1：旧 start.bat 点开即消失

旧版脚本内容已不可考，现象是双击后命令行窗口闪一下（~0.5 秒）就消失，没有服务器进程启动。推测是脚本中有错误导致立即退出。

### 问题 2：中文乱码（UTF-8 vs CP936）

修复后的 start.bat 包含中文 echo 语句。文件本身以 UTF-8 编码保存，但 Windows 的 `cmd.exe` 默认用 **CP936（GBK）** 解码 .bat 文件。UTF-8 的中文被当作 GBK 解码 → 乱码（如 `繘绋?`、`彛鍗冲仠姝㈡湇鍔★級`）。

### 修复：纯 ASCII 英文重写

整个 start.bat 不再使用任何非 ASCII 字符，所有提示信息改为英文。

### start.bat 最终功能

1. **杀旧进程**：`netstat -ano | findstr ":8765.*LISTENING"` 查找占用端口的进程 → `taskkill /F`
2. **找 Python**：使用 conda 环境的绝对路径 `D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe`
3. **启动服务器**：`start /MIN cmd /c "... python app.py"` 在最小化窗口中启动
4. **轮询就绪**：PowerShell 检测端口 8765 是否可达，最多等 15 秒
5. **打开浏览器**：`start "" http://localhost:8765`

### 注意事项

- Windows .bat 文件的编码必须是 **系统默认 ANSI 代码页**（中文 Windows = CP936/GBK），否则中文乱码
- 如果必须用中文，保存时选「ANSI」编码而非「UTF-8」
- 更稳健的做法：像这次一样全部用 ASCII 英文，彻底避免编码问题

---

## 五、修改文件汇总

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `client/js/renderers/ch2_r0_matrix_multiply.js` | **修改** | 拆分合并标签为 4 个独立标签 + 重心定位 + labelSprite 动画追踪 |
| `client/js/renderers/ch2_r1_matrix_inverse.js` | **修改** | 可逆/不可逆分支各独立标签 + 字符替换 + labelSprite 追踪 |
| `client/js/renderers/ch2_r2_matrix_transpose.js` | **修改** | 替换非 ASCII 字符（ᵀ→^T, ⟨⟩→<>, ✓✗→OK/X） |
| `client/js/renderers/ch3_r12_elem_row.js` | **修改** | 重心定位 + labelSprite 追踪 |
| `client/js/renderers/ch3_r13_elem_col.js` | **修改** | 重心定位 + labelSprite 追踪 |
| `client/js/renderers/matrix_calculator.js` | **修改** | 重心定位 + labelSprite 追踪 |
| `client/index.html` | **修改** | main.js 加 `?v=3` 缓存破坏参数 |
| `server/main.py` | **修改** | 根路由 `/` 加 Cache-Control no-store 头 |
| `start.bat` | **重写** | 纯 ASCII 英文 + 端口占用清理 + 启动轮询 |
| `CLAUDE.md` | **修改** | 基础设施待办项 + 场景标题栏菜单按钮 |

---

## 六、给未来 AI 的教训

### 6.1 Canvas 2D 标签字符选择

**铁律：3D 场景中的 Canvas 2D 标签只使用 ASCII 字符 + 中文。**

禁用类别：
- 数学字母数字符号（U+1D400–U+1D7FF）：如 `ᵀ`、`𝐀`、`𝑨`
- 杂项数学符号（U+27C0–U+27EF）：如 `⟨` `⟩`
- 丁贝符（U+2700–U+27BF）：如 `✓` `✗`
- 语音学扩展（U+1D00–U+1D7F）：如 `ᵀ`

替代方案：
- 上标/转置 → `^T` 而非 `ᵀ`
- 尖括号 → `<>` 而非 `⟨⟩`
- 对号叉号 → `OK` / `X` 而非 `✓` / `✗`
- 逆矩阵 → `A^{-1}` 而非 `A⁻¹`

**为什么 DOM 里能显示但 Canvas 不行？** DOM 有字体回退（font fallback），浏览器会自动从系统中找能渲染该字符的字体。Canvas 2D 没有——指定的字体缺字形就直接画 tofu。

### 6.2 标签吸附的通用模式

任何包含动画形状 + 文字标签的场景，必须：

1. 标签位置基于形状**重心**计算，不硬编码坐标
2. 把 labelSprite 引用存入动画追踪结构
3. `_interpolateToT(t)` 中同步更新标签位置

如果不做这些，标签在动画中会「脱锚」。

### 6.3 浏览器缓存的三层防线

开发阶段（本项目当前处于开发阶段）必须确保：

1. **根路由 `/`** 有 `Cache-Control: no-store`（返回 index.html）
2. **所有 `/client/**` 路径**有 `Cache-Control: no-store`（JS/CSS/HTML）
3. **入口 script 标签**带版本号（`main.js?v=N`），每次重大更新后 +1

防线 1+2 是服务器端（已在本次修复），防线 3 是兜底。缺少任何一层都可能导致用户看到旧界面。

### 6.4 Windows 批处理文件编码

- `.bat` 文件在中文 Windows 上默认以 **GBK/CP936** 解码
- 如果文件是 UTF-8，中文必定乱码
- **最佳实践**：用纯 ASCII 英文写 .bat 文件，彻底避开编码问题
- 如果必须含中文 → 保存时选 ANSI 编码（记事本 → 另存为 → 编码 → ANSI）

### 6.5 排查「改了代码但不生效」

优先级排查顺序：

1. 浏览器缓存？（无痕窗口测试）
2. 服务器确实在运行新代码？（看终端日志，查文件 MD5）
3. 端口被旧进程占用？（`netstat -ano | findstr ":8765"`）
4. 多个 Python 进程？（`tasklist | findstr python`）
