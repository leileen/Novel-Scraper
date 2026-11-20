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

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
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
            PrintWindow(hWnd, hdc, 2); // 2 = PW_RENDERFULLCONTENT
            g.ReleaseHdc(hdc);
        }
        return bmp;
    }
}
"@ -ReferencedAssemblies System.Drawing, System.Windows.Forms

$exePath = "D:\Project\Novel Scraper\LMT Novel Manager v1.3.exe"
if (-not (Test-Path $exePath)) {
    $exePath = "D:\Project\Novel Scraper\desktop\src-tauri\target\release\novel-scraper-desktop.exe"
}

Write-Host "Launching $exePath..."
$proc = Start-Process -FilePath $exePath -PassThru
Start-Sleep -Seconds 4

$hWnd = $proc.MainWindowHandle
$retries = 0
while ($hWnd -eq [IntPtr]::Zero -and $retries -lt 15) {
    Start-Sleep -Milliseconds 500
    $proc.Refresh()
    $hWnd = $proc.MainWindowHandle
    $retries++
}

Write-Host "Window Handle: $hWnd"
if ($hWnd -eq [IntPtr]::Zero) {
    Write-Host "Could not obtain window handle."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

[WinCapture]::ShowWindow($hWnd, 9) # SW_RESTORE
[WinCapture]::SetForegroundWindow($hWnd)
Start-Sleep -Milliseconds 600

$artifactsDir = "C:\Users\lmt pc\.gemini\antigravity\brain\482892ca-ad1e-4fca-936f-13bedaa181d1"

# 1. Wide window (3 columns: 1520x920)
Write-Host "Setting size to 1520x920 (3 columns)..."
[WinCapture]::SetWindowPos($hWnd, [IntPtr]::Zero, 50, 50, 1520, 920, 0x0040)
Start-Sleep -Seconds 2

# Send click or Enter/Space to enter reader if on welcome/dashboard
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 2

$bmp3 = [WinCapture]::CaptureWindow($hWnd)
if ($bmp3) {
    $savePath = Join-Path $artifactsDir "v1_3_calibre_clone_3col.png"
    $bmp3.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp3.Dispose()
    Write-Host "Captured 3-column layout: $savePath"
}

# 2. Medium window (2 columns: 1100x820)
Write-Host "Setting size to 1100x820 (2 columns)..."
[WinCapture]::SetWindowPos($hWnd, [IntPtr]::Zero, 80, 60, 1100, 820, 0x0040)
Start-Sleep -Seconds 2

$bmp2 = [WinCapture]::CaptureWindow($hWnd)
if ($bmp2) {
    $savePath = Join-Path $artifactsDir "v1_3_calibre_clone_2col.png"
    $bmp2.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp2.Dispose()
    Write-Host "Captured 2-column layout: $savePath"
}

# 3. Narrow window (1 column: 720x860)
Write-Host "Setting size to 720x860 (1 column)..."
[WinCapture]::SetWindowPos($hWnd, [IntPtr]::Zero, 120, 70, 720, 860, 0x0040)
Start-Sleep -Seconds 2

$bmp1 = [WinCapture]::CaptureWindow($hWnd)
if ($bmp1) {
    $savePath = Join-Path $artifactsDir "v1_3_calibre_clone_1col.png"
    $bmp1.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp1.Dispose()
    Write-Host "Captured 1-column layout: $savePath"
}

# 4. Open Preferences modal via key 'p'
Write-Host "Opening Preferences modal..."
[System.Windows.Forms.SendKeys]::SendWait("p")
Start-Sleep -Seconds 2

$bmpPref = [WinCapture]::CaptureWindow($hWnd)
if ($bmpPref) {
    $savePath = Join-Path $artifactsDir "v1_3_calibre_clone_preferences.png"
    $bmpPref.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpPref.Dispose()
    Write-Host "Captured Preferences dialog: $savePath"
}

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Write-Host "All verification captures completed!"
