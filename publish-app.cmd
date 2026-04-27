@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "DOTNET_EXE=%~dp0tools\dotnet\dotnet.exe"
set "APP_PROJ=%~dp03DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj"
set "OUT_DIR=%~dp0artifacts\DesktopApp"

if not exist "%DOTNET_EXE%" (
  echo.
  echo [FEHLER] Lokales SDK fehlt: "%DOTNET_EXE%"
  echo Installiere das portable .NET 8 SDK unter tools\dotnet\ ^(siehe 3DInteriorEditor/DOCUMENTATION.md Phase 1^).
  echo.
  exit /b 1
)

if not exist "%APP_PROJ%" (
  echo [FEHLER] Projekt nicht gefunden: "%APP_PROJ%"
  exit /b 1
)

echo.
echo === 3D Interior Editor — Desktop-Paket bauen ===
echo Ausgabe: "%OUT_DIR%"
echo.

"%DOTNET_EXE%" publish "%APP_PROJ%" ^
  -c Release ^
  -r win-x64 ^
  --self-contained true ^
  -p:PublishSingleFile=true ^
  -p:EnableCompressionInSingleFile=true ^
  -p:PublishTrimmed=false ^
  -o "%OUT_DIR%"

if errorlevel 1 (
  echo.
  echo [FEHLER] publish ist fehlgeschlagen.
  exit /b 1
)

echo.
echo Fertig. Die Anwendung startest du mit:
echo   "%OUT_DIR%\3DInteriorEditor.App.exe"
echo.
echo Diesen gesamten Ordner kannst du weitergeben ^(ZIP^) — keine separate .NET-Installation noetig.
echo.

explorer.exe "%OUT_DIR%"
exit /b 0
