REM *************************************************************************************************
REM
REM This script will be invoked by 'runlba.cmd CopyResourcesToDropshare' job.
REM This script will copy the lba\default folder from Source Control to
REM <ProductTeamDropShare>\<DropNumber>\retail\lba\default location.
REM
REM *************************************************************************************************

if %1=="" goto :missingParam
if %2=="" goto :missingParam

set SOURCE=%1
set DESTINATION=%2

robocopy.exe "%SOURCE%" "%DESTINATION%" "*.*" /S /R:5 /XD BuildTools lss lss.pseudo lcg lci BaseEdb
exit /b
:missingParam
echo Error: missing parameter for CopyResourcesToDropshare.cmd. Please specify the source and destination folder path for copying files to the drop share.
