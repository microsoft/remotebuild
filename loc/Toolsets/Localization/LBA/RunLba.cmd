@echo off

if "%inetroot%"=="" (
    echo Error: set INETROOT to the root of your enlistment.
    exit /b 1
)

if not exist "%inetroot%\tools\path1st\myenv.cmd" (
    echo Error: unable to find %inetroot%\tools\path1st\myenv.cmd
    echo        set INETROOT to the root of your enlistment.
    exit /b 1
)

setlocal

call "%inetroot%\tools\path1st\myenv.cmd"

set LBA_EXECUTION_ARGS=

if not "%LBA_NOCOMMON%"=="1" (
    if exist "%INETROOT%\build\automation\LBACommon.cmd" (
        call "%INETROOT%\build\automation\LBACommon.cmd"
    )
)

if "%LOCTOOLS_LBAPATH%"=="" set LOCTOOLS_LBAPATH=%extpath%\lba

if "%LBA_SDPATH%"=="" set LBA_SDPATH=%INETROOT%\private\lba
if "%LBA_WKSPPATH%"=="" set LBA_WKSPPATH=%INETROOT%\LBA.WKSP
if "%LBA_TEMPSOURCEPATH%"=="" set LBA_TEMPSOURCEPATH=%INETROOT%\temp_source_lba
if "%LBA_RELDROPPATH%"=="" set LBA_RELDROPPATH=retail\lba
if "%LBA_DROPPATH%"=="" set LBA_DROPPATH=%srvReleaseShare%\%newbldShare%\%LBA_RELDROPPATH%
if "%LBA_CUSTOMRUNLBA%"=="" set LBA_CUSTOMRUNLBA=%INETROOT%\build\automation\RunLba.cmd

if not exist "%LBA_SDPATH%" (
    echo Error: LBA_SDPATH is invalid. "%LBA_SDPATH%" does not exist.
    echo        set LBA_SDPATH to the root of your LBA directory.
    exit /b 1
)

rem Set LBA_SOURCECONTROLPATH to LBA_SDPATH for TFS Checkin compatibility
set LBA_SOURCECONTROLPATH=%LBA_SDPATH%

if not exist "%LOCTOOLS_LBAPATH%\RunLbaCommon.cmd" (
    echo Error: LOCTOOLS_LBAPATH is invalid. "%LOCTOOLS_LBAPATH%\RunLbaCommon.cmd" does not exist.
    echo        set LOCTOOLS_LBAPATH to the LBA tools directory, or use the default setting.
    exit /b 1
)

"%LOCTOOLS_LBAPATH%\RunLbaCommon.cmd" %*
