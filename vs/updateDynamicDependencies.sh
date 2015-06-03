# Update file paths in dynamic dependencies to point to the local cache.
for file in */dynamicDependencies.json; do #
    <$file >$file.out sed -e "s#file://.*[\\/]\([-a-zA-Z]*\)#file://`pwd`/\1#g" #
    mv $file.out $file #
done #
#
# Update file paths in package.json local references topoint to the local cache.
for file in */package.json; do #
    <$file >$file.out sed -e "s#file:.*[\\/]\([-a-zA-Z]*\)#file://`pwd`/\1#g" #
    mv $file.out $file #
done #
#
# Remove windows-style line endings from the executable file
tr -d "\r" < remotebuild/bin/remotebuild > remotebuild/bin/out #
mv remotebuild/bin/out remotebuild/bin/remotebuild #
chmod u+x remotebuild/bin/remotebuild #
