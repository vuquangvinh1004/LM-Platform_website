@echo off
setlocal
cd /d %~dp0
echo [shortcut] Stopping Learning Management Platform local stack...
pnpm local:stop
endlocal
