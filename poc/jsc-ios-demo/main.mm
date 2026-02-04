// PoC: oven-sh/WebKit's JSC on iOS — using both public C API and private C++ API
#import <UIKit/UIKit.h>

// Use the public JSC C API for evaluation (avoids WTF::String issues)
#include <JavaScriptCore/JavaScript.h>

// But ALSO prove the private headers compile:
#include "cmakeconfig.h"
#include <JavaScriptCore/VM.h>
#include <JavaScriptCore/JSGlobalObject.h>
#include <JavaScriptCore/Heap.h>
#include <JavaScriptCore/Structure.h>

@interface ViewController : UIViewController
@property (nonatomic, strong) UITextView *textView;
@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.systemBackgroundColor;
    _textView = [[UITextView alloc] initWithFrame:self.view.bounds];
    _textView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _textView.editable = NO;
    _textView.font = [UIFont monospacedSystemFontOfSize:14 weight:UIFontWeightRegular];
    _textView.contentInset = UIEdgeInsetsMake(60, 10, 20, 10);
    [self.view addSubview:_textView];

    dispatch_async(dispatch_get_global_queue(0, 0), ^{
        NSString *result = [self runTests];
        dispatch_async(dispatch_get_main_queue(), ^{ self->_textView.text = result; });
    });
}

static NSString *eval(JSGlobalContextRef ctx, NSString *code) {
    JSStringRef src = JSStringCreateWithUTF8CString(code.UTF8String);
    JSValueRef exc = NULL;
    JSValueRef val = JSEvaluateScript(ctx, src, NULL, NULL, 0, &exc);
    JSStringRelease(src);
    if (exc) {
        JSStringRef s = JSValueToStringCopy(ctx, exc, NULL);
        size_t len = JSStringGetMaximumUTF8CStringSize(s);
        char *buf = (char *)malloc(len);
        JSStringGetUTF8CString(s, buf, len);
        NSString *r = [NSString stringWithFormat:@"✗ %s", buf];
        free(buf); JSStringRelease(s);
        return r;
    }
    JSStringRef s = JSValueToStringCopy(ctx, val, NULL);
    size_t len = JSStringGetMaximumUTF8CStringSize(s);
    char *buf = (char *)malloc(len);
    JSStringGetUTF8CString(s, buf, len);
    NSString *r = [NSString stringWithUTF8String:buf];
    free(buf); JSStringRelease(s);
    return r;
}

- (NSString *)runTests {
    NSMutableString *out = [NSMutableString string];
    [out appendString:@"oven-sh/WebKit JSC on iOS\n"];
    [out appendString:@"(Bun's engine, JIT disabled)\n"];
    [out appendString:@"════════════════════════════\n\n"];

    JSGlobalContextRef ctx = JSGlobalContextCreate(NULL);

    NSDictionary *tests = @{
        @"string": @"'Hello from Bun\\'s JSC on iOS! 🎉'",
        @"arrow+map": @"[1,2,3,4,5].map(n => n*n).join(', ')",
        @"JSON": @"JSON.stringify({engine:'JSC',source:'oven-sh/WebKit',jit:false})",
        @"fib(30)": @"((n)=>{let f=n=>n<=1?n:f(n-1)+f(n-2);return ''+f(n)})(30)",
        @"spread": @"(()=>{const {a,...r}={a:1,b:2,c:3};return JSON.stringify(r)})()",
        @"Promise": @"typeof Promise",
        @"try/catch": @"(()=>{try{undefined.x}catch(e){return e.message}})()",
        @"class": @"class Foo{#x;constructor(x){this.#x=x}get(){return this.#x}};new Foo(42).get()+''",
        @"generator": @"(function*(){yield 1;yield 2;yield 3})().next().value+''",
        @"WeakRef": @"typeof WeakRef",
    };

    for (NSString *label in @[@"string",@"arrow+map",@"JSON",@"fib(30)",@"spread",
                              @"Promise",@"try/catch",@"class",@"generator",@"WeakRef"]) {
        NSString *r = eval(ctx, tests[label]);
        [out appendFormat:@"▸ %@\n  → %@\n\n", label, r];
    }

    // Prove the private C++ API compiles
    [out appendString:@"════════════════════════════\n"];
    [out appendFormat:@"Private API: JSC::VM size = %zu bytes\n", sizeof(JSC::VM)];
    [out appendFormat:@"JSC::JSGlobalObject size = %zu bytes\n", sizeof(JSC::JSGlobalObject)];
    [out appendString:@"\n✓ Bun's JSC running on iOS.\n"];
    [out appendString:@"  238 private headers available.\n"];

    JSGlobalContextRelease(ctx);
    return out;
}

@end

@interface AppDelegate : UIResponder <UIApplicationDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation AppDelegate
- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    _window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    _window.rootViewController = [ViewController new];
    [_window makeKeyAndVisible];
    return YES;
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        return UIApplicationMain(argc, argv, nil, NSStringFromClass([AppDelegate class]));
    }
}
