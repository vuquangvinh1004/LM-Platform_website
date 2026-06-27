@echo off
setlocal
cd /d %~dp0
echo [shortcut] Starting Learning Management Platform local website...
pnpm local:start
endlocal
