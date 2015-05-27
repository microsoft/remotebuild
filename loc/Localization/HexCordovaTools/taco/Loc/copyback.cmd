set LOCDROP=..\locdrop\bin
setlocal ENABLEDELAYEDEXPANSION

for /f %%l in ('dir /b %LOCDROP%') do (
    set al=%%l
    set bl=!al:~0,2!
    if "!bl!" == "zh" (set cl=!al!) else (set cl=!bl!)

    for /f %%p in ('dir /b %LOCDROP%\%%l') do (
     	robocopy %LOCDROP%\%%l\%%p\resources\en\ %TACO_ROOT%\build\packages\node_modules\%%p\resources\!cl!\
    )
)
