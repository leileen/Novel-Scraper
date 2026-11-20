Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class WinCapture {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;

    public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(120);
        mouse_event(MOUSEEVENTF_LEFTDOWN, (uint)x, (uint)y, 0, 0);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTUP, (uint)x, (uint)y, 0, 0);
    }

    public static Bitmap CaptureWindow(IntPtr hWnd) {
        RECT rect;
        GetWindowRect(hWnd, out rect);
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0) return null;

        Bitmap bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp)) {
            IntPtr hdc = g.GetHdc();
            PrintWindow(hWnd, hdc, 2);
            g.ReleaseHdc(hdc);
        }
        return bmp;
    }
}
"@ -ReferencedAssemblies System.Drawing, System.Windows.Forms

$exePath = "D:\Project\Novel Scraper\LMT Novel Manager v1.3.exe"
$proc = Start-Process -FilePath $exePath -PassThru
Start-Sleep -Seconds 4

$hWnd = $proc.MainWindowHandle
[WinCapture]::ShowWindow($hWnd, 9)
[WinCapture]::SetForegroundWindow($hWnd)
[WinCapture]::SetWindowPos($hWnd, [IntPtr]::Zero, 50, 50, 1500, 920, 0x0040)
Start-Sleep -Seconds 2

# Click the close button X on the welcome dialog (Screen coords: 50 + 1152 = 1202, 50 + 130 = 180)
# Or click "Bắt đầu sử dụng ngay" (Screen coords: 50 + 1045 = 1095, 50 + 880 = 930)
[WinCapture]::ClickAt(1095, 930)
Start-Sleep -Seconds 1
[WinCapture]::ClickAt(1202, 180)
Start-Sleep -Seconds 1

# Now we are on Dashboard/Library. Click "Thư viện" on Sidebar (x=50+120=170, y=50+175=225)
[WinCapture]::ClickAt(170, 225)
Start-Sleep -Seconds 1

# Click "Đọc" or open first novel (around x=50+380=430, y=50+300=350)
[WinCapture]::ClickAt(430, 350)
Start-Sleep -Seconds 2

# Move mouse to bottom area (x=800, y=850) so floating top bar auto-hides!
[WinCapture]::SetCursorPos(800, 850)
Start-Sleep -Seconds 2

$artifactsDir = "C:\Users\lmt pc\.gemini\antigravity\brain\482892ca-ad1e-4fca-936f-13bedaa181d1"

# 1. 3-column layout (1500x920)
$bmp3 = [WinCapture]::CaptureWindow($hWnd)
if ($bmp3) {
    $bmp3.Save((Join-Path $artifactsDir "v1_3_calibre_clone_3col.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp3.Dispose()
    Write-Host "Captured 3col"
}

# 2. 2-column layout (1100x820)
[WinCapture]::SetWindowPos($hWnd, [IntPtr]::Zero, 80, 60, 1100, 820, 0x0040)
[WinCapture]::SetCursorPos(600, 750)
Start-Sleep -Seconds 2

$bmp2 = [WinCapture]::CaptureWindow($hWnd)
if ($bmp2) {
    $bmp2.Save((Join-Path $artifactsDir "v1_3_calibre_clone_2col.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp2.Dispose()
    Write-Host "Captured 2col"
}

# 3. 1-column layout (720x860)
[WinCapture]::SetWindowPos($hWnd, [IntPtr]::Zero, 120, 70, 720, 860, 0x0040)
[WinCapture]::SetCursorPos(400, 780)
Start-Sleep -Seconds 2

$bmp1 = [WinCapture]::CaptureWindow($hWnd)
if ($bmp1) {
    $bmp1.Save((Join-Path $artifactsDir "v1_3_calibre_clone_1col.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp1.Dispose()
    Write-Host "Captured 1col"
}

# 4. Show top bar & open Preferences
[WinCapture]::SetWindowPos($hWnd, [IntPtr]::Zero, 80, 60, 1200, 840, 0x0040)
[WinCapture]::SetCursorPos(600, 80)
Start-Sleep -Milliseconds 600
# Click "Cài đặt" button in floating toolbar (Screen: 80+1120=1200, 60+45=105)
[WinCapture]::ClickAt(1200, 105)
Start-Sleep -Seconds 2

$bmpPref = [WinCapture]::CaptureWindow($hWnd)
if ($bmpPref) {
    $bmpPref.Save((Join-Path $artifactsDir "v1_3_calibre_clone_preferences.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpPref.Dispose()
    Write-Host "Captured Preferences"
}

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
