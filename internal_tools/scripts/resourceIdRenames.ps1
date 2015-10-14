$seps=@('.','-');
$encoding="UTF8";
$exceptions=@{"Http"="HTTP"; "Osx"="OSX"; "Ca"="CA"; "Ios"="IOS"};
$codeRegex=@("(.+)getString\((`"[^`"]+`")(.+)", "(.+)getStringForLanguage\(.+(`"[^`"]+`")(.+)", "Q.reject(.+)(`"[^`"^\s]+`").+", "throw (new) Error\((`"[^`"^\s^']+`")(.+)", "(deferred).reject\((`"[^`"^\s^']+`")");
$commandsFile=".\taco-cli\cli\commands.json";

function GetCodeMatch($str) { $regexMatch=$nul; for ($i=0; $i -lt $codeRegex.Length; $i++) { if ($str -match $codeRegex[$i]){ $regexMatch= $matches[2]; break;}}; return $regexMatch;}

function outCast($str) { $arr=$str.toCharArray(); for ($i=0; $i -lt $str.Length -1; $i++) { if ([byte][char]$arr[$i] -lt 96 -And [byte][char]$arr[$i+1] -lt 96) { return $true}} return $false;}
function applyException($str){$key=($exceptions.Keys|? {$str.StartsWith($_)}); if ($key) { return $exceptions[$key]+$str.substring($key.Length)}; return $str;}

function camelToPascal($str1){ $c= [byte][char]$str1[0];if ($c -gt 96) { $c = $c-32;} $c=[char]$c+""; $rest=$str1.substring(1); return "$c$rest"}

function pascalToCamel($str) {  $c= [byte][char]$str[0];if ($c -lt 96) { $c = $c+32;} $c=[char]$c+""; $rest=$str.substring(1); return applyException("$c$rest"); }

function idToCamel($str) {$str=$str.Trim("`""); $us="";if ($str.StartsWith("_")) { $us="_"; $str=$str.substring(1);} $sp=$str.split($seps); $a=(camelToPascal $sp[0]); $a=(applyException $a); $end=$sp.length-1; $comment="";if ($sp[$end] -eq "comment"){ $end=$end-1;$comment=".comment";} $b="";if ($end -ge 1) {$b=(($sp[1..$end]|% { camelToPascal $_}) -Join "")}; return "`"$us$a$b$comment`""}


function lineToCamel($str) { $kv=$str.Trim().split(":"); $a= (idToCamel $kv[0]); $b=($kv[1..100] -Join ":"); return "    $a`:$b";}

function convertResourcesFile($file) { cat $file|% { if ($_.Contains(":") -And $_.Split(":")[0].EndsWith("`"")) { lineToCamel $_} else { $_}}}

function convertCodeFile($file) {cat $file|% { $match=GetCodeMatch($_); if ($match) { $x=idToCamel($match); $_ -replace $match,$x;} else {$_}}}

function ensureCR($fileName) { $lineStart=0;$search=(select-string "\*\*\*\*\*" $fileName); if ($search -And $search.Length -gt 1){ $lineStart=$search[1].LineNumber+1}; $contents=(cat $fileName); cat d:\tacodev\copyright.txt | Out-File $fileName -encoding $encoding;$contents[$lineStart..$contents.Length]| Out-File $fileName -encoding $encoding -Append}
$copyRightExcludeList=(ls -r .\typings|? { select-string DefinitelyTyped $_.FullName}|% { $_.FullName});

function convertCommandsFile($file) {cat $file | % { if ($_ -match "(\[.+\])" -And $matches[1].contains(".")) { $token=$matches[1].Trim("[").Trim("]"); $x=idToCamel($token);$x=$x.Trim("`""); $_ -replace $token,$x} else { $_}}}

#$resourceIdsInCode=(ls -r -fil *.ts|? {!$_.FullName.Contains("test") }| % { cat $_.FullName} |% { $match=GetCodeMatch($_); if ($match) {$match}} |% { $_.Trim("`"")}|sort|group|% { $_.Name})

#$resourceIds=(ls -r -fil resources.json|? { !$_.FullName.contains("test")}|% { cat $_.FullName}|% { $_.Trim()}|? { $_.Length -gt 2}|% { $_.Trim("`"")}|? { !$_.StartsWith("_")}|% { $_.Split(":")[0]}|? { $_.EndsWith("`"")}|% { $_.Trim("`"")}|sort|group|% { $_.Name})

#diff $resourceIds $resourceIdsInCode

ls -r -fil resources.json|? { !$_.FullName.Contains("test")} |% { $contents=(convertResourcesFile $_.FullName); $contents|Out-File $_.FullName -encoding $encoding}
ls -r -fil *.ts|? {!$_.FullName.EndsWith(".d.ts")  -And  !$_.FullName.Contains("test") -And !$_.FullName.contains("gulpmain.ts")} |% { $contents=(convertCodeFile $_.FullName); $contents|Out-File $_.FullName -encoding $encoding}

#ls -r -fil *.ts|? {!$_.FullName.Contains("test") -And !$_.FullName.contains("gulpmain.ts") -And !$copyRightExcludeList.Contains($_.FullName)} |% { ensureCR $_.FullName}

$contents=(convertCommandsFile $commandsFile);$contents|Out-File $commandsFile -encoding $encoding



#ls -r -fil *.ts| % { cat $_.FullName} | ?{ !$_.Contains("require")} | % { Select-String `"[^`"]+`" -AllMatches -input $}|% { $_.matches}|% { $_.Value}|sort|group|% { $_.Name}|? { !$_.Contains(" ")}
