# Java 9-11：模块化与 LTS 落地 · 作业

> 不判分，对照参考要点自查。

## 作业 1：库改进速练（必做）

用 `jshell` 或写个 main，验证：① `List.of(1,2,3)` 调 `add` 抛异常；② `List.copyOf(可变list)` 得到不可变副本；③ `"  x  ".strip()` 与 `trim()` 对全角空格 `"\u3000a"` 的差异；④ `"ab".repeat(3)`、`"   ".isBlank()`。

**参考要点**：`List.of` 不可变；`strip` 基于 Character 能去全角空白、`trim` 只去 ASCII ≤U+0020；`isBlank` 纯空白为 true。

## 作业 2：var 边界实验（必做）

写一段代码分别尝试 `var a = 1;`、`var b;`、`var c = null;`、把 `var` 用在字段/方法参数上，记录哪些编译失败及原因。

**参考要点**：`var b;`（无初始化）、`var c = null;`（无法推断）、字段/参数/返回用 var 都编译错；var 仅限有初值的局部变量（含 lambda 参数，Java 11）。

## 作业 3：升级 8→11 迁移清单（必做）

挑一个（或虚构）JDK 8 的 Spring 项目，列出升级到 11 需要检查/改动的 5 项，并说明每项应对。

**参考要点**：① 编译/运行插件与字节码库（CGLIB/ASM）版本；② 内部 API/`sun.misc.Unsafe` 替换；③ 反射私有成员加 `--add-opens`；④ GC 从 CMS→G1 参数调整；⑤ 授权/发行版选型（Temurin/Corretto）。

## 作业 4：jlink 精简镜像（选做）

为自己写的一个小应用（可用示例工程）通过 `jdeps` 找出依赖、`jlink --add-modules ... --output runtime` 生成自定义运行时，对比它与完整 JDK 目录体积，并写一句 Dockerfile 用该镜像。

**参考要点**：`jlink --strip-debug --no-header-files --no-man-pages --compress=2` 进一步瘦身；收益是容器基础镜像大幅变小、攻击面收敛。

## 作业 5：module-info 与反射坑（选做）

给一个模块写 `module-info.java` 只 `exports` 但不 `opens` 某被 Jackson 序列化的包，运行 `ObjectMapper.writeValue` 复现异常，再用 `opens` 修复，写一句话说明 exports 与 opens 的职责差异。

**参考要点**：`InaccessibleObjectException` → 加 `opens com.x.model;`（或 `--add-opens`）修复；exports=编译期可读、opens=运行时反射可深访问。
