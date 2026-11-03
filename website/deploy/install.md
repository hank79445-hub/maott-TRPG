---
title: 获取版本与安装依赖
description: 固定版本后安装，保留锁文件。
---

# 获取版本与安装依赖

> 适用：自行部署者 · 公共版 0.57.0-public.1 · 使用指南

固定版本后安装，保留锁文件。

## 开始前

准备自己的可写目录与终端。操作对象是自己的部署，不包含作者的运行环境或账号。

## 按步骤操作

### 01 · 从公开仓库获取指定标签或发行源码

从公开仓库获取指定标签或发行源码，进入含package.json的项目根目录。

### 02 · 运行 pnpm install --frozen-lockfile --prod=false

运行 pnpm install --frozen-lockfile --prod=false，保留pnpm-lock.yaml；原生依赖按包管理器明确要求构建。

### 03 · 运行 pnpm typecheck 和 pnpm test

运行 pnpm typecheck 和 pnpm test，查看当前公共版验证结果。

## 当前可用的获取方式

下载[完整公开版源码包](/downloads/maott-trpg-public-source.zip)，解压进入含package.json的目录。GitHub首次公开推送等待作者登录，下方git clone供仓库上线后使用；从源码包开始时跳过这两行。

## 命令示例

在项目根目录执行，终端成功后再继续。

```sh
git clone https://github.com/hank79445-hub/maott-TRPG.git
cd maott-TRPG
pnpm install --frozen-lockfile --prod=false
pnpm typecheck
pnpm test
```

## 完成后检查

- 依赖安装正常结束，锁文件没有被改写。
- typecheck和公共版定向测试均通过，再进行构建。

## 边界与常见错误

首次安装需要网络。源码包不是已捆绑Node运行时的双击安装器。

原生依赖失败时检查Node版本、平台与编译要求，不删除锁文件规避问题。

## 继续阅读

- [上一篇：环境要求](./requirements)
- [下一篇：构建、启动与正常关闭](./run)
- [遇到问题](/help/) · [当前支持范围](/about/status)
