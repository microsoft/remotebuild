$TacoRoot = "$env:TF_BUILD_SOURCESDIRECTORY\src";
$GulpPath = "$TacoRoot\node_modules\gulp\bin\gulp.js";
$TacoSrc = "$TacoRoot\src";

pushd $TacoSrc
node $GulpPath unprep 
popd