@echo off
setlocal
cd /d "%~dp0"
set "APP_DATA_DIR=%CD%\personal-life-hub-data"

call :launch_existing
if not errorlevel 1 exit /b 0

echo Desktop build not found. Building it now...
call npm.cmd run desktop:package
if errorlevel 1 goto failed

call :launch_existing
if not errorlevel 1 exit /b 0

:failed
echo Could not start Personal Life Hub.
pause
exit /b 1

:launch_existing
for %%F in ("release\win-unpacked\*.exe") do (
  if exist "%%~fF" (
    start "" "%%~fF"
    exit /b 0
  )
)
for /D %%D in ("release\*") do (
  if exist "%%~fD\*.exe" (
    for %%F in ("%%~fD\*.exe") do (
      start "" "%%~fF"
      exit /b 0
    )
  )
)
exit /b 1
