# MTR Resource Packs Creator

基于 JavaScript / Node.js 的 Minecraft Transit Railway（MTR）资源包自动化创建器。

当前版本先提供通用项目框架和资源包构建流水线。资源文件由开发者放入输入目录，工具负责读取配置、检查结构、生成元数据、复制资源并可选压缩为 ZIP。MTR 专用资源转换、批量贴图处理和模型生成可在此基础上继续扩展。

## 环境要求

- Node.js 20 或更高版本
- npm

## 快速开始

在仓库根目录安装依赖：

    npm install

初始化资源包项目：

    npm run init

将资源文件放入：

    resource-pack/
      pack.mcmeta          可选；缺少时会根据配置自动生成
      pack.png             可选；资源包图标
      assets/
        mtr/               MTR 命名空间资源
        minecraft/         Minecraft 原版资源覆盖（按需使用）

检查配置和资源目录：

    npm run validate

生成资源包目录和 ZIP：

    npm run build

默认输出：

- dist/resource-pack/：可直接作为资源包目录使用
- dist/mtr-resource-pack.zip：可分发的 ZIP 文件

## 命令行

    node src/cli.js init [directory]
    node src/cli.js validate [--config file]
    node src/cli.js build [--config file] [--no-archive]

自定义配置文件可通过 --config 指定。构建时使用 --no-archive 可以跳过 ZIP 输出。

## 配置说明

初始化后会创建 mtr-resource-pack.config.json。主要字段：

| 字段 | 作用 |
| --- | --- |
| name | 项目标识名称 |
| version | 项目版本标识，供后续扩展使用 |
| author | 作者信息 |
| namespace | 默认资源命名空间，初始化示例为 mtr |
| pack.packFormat | Minecraft 资源包格式版本 |
| pack.description | 自动生成 pack.mcmeta 时使用的描述 |
| paths.source | 输入资源目录 |
| paths.output | 构建输出目录 |
| paths.archive | ZIP 输出路径 |
| archive.enabled | 是否默认生成 ZIP |

示例配置中的 packFormat 为 15，仅作为 Minecraft 1.20.1 项目的起点。使用其他 Minecraft 版本时，请按目标版本修改，不要直接沿用示例值。

如果输入目录中已经存在 pack.mcmeta，构建器会保留该文件；缺少时才会按配置自动生成。若已有文件中的 pack_format 与配置值不同，校验会给出警告，但不会覆盖用户文件。

## 设计结构

    src/
      cli.js                  命令行入口
      index.js                对外 API
      core/
        config.js             配置读取与校验
        paths.js              路径安全检查
        validator.js           资源包结构校验
        metadata.js            pack.mcmeta 生成
        generator.js            构建与目录替换
        archive.js              ZIP 压缩
        initializer.js          初始化项目
    tests/
      core.test.js              核心逻辑测试

构建流程：

1. 读取并校验 JSON 配置。
2. 检查输入目录、资源命名空间和 pack.mcmeta。
3. 将资源复制到临时目录，拒绝符号链接并跳过常见系统文件。
4. 自动补齐缺失的 pack.mcmeta。
5. 将临时目录替换为正式输出目录。
6. 根据配置可选生成 ZIP 文件。

输入目录与输出目录不允许互相嵌套，避免清理或构建时误删源文件。ZIP 输出也必须位于输入和输出目录之外。

## 开发与测试

运行测试：

    npm test

核心 API 可从 src/index.js 导入。后续可新增独立 adapter / transformer 模块处理特定 MTR 版本的数据格式，而不需要将这些逻辑塞进 CLI 或通用生成器。

## 当前范围

此版本是可运行的通用构建骨架，不包含 MTR 特定 JSON、贴图、模型或站牌数据的自动转换规则。此类规则应根据目标 MTR 版本和实际资源格式逐项实现。
