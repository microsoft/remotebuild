param (
      [string]$DropLocation = $env:TF_BUILD_DROPLOCATION,
      [string]$SourceRoot = $(Write-Output $env:TF_BUILD_SOURCESDIRECTORY\),
      [string]$LocRoot = $(Write-Output $env:TF_BUILD_BINARIESDIRECTORY\localize)
)
$GulpRoot = Write-Output $SourceRoot\src
$GulpCommand = Write-Output node $SourceRoot\node_modules\gulp\bin\gulp.js
$DropPackages = Write-Output --drop=$DropLocation\packages\
cd $GulpRoot

# Copy localized resources
# Note that the destination folders must be lower case since we run on case sensitive filesystems and lowercase everything.
$langs = @{"CHS" = "zh-cn";
         "CHT"= "zh-tw";
	 "CSY" = "cs";
	 "DEU" = "de";
	 "ESN" = "es";
	 "FRA" = "fr";
	 "ITA" = "it";
	 "JPN" = "jp";
	 "KOR" = "ko";
	 "PLK" = "pl";
	 "PTB" = "pt-br";
	 "RUS" = "ru";
	 "TRK" = "tr"}

$packages = "remotebuild",
            "taco-utils", 
            "taco-remote", 
            "taco-remote-lib", 
            "taco-kits",
            "taco-cli"


gci $LocRoot | where {$langs[$_.BaseName]} | foreach {
    $lang = $_.BaseName
    $destlang = $langs[$lang]
    $packages | foreach {
        $package = $_
        $from = write-output "$LocRoot\$lang\packages\node_modules\$package\resources\en\"
        $srcto = write-output "$SourceRoot\build\packages\node_modules\$package\resources\$destlang\"
        $binto = write-output "$LocRoot\..\packages\node_modules\$package\resources\$destlang\"
        robocopy $from $srcto resources.json
        robocopy $from $binto resources.json
    }
}

& $GulpCommand just-package $DropPackages

# Clean up devDependencies to make sure microbuild can 
# delete sources and start fresh
& $GulpCommand unprep