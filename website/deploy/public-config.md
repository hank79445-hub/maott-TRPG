# 受保护的公网实例配置

先准备由你管理的HTTPS入口和反向代理。后端保持回环监听，不把裸HTTP房间端口直接当公共站点。

## 创建自己的账号配置

在项目根目录执行，目标文件必须不存在：

```sh
node scripts/create-access.mjs --output .local/access.json --username gm
```

工具创建永久账号ID、随机签名密钥和口令哈希，并在本机终端仅显示一次随机密码。保存到自己的密码管理器，不把输出、配置或运行数据提交到仓库。已有目标不会被覆盖。

## 必须配置的环境变量

设置TRPG_PUBLIC_ORIGIN为你的完整HTTPS源地址（没有路径），TRPG_ROOM_HOST为127.0.0.1。TRPG_ROOM_DATA、TRPG_STATIC_DIR和TRPG_TEST_ACCESS_FILE使用实际绝对路径，分别指向自己的房间目录、构建后的dist和上一步配置。TRPG_SCRIPT_DATA同样使用自己的绝对目录。通过受信本机代理访问时按部署方式设置TRPG_TRUST_LOOPBACK_PROXY=1。

可选QQ另需自己的Bot配置，不影响Web主线。不要复制作者的私测地址、部署身份或账号。

## PowerShell配置示例

在项目根目录运行，域名需要替换为自己已配置的HTTPS入口。以下目录全部属于当前安装：

```powershell
$env:TRPG_PUBLIC_ORIGIN = 'https://tabletop.example.org'
$env:TRPG_ROOM_HOST = '127.0.0.1'
$env:TRPG_ROOM_PORT = '8787'
$env:TRPG_ROOM_DATA = [IO.Path]::GetFullPath('.local/rooms')
$env:TRPG_STATIC_DIR = [IO.Path]::GetFullPath('dist')
$env:TRPG_TEST_ACCESS_FILE = [IO.Path]::GetFullPath('.local/access.json')
$env:TRPG_SCRIPT_DATA = [IO.Path]::GetFullPath('.local/scripts')
pnpm start
```

这些环境变量仅对当前终端及其子进程生效。使用系统服务时，把相同变量加入自己的服务配置。只有实际使用受信本机反向代理并正确清洗转发头时，才启用TRPG_TRUST_LOOPBACK_PROXY。

## 启动与检查

先完成pnpm build，再在同一环境中pnpm start。反向代理转发到实际回环端口。打开你配置的HTTPS源地址，检查登录、账号个人库、房间邀请和公开投影；普通房间GM不拥有本机Bot凭据管理权限。

[账号概念](./accounts) · [网络访问](./network) · [数据维护](./data)
