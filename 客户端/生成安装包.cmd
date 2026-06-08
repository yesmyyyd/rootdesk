@echo off

:: Search NSIS in common locations
set NSIS_PATH=makensis.exe
where makensis.exe >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files (x86)\NSIS\makensis.exe" set NSIS_PATH="C:\Program Files (x86)\NSIS\makensis.exe"
    if exist "C:\Program Files\NSIS\makensis.exe" set NSIS_PATH="C:\Program Files\NSIS\makensis.exe"
)

echo [*] Using: %NSIS_PATH%

:: Check if build exists
if not exist "dist\rootdesk\rootdesk.exe" (
    echo [!] dist\rootdesk\rootdesk.exe not found.
    echo [*] Running build script...
    call "build_with_deps.cmd"
)

 

:: Compile main setup
echo [*] Compiling setup.nsi...
"%NSIS_PATH%" /INPUTCHARSET UTF8 setup.nsi

if %errorlevel% equ 0 (
    echo [+] Success! RootDesk_Setup.exe created.
) else (
    echo [!] Error during compilation.
)

pause
