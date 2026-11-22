// Nibble for Android and iPhone.
//
// A native shell (tab bar, badges, notifications, Google sign-in, offline screen, back button) around
// the live Nibble web app at https://meetnibble.com/m. The web page and this app talk through the
// `NibbleMobile` JavaScript channel; the web half lives in lib/mobileBridge.js of the website.
// Because the pages come from the website, every website update reaches the app straight away.
import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

/// Where the app lives. Override for testing: `--dart-define=NIBBLE_SITE=https://preview-url.vercel.app`
const String kSite = String.fromEnvironment('NIBBLE_SITE', defaultValue: 'https://meetnibble.com');

/// Google sign-in page. It runs in the phone's browser (Google blocks sign-in inside app WebViews)
/// and must be on a domain listed in Firebase → Authentication → Authorized domains.
const String kSignInSite = String.fromEnvironment('NIBBLE_SIGNIN_SITE', defaultValue: 'https://nibblex.vercel.app');

/// Pages the WebView may open itself. Anything else opens in the phone's browser.
const Set<String> kOwnHosts = {'meetnibble.com', 'www.meetnibble.com', 'nibblex.vercel.app'};

const Color kInk = Color(0xFF0E0F1A);
const Color kCard = Color(0xFF161829);
const Color kMint = Color(0xFF7EE8C6);
const Color kMuted = Color(0xFF9AA0BF);

final FlutterLocalNotificationsPlugin notifications = FlutterLocalNotificationsPlugin();
final StreamController<String> notificationTaps = StreamController<String>.broadcast();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: kCard,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  await notifications.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    ),
    onDidReceiveNotificationResponse: (r) {
      final tab = r.payload ?? '';
      if (tab.isNotEmpty) notificationTaps.add(tab);
    },
  );
  runApp(const NibbleApp());
}

class NibbleApp extends StatelessWidget {
  const NibbleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nibble',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: kInk,
        colorScheme: ColorScheme.fromSeed(seedColor: kMint, brightness: Brightness.dark, surface: kCard, primary: kMint),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: kCard,
          indicatorColor: kMint.withValues(alpha: 0.18),
          labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
                fontSize: 11.5,
                fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
                color: s.contains(WidgetState.selected) ? Colors.white : kMuted,
              )),
        ),
      ),
      home: const NibbleShell(),
    );
  }
}

/// One page of the web app, as the website describes it ({ id, label, icon }).
class NavTab {
  const NavTab(this.id, this.label, this.icon);
  final String id;
  final String label;
  final String icon;
}

const List<String> kPrimary = ['home', 'friends', 'messages', 'groups'];

IconData iconFor(String key, {bool on = false}) {
  switch (key) {
    case 'house':
      return on ? Icons.home_rounded : Icons.home_outlined;
    case 'palette':
      return on ? Icons.palette : Icons.palette_outlined;
    case 'game':
      return on ? Icons.sports_esports : Icons.sports_esports_outlined;
    case 'trophy':
      return on ? Icons.emoji_events : Icons.emoji_events_outlined;
    case 'smile':
      return on ? Icons.people_alt : Icons.people_alt_outlined;
    case 'envelope':
      return on ? Icons.chat_bubble : Icons.chat_bubble_outline;
    case 'people':
      return on ? Icons.groups : Icons.groups_outlined;
    case 'tea':
      return on ? Icons.local_cafe : Icons.local_cafe_outlined;
    case 'notes':
      return on ? Icons.headphones : Icons.headphones_outlined;
    case 'alarm':
      return on ? Icons.alarm : Icons.alarm_outlined;
    case 'bust':
      return on ? Icons.person : Icons.person_outline;
    case 'bug':
      return on ? Icons.bug_report : Icons.bug_report_outlined;
    case 'gem':
      return on ? Icons.diamond : Icons.diamond_outlined;
    case 'gear':
      return on ? Icons.settings : Icons.settings_outlined;
    default:
      return on ? Icons.circle : Icons.circle_outlined;
  }
}

class NibbleShell extends StatefulWidget {
  const NibbleShell({super.key});

  @override
  State<NibbleShell> createState() => _NibbleShellState();
}

class _NibbleShellState extends State<NibbleShell> with WidgetsBindingObserver {
  WebViewController? _webc;
  WebViewController get _web => _webc!;
  StreamSubscription<String>? _taps;
  String _version = '1.0.0';
  bool _loaded = false; // first page shown
  bool _offline = false;
  int _progress = 0;
  List<NavTab> _tabs = const [];
  String _current = 'home';
  Map<String, int> _badges = const {};
  bool _foreground = true;
  bool _askedNotify = false;
  String _pendingTab = ''; // from a notification tap before the page was ready

  bool get _signedIn => _tabs.isNotEmpty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _taps = notificationTaps.stream.listen(_openTab);
    _setUp();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _taps?.cancel();
    super.dispose();
  }

  Future<void> _setUp() async {
    try {
      _version = (await PackageInfo.fromPlatform()).version;
    } catch (_) {}
    final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true, // music rooms play inside the page
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }
    final web = WebViewController.fromPlatformCreationParams(params);
    web
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(kInk)
      ..addJavaScriptChannel('NibbleMobile', onMessageReceived: (m) => _onMessage(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => _progress = p),
        onPageFinished: (_) => setState(() {
          _loaded = true;
          _progress = 100;
        }),
        onWebResourceError: (e) {
          if (e.isForMainFrame ?? true) setState(() => _offline = true);
        },
        onNavigationRequest: (r) {
          if (!r.isMainFrame) return NavigationDecision.navigate; // embedded players (YouTube, Spotify)
          final uri = Uri.tryParse(r.url);
          if (uri == null) return NavigationDecision.prevent;
          if ((uri.scheme == 'https' || uri.scheme == 'http') && kOwnHosts.contains(uri.host)) return NavigationDecision.navigate;
          if (uri.scheme == 'about' || uri.scheme == 'data' || uri.scheme == 'blob') return NavigationDecision.navigate;
          _openExternal(r.url);
          return NavigationDecision.prevent;
        },
      ));
    final platform = web.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(kDebugMode);
      await platform.setMediaPlaybackRequiresUserGesture(false);
    }
    if (platform is WebKitWebViewController) {
      await platform.setAllowsBackForwardNavigationGestures(false);
      if (kDebugMode) await platform.setInspectable(true);
    }
    // the web page recognises the app by this tag at the end of the user agent
    String ua = '';
    try {
      ua = await web.getUserAgent() ?? '';
    } catch (_) {}
    if (ua.isEmpty) {
      ua = Platform.isIOS
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
          : 'Mozilla/5.0 (Linux; Android 14; Mobile; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
    }
    await web.setUserAgent('$ua NibbleMobile/$_version (${Platform.isIOS ? 'ios' : 'android'})');
    setState(() => _webc = web);
    _load();
  }

  bool _ready = false;
  void _load() {
    setState(() {
      _offline = false;
      _progress = 0;
    });
    _web.loadRequest(Uri.parse('$kSite/m'));
  }

  // ---------- messages from the web page ----------
  void _onMessage(String raw) {
    Map<String, dynamic> m;
    try {
      final d = jsonDecode(raw);
      if (d is! Map<String, dynamic>) return;
      m = d;
    } catch (_) {
      return;
    }
    final type = m['type'];
    switch (type) {
      case 'ready':
        _ready = true;
        if (_pendingTab.isNotEmpty) {
          _sendEvent('tab', _pendingTab);
          _pendingTab = '';
        }
        break;
      case 'tabs':
        final list = (m['tabs'] is List ? m['tabs'] as List : const [])
            .whereType<Map>()
            .map((t) => NavTab('${t['id'] ?? ''}', '${t['label'] ?? ''}', '${t['icon'] ?? ''}'))
            .where((t) => RegExp(r'^[a-z]{2,12}$').hasMatch(t.id))
            .take(20)
            .toList();
        setState(() => _tabs = list);
        if (list.isNotEmpty) _askNotificationsOnce();
        break;
      case 'current':
        final t = '${m['tab'] ?? ''}';
        if (t.isNotEmpty) setState(() => _current = t);
        break;
      case 'badges':
        final b = m['badges'];
        if (b is Map) {
          setState(() => _badges = {
                for (final e in b.entries)
                  if (e.value is num) '${e.key}': (e.value as num).toInt().clamp(0, 999)
              });
        }
        break;
      case 'notify':
        _notify('${m['title'] ?? 'Nibble'}', '${m['body'] ?? ''}', '${m['tab'] ?? ''}');
        break;
      case 'google':
        _googleSignIn('${m['id'] ?? ''}');
        break;
      case 'open':
        _openExternal('${m['url'] ?? ''}');
        break;
      case 'haptic':
        m['kind'] == 'heavy' ? HapticFeedback.mediumImpact() : HapticFeedback.selectionClick();
        break;
      case 'signedOut':
        setState(() {
          _tabs = const [];
          _badges = const {};
          _current = 'home';
        });
        break;
    }
  }

  Future<void> _js(Map<String, dynamic> msg) async {
    try {
      await _web.runJavaScript('window.__nibbleMobileIn && window.__nibbleMobileIn(${jsonEncode(msg)});');
    } catch (_) {}
  }

  void _sendEvent(String event, Object value) => _js({'event': event, 'value': value});

  void _openTab(String tab) {
    if (!RegExp(r'^[a-z]{2,12}$').hasMatch(tab)) return;
    HapticFeedback.selectionClick();
    setState(() => _current = tab);
    if (_ready) {
      _sendEvent('tab', tab);
    } else {
      _pendingTab = tab;
    }
  }

  // ---------- Google sign-in in the phone's browser ----------
  Future<void> _googleSignIn(String id) async {
    final rnd = Random.secure();
    final state = List.generate(16, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    try {
      final result = await FlutterWebAuth2.authenticate(
        url: '$kSignInSite/link?app=mobile&state=$state',
        callbackUrlScheme: 'nibble',
      );
      final uri = Uri.parse(result);
      final token = uri.queryParameters['g'] ?? '';
      if (uri.queryParameters['state'] != state || token.isEmpty) {
        await _js({'id': id, 'error': 'Google sign-in didn’t finish. Try again.'});
        return;
      }
      await _js({'id': id, 'result': token});
    } on PlatformException catch (e) {
      final cancelled = e.code.toUpperCase().contains('CANCEL');
      await _js({'id': id, 'error': cancelled ? 'Google sign-in was cancelled.' : 'Google sign-in didn’t work. Try again, or use email.'});
    } catch (_) {
      await _js({'id': id, 'error': 'Google sign-in didn’t work. Try again, or use email.'});
    }
  }

  // ---------- notifications ----------
  Future<void> _askNotificationsOnce() async {
    if (_askedNotify) return;
    _askedNotify = true;
    try {
      if (Platform.isIOS) {
        await notifications
            .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
            ?.requestPermissions(alert: true, badge: true, sound: true);
      } else {
        await notifications
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.requestNotificationsPermission();
      }
    } catch (_) {}
  }

  int _nid = 0;
  Future<void> _notify(String title, String body, String tab) async {
    if (_foreground) {
      // in the app: a small banner instead of a system notification
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: kCard,
          content: Text(body.isEmpty ? title : '$title: $body', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white)),
          action: tab.isEmpty ? null : SnackBarAction(label: 'Open', textColor: kMint, onPressed: () => _openTab(tab)),
          duration: const Duration(seconds: 4),
        ));
      return;
    }
    try {
      await notifications.show(
        ++_nid,
        title,
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails('nibble', 'Messages and friends',
              channelDescription: 'New messages, friend requests, group chats and reminders', importance: Importance.high, priority: Priority.high),
          iOS: DarwinNotificationDetails(),
        ),
        payload: tab,
      );
    } catch (_) {}
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || !(uri.scheme == 'https' || uri.scheme == 'http' || uri.scheme == 'mailto')) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  // ---------- app in front / in the background ----------
  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    final visible = s == AppLifecycleState.resumed;
    if (visible == _foreground) return;
    _foreground = visible;
    if (_ready) _sendEvent('visible', visible);
  }

  // Android back: go back inside the page, then to Home, then leave the app
  Future<void> _back() async {
    if (_offline) return SystemNavigator.pop();
    try {
      if (await _web.canGoBack()) {
        await _web.goBack();
        return;
      }
    } catch (_) {}
    if (_signedIn && _current != 'home') return _openTab('home');
    await SystemNavigator.pop();
  }

  // ---------- UI ----------
  List<NavTab> get _bar {
    final byId = {for (final t in _tabs) t.id: t};
    final out = <NavTab>[for (final id in kPrimary) if (byId[id] != null) byId[id]!];
    for (final t in _tabs) {
      if (out.length >= 4) break;
      if (!out.contains(t)) out.add(t);
    }
    return out;
  }

  List<NavTab> get _more => _tabs.where((t) => !_bar.contains(t)).toList();

  int _badge(String id) => _badges[id] ?? 0;

  void _openMore() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: kCard,
      showDragHandle: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: GridView.count(
            shrinkWrap: true,
            crossAxisCount: 4,
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            childAspectRatio: 0.92,
            children: [
              for (final t in _more)
                InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () {
                    Navigator.pop(ctx);
                    _openTab(t.id);
                  },
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Badge(
                      isLabelVisible: _badge(t.id) > 0,
                      label: Text('${_badge(t.id)}'),
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: t.id == _current ? kMint.withValues(alpha: 0.18) : Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Icon(iconFor(t.icon, on: t.id == _current), color: t.id == _current ? kMint : Colors.white),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(t.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Colors.white)),
                  ]),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget? _navBar() {
    if (!_signedIn || _offline) return null;
    final bar = _bar;
    final more = _more;
    final moreOn = more.any((t) => t.id == _current);
    final moreBadge = more.fold<int>(0, (n, t) => n + _badge(t.id));
    int sel = bar.indexWhere((t) => t.id == _current);
    if (sel < 0) sel = moreOn && more.isNotEmpty ? bar.length : 0;
    return NavigationBar(
      height: 64,
      selectedIndex: sel,
      onDestinationSelected: (i) => i < bar.length ? _openTab(bar[i].id) : _openMore(),
      destinations: [
        for (final t in bar)
          NavigationDestination(
            icon: Badge(isLabelVisible: _badge(t.id) > 0, label: Text('${_badge(t.id)}'), child: Icon(iconFor(t.icon))),
            selectedIcon: Badge(isLabelVisible: _badge(t.id) > 0, label: Text('${_badge(t.id)}'), child: Icon(iconFor(t.icon, on: true), color: kMint)),
            label: t.label,
          ),
        if (more.isNotEmpty)
          NavigationDestination(
            icon: Badge(isLabelVisible: moreBadge > 0, label: Text('$moreBadge'), child: const Icon(Icons.apps_rounded)),
            selectedIcon: const Icon(Icons.apps_rounded, color: kMint),
            label: 'More',
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final started = _loaded;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        backgroundColor: kInk,
        bottomNavigationBar: _navBar(),
        body: SafeArea(
          bottom: !_signedIn,
          child: Stack(children: [
            if (_isSetUp) WebViewWidget(controller: _web),
            if (!started && !_offline) _Splash(progress: _progress),
            if (started && _progress < 100 && !_offline)
              Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(value: _progress / 100, minHeight: 2, color: kMint, backgroundColor: Colors.transparent)),
            if (_offline) _Offline(onRetry: _load),
          ]),
        ),
      ),
    );
  }

  bool get _isSetUp => _webc != null;
}

class _Splash extends StatelessWidget {
  const _Splash({required this.progress});
  final int progress;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kInk,
      alignment: Alignment.center,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Image.asset('assets/logo.png', width: 132, height: 132),
        const SizedBox(height: 18),
        const Text('Nibble', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5)),
        const SizedBox(height: 22),
        SizedBox(
          width: 120,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(value: progress == 0 ? null : progress / 100, minHeight: 4, color: kMint, backgroundColor: Colors.white12),
          ),
        ),
      ]),
    );
  }
}

class _Offline extends StatelessWidget {
  const _Offline({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kInk,
      padding: const EdgeInsets.all(28),
      alignment: Alignment.center,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Opacity(opacity: 0.85, child: Image.asset('assets/logo.png', width: 110, height: 110)),
        const SizedBox(height: 18),
        const Text('Can’t reach Nibble', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
        const SizedBox(height: 8),
        const Text('Check your internet connection, then try again.', textAlign: TextAlign.center, style: TextStyle(fontSize: 15, color: kMuted, height: 1.4)),
        const SizedBox(height: 22),
        FilledButton(
          onPressed: onRetry,
          style: FilledButton.styleFrom(backgroundColor: kMint, foregroundColor: kInk, padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14)),
          child: const Text('Try again', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        ),
      ]),
    );
  }
}
