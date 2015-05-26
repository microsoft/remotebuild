@echo off
@echo Build_Status LBA - Running localization

if "%1" == "PSEUDO" (
	set PSEUDO=YES
) else (
	set PSEUDO=NO
)

rem 
For /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
For /f "tokens=1-3 delims=/: " %%a in ('time /t') do (set mytime=%%a%%b%%c)
set BuildNumber=%mydate%.%mytime%


for %%A in ("%~dp0..") do set INETROOT=%%~fA

rem Modified these and serverdrop path:
set LBAProject=taco
set SrcPath=%TACO_ROOT%\src

if "%1" == "SERVERDROP" (
rem change this to the drop folder
	set DROP="C:\z"
) else (
	set DROP=%INETROOT%\locdrop
)

set LBA_SDPATH=%INETROOT%\Loc\LBA
set LBA_WKSPPATH=%INETROOT%\Loc\LBA.WKSP
set LBA_FULL_CMD=%INETROOT%\..\..\..\Toolsets\Localization\LBA\LBA.exe
set EXTPATH=%INETROOT%\..\..\..\Toolsets\Localization

    call :CopySourceResources
    call :SET_LBA_CONFIG
	if not exist %LBA_WKSPPATH% md %LBA_WKSPPATH%
    call "%LBA_FULL_CMD%" /job LocBuild /src "%LBA_SDPATH%" /wksp "%LBA_WKSPPATH%" /Local

goto :EOF


:CopySourceResources

@echo  copy source files into LBA source folders

rem tf get -r %INETROOT%\*.*
robocopy /s "%SrcPath%" "%LBA_SDPATH%\default\%LBAProject%\locstudio.source" *.json /XD test /XF package.json /XF dynamicdependencies.json /XF tacokitmetadata.json /XF commands.json /XF build_config.json /XF exampleConfig.json

goto :EOF

:SET_LBA_CONFIG
if "%PSEUDO%" == "NO" (
    cmd /c echo F | xcopy %LBA_SDPATH%\LBA.NORMAL.CONFIG %LBA_SDPATH%\LBA.CONFIG /Y
) else (
    cmd /c echo F | xcopy %LBA_SDPATH%\LBA.PSEUDO.CONFIG %LBA_SDPATH%\LBA.CONFIG /Y
)

goto :EOF
