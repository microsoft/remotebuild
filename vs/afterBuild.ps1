param (
      [string]$DropLocation = $env:TF_BUILD_DROPLOCATION,
      [string]$SourceRoot = $(Write-Output $env:TF_BUILD_SOURCESDIRECTORY\taco),
      [string]$LocRoot = $(Write-Output $env:TF_BUILD_BINARIESDIRECTORY\localize)
)
$GulpRoot = Write-Output $SourceRoot\src
$GulpCommand = Write-Output $SourceRoot\node_modules\.bin\gulp.cmd
$DropPackages = Write-Output --drop=$DropLocation\packages\
cd $GulpRoot

# Copy localized resources
$langs = @{"CHS" = "zh-CN";
         "CHT"= "zh-TW";
	 "CSY" = "cs";
	 "DEU" = "de";
	 "ESN" = "es";
	 "FRA" = "fr";
	 "ITA" = "it";
	 "JPN" = "jp";
	 "KOR" = "ko";
	 "PLK" = "pl";
	 "PTB" = "pt-BR";
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