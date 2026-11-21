# MTR Resource Packs Creator

基于 JavaScript / Node.js 的 Minecraft Transit Railway（MTR）资源包自动化创建器。

当前版本先提供通用项目框架和资源包构建流水线。资源文件由开发者放入输入目录，工具负责读取配置、检查结构、生成元数据、复制资源并可选压缩为 ZIP。MTR 专用资源转换、批量贴图处理和模型生成可在此基础上继续扩展。

## 环境要求

- Node.js 20 或更高版本
- npm

## 快速开始

在仓库根目录安装依赖：

    npm install

`npm install` 会自动触发 `prepare` 脚本执行初始化，因此 IDE 导入项目时（WebStorm / VS Code 导入后通常会自动安装依赖）就已经完成脚手架，无需手动操作。也可以随时手动执行：

    npm run init

初始化是幂等的：项目已存在 `mtr-resource-pack.config.json` 时会直接跳过，重复执行不会覆盖任何已有文件。

初始化时会自动生成一套可直接构建的示例资源包与目录结构（已存在的文件不会被覆盖）：

    resource-pack/
      pack.png                    示例图标（工具生成的 128x128 PNG）
      assets/
        mtr/                      MTR 命名空间资源（按配置的 namespace 生成）
          lang/en_us.json         示例语言覆盖
          textures/example.png    示例贴图（工具生成的 16x16 PNG）
          models/                 模型目录（空，含 .gitkeep 占位）
          sounds/                 音效目录（空，含 .gitkeep 占位）
        minecraft/                Minecraft 原版资源覆盖（按需使用）
      pack.mcmeta                 可选；缺少时会根据配置自动生成

随后把自有资源放进 `resource-pack/` 覆盖或补充示例文件即可。

检查配置和资源目录：

    npm run validate

生成资源包目录和 ZIP：

    npm run build

默认输出：

- dist/resource-pack/：可直接作为资源包目录使用
- dist/mtr-resource-pack.zip：可分发的 ZIP 文件

## 命令行

    node src/cli.js init [directory] [--if-missing]
    node src/cli.js ide [directory]
    node src/cli.js validate [--config file]
    node src/cli.js build [--config file] [--no-archive]
    node src/cli.js setup [--dir name] [--mc version] [--loader version] [--no-assets] [--proxy url]
    node src/cli.js sources [--dir name] [--mc version] [--targets list] [--java path] [--proxy url] [--force]
    node src/cli.js install [--config file] [--dir name] [--no-build]
    node src/cli.js launch [--dir name] [--username name] [--memory 2G] [--java path] [--no-install] [--dry-run]

自定义配置文件可通过 --config 指定。构建时使用 --no-archive 可以跳过 ZIP 输出。初始化时使用 --if-missing 可在项目已初始化时静默跳过（IDE 自动执行 init 时使用这一形式）。

## IDE 启动快捷按钮

`init` 会同时生成 IDE 运行配置，`ide` 命令可随时重新生成，让 WebStorm / IntelliJ 与 VS Code 的启动栏直接出现“构建”和“运行测试”按钮：

- `.vscode/tasks.json`、`.vscode/launch.json`：VS Code 的 Run and Debug 面板与任务列表（launch.json 通过 Node 调试器直接运行 `src/cli.js`，可在 `src/` 内下断点）
- `.vscode/settings.json`：打开共享任务中的自动执行许可（使导入项目时自动运行 `init`），并把 `syntax/schemas/` 下的 JSON Schema 映射到对应的 MTR 资源文件
- `jsconfig.json`：把 `syntax/types/` 的声明文件纳入 JS 工程，让脚本获得 API 补全与类型报错
- `.idea/runConfigurations/*.xml`：WebStorm / IntelliJ 的运行配置（npm 类型，随 VCS 共享，与 package.json 脚本联动）
- `.idea/jsonSchemas.xml`：WebStorm / IntelliJ 的 JSON Schema 映射（随 VCS 共享）

生成的动作与 npm 脚本一一对应：构建资源包（build）、下载测试客户端（setup）、反编译 Java 源码（sources）、安装资源包到测试客户端（install-pack）、启动测试客户端（launch）、运行单元测试（test）。重新执行 `npm run ide` 会原地刷新这些文件。

导入项目时自动执行初始化由两条路径保证：VS Code 通过 `runOn: "folderOpen"` 的初始化任务，WebStorm / IntelliJ 通过导入后自动执行的 `npm install`（即 `prepare` 脚本）。两条路径都调用幂等的 `init --if-missing`，已初始化的项目会静默跳过。

## 语法补全与报错

`syntax/` 目录依据 NTE (A)NTE 官方文档仓库（[aphrodite281/mtr-ante docs](https://github.com/aphrodite281/mtr-ante/tree/alpha/docs)）整理了资源包 JSON 与脚本 API 的语法，供 IDE 提供补全和错误标注：

- `syntax/schemas/`：JSON Schema（draft-07），用于 JSON 键名补全与取值校验报错
  - `eyecandy.schema.json` → `assets/mtrsteamloco/eyecandies/*.json`
  - `rail-model.schema.json` → `assets/mtrsteamloco/rails/*.json`
  - `mtr-custom-resources.schema.json` → `mtr_custom_resources.json`
- `syntax/types/`：TypeScript 全局声明文件，用于列车 / 装饰物件脚本的 API 补全与类型报错
  - `mtrsteamloco-core.d.ts`：共享环境（`Resources`、`ComponentUtil`、数学类型、`ConfigResponder` 等）
  - `mtrsteamloco-render.d.ts`：模型处理与绘制调用（`RawModel`、`ModelCluster`、`DrawCall` 等）
  - `mtrsteamloco-scripts.d.ts`：脚本入口、`Train`/`BlockEntityEyeCandy`、`DisplayHelper`、`GraphicsTexture`

`npm run ide` 会生成 `.vscode/settings.json`（`json.schemas`）、`.idea/jsonSchemas.xml` 与 `jsconfig.json`，让 VS Code 和 WebStorm / IntelliJ 自动加载上述语法：在对应 JSON 文件中输入键名会补全，写错键名或类型会立刻标红；脚本中可使用全局 API 补全，参数不匹配会给出类型报错。

> 声明文件仅覆盖文档已记录的 API，未出现在文档中的成员不作声明。脚本运行于 Rhino 1.7.14（ES6，严格模式），且 MTR/NTE 返回的是 Java 字符串，取长度请用 `str.length()`。

## 测试客户端自动化

仓库不依赖 Gradle，全部自动化能力都由 Node.js 提供。setup 命令会用公开 API 组装一个可直接启动的 Minecraft 1.20.1 + Fabric 测试环境：

- 从 Mojang 版本清单下载 Minecraft 1.20.1 客户端、全部库文件和资源文件（assets）
- 从 Fabric Meta 解析并下载 Fabric Loader 及其依赖库
- 从 Modrinth 下载 Fabric API、Architectury API（MTR 的必需运行时依赖），以及 MTR 相关模组（默认 ybOYitTg=MTR-ANTE、U75MCH6y=YMTR，均按指定版本 ID 固定）
- 解压 LWJGL 等原生库（natives），并写入环境清单

    npm run setup

安装到 minecraft-test/ 目录，结构为标准启动器布局（versions/、libraries/、assets/、mods/）。可用 --no-assets 跳过体积较大的资源文件下载。

启动测试客户端：

    npm run launch

launch 会复用 setup 下载的内容，拼装 classpath 与 JVM/游戏参数并调用本地 Java（需 Java 17+，可通过 JAVA_HOME 或 --java 指定）启动 Fabric 客户端。使用 --dry-run 可以只打印启动参数而不真正启动，便于排查。

启动前会自动接入资源包，无需手动安装：

1. 先执行一次构建，生成最新的 `dist/mtr-resource-pack.zip`；
2. 把 ZIP 复制到 `minecraft-test/resourcepacks/`；
3. 在 `minecraft-test/options.txt` 的 `resourcePacks` 中登记 `file/mtr-resource-pack.zip`（追加在列表末尾以获得最高优先级），使其进入已启用列表。

因此每次 launch 加载的都是当前代码的构建产物。只想刷新客户端里的资源包而不启动游戏时，执行：

    npm run install-pack

install 同样会先构建再安装（用 --no-build 可改为安装现有构建）。如果希望启动时完全不改动客户端，使用 `launch --no-install`。

Minecraft 版本、Fabric Loader 版本、测试目录名以及要安装的模组列表都定义在 src/core/environment.js，可按需调整。

## Java 源码反编译

MTR 模组与 API 的源码不在仓库中，想在 IDE 里直接读 Java 源码时，用 `sources` 命令把测试客户端里的编译产物反编译成 `.java` 落盘，无需引入 Gradle：

    npm run sources

流程分两步：

1. Minecraft 本体：先用 Mojang 官方映射（`client.txt`）反混淆混淆过的 `1.20.1.jar`，再反编译。否则只能得到 `a`/`b`/`c` 这样的名字。
2. 模组：直接反编译 `minecraft-test/mods/` 下的每个 jar。

反编译用两个独立的命令行工具完成，首次运行会从 Maven Central 下载到 `minecraft-test/.mtr-test/tools/`（不进版本库）：

- [Vineflower](https://github.com/Vineflower/vineflower) 1.12.0：jar → `.java`，并把 `libraries/` 下的库作为 external 传入以补全签名
- [SpecialSource](https://github.com/agaricusb/SpecialSource) 1.11.6：按官方映射重命名 jar 中的类

产物位置（`minecraft-test/` 整体已被 `.gitignore` 忽略）：

- `minecraft-test/decompiled/minecraft/`：反混淆后的 Minecraft 本体
- `minecraft-test/decompiled/mods/<jar 名>/`：各模组

命令是幂等的：`minecraft-test/.mtr-test/decompiled.json` 记录来源 jar 的大小与修改时间，未变化时直接跳过；需要强制重做时加 `--force`。只反编译其中一部分可以指定目标：

    npm run sources -- --targets minecraft
    npm run sources -- --targets mods

`--targets` 支持 `minecraft`、`mods`、`all`（默认全部）。与 setup 一致，Java 可用 `--java` 或 JAVA_HOME 指定（需 Java 17+），网络可用 `--proxy` 指定。

在 IDE 中查看：

- 反编译结果落在项目树内的 `minecraft-test/decompiled/`，WebStorm 与 IntelliJ 都能直接展开并打开这些 `.java` 文件。
- 需要注意 **WebStorm 本身不提供 Java 支持**，无法像 IntelliJ IDEA 那样在点击类名时即时反编译或跳转；WebStorm 中只能作为文件浏览。在 IDEA 中打开同一目录则可以使用常规的符号导航。
- 模组 jar 中的 Minecraft 引用仍是 Fabric 的 intermediary 名称（如 `net.minecraft.class_310`），模组自身的类名与方法名是可读的；只有 Minecraft 本体经过官方映射反混淆。
- `decompiled/` 下文件数量较大，如遇编辑器索引变慢，可在 IDE 中把该目录标记为排除（Excluded）。

> 当前版本只覆盖 Minecraft 本体与模组。Java 库的官方 `-sources.jar` 下载、以及为 IntelliJ IDEA 生成 `.idea/libraries` 挂载配置尚未实现。

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
        initializer.js          初始化项目（示例资源包 + IDE 配置）
        sample.js               生成示例资源包与占位目录
        ide.js                  生成 VS Code / WebStorm 运行配置与语法映射
        download.js            下载/校验/并发等通用工具
        environment.js         下载并组装 Minecraft + Fabric 测试环境
        decompiler.js          下载 Vineflower / SpecialSource 并调用反编译
        sources.js             反混淆并反编译测试客户端与模组
        installer.js            构建产物装入测试客户端并在 options.txt 中启用
        launcher.js             拼装启动参数并启动测试客户端
    tests/
      core.test.js              核心逻辑测试
    syntax/
      schemas/                  JSON Schema（资源包 JSON 的补全与校验）
      types/                    脚本 API 的 TypeScript 全局声明文件

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
