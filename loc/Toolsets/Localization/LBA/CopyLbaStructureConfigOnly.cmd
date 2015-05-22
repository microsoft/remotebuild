REM *************************************************************************************************
REM
REM This script will be invoked by 'runlba.cmd InitiateBuild' job.
REM This script will copy the lba\default folder from Drop Share including only LBA.CONFIG files 
REM
REM *************************************************************************************************

if %1=="" (
   goto :missingParam
)
if %2=="" (
   goto :missingParam
)

set SOURCE=%1
set DESTINATION=%2

echo Copying LBA structure with LBA.CONFIG files from %SOURCE% to %DESTINATION%
robocopy.exe %SOURCE% %DESTINATION% lba.config /MIR /R:5 
if ERRORLEVEL 8 (
   echo Copy Failed!
   exit /b 1
) else (
   echo Copy Success!
   exit /b 0
)

:missingParam
echo Error: missing parameter for CopyLbaStructureConfigOnly.cmd. Please specify the source and destination folder path for copying LBA structure
exit /b 1
