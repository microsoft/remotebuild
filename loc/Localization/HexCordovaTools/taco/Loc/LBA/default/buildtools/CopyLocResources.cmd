REM *************************************************************************************************
REM
REM This script will be invoked by 'runlba.cmd CopyLocResources' job.
REM Please update this script so that the resources are appropriately copied to the correct location.
REM Please copy/paste as many lines as needed for more resources or projects.
REM
REM Syntax
REM      ROBOCOPY source_folder destination_folder [file(s)_to_copy] [options]

REM Key
REM   file(s)_to_copy : A list of files or a wildcard.
REM                          (defaults to copying *.*)
REM Source options
REM                /S : Copy Subfolders
REM                /E : Copy Subfolders, including Empty Subfolders.
REM
REM *************************************************************************************************

REM  ROBOCOPY path_to_your_resource_folder %LBA_SDPATH%\default\<<ProjectA>>\locstudio.source
REM  ROBOCOPY path_to_your_resource_folder %LBA_SDPATH%\default\<<ProjectB>>\locstudio.source
ROBOCOPY %INET_ROOT%\Src %LBA_SDPATH%\default\taco\locstudio.source *.*

