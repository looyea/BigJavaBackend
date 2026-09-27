@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Big Java Backend - 生产预览 (PROD)

rem ============================================================
rem   Big Java Backend · 大Java后端 —— 生产 / 部署预览启动脚本
rem   本站「零依赖纯静态、构建即源码」：整个目录即最终可部署产物，
rem   直接丢给 Nginx / 对象存储 / GitHub Pages / 任意 CDN 即可上线。
rem   本脚本先在本地模拟这层静态托管，并附带一次内容自检。
rem ============================================================

set "PORT=8080"
set "URL=http://127.0.0.1:%PORT%/"

set "SRV="
where py >nul 2>nul      && set "SRV=py -3 -m http.server %PORT%"
if not defined SRV where python >nul 2>nul  && set "SRV=python -m http.server %PORT%"
if not defined SRV where python3 >nul 2>nul && set "SRV=python3 -m http.server %PORT%"
if not defined SRV where node >nul 2>nul    && set "SRV=npx --yes http-server -p %PORT% -c-1 ."

if defined SRV goto :check

echo [错误] 未检测到 Python 或 Node，无法启动静态服务器。
echo        本项目是纯静态站，任选其一安装后即可运行；
echo        或用你现有的任意静态服务器（Nginx / Apache / serve 等）托管本目录。
echo.
pause
exit /b 1

:check
rem 若装有 Node，先跑一次内容 / 结构自检（失败不阻断托管，仅提示）
where node >nul 2>nul
if errorlevel 1 (
  echo [提示] 未检测到 Node，跳过内容自检（scripts/check.mjs 需要 Node）。
  goto :start
)
echo [1/2] 正在执行内容自检：node scripts\check.mjs ...
node scripts\check.mjs
if errorlevel 1 echo [警告] 自检发现告警，请查看上方输出；仍继续启动托管以便预览。

:start
echo.
echo ============================================================
echo   Big Java Backend - 大Java后端   生产预览模式 (PROD) 启动中...
echo   站点    :  %URL%       （浏览器自动打开）
echo   服务命令:  %SRV%
echo   部署提示:  本站为纯静态资源，把整个目录交付任意静态服务器即可上线
echo   停止    :  本窗口按 Ctrl + C
echo ============================================================
echo.
start "" cmd /c "timeout /t 2 >nul & start %URL%"

%SRV%

echo.
echo [生产预览服务已退出]
pause
