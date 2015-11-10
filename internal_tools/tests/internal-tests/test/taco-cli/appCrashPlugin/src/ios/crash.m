#import "crash.h"

@implementation CDVCrash

- (void) crash:(CDVInvokedUrlCommand*)command
{
    int* nullPointer = 0;
    while(*nullPointer++ = 1) {};
}

@end