using System;
using System.Threading.Tasks;
using System.Security.Cryptography.X509Certificates;

// Must be a class called Startup with a public method called Invoke for edge.js to find it.
public class Startup
{
    public async Task<object> Invoke(dynamic input)
    {
        return "test";
    }

}