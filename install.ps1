# 小红书专家 — 安装到 DSH desktop profile
#
# 做三件事（都带备份，可 uninstall.ps1 回滚）：
#   1. 在 profile/node_modules 下建立指向本仓库的目录联接（junction）
#   2. profile/package.json: dependencies 加 "xiaohongshu-expert"
#   3. profile/package.json: dsh.profile.bundles 末尾加 "xiaohongshu-expert"
#
# 跑完需要重启 DeepSeek Harness 才会加载。

[CmdletBinding()]
param(
  [string]$Profile = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),
  [string]$Source  = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$pkgName = 'xiaohongshu-expert'

if (-not (Test-Path $Profile))              { throw "profile 不存在: $Profile" }
if (-not (Test-Path (Join-Path $Source 'package.json'))) { throw "源目录不像插件包: $Source" }

$pkgFile   = Join-Path $Profile 'package.json'
$patchFile = Join-Path $Profile 'cordis.patch.yml'
$target    = Join-Path $Profile "node_modules\$pkgName"
$stamp     = Get-Date -Format 'yyyyMMdd-HHmmss'

# 0. 备份
Copy-Item $pkgFile "$pkgFile.xhsbak-$stamp" -Force
if (Test-Path $patchFile) { Copy-Item $patchFile "$patchFile.xhsbak-$stamp" -Force }
Write-Host "[1/5] 已备份 profile 配置 (后缀 .xhsbak-$stamp)"

# 1. node_modules 链接
if (Test-Path $target) {
  $item = Get-Item $target -Force
  if ($item.LinkType) { Remove-Item $target -Force }
  else { throw "目标已存在且不是链接，请先手动处理: $target" }
}
New-Item -ItemType Junction -Path $target -Target $Source | Out-Null
Write-Host "[2/5] 已建立链接: $target -> $Source"

# 2/3. package.json: dependencies + bundles
$json = Get-Content $pkgFile -Raw -Encoding UTF8 | ConvertFrom-Json
$deps = [ordered]@{}
foreach ($p in $json.dependencies.PSObject.Properties) { $deps[$p.Name] = $p.Value }
$deps[$pkgName] = "file:$($Source -replace '\\','/')"
$json.dependencies = [pscustomobject]$deps

$bundles = @($json.dsh.profile.bundles)
if ($bundles -notcontains $pkgName) { $bundles += $pkgName }
$json.dsh.profile.bundles = $bundles

$json | ConvertTo-Json -Depth 32 | Set-Content $pkgFile -Encoding UTF8
Write-Host "[3/5] dependencies 已写入 $pkgName"
Write-Host "[4/5] bundles 已写入 $pkgName (共 $($bundles.Count) 项)"

# 4. cordis.patch.yml 兜底：如果 bundles 机制没生效，手动补一行 insert
$patchText = if (Test-Path $patchFile) { Get-Content $patchFile -Raw -Encoding UTF8 } else { '' }
if ($patchText -notmatch [regex]::Escape($pkgName)) {
  $block = @"

# 小红书专家（bundle 层未生效时的手动兜底）
- insert:
    - id: $pkgName
      name: '$pkgName'
"@
  Add-Content -Path $patchFile -Value $block -Encoding UTF8
  Write-Host "[5/5] cordis.patch.yml 已追加 insert 行"
} else {
  Write-Host "[5/5] cordis.patch.yml 已含 $pkgName，跳过"
}

Write-Host ''
Write-Host '安装完成。重启 DeepSeek Harness 后，技能目录里会出现 11 个 xiaohongshu-* 技能。'
Write-Host '自检： node scripts/selftest.mjs'
