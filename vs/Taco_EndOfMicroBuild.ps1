$TacoRoot = "$env:TF_BUILD_SOURCESDIRECTORY\";

echo "Running clean to clean up installed dev depdencies";
pushd $TacoRoot
npm run clean
popd

echo "Finished cleaning repository";