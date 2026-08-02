// VisionAnalyzerPlugin.m
// ObjC bridge — registers the Swift class with the Capacitor runtime.
// Capacitor discovers all CAP_PLUGIN registrations at launch via Objective-C
// runtime scanning, so this file must be compiled into the Xcode target.

#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VisionAnalyzerPlugin, "VisionAnalyzer",
    CAP_PLUGIN_METHOD(analyze, CAPPluginReturnPromise);
)
