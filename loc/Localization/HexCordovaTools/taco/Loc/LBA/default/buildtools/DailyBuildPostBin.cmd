REM *******************************************************************************************************
REM
REM This script is called during your daily build when 'runlba.cmd locbuild' is invoked.
REM Please edit this script for any post processing that is required on localized (including pseudo) files.
REM
REM Localized files are generated on local/build machine in LBA Workspace at
REM '%inetroot%\lba.wksp\lba\<CultureName>\<projectname>\locstudio.target'
REM The example below loops through every culture in the LBA workspace and copies
REM localized files from locstudio.target to a generic folder called resources\culture folder
REM
REM *******************************************************************************************************

REM robocopy %LBA.SCRIPT.CURRENTPROJECTFOLDER%\locstudio.target ..\resources\%LBA.SCRIPT.CURRENTCULTUREID%\ /s >%inetroot%\mylbacopy%LBA.SCRIPT.CURRENTCULTUREID%log.txt
REM exit /B
REM Where %LBA.SCRIPT.CURRENTPROJECTFOLDER% is the LBA workspace and %LBA.SCRIPT.CURRENTCULTUREID% is the Language or Market being built

REM For more information http://sharepoint/sites/mlp/LBAHelp/References/LbaEnvVariables.htm

@echo off

@echo Placing generated LCG file to loc drop place.
call ROBOCOPY %LBA.SCRIPT.WORKSPACELBAROOT%\default\%LBA.SCRIPT.CURRENTPROJECTID%\lcg "%DROP%\lcg\%LBA.SCRIPT.CURRENTPROJECTID%" /s /NJH /NJS /NP /R:5 /W:30
@echo Placing source file to loc drop place.
call ROBOCOPY %LBA.SCRIPT.WORKSPACELBAROOT%\default\%LBA.SCRIPT.CURRENTPROJECTID%\locstudio.source "%DROP%\locstudio.source\%LBA.SCRIPT.CURRENTPROJECTID%" /s /NJH /NJS /NP /R:5 /W:30

if "%LBA.SCRIPT.CURRENTCULTUREID%" == "default" goto :EndOfScript

@echo Placing translation LCT file to loc drop place.
call ROBOCOPY %LBA.SCRIPT.WORKSPACELBAROOT%\%LBA.SCRIPT.CURRENTCULTUREID%\%LBA.SCRIPT.CURRENTPROJECTID%\lct "%DROP%\lct\%LBA.SCRIPT.CURRENTCULTUREID%" /s /NJH /NJS /NP /R:5 /W:30


REM Placing localized files to loc drop place
call ROBOCOPY %LBA.SCRIPT.WORKSPACELBAROOT%\%LBA.SCRIPT.CURRENTCULTUREID%\%LBA.SCRIPT.CURRENTPROJECTID%\locstudio.target "%DROP%\bin\%LBA.SCRIPT.CURRENTCULTUREID%" /s /NJH /NJS /NP /R:5 /W:30

REM create a build complete marker
call type nul >"%DROP%"\build.done"
:EndOfScript
exit /b