// Nibble window watcher.
// Compiled at runtime by PowerShell's Add-Type (uses the C# compiler that ships with Windows),
// so the app needs no native Node modules. Streams one JSON line to stdout whenever the
// set of visible windows (or the foreground app) changes.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class NibbleWatch
{
    delegate bool EnumProc(IntPtr h, IntPtr l);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int L, T, R, B; }

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int idx);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] static extern int DwmRect(IntPtr h, int attr, out RECT r, int size);
    [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] static extern int DwmInt(IntPtr h, int attr, out int v, int size);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    const int GWL_EXSTYLE = -20;
    const int WS_EX_TOOLWINDOW = 0x80;
    const int WS_EX_APPWINDOW = 0x40000;
    const int WS_EX_NOACTIVATE = 0x08000000;
    const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    const int DWMWA_CLOAKED = 14;

    static readonly string[] SkipClasses = {
        "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd",
        "Windows.UI.Core.CoreWindow", "NotifyIconOverflowWindow", "TopLevelWindowForOverflowXamlIsland",
        "XamlExplorerHostIslandWindow", "ForegroundStaging", "MultitaskingViewFrame"
    };

    static readonly Dictionary<uint, string> ProcNames = new Dictionary<uint, string>();

    static string ProcName(uint pid)
    {
        string n;
        if (ProcNames.TryGetValue(pid, out n)) return n;
        try { n = Process.GetProcessById((int)pid).ProcessName; } catch { n = ""; }
        if (ProcNames.Count > 400) ProcNames.Clear();
        ProcNames[pid] = n;
        return n;
    }

    static string Esc(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        var sb = new StringBuilder(s.Length + 8);
        foreach (char c in s)
        {
            if (c == '"' || c == '\\') { sb.Append('\\').Append(c); }
            else if (c < 0x20) { sb.Append(' '); }
            else sb.Append(c);
        }
        return sb.ToString();
    }

    static string Title(IntPtr h)
    {
        int len = GetWindowTextLength(h);
        if (len <= 0) return "";
        var sb = new StringBuilder(Math.Min(len, 300) + 1);
        GetWindowText(h, sb, sb.Capacity);
        return sb.ToString();
    }

    static string Cls(IntPtr h)
    {
        var sb = new StringBuilder(128);
        GetClassName(h, sb, sb.Capacity);
        return sb.ToString();
    }

    static RECT Bounds(IntPtr h)
    {
        RECT r;
        // Extended frame bounds = the visible window, without the invisible resize shadow.
        if (DwmRect(h, DWMWA_EXTENDED_FRAME_BOUNDS, out r, Marshal.SizeOf(typeof(RECT))) != 0)
            GetWindowRect(h, out r);
        return r;
    }

    public static void Run(int ownPid, int intervalMs)
    {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } // per-monitor v2 => physical pixels
        catch { try { SetProcessDPIAware(); } catch { } }

        try { Console.OutputEncoding = Encoding.UTF8; } catch { }
        string last = null;
        int sinceBeat = 0;

        while (true)
        {
            var sb = new StringBuilder(4096);
            sb.Append("{\"wins\":[");
            bool first = true;

            EnumWindows((h, l) =>
            {
                try
                {
                    if (!IsWindowVisible(h) || IsIconic(h)) return true;
                    uint pid; GetWindowThreadProcessId(h, out pid);
                    if (pid == (uint)ownPid) return true;
                    int ex = GetWindowLong(h, GWL_EXSTYLE);
                    if ((ex & WS_EX_TOOLWINDOW) != 0 && (ex & WS_EX_APPWINDOW) == 0) return true;
                    if ((ex & WS_EX_NOACTIVATE) != 0 && (ex & WS_EX_APPWINDOW) == 0) return true;
                    int cloaked; if (DwmInt(h, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
                    if (GetWindowTextLength(h) == 0) return true;
                    if (Array.IndexOf(SkipClasses, Cls(h)) >= 0) return true;
                    RECT r = Bounds(h);
                    int w = r.R - r.L, ht = r.B - r.T;
                    if (w < 120 || ht < 60) return true;

                    if (!first) sb.Append(',');
                    first = false;
                    sb.Append("{\"id\":").Append(h.ToInt64())
                      .Append(",\"x\":").Append(r.L).Append(",\"y\":").Append(r.T)
                      .Append(",\"w\":").Append(w).Append(",\"h\":").Append(ht)
                      .Append(",\"max\":").Append(IsZoomed(h) ? "true" : "false").Append('}');
                }
                catch { }
                return true; // EnumWindows walks top-most first => this list is in z-order
            }, IntPtr.Zero);

            sb.Append("],\"fg\":");
            IntPtr fg = GetForegroundWindow();
            if (fg != IntPtr.Zero)
            {
                uint fpid; GetWindowThreadProcessId(fg, out fpid);
                RECT fr = Bounds(fg);
                sb.Append("{\"id\":").Append(fg.ToInt64())
                  .Append(",\"proc\":\"").Append(Esc(fpid == (uint)ownPid ? "nibble" : ProcName(fpid))).Append('"')
                  .Append(",\"title\":\"").Append(Esc(Title(fg))).Append('"')
                  .Append(",\"cls\":\"").Append(Esc(Cls(fg))).Append('"')
                  .Append(",\"x\":").Append(fr.L).Append(",\"y\":").Append(fr.T)
                  .Append(",\"w\":").Append(fr.R - fr.L).Append(",\"h\":").Append(fr.B - fr.T).Append('}');
            }
            else sb.Append("null");
            sb.Append('}');

            string json = sb.ToString();
            sinceBeat += intervalMs;
            if (json != last || sinceBeat >= 5000)
            {
                Console.Out.WriteLine(json);
                Console.Out.Flush();
                last = json;
                sinceBeat = 0;
            }
            Thread.Sleep(intervalMs);
        }
    }
}
