@echo off
setlocal EnableDelayedExpansion
title Sentinel Wallet - START ALL

:: Resolve repository directory dynamically
set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"
set "REPO_SLASH=%REPO:\=/%"

echo ================================================================
echo           Sentinel Wallet - One-Click Launcher
echo ================================================================
echo  Repository: %REPO%
echo.

:: ------------------------------------------------------------------
:: [0/4] Locate Git Bash & Foundry tools
:: ------------------------------------------------------------------
set "GITBASH="
if exist "C:\Program Files\Git\bin\bash.exe"          set "GITBASH=C:\Program Files\Git\bin\bash.exe"
if not defined GITBASH (
  if exist "C:\Program Files (x86)\Git\bin\bash.exe"  set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
)
if not defined GITBASH (
  if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GITBASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
)
if not defined GITBASH (
  for %%P in (bash.exe) do set "GITBASH=%%~$PATH:P"
)
if not defined GITBASH (
  echo.
  echo  [ERROR] Git Bash (bash.exe) was not found in:
  echo    - C:\Program Files\Git\bin\bash.exe
  echo    - C:\Program Files (x86)\Git\bin\bash.exe
  echo    - %LOCALAPPDATA%\Programs\Git\bin\bash.exe
  echo    - System PATH
  echo.
  echo  Please install Git for Windows from https://git-scm.com
  pause
  exit /b 1
)
echo  [OK] Found Git Bash: %GITBASH%

:: ------------------------------------------------------------------
:: [1/4] Check / Start Anvil on port 8545
:: ------------------------------------------------------------------
echo.
echo  [1/4] Checking local RPC (http://127.0.0.1:8545)...
set "CURL_OUT="
for /f "delims=" %%R in ('curl.exe -s -m 2 -X POST -H "Content-Type: application/json" --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}" http://127.0.0.1:8545 2^>nul') do set "CURL_OUT=%%R"
echo !CURL_OUT! | findstr /i "result" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo  [OK] Anvil node is already running on port 8545. Reusing instance.
  goto :deploy
)

echo  [1/4] Starting local Anvil node (chainId: 31337)...
start "Sentinel Wallet - Anvil (do not close)" "%GITBASH%" -l -c "anvil --code-size-limit 50000; exec bash"
echo  Waiting for Anvil to become ready (up to 30s)...

set "READY=0"
for /L %%i in (1,1,30) do (
  if !READY! EQU 0 (
    set "POLL_OUT="
    for /f "delims=" %%R in ('curl.exe -s -m 1 -X POST -H "Content-Type: application/json" --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}" http://127.0.0.1:8545 2^>nul') do set "POLL_OUT=%%R"
    echo !POLL_OUT! | findstr /i "result" >nul 2>&1
    if !ERRORLEVEL% EQU 0 (
      set "READY=1"
      echo  [OK] Anvil node is live after %%i second(s).
    ) else (
      timeout /t 1 /nobreak >nul
    )
  )
)
if !READY! EQU 0 (
  echo.
  echo  [ERROR] Anvil did not respond on port 8545 within 30 seconds.
  echo  Check the Anvil terminal window for error details.
  pause
  exit /b 1
)

:deploy
:: ------------------------------------------------------------------
:: [2/4] Deploy contracts via Foundry script
:: ------------------------------------------------------------------
echo.
echo  [2/4] Deploying smart contracts to Anvil (log: %REPO%\deploy.log)...
"%GITBASH%" -l -c "cd \"%REPO_SLASH%\" && forge script contracts/script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast > deploy.log 2>&1"
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [ERROR] Contract deployment failed. Last 20 lines of deploy.log:
  echo  --------------------------------------------------
  "%GITBASH%" -l -c "cd \"%REPO_SLASH%\" && tail -20 deploy.log"
  echo  --------------------------------------------------
  pause
  exit /b 1
)
echo  [OK] Smart contracts deployed successfully!
if exist "%REPO%\shared\addresses.json" (
  echo  Contract Addresses:
  type "%REPO%\shared\addresses.json"
  echo.
)

:: ------------------------------------------------------------------
:: [3/4] Start Web Dashboard
:: ------------------------------------------------------------------
echo.
echo  [3/4] Launching Web Dashboard...
if not exist "%REPO%\web\node_modules" (
  echo  node_modules missing in web/ -- running npm install (this may take a minute)...
  pushd "%REPO%\web"
  call npm install
  popd
  echo  [OK] Dependencies installed.
)
start "Sentinel Wallet - Dashboard (do not close)" cmd /k "cd /d \"%REPO%\web\" && npm run dev"

:: ------------------------------------------------------------------
:: [4/4] Open Browser
:: ------------------------------------------------------------------
echo.
echo  [4/4] Waiting 5 seconds for Vite dev server, then opening browser...
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo ================================================================
echo  Sentinel Wallet is ready!
echo  - Anvil RPC:  http://127.0.0.1:8545
echo  - Dashboard:  http://localhost:5173
echo  (If 5173 is occupied, check the Dashboard terminal for port 5174)
echo ================================================================
echo.
pause
endlocal
