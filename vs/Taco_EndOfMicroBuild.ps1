$TacoRoot = "$env:TF_BUILD_SOURCESDIRECTORY\";
$GulpPath = "$TacoRoot\node_modules\gulp\bin\gulp.js";
$TacoSrc = "$TacoRoot\src";

echo "Running unprep to clean up installed dev depdencies";
pushd $TacoSrc
node $GulpPath unprep 
popd

echo "Finished unprep";