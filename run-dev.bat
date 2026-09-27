@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Big Java Backend - 本地开发 (DEV)

rem ============================================================
rem   Big Java Backend · 大Java后端 —— 本地开发 / 学习启动脚本
rem   本站是「零依赖纯静态」站：无 npm 安装、无构建，源码目录即站点。
rem   本脚本自动探测可用的静态服务器（优先 Python，回退 Node）并托管当前目录。
rem ============================================================

set "PORT=5180"
set "URL=http://127.0.0.1:%PORT%/"

set "SRV="
where py >nul 2>nul      && set "SRV=py -3 -m http.server %PORT%"
if not defined SRV where python >nul 2>nul  && set "SRV=python -m http.server %PORT%"
if not defined SRV where python3 >nul 2>nul && set "SRV=python3 -m http.server %PORT%"
if not defined SRV where node >nul 2>nul    && set "SRV=npx --yes http-server -p %PORT% -c-1 ."

if defined SRV goto :start

echo [错误] 未检测到 Python 或 Node，无法启动静态服务器。
echo        本项目是纯静态站，任选其一安装后即可运行；
echo        或用你现有的任意静态服务器（Nginx / Apache / serve 等）托管本目录。
echo.
pause
exit /b 1

:start
echo.
echo ============================================================
echo   Big Java Backend - 大Java后端   本地开发模式 (DEV) 启动中...
echo   站点    :  %URL%       （浏览器自动打开）
echo   服务命令:  %SRV%
echo   热更新  :  改任意文件后，浏览器强制刷新（Ctrl+F5）即见
echo   停止    :  本窗口按 Ctrl + C
echo ============================================================
echo.
start "" cmd /c "timeout /t 2 >nul & start %URL%"

%SRV%

echo.
echo [本地开发服务已退出]
pause
