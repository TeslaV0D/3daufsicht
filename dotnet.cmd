@echo off
setlocal
set DOTNET_EXE=%~dp0tools\dotnet\dotnet.exe
if not exist "%DOTNET_EXE%" (
  echo Local dotnet not found at "%DOTNET_EXE%". Run tools/dotnet-install first.
  exit /b 1
)
"%DOTNET_EXE%" %*
exit /b %ERRORLEVEL%

