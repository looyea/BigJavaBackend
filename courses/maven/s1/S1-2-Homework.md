# 继承、聚合与多模块、BOM · 作业

## 作业 1：三模块工程搭建

**目标**：common → service → web 分层聚合工程跑通。

1. 建根 POM（packaging=pom）+ 三模块，web 依赖 service、service 依赖 common。
2. `mvn -pl service -am test` 验证只构建 service+common（输出：反应堆模块列表）。
3. 人为让 common 依赖 web → 构建报错读环信息（错误用例：循环依赖报错原文截图并写解法）。

## 作业 2：${revision}+flatten 全流程

**目标**：全仓版本只在一处。

1. 按课文配 flatten 插件，`mvn -Drevision=2.1.0-SNAPSHOT install`。
2. 打开 `~/.m2` 里安装后的 POM 检查版本已是 2.1.0-SNAPSHOT（验收：无 ${revision} 字面量）。
3. 注释掉 flatten 重装 → 对比仓库 POM 差异（结果：坐实"经典坑"）。

## 作业 3：BOM 优先级实验

**目标**：验证多 BOM 的先 import 者优先。

1. parent 先后 import 两个声明不同 jackson 版本的 BOM → `dependency:tree` 看实际生效者。
2. 调换 import 顺序复测 → 版本随之变化（输出：两次 tree 对照）。
3. 给出团队规约草案：公司 BOM 永远第一位 + 关键组件显式钉版本。
