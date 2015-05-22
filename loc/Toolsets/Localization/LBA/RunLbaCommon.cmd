@echo off

if "%1"=="" goto :missingParam

setlocal  

if "%LBA_LOCBUILD_JOB%"=="" set LBA_LOCBUILD_JOB=LocBuild
if "%LBA_REGISTERBUILD_JOB%"=="" set LBA_REGISTERBUILD_JOB=RegisterBuild
if "%LBA_PREPHANDOFF_JOB%"=="" set LBA_PREPHANDOFF_JOB=PrepHandoff
if "%LBA_HANDBACK_JOB%"=="" set LBA_HANDBACK_JOB=Handback
if "%LBA_HANDBACKREMOTE1_JOB%"=="" set LBA_HANDBACKREMOTE1_JOB=HandbackRemote1
if "%LBA_CHECKIN_JOB%"=="" set LBA_CHECKIN_JOB=Checkin
if "%LBA_INITIATEBUILD_JOB%"=="" set LBA_INITIATEBUILD_JOB=InitiateBuild
if "%LBA_CREATEBUILD_JOB%"=="" set LBA_CREATEBUILD_JOB=CreateBuild
if "%LBA_HELIUM_REGISTERBUILD_JOB%"=="" set LBA_HELIUM_REGISTERBUILD_JOB=HeliumRegisterBuild
if "%LBA_HELIUM_PREPHANDOFF_JOB%"=="" set LBA_HELIUM_PREPHANDOFF_JOB=HeliumPrepHandoff
if "%LBA_HELIUM_HANDBACK_JOB%"=="" set LBA_HELIUM_HANDBACK_JOB=HeliumHandback
if "%LBA_HELIUM_CHECKIN_JOB%"=="" set LBA_HELIUM_CHECKIN_JOB=HeliumCheckin
if "%LBA_HELIUM_INITIATEBUILD_JOB%"=="" set LBA_HELIUM_INITIATEBUILD_JOB=HeliumInitiateBuild
if "%LBA_HELIUM_CREATEBUILD_JOB%"=="" set LBA_HELIUM_CREATEBUILD_JOB=HeliumCreateBuild

if "%LBA_DAILYBUILDPOSTEDB2BIN%"=="" set LBA_DAILYBUILDPOSTEDB2BIN=%LBA_SDPATH%\default\buildtools\DailyBuildPostEdb2Bin.cmd
if "%LBA_DAILYBUILDPOSTBIN%"=="" set LBA_DAILYBUILDPOSTBIN=%LBA_SDPATH%\default\buildtools\DailyBuildPostBin.cmd
if "%LBA_HANDBACKPOSTEDB2BIN%"=="" set LBA_HANDBACKPOSTEDB2BIN=%LBA_SDPATH%\default\buildtools\HandbackPostEdb2Bin.cmd
if "%LBA_HANDBACKPOSTBIN%"=="" set LBA_HANDBACKPOSTBIN=%LBA_SDPATH%\default\buildtools\HandbackPostBin.cmd
if "%LBA_CUSTOMCHECKIN%"=="" set LBA_CUSTOMCHECKIN=%LBA_SDPATH%\default\buildtools\CustomCheckin.cmd
if "%LBA_COPYLOCRESOURCES%"=="" set LBA_COPYLOCRESOURCES=%LBA_SDPATH%\default\buildtools\CopyLocResources.cmd
if "%LBA_COPYRESOURCESTODROPSHARE%"=="" set LBA_COPYRESOURCESTODROPSHARE=%LBA_SDPATH%\default\buildtools\CopyResourcesToDropshare.cmd
if "%LBA_COPYLBASTRUCTURECONFIGONLY%"=="" set LBA_COPYLBASTRUCTURECONFIGONLY=%LBA_SDPATH%\default\buildtools\CopyLbaStructureConfigOnly.cmd

set LBA_JOBNAME=%1

rem This is for compatibility only
if /I "%LBA_JOBNAME%" equ "LocalizationLeg" set LBA_JOBNAME=LocBuild

rem Make sure MLP_INCREMENTALPREPHANDOFF is something
set LBA_COPYLBA_EXECUTIONLEVEL=Root
if /I "%MLP_INCREMENTALPREPHANDOFF%" equ "True" (
   set LBA_COPYLBA_EXECUTIONLEVEL=Culture
)

shift
:ArgumentsLoopBegin

if "%~1"=="" goto :ArgumentsLoopEnd

if /I "%~1" EQU "local" (
    set LBA_LOCALMODE=1
) else if /I "%~1" EQU "debug" (
    set LBA_DEBUGMODE=1
) else (
    set LBA_EXECUTION_ARGS=%LBA_EXECUTION_ARGS% %~1
)

shift
goto :ArgumentsLoopBegin

:ArgumentsLoopEnd

if "%LBA_DEBUGMODE%"=="1" set LBA_EXECUTION_ARGS=%LBA_EXECUTION_ARGS% /debug

if "%LBA_LOCALMODE%"=="1" goto :LbaLocalMode

rem set the same values for both LocBuild and LocBuildEx 
if /I "%LBA_JOBNAME%" equ "LocBuild" (
	if "%LBA_DROPPATH%"=="" (
		set LBA_JOB_PARAM=/job %LBA_LOCBUILD_JOB% /src "%LBA_SDPATH%"
	) else (
		set LBA_JOB_PARAM=/job %LBA_LOCBUILD_JOB% /src "%LBA_DROPPATH%" /src "%LBA_SDPATH%"
	)
) else if /I "%LBA_JOBNAME%" equ "LocBuildEx" ( 
   set LBA_JOB_PARAM=/job %LBA_LOCBUILD_JOB% /src "%LBA_SDPATH%"
) else if /I "%LBA_JOBNAME%" equ "RegisterBuild" (
    set LBA_JOB_PARAM=/job %LBA_REGISTERBUILD_JOB% /src "%BuildTracker.BuildShareGroup.DropShare%\%BuildTracker.Build.Number%\%LBA_RELDROPPATH%" /src "%LBA_SDPATH%" /bnum "%BuildTracker.Build.Number%"
) else if /I "%LBA_JOBNAME%" equ "InitiateBuild" (
    set LBA_JOB_PARAM=/job %LBA_INITIATEBUILD_JOB% /src "%LBA_TEMPSOURCEPATH%" /src "%LBA_SDPATH%" /bnum "%BuildTracker.Build.Number%" 
) else if /I "%LBA_JOBNAME%" equ "CreateBuild" (
    set LBA_JOB_PARAM=/job %LBA_CREATEBUILD_JOB% /src "%MLP_BUILDDROPLBAPATH%" /src "%LBA_SDPATH%" /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml"
)  else if /I "%LBA_JOBNAME%" equ "PrepHandoff" (
    set LBA_JOB_PARAM=/job %LBA_PREPHANDOFF_JOB% /src "%LBA_SDPATH%" /src "$LbaConfigInfo.MlpBuildRoot$\build\lba" -lba.config /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml" 
) else if /I "%LBA_JOBNAME%" equ "Handback" (
    set LBA_JOB_PARAM=/job %LBA_HANDBACK_JOB% /src "$LbaConfigInfo.MlpTransactionRoot$\handback\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\handoffbuild\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\build\lba" -lba.config /src "%LBA_SDPATH%" -*.lcl /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml" 
) else if /I "%LBA_JOBNAME%" equ "HandbackRemote1" (
    set LBA_JOB_PARAM=/job %LBA_HANDBACKREMOTE1_JOB% /src "$LbaConfigInfo.MlpTransactionRoot$\handback\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\handoffbuild\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\build\lba" -lba.config /src "%LBA_SDPATH%" -*.lcl /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog_1.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml" 
) else if /I "%LBA_JOBNAME%" equ "Checkin" (
    set LBA_JOB_PARAM=/job %LBA_CHECKIN_JOB% /src "$LbaConfigInfo.MlpTransactionRoot$\handback\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\handoffbuild\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\build\lba" -lba.config /src "%LBA_SDPATH%" /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml" 
) else if /I "%LBA_JOBNAME%" equ "HeliumRegisterBuild" (
    set LBA_JOB_PARAM=/job %LBA_HELIUM_REGISTERBUILD_JOB% /src "%BuildTracker.BuildShareGroup.DropShare%\%BuildTracker.Build.Number%\%LBA_RELDROPPATH%" /src "%LBA_SDPATH%" /bnum "%BuildTracker.Build.Number%" 
) else if /I "%LBA_JOBNAME%" equ "HeliumInitiateBuild" (
    set LBA_JOB_PARAM=/job %LBA_HELIUM_INITIATEBUILD_JOB% /src "%LBA_TEMPSOURCEPATH%" /src "%LBA_SDPATH%" /bnum "%BuildTracker.Build.Number%" 
) else if /I "%LBA_JOBNAME%" equ "HeliumCreateBuild" (
    set LBA_JOB_PARAM=/job %LBA_HELIUM_CREATEBUILD_JOB% /src "%MLP_BUILDDROPLBAPATH%" /src "%LBA_SDPATH%" /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml"
) else if /I "%LBA_JOBNAME%" equ "HeliumPrepHandoff" (
    set LBA_JOB_PARAM=/job %LBA_HELIUM_PREPHANDOFF_JOB% /src "%LBA_SDPATH%" /src "$LbaConfigInfo.MlpBuildRoot$\build\lba" -lba.config /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml" 
) else if /I "%LBA_JOBNAME%" equ "HeliumHandback" (
    set LBA_JOB_PARAM=/job %LBA_HELIUM_HANDBACK_JOB% /src "$LbaConfigInfo.MlpTransactionRoot$\handback\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\handoffbuild\lba" -lba.config -helium.source -helium.target -helium.working /src "$LbaConfigInfo.MlpBuildRoot$\build\lba" -lba.config -helium.source -helium.target -helium.working /src "%LBA_SDPATH%" -helium.source -helium.target -helium.working /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml" 
) else if /I "%LBA_JOBNAME%" equ "HeliumCheckin" (
    set LBA_JOB_PARAM=/job %LBA_HELIUM_CHECKIN_JOB% /src "$LbaConfigInfo.MlpTransactionRoot$\handback\lba" -lba.config /src "$LbaConfigInfo.MlpBuildRoot$\handoffbuild\lba" -lba.config -helium.source -helium.target -helium.working /src "$LbaConfigInfo.MlpBuildRoot$\build\lba" -lba.config -helium.source -helium.target -helium.working /src "%LBA_SDPATH%" -helium.source -helium.target -helium.working /o "$LbaConfigInfo.MlpTransactionRoot$\LbaLog.xml" /info "%MLP_TRANSACTION_INFO_PATH%" /statusout "$LbaConfigInfo.MlpTransactionRoot$\LbaStatus.xml" 
) else if /I "%LBA_JOBNAME%" equ "CopyLocResources" (
	goto :copyLocResources
) else if /I "%LBA_JOBNAME%" equ "CopyResourcesToDropshare" (
	goto :copyResourcesToDropshare
) else (	 
	goto :invalidType
)

if not "%LBA_NONUKE%"=="1" (
	pushd "%LBA_SDPATH%"
	echo Removing files not under source control from %cd%
	call %LOCTOOLS_LBAPATH%\buildnuke.cmd
	popd 
)

set LBA_JOB_PARAM=%LBA_JOB_PARAM% /wksp "%LBA_WKSPPATH%" %LBA_EXECUTION_ARGS%
set LBAExeCommand="%LOCTOOLS_LBAPATH%\lba.exe" %LBA_JOB_PARAM%
goto :executeLBAJOB

:LbaLocalMode
if /I "%LBA_JOBNAME%" equ "LocBuild" (
    set LBA_JOB=%LBA_LOCBUILD_JOB%
) else if /I "%LBA_JOBNAME%" equ "LocBuildEx" (
    set LBA_JOB=%LBA_LOCBUILD_JOB%
) else if /I "%LBA_JOBNAME%" equ "RegisterBuild" (
    set LBA_JOB=%LBA_REGISTERBUILD_JOB%
) else if /I "%LBA_JOBNAME%" equ "InitiateBuild" (
    set LBA_JOB=%LBA_INITIATEBUILD_JOB%
) else if /I "%LBA_JOBNAME%" equ "CreateBuild" (
    set LBA_JOB=%LBA_CREATEBUILD_JOB% 
) else if /I "%LBA_JOBNAME%" equ "PrepHandoff" (
    set LBA_JOB=%LBA_PREPHANDOFF_JOB%
) else if /I "%LBA_JOBNAME%" equ "Handback" (
    set LBA_JOB=%LBA_HANDBACK_JOB%
) else if /I "%LBA_JOBNAME%" equ "HandbackRemote1" (
    set LBA_JOB=%LBA_HANDBACKREMOTE1_JOB%
) else if /I "%LBA_JOBNAME%" equ "Checkin" (
    set LBA_JOB=%LBA_CHECKIN_JOB%
) else if /I "%LBA_JOBNAME%" equ "HeliumRegisterBuild" (
    set LBA_JOB=%LBA_HELIUM_REGISTERBUILD_JOB%
) else if /I "%LBA_JOBNAME%" equ "HeliumInitiateBuild" (
    set LBA_JOB=%LBA_HELIUM_INITIATEBUILD_JOB%
) else if /I "%LBA_JOBNAME%" equ "HeliumCreateBuild" (
    set LBA_JOB=%LBA_HELIUM_CREATEBUILD_JOB%
) else if /I "%LBA_JOBNAME%" equ "HeliumPrepHandoff" (
    set LBA_JOB=%LBA_HELIUM_PREPHANDOFF_JOB%
) else if /I "%LBA_JOBNAME%" equ "HeliumHandback" (
    set LBA_JOB=%LBA_HELIUM_HANDBACK_JOB%
) else if /I "%LBA_JOBNAME%" equ "HeliumCheckin" (
    set LBA_JOB=%LBA_HELIUM_CHECKIN_JOB%
) else if /I "%LBA_JOBNAME%" equ "CopyLocResources" (
 	goto :copyLocResources
) else if /I "%LBA_JOBNAME%" equ "CopyResourcesToDropshare" (
	echo Error: Invalid execution type %LBA_JOBNAME% passed to RunLba.cmd for LocalMode
	exit /b 1
) else (
    goto :invalidType
)

set LBAExeCommand="%LOCTOOLS_LBAPATH%\lba.exe" /job %LBA_JOB% /src "%LBA_SDPATH%" /wksp "%LBA_WKSPPATH%" /local %LBA_EXECUTION_ARGS%

:executeLBAJOB
if /I "%LBA_JOBNAME%" EQU "LocBuildEx" ( 
	goto :copyLocResources	
) else if /I "%LBA_JOBNAME%" EQU "InitiateBuild" (
	goto :copyLbaStructureFromBuildDrop
) else if /I "%LBA_JOBNAME%" EQU "HeliumInitiateBuild" (
	goto :copyLbaStructureFromBuildDrop
) else (
	goto :callLBAExe
)

:copyLocResources
if not exist "%LBA_COPYLOCRESOURCES%" (
	echo Error: unable to find %LBA_COPYLOCRESOURCES%
	exit /b 1
)
echo Executing "%LBA_COPYLOCRESOURCES%"
call "%LBA_COPYLOCRESOURCES%"

if /I "%LBA_JOBNAME%" EQU "LocBuildEx" ( 
	if ERRORLEVEL 1 (
		goto :handleExitCode
	) else (
		goto :callLBAExe
	)
) else (
	goto :handleExitCode
)

:copyLbaStructureFromBuildDrop
set BUILDDROPFOLDER=%BuildTracker.BuildShareGroup.DropShare%\%BuildTracker.Build.Number%
set SEMAPHORE=%BUILDDROPFOLDER%\done.txt
set NUM_OF_TRIALS=120
set COUNT=0
if /I "%MLP_REQUIRESBUILDSEMAPHORE%" EQU "true"  if not exist "%SEMAPHORE%" (
	echo Waiting for semaphore file "%SEMAPHORE%"...
	:loop
	if not exist "%BUILDDROPFOLDER%" (
		echo Drop folder "%BUILDDROPFOLDER%" does not exist anymore. Canceling the process.
		exit /b 1
	)
	if not exist "%SEMAPHORE%" (
		set /a COUNT+=1
		if %COUNT% GTR %NUM_OF_TRIALS% (
			echo The semaphore timeout period of 60 minutes has expired.
			exit /b 1
		)
		if exist sleep.exe (
			SLEEP 30
		) else (
			rem ***HACK: Sleep for 30 seconds***
			PING 1.1.1.1 -n 1 -w 30000 >NUL
		)
		goto :loop
	)
)

set CopyLbaStructureParams="%BuildTracker.BuildShareGroup.DropShare%\%BuildTracker.Build.Number%\%LBA_RELDROPPATH%" "%LBA_TEMPSOURCEPATH%"
if exist "%LBA_COPYLBASTRUCTURECONFIGONLY%" (
  echo Executing %LBA_COPYLBASTRUCTURECONFIGONLY%
  call "%LBA_COPYLBASTRUCTURECONFIGONLY%" %CopyLbaStructureParams%
) else (
  echo %LBA_COPYLBASTRUCTURECONFIGONLY% does not exist.  Executing %LOCTOOLS_LBAPATH%\CopyLbaStructureConfigOnly.cmd
  call "%LOCTOOLS_LBAPATH%\CopyLbaStructureConfigOnly.cmd" %CopyLbaStructureParams%
)
echo Finished executing CopyLbaStructureConfigOnly.cmd.

if ERRORLEVEL 1 (
   goto :handleExitCode
) else (
   goto :callLBAExe
)

:callLBAExe
echo Executing %LBAExeCommand%
call %LBAExeCommand%

if /I "%LBA_JOBNAME%" EQU "LocBuildEx" ( 
	if ERRORLEVEL 1 (
		goto :handleExitCode
	) else if "%LBA_LOCALMODE%"=="1" (
		goto :handleExitCode
	) else (
		goto :copyResourcesToDropshare
	)
) else (
	goto :handleExitCode
)

:copyResourcesToDropshare
if not exist "%LBA_COPYRESOURCESTODROPSHARE%" (
    echo Error: unable to find %LBA_COPYRESOURCESTODROPSHARE%
    exit /b 1
)
echo Executing "%LBA_COPYRESOURCESTODROPSHARE% %LBA_SDPATH%\default %BuildTracker.BuildShareGroup.DropShare%\%newBldShare%\%LBA_RELDROPPATH%\default" 
call "%LBA_COPYRESOURCESTODROPSHARE%" "%LBA_SDPATH%\default" "%BuildTracker.BuildShareGroup.DropShare%\%newBldShare%\%LBA_RELDROPPATH%\default"  
goto :handleExitCode

:invalidType
if exist "%LBA_CUSTOMRUNLBA%" (
    call "%LBA_CUSTOMRUNLBA%"
    exit /b
) else (
    echo Error: Invalid execution type %LBA_JOBNAME% passed to RunLba.cmd
    goto :usage
)

:missingParam
echo Error: missing parameter for RunLba.cmd

:usage
echo.
echo   RunLba.cmd command [local] [debug] [Lba Args...]
echo.
echo   command:
echo   LocBuild^|LocBuildEx^|RegisterBuild^|PrepHandoff^|Handback^|HandbackRemote1^|Checkin^|HeliumRegisterBuild^|HeliumPrepHandoff^|HeliumHandback^|HeliumCheckin^|CopyLocResources^|CopyResourcesToDropshare^|InitiateBuild^|CreateBuild
exit /b 1

:handleExitCode
rem Exit code of 2 denotes Partial Success.  This should not fail BT leg except for RegisterBuild, CreateBuild or LocBuild/LocBuildEx.
if ERRORLEVEL 2 (
    if /I "%LBA_JOBNAME%" equ "LocBuild" (
        exit /b 2
    ) else if /I "%LBA_JOBNAME%" equ "LocBuildEx" (
        exit /b 2
    ) else if /I "%LBA_JOBNAME%" equ "RegisterBuild" (
        exit /b 2
    ) else if /I "%LBA_JOBNAME%" equ "CreateBuild" (
	    exit /b 2
    ) else (
        exit /b 0
    )
)

set lbaExitCode=%ERRORLEVEL%
exit /b %lbaExitCode%
