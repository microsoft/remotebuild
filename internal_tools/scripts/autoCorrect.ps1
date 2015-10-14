$excluded=((ls -r -fil *.d.ts |% { $_.Name}) -Join " ")
$command = " & node ../tools/internal/TSStyleCop/TSStyleCop.js -analyze . -autoCorrect -exclude $excluded -config ../tools/internal/TSStyleCop/TSStyleAllRules.json"
Invoke-Expression $command
