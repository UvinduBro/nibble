#!/usr/bin/env python3
"""Make the Flutter-generated Android + iOS projects in mobile/ ready for Nibble (safe to run again).

  python3 tools/mobile/patch_native.py

Sets the store ids (com.meetnibble.app), the app name, permissions, the nibble:// sign-in callback,
notification set-up, release signing (Android, from mobile/android/key.properties) and dark launch screens.
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'mobile')
APP_ID = 'com.meetnibble.app'
BG = '#0E0F1A'


def path(*p):
    return os.path.join(ROOT, *p)


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def must(cond, what):
    if not cond:
        sys.exit('patch_native: could not ' + what)


# ---------------- Android ----------------
def android():
    gk = path('android', 'app', 'build.gradle.kts')
    g = path('android', 'app', 'build.gradle')
    kts = os.path.exists(gk)
    gp = gk if kts else g
    s = read(gp)
    if kts:
        s = re.sub(r'applicationId\s*=\s*"[^"]+"', f'applicationId = "{APP_ID}"', s)
        s = re.sub(r'minSdk\s*=\s*[^\n]+', 'minSdk = 24', s)
        if 'isCoreLibraryDesugaringEnabled' not in s:
            s = s.replace('compileOptions {', 'compileOptions {\n        isCoreLibraryDesugaringEnabled = true', 1)
        if 'desugar_jdk_libs' not in s:
            s += '\ndependencies {\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")\n}\n'
        if 'nibbleKeys' not in s:
            # release signing from android/key.properties (kept out of git); debug keys otherwise
            s = 'import java.util.Properties\nimport java.io.FileInputStream\n\n' + s
            s = s.replace('android {', '''val nibbleKeys = Properties()
val nibbleKeyFile = rootProject.file("key.properties")
if (nibbleKeyFile.exists()) nibbleKeys.load(FileInputStream(nibbleKeyFile))

android {''', 1)
            s = s.replace('    buildTypes {', '''    signingConfigs {
        create("release") {
            if (nibbleKeyFile.exists()) {
                keyAlias = nibbleKeys["keyAlias"] as String
                keyPassword = nibbleKeys["keyPassword"] as String
                storeFile = file(nibbleKeys["storeFile"] as String)
                storePassword = nibbleKeys["storePassword"] as String
            }
        }
    }

    buildTypes {''', 1)
            s = re.sub(r'signingConfig\s*=\s*signingConfigs\.getByName\("debug"\)',
                       'signingConfig = if (nibbleKeyFile.exists()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")', s)
        must('applicationId = "' + APP_ID in s, 'set applicationId (kts)')
    else:
        s = re.sub(r'applicationId\s+"[^"]+"', f'applicationId "{APP_ID}"', s)
        s = re.sub(r'minSdk(Version)?\s+[^\n]+', 'minSdkVersion 24', s)
        if 'coreLibraryDesugaringEnabled' not in s:
            s = s.replace('compileOptions {', 'compileOptions {\n        coreLibraryDesugaringEnabled true', 1)
        if 'desugar_jdk_libs' not in s:
            s += "\ndependencies {\n    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'\n}\n"
        must('applicationId "' + APP_ID in s, 'set applicationId (groovy)')
    write(gp, s)

    mp = path('android', 'app', 'src', 'main', 'AndroidManifest.xml')
    m = read(mp)
    m = re.sub(r'android:label="[^"]*"', 'android:label="Nibble"', m, count=1)
    perms = ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE']
    for p in perms:
        if p not in m:
            m = m.replace('<application', f'<uses-permission android:name="{p}"/>\n    <application', 1)
    if 'flutter_web_auth_2.CallbackActivity' not in m:
        m = m.replace('</application>', '''    <!-- Google sign-in returns here: nibble://auth (flutter_web_auth_2) -->
        <activity android:name="com.linusu.flutter_web_auth_2.CallbackActivity" android:exported="true">
            <intent-filter android:label="flutter_web_auth_2">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="nibble" android:host="auth" />
            </intent-filter>
        </activity>
    </application>''', 1)
    if 'CustomTabsService' not in m:
        # Android 11+: let the app see browsers (links + Google sign-in)
        q = '''    <queries>
        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="https" /></intent>
        <intent><action android:name="android.support.customtabs.action.CustomTabsService" /></intent>
    </queries>
'''
        if '<queries>' in m:
            inner = '\n'.join(q.rstrip().split('\n')[1:-1])
            m = m.replace('<queries>', '<queries>\n' + inner, 1)
        else:
            m = m.replace('</manifest>', q + '</manifest>', 1)
    write(mp, m)

    res = path('android', 'app', 'src', 'main', 'res')
    write(os.path.join(res, 'values', 'nibble_colors.xml'),
          f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="nibble_bg">{BG}</color>\n</resources>\n')
    launch = '''<?xml version="1.0" encoding="utf-8"?>
<!-- Nibble launch screen: dark background, the app icon in the middle -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/nibble_bg" />
    <item android:width="120dp" android:height="120dp" android:gravity="center">
        <bitmap android:gravity="fill" android:src="@mipmap/ic_launcher" />
    </item>
</layer-list>
'''
    for d in ('drawable', 'drawable-v21'):
        if os.path.isdir(os.path.join(res, d)):
            write(os.path.join(res, d, 'launch_background.xml'), launch)
    # don't keep page caches or app data in Google's cloud backup (accounts are on our server anyway)
    print('android: ok')


# ---------------- iOS ----------------
def ios():
    pb = path('ios', 'Runner.xcodeproj', 'project.pbxproj')
    s = read(pb)
    s = re.sub(r'PRODUCT_BUNDLE_IDENTIFIER = [A-Za-z0-9.\-]+\.RunnerTests;', f'PRODUCT_BUNDLE_IDENTIFIER = {APP_ID}.RunnerTests;', s)
    s = re.sub(r'PRODUCT_BUNDLE_IDENTIFIER = (?![^;]*RunnerTests)[A-Za-z0-9.\-]+;', f'PRODUCT_BUNDLE_IDENTIFIER = {APP_ID};', s)
    s = re.sub(r'IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;', s)
    must(f'PRODUCT_BUNDLE_IDENTIFIER = {APP_ID};' in s, 'set the iOS bundle id')
    # Sign in with Apple needs an entitlement (Apple asks for it because the app offers Google sign-in)
    if 'CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;' not in s:
        s = s.replace(f'PRODUCT_BUNDLE_IDENTIFIER = {APP_ID};', f'CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {APP_ID};')
    write(pb, s)
    write(path('ios', 'Runner', 'Runner.entitlements'), '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.applesignin</key>
	<array>
		<string>Default</string>
	</array>
</dict>
</plist>
''')

    ip = path('ios', 'Runner', 'Info.plist')
    p = read(ip)

    def setkey(p, key, xml):
        if f'<key>{key}</key>' in p:
            return re.sub(rf'<key>{key}</key>\s*<[^>]+>[^<]*</[^>]+>|<key>{key}</key>\s*<(true|false)/>', f'<key>{key}</key>\n\t{xml}', p, count=1)
        return p.replace('</dict>\n</plist>', f'\t<key>{key}</key>\n\t{xml}\n</dict>\n</plist>', 1)
    p = setkey(p, 'CFBundleDisplayName', '<string>Nibble</string>')
    p = setkey(p, 'CFBundleName', '<string>Nibble</string>')
    p = setkey(p, 'ITSAppUsesNonExemptEncryption', '<false/>')  # only standard HTTPS: no export paperwork
    p = setkey(p, 'UIStatusBarStyle', '<string>UIStatusBarStyleLightContent</string>')
    p = setkey(p, 'UIViewControllerBasedStatusBarAppearance', '<false/>')
    write(ip, p)

    po = path('ios', 'Podfile')
    if os.path.exists(po):
        s = read(po)
        s = re.sub(r"^#?\s*platform :ios, '[0-9.]+'", "platform :ios, '15.0'", s, flags=re.M)
        write(po, s)

    ad = path('ios', 'Runner', 'AppDelegate.swift')
    s = read(ad)
    if 'UNUserNotificationCenter' not in s:
        s = s.replace('import UIKit', 'import UIKit\nimport UserNotifications', 1)
        # notifications show while the app is open too (flutter_local_notifications set-up)
        s = re.sub(r'(\n(\s*)GeneratedPluginRegistrant\.register)',
                   r'\n\2UNUserNotificationCenter.current().delegate = self as? UNUserNotificationCenterDelegate\1', s, count=1)
        must('UNUserNotificationCenter.current().delegate' in s, 'add the notification delegate')
    write(ad, s)

    ls = path('ios', 'Runner', 'Base.lproj', 'LaunchScreen.storyboard')
    if os.path.exists(ls):
        s = read(ls)
        s = re.sub(r'<color key="backgroundColor"[^/]*/>',
                   '<color key="backgroundColor" red="0.0549" green="0.0588" blue="0.1020" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>', s)
        write(ls, s)
    print('ios: ok')


if __name__ == '__main__':
    android()
    ios()
