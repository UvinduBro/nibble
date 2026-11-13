// Nibble Setup - a native Windows installer (no PowerShell, no console window).
// Downloads the Electron runtime (SHA-256 verified), lays down the app, makes
// Start-menu/Desktop shortcuts, registers in Add/Remove Programs, and doubles as
// its own uninstaller (run with /uninstall).
//
// Build: mcs -target:winexe -platform:anycpu -win32icon:nibble.ico \
//        -r:System.Windows.Forms.dll -r:System.Drawing.dll \
//        -r:System.IO.Compression.dll -r:System.IO.Compression.FileSystem.dll Setup.cs
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Nibble Setup")]
[assembly: AssemblyDescription("Installs Nibble, the desktop pet that lives on your windows")]
[assembly: AssemblyProduct("Nibble")]
[assembly: AssemblyCompany("Uvi")]
[assembly: AssemblyCopyright("Nibble by Uvi")]
[assembly: AssemblyVersion("2.0.19.0")]
[assembly: AssemblyFileVersion("2.0.19.0")]

static class Cfg
{
    public const string Site = "https://nibblex.vercel.app";
    public static string Ver = "2.0.19";
    public const string ElectronVer = "45.2.3";
    public const string ElectronSha = "489CD061908E697394B004298BF5FFD345C935D10E8CA197BA819F019AB2DEC0";

    // [remote path on site, destination under resources/app]. The live list is read from
    // <site>/install-files.txt, so new app files never get left out; this is only the fallback.
    public static string[][] Files = new string[][] {
        new[]{"/app/package.json","package.json"},
        new[]{"/app/src/main.js","src/main.js"},
        new[]{"/app/src/preload.js","src/preload.js"},
        new[]{"/app/src/settings.js","src/settings.js"},
        new[]{"/app/src/hub.js","src/hub.js"},
        new[]{"/app/src/hubPreload.js","src/hubPreload.js"},
        new[]{"/app/src/offline.html","src/offline.html"},
        new[]{"/app/src/windowWatcher.js","src/windowWatcher.js"},
        new[]{"/app/src/nowPlaying.js","src/nowPlaying.js"},
        new[]{"/app/src/helper/WinWatch.cs","src/helper/WinWatch.cs"},
        new[]{"/app/src/renderer/index.html","src/renderer/index.html"},
        new[]{"/app/src/renderer/app.js","src/renderer/app.js"},
        new[]{"/nibble/engine/skins.js","src/skins.js"},
        new[]{"/nibble/engine/lines.js","src/renderer/lines.js"},
        new[]{"/nibble/engine/wardrobe.js","src/renderer/wardrobe.js"},
        new[]{"/nibble/engine/draw.js","src/renderer/draw.js"},
        new[]{"/nibble/engine/pet.js","src/renderer/pet.js"},
        new[]{"/nibble/engine/social-draw.js","src/renderer/social-draw.js"},
    };
}

static class Paths
{
    public static string Dir  { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\Nibble"); } }
    public static string App  { get { return Path.Combine(Dir, @"resources\app"); } }
    public static string Exe  { get { return Path.Combine(Dir, "Nibble.exe"); } }
    public static string Ico  { get { return Path.Combine(Dir, "nibble.ico"); } }
    public static string Setup{ get { return Path.Combine(Dir, "Nibble Setup.exe"); } }
    public static string Menu { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Nibble"); } }
    public static string Desk { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Nibble.lnk"); } }
    public static string AppData { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Nibble"); } }
    public const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    public const string UninKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Nibble";
}

class SetupForm : Form
{
    static readonly Color Bg = Color.FromArgb(11, 13, 23);
    static readonly Color Card = Color.FromArgb(20, 24, 49);
    static readonly Color Mint = Color.FromArgb(126, 232, 198);
    static readonly Color Muted = Color.FromArgb(154, 163, 194);

    readonly Label status;
    readonly ProgressBar bar;
    readonly TextBox log;
    readonly Button done;
    readonly bool uninstalling;
    bool finished;

    public SetupForm(bool uninstall)
    {
        uninstalling = uninstall;
        Text = uninstall ? "Uninstall Nibble" : "Nibble Setup";
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(540, 360);
        BackColor = Bg;
        ForeColor = Color.FromArgb(233, 236, 248);
        Font = new Font("Segoe UI", 9.75f);

        var title = new Label { Text = "nibble", Font = new Font("Segoe UI Semibold", 22f), ForeColor = Mint, AutoSize = true, Location = new Point(22, 14) };
        var sub = new Label { Text = uninstall ? "Removing Nibble from your PC" : "A geeky desktop pet that lives on your windows", ForeColor = Muted, AutoSize = true, Location = new Point(26, 58) };
        status = new Label { Text = "Getting ready…", AutoSize = false, Location = new Point(26, 90), Size = new Size(488, 38) };
        bar = new ProgressBar { Style = ProgressBarStyle.Marquee, MarqueeAnimationSpeed = 30, Location = new Point(26, 132), Size = new Size(488, 10), Minimum = 0, Maximum = 100 };
        log = new TextBox {
            Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, BorderStyle = BorderStyle.None,
            BackColor = Card, ForeColor = Color.FromArgb(200, 210, 235), Font = new Font("Consolas", 9f),
            Location = new Point(26, 152), Size = new Size(488, 148), TabStop = false,
        };
        done = new Button { Text = "Please wait…", Enabled = false, Location = new Point(394, 314), Size = new Size(120, 32), FlatStyle = FlatStyle.Flat, BackColor = Mint, ForeColor = Color.FromArgb(11, 26, 22) };
        done.FlatAppearance.BorderSize = 0;
        done.Click += (s, e) => Close();

        Controls.Add(title); Controls.Add(sub); Controls.Add(status);
        Controls.Add(bar); Controls.Add(log); Controls.Add(done);

        Shown += (s, e) => { var t = new Thread(Run) { IsBackground = true }; t.Start(); };
    }

    void Say(string m) { if (IsHandleCreated) BeginInvoke((Action)(() => { status.Text = m; log.AppendText(m + "\r\n"); })); }
    void SetBar(int pct, bool marquee) {
        if (!IsHandleCreated) return;
        BeginInvoke((Action)(() => {
            if (marquee) { if (bar.Style != ProgressBarStyle.Marquee) bar.Style = ProgressBarStyle.Marquee; }
            else { if (bar.Style != ProgressBarStyle.Continuous) bar.Style = ProgressBarStyle.Continuous; bar.Value = Math.Max(0, Math.Min(100, pct)); }
        }));
    }
    void Finish(string label, bool ok) {
        finished = true;
        if (!IsHandleCreated) return;
        BeginInvoke((Action)(() => {
            bar.Style = ProgressBarStyle.Continuous; bar.Value = ok ? 100 : 0;
            done.Enabled = true; done.Text = label;
        }));
    }

    void Run()
    {
        try { if (uninstalling) DoUninstall(); else DoInstall(); }
        catch (Exception ex) {
            Say("");
            Say("Something went wrong: " + ex.Message);
            if (!uninstalling) Say("Nothing was left half-installed. You can try again, or use the PowerShell line on the website.");
            Finish("Close", false);
        }
    }

    // ---- install ----
    void DoInstall()
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
        if (!Environment.Is64BitOperatingSystem) throw new Exception("Nibble needs 64-bit Windows 10 or 11.");

        Say("Closing any running Nibble…");
        KillNibble();
        LoadLiveList();

        string zip = Path.Combine(Path.GetTempPath(), "nibble-electron-" + Cfg.ElectronVer + "-win32-x64.zip");
        bool cached = File.Exists(zip) && Sha256(zip).Equals(Cfg.ElectronSha, StringComparison.OrdinalIgnoreCase);
        if (!cached) {
            Say("Downloading the runtime (Electron " + Cfg.ElectronVer + ", ~110 MB) from GitHub…");
            Download("https://github.com/electron/electron/releases/download/v" + Cfg.ElectronVer + "/electron-v" + Cfg.ElectronVer + "-win32-x64.zip", zip, true);
            string h = Sha256(zip);
            if (!h.Equals(Cfg.ElectronSha, StringComparison.OrdinalIgnoreCase)) { try { File.Delete(zip); } catch {} throw new Exception("Runtime checksum did not match. Nothing was installed."); }
        }
        Say("Runtime verified (SHA-256 OK)");

        SetBar(0, true);
        Say("Clearing any old copy…");
        for (int i = 0; Directory.Exists(Paths.Dir) && i < 12; i++) {
            try { Directory.Delete(Paths.Dir, true); } catch { Thread.Sleep(700); }
        }
        Directory.CreateDirectory(Paths.Dir);

        Say("Unpacking the runtime…");
        Extract(zip, Paths.Dir);
        string stub = Path.Combine(Paths.Dir, @"resources\default_app.asar");
        try { if (File.Exists(stub)) File.Delete(stub); } catch {}
        try { Download(Cfg.Site + "/nibble.ico", Paths.Ico, false); } catch {}
        Brand();

        Say("Fetching Nibble…");
        Directory.CreateDirectory(Paths.App);
        for (int i = 0; i < Cfg.Files.Length; i++) {
            var f = Cfg.Files[i];
            string dest = Path.Combine(Paths.App, f[1].Replace('/', '\\'));
            Directory.CreateDirectory(Path.GetDirectoryName(dest));
            Download(Cfg.Site + f[0], dest, false);
            SetBar((int)((i + 1) * 100.0 / Cfg.Files.Length), false);
        }
        Say("Finishing up…");
        ForgetOldNames();
        SetBar(0, true);
        try { File.Copy(Application.ExecutablePath, Paths.Setup, true); } catch {}
        string iconRef = File.Exists(Paths.Ico) ? Paths.Ico : (Paths.Exe + ",0");
        Directory.CreateDirectory(Paths.Menu);
        MakeShortcut(Path.Combine(Paths.Menu, "Nibble.lnk"), Paths.Exe, null, iconRef, "Nibble - desktop pet");
        MakeShortcut(Paths.Desk, Paths.Exe, null, iconRef, "Nibble - desktop pet");
        MakeShortcut(Path.Combine(Paths.Menu, "Uninstall Nibble.lnk"), Paths.Setup, "/uninstall", iconRef, "Remove Nibble");
        WriteUninstallEntry(iconRef);
        RefreshIcons(iconRef);

        Finish("Done", true);
        Say("All set — Nibble is dropping onto your screen.");
        Say("Open the Hub from the tray (double-click) to sign in and add friends. Ctrl+Alt+N hides/shows pets.");
        try { Process.Start(new ProcessStartInfo { FileName = Paths.Exe, WorkingDirectory = Paths.Dir, UseShellExecute = true }); } catch {}
    }

    // ---- uninstall ----
    void DoUninstall()
    {
        Say("Closing Nibble…");
        KillNibble();
        Thread.Sleep(600);

        Say("Removing shortcuts…");
        try { using (var k = Registry.CurrentUser.OpenSubKey(Paths.RunKey, true)) if (k != null) foreach (var n in k.GetValueNames()) { var v = k.GetValue(n) as string; if (v != null && v.IndexOf(@"Programs\Nibble", StringComparison.OrdinalIgnoreCase) >= 0) k.DeleteValue(n, false); } } catch {}
        try { if (Directory.Exists(Paths.Menu)) Directory.Delete(Paths.Menu, true); } catch {}
        try { if (File.Exists(Paths.Desk)) File.Delete(Paths.Desk); } catch {}

        Say("Removing settings…");
        try { if (Directory.Exists(Paths.AppData)) Directory.Delete(Paths.AppData, true); } catch {}
        try { using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true)) if (k != null) k.DeleteSubKeyTree("Nibble", false); } catch {}

        Say("Removing program files…");
        // Can't delete our own running copy from inside the folder; schedule a cleanup and move out first.
        ScheduleDirCleanup(Paths.Dir);

        Finish("Close", true);
        Say("");
        Say("Nibble has been removed. Bye!  (o.o)/");
    }

    // ---- the live file list + version from the site ----
    void LoadLiveList()
    {
        try {
            string txt;
            using (var wc = new WebClient()) { wc.Headers.Add("User-Agent", "NibbleSetup"); txt = wc.DownloadString(Cfg.Site + "/install-files.txt"); }
            var list = new System.Collections.Generic.List<string[]>();
            foreach (var raw in txt.Split('\n')) {
                var line = raw.Trim();
                if (line.StartsWith("version ")) { Cfg.Ver = line.Substring(8).Trim(); continue; }
                var parts = line.Split(' ');
                if (parts.Length == 2 && parts[0].StartsWith("/") && !parts[1].Contains("..")) list.Add(parts);
            }
            if (list.Count >= 10) Cfg.Files = list.ToArray();
            Say("Installing Nibble " + Cfg.Ver + " (" + Cfg.Files.Length + " files)");
        } catch { Say("Using the built-in file list"); }
    }

    // ---- give Nibble.exe Nibble's name + icon (otherwise Windows shows "Electron") ----
    // The runtime brands a copy of itself with brand.js (resedit), then the copy replaces electron.exe.
    void Brand()
    {
        string el = Path.Combine(Paths.Dir, "electron.exe");
        string bj = Path.Combine(Paths.Dir, "brand.js");
        bool ok = false;
        try {
            Say("Giving Nibble its name and icon…");
            if (File.Exists(Paths.Exe)) File.Delete(Paths.Exe);
            Download(Cfg.Site + "/app/brand.js", bj, false);
            var psi = new ProcessStartInfo {
                FileName = el,
                Arguments = "\"" + bj + "\" \"" + el + "\" \"" + Paths.Exe + "\" \"" + Paths.Ico + "\" " + Cfg.Ver,
                WorkingDirectory = Paths.Dir, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true,
            };
            psi.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            using (var p = Process.Start(psi)) {
                string err = p.StandardError.ReadToEnd();
                p.WaitForExit(120000);
                if (p.ExitCode != 0 && err.Length > 0) Say("  " + err.Trim());
            }
            ok = File.Exists(Paths.Exe) && FileVersionInfo.GetVersionInfo(Paths.Exe).FileDescription == "Nibble";
        } catch (Exception ex) { Say("  " + ex.Message); }
        try { if (File.Exists(bj)) File.Delete(bj); } catch {}
        if (ok) {
            try { File.Delete(el); } catch {}
            Say("Nibble.exe has Nibble's name and icon ✓");
        } else {
            try { if (File.Exists(Paths.Exe)) File.Delete(Paths.Exe); } catch {}
            File.Move(el, Paths.Exe);
            Say("Couldn't set the name/icon now; Nibble will fix it itself the first time it starts.");
        }
    }

    // Windows remembers an exe's old name ("Electron") per path; forget it so "Nibble" shows
    static void ForgetOldNames()
    {
        try {
            using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache", true)) {
                if (k != null) foreach (var n in k.GetValueNames()) if (n.IndexOf(@"Programs\Nibble\", StringComparison.OrdinalIgnoreCase) >= 0) k.DeleteValue(n, false);
            }
        } catch {}
    }

    // a Nibble pinned to the taskbar keeps its old icon: point it at Nibble's, then nudge Explorer
    static void RefreshIcons(string iconRef)
    {
        try {
            string pins = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar");
            if (Directory.Exists(pins)) foreach (var l in Directory.GetFiles(pins, "*.lnk")) {
                Type t = Type.GetTypeFromProgID("WScript.Shell"); object sh = Activator.CreateInstance(t);
                try {
                    object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { l });
                    Type st = sc.GetType();
                    string target = (string)st.InvokeMember("TargetPath", BindingFlags.GetProperty, null, sc, null);
                    if (target != null && target.IndexOf(@"Programs\Nibble\", StringComparison.OrdinalIgnoreCase) >= 0) {
                        st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { Paths.Exe });
                        st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { iconRef });
                        st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
                    }
                    Marshal.ReleaseComObject(sc);
                } finally { Marshal.ReleaseComObject(sh); }
            }
        } catch {}
        try { Process.Start(new ProcessStartInfo { FileName = "ie4uinit.exe", Arguments = "-show", WindowStyle = ProcessWindowStyle.Hidden, CreateNoWindow = true, UseShellExecute = false }); } catch {}
    }

    // ---- helpers ----
    static void KillNibble()
    {
        foreach (var p in Process.GetProcessesByName("Nibble")) { try { p.Kill(); p.WaitForExit(2500); } catch {} }
    }

    // Unzip without any extra assembly: the built-in tar.exe (Win10 1803+), else Shell COM.
    static void Extract(string zip, string dir)
    {
        string tar = Path.Combine(Environment.SystemDirectory, "tar.exe");
        if (File.Exists(tar)) {
            try {
                var psi = new ProcessStartInfo { FileName = tar, Arguments = "-xf \"" + zip + "\" -C \"" + dir + "\"", WindowStyle = ProcessWindowStyle.Hidden, CreateNoWindow = true, UseShellExecute = false };
                var p = Process.Start(psi); p.WaitForExit();
                if (p.ExitCode == 0 && File.Exists(Path.Combine(dir, "electron.exe"))) return;
            } catch {}
        }
        ShellExtract(zip, dir);
        for (int i = 0; i < 240 && !File.Exists(Path.Combine(dir, "electron.exe")); i++) Thread.Sleep(500);
        if (!File.Exists(Path.Combine(dir, "electron.exe"))) throw new Exception("Could not unpack the runtime.");
    }

    static void ShellExtract(string zip, string dir)
    {
        Type t = Type.GetTypeFromProgID("Shell.Application");
        object shell = Activator.CreateInstance(t);
        try {
            object src = t.InvokeMember("NameSpace", BindingFlags.InvokeMethod, null, shell, new object[] { zip });
            object dst = t.InvokeMember("NameSpace", BindingFlags.InvokeMethod, null, shell, new object[] { dir });
            object items = src.GetType().InvokeMember("Items", BindingFlags.InvokeMethod, null, src, null);
            // 4 = no progress dialog, 16 = yes-to-all, 1024 = no UI on error
            dst.GetType().InvokeMember("CopyHere", BindingFlags.InvokeMethod, null, dst, new object[] { items, 4 | 16 | 1024 });
        } finally { Marshal.ReleaseComObject(shell); }
    }

    void Download(string url, string dest, bool showProgress)
    {
        using (var wc = new WebClient()) {
            wc.Headers.Add("User-Agent", "NibbleSetup/" + Cfg.Ver);
            if (showProgress) {
                var doneEvt = new ManualResetEventSlim(false);
                Exception err = null;
                wc.DownloadProgressChanged += (s, e) => {
                    SetBar(e.ProgressPercentage, false);
                    if (e.TotalBytesToReceive > 0) Say(string.Format("  {0:0.0} / {1:0.0} MB", e.BytesReceived / 1048576.0, e.TotalBytesToReceive / 1048576.0));
                };
                wc.DownloadFileCompleted += (s, e) => { if (e.Error != null) err = e.Error; doneEvt.Set(); };
                wc.DownloadFileAsync(new Uri(url), dest);
                doneEvt.Wait();
                if (err != null) throw err;
            } else {
                wc.DownloadFile(url, dest);
            }
        }
    }

    static string Sha256(string path)
    {
        using (var sha = SHA256.Create())
        using (var fs = File.OpenRead(path))
            return BitConverter.ToString(sha.ComputeHash(fs)).Replace("-", "");
    }

    // Late-bound WScript.Shell COM — makes a .lnk without any console window.
    static void MakeShortcut(string lnk, string target, string args, string icon, string desc)
    {
        Type t = Type.GetTypeFromProgID("WScript.Shell");
        object sh = Activator.CreateInstance(t);
        try {
            object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { lnk });
            Type st = sc.GetType();
            st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
            if (!string.IsNullOrEmpty(args)) st.InvokeMember("Arguments", BindingFlags.SetProperty, null, sc, new object[] { args });
            st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { Paths.Dir });
            if (!string.IsNullOrEmpty(icon)) st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { icon });
            if (!string.IsNullOrEmpty(desc)) st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { desc });
            st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
            Marshal.ReleaseComObject(sc);
        } finally { Marshal.ReleaseComObject(sh); }
    }

    static void WriteUninstallEntry(string iconRef)
    {
        try {
            using (var k = Registry.CurrentUser.CreateSubKey(Paths.UninKey)) {
                if (k == null) return;
                k.SetValue("DisplayName", "Nibble");
                k.SetValue("DisplayVersion", Cfg.Ver);
                k.SetValue("Publisher", "Uvi");
                k.SetValue("DisplayIcon", iconRef);
                k.SetValue("InstallLocation", Paths.Dir);
                k.SetValue("UninstallString", "\"" + Paths.Setup + "\" /uninstall");
                k.SetValue("QuietUninstallString", "\"" + Paths.Setup + "\" /uninstall /quiet");
                k.SetValue("URLInfoAbout", Cfg.Site);
                k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                long kb = 0; try { foreach (var fp in Directory.GetFiles(Paths.Dir, "*", SearchOption.AllDirectories)) kb += new FileInfo(fp).Length / 1024; } catch {}
                if (kb > 0) k.SetValue("EstimatedSize", (int)kb, RegistryValueKind.DWord);
            }
        } catch {}
    }

    // Move the install dir aside, then fire a detached cmd that waits and deletes it.
    static void ScheduleDirCleanup(string dir)
    {
        if (!Directory.Exists(dir)) return;
        string stale = dir + ".old-" + DateTime.Now.Ticks;
        try { Directory.Move(dir, stale); dir = stale; }
        catch { /* our own exe is locked in place; fall back to deleting what we can */ }
        string cmd = "/c ping 127.0.0.1 -n 3 >nul & rmdir /s /q \"" + dir + "\"";
        try { Process.Start(new ProcessStartInfo { FileName = "cmd.exe", Arguments = cmd, WindowStyle = ProcessWindowStyle.Hidden, CreateNoWindow = true, UseShellExecute = false }); } catch {}
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (!finished) { if (MessageBox.Show(this, "Cancel and quit?", Text, MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) { e.Cancel = true; return; } }
        base.OnFormClosing(e);
    }
}

static class Program
{
    [STAThread]
    static void Main(string[] argv)
    {
        bool uninstall = false, quiet = false;
        foreach (var a in argv) {
            string s = a.TrimStart('-', '/').ToLowerInvariant();
            if (s == "uninstall" || s == "remove") uninstall = true;
            if (s == "quiet" || s == "silent" || s == "s") quiet = true;
        }
        if (uninstall && quiet) { QuietUninstall(); return; }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm(uninstall));
    }

    static void QuietUninstall()
    {
        foreach (var p in Process.GetProcessesByName("Nibble")) { try { p.Kill(); p.WaitForExit(2500); } catch {} }
        try { using (var k = Registry.CurrentUser.OpenSubKey(Paths.RunKey, true)) if (k != null) foreach (var n in k.GetValueNames()) { var v = k.GetValue(n) as string; if (v != null && v.IndexOf(@"Programs\Nibble", StringComparison.OrdinalIgnoreCase) >= 0) k.DeleteValue(n, false); } } catch {}
        try { if (Directory.Exists(Paths.Menu)) Directory.Delete(Paths.Menu, true); } catch {}
        try { if (File.Exists(Paths.Desk)) File.Delete(Paths.Desk); } catch {}
        try { if (Directory.Exists(Paths.AppData)) Directory.Delete(Paths.AppData, true); } catch {}
        try { using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true)) if (k != null) k.DeleteSubKeyTree("Nibble", false); } catch {}
        try {
            string dir = Paths.Dir, stale = dir + ".old-" + DateTime.Now.Ticks;
            try { Directory.Move(dir, stale); dir = stale; } catch {}
            Process.Start(new ProcessStartInfo { FileName = "cmd.exe", Arguments = "/c ping 127.0.0.1 -n 3 >nul & rmdir /s /q \"" + dir + "\"", WindowStyle = ProcessWindowStyle.Hidden, CreateNoWindow = true, UseShellExecute = false });
        } catch {}
    }
}
