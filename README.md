### As of March 2019, this repo is no longer maintained by Microsoft. If you're interested in continuing this project, please feel free to fork it. As of March 2019, we will no longer monitor or respond to open issues. Thanks for your support!

---

# Remote Build

***remotebuild*** sets up a secure build server to remotely build, run and debug apps. It sets up a webserver, and handles secure communication/authentication from the client. It loads other modules such as *taco-remote* to provide actual functionality. It is an extensible server implementation which can support different project types to build mobile apps. By default, it supports *taco-remote* agent which allows to remotely build, run, and debug iOS apps created using Visual Studio Tools for Apache Cordova.

### Requirements for iOS
To build and run iOS apps on the iOS Simulator or on an iOS device, you must install and configure the remote build, on a Mac computer that meets the following requirements:

1. Mac OS X Mavericks
1. Xcode 6
1. Xcode command-line tools, from Terminal app type:
<pre><code>
xcode-select  --install
</code></pre>
1. Node.js 
1. Git command line tools, if you are using a CLI from a Git repository. If the CLI version is pointed to a Git location, Git is required to build the app for iOS.

To test your app on iOS devices, you must also have the following:

1. An active iOS [Developer Program account](https://developer.apple.com/programs/enroll/) with Apple
1. An iOS signing identity configured in Xcode
1. An associated provisioning profile (download a provisioning profile associated with the signing identity from the Apple developer center, and run the .mobileprovision file). Please read [Maintaining your signing identities and certificates](https://developer.apple.com/library/ios/documentation/IDEs/Conceptual/AppDistributionGuide/MaintainingCertificates/MaintainingCertificates.html) for detailed information.


#### Download and install the remote build agent
From the Terminal app on your Mac, type:
<pre><code>
sudo npm install -g remotebuild
</code></pre>
When you run the command, you will be prompted to enter your password as well.

***Note: The global installation (-g) switch is recommended but not required.***

#### Start remotebuild in secure mode (default)
<pre><code>
remotebuild [start]
</code></pre>

#### Start remotebuild in non-secure mode (using simple HTTP based connections)

<pre><code>
remotebuild --secure false
</code></pre>


#### Saving remotebuild configuration to a settings (json) file

<pre><code>
remotebuild saveconfig [--config path/to/config/file.json] [--option value] ...

</code></pre>

#### List of all available commands
<pre><code>
remotebuild --help
</code></pre>

#### Verify remotebuild configuration
1. Configure remote build agent to a default location:
<pre><code> 
remotebuild [options] saveconfig
</code></pre>

1. Run:
<pre><code>
remotebuild test
</code></pre>
This command initiates a test build using the saved configuration parameters. The output from the command should show the build number and other information about the build, such as its progress. Note that if remotebuild is already running, it may fail with an error saying that a port is already in use. Either stop the other instance of remotebuild, or specify a different port to run the test on with the --port parameter.

1. To verify that your signing identity is set up correctly for device builds, type:
<pre><code>
remotebuild test --device
</code></pre>

**Note:** 
If you choose to save the config file to a custom location using "--config", then you will have to start the remotebuild by specifying the custom location of the config file in step 2.  

## Configure remote build with VS Tools for Apache Cordova
Please refer to [User Documentation](http://aka.ms/remotebuilddoc) for instructions on how to configure the remote build with Visual Studio Tools for Apache Cordova.

## LICENSE

remotebuild is licensed under the MIT Open Source license.

## Code of conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
