# Windows PowerShell 5.1; keep this file encoded as UTF-8 with BOM.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = 'Stop'
trap {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Ошибка запуска КВН') | Out-Null
    exit 1
}
$root = Split-Path $PSScriptRoot -Parent
$settingsPath = Join-Path $root 'cfg\launcher.json'
$script:server = $null
$script:opening = $false
$script:deadline = $null
$script:mutex = New-Object System.Threading.Mutex($false, 'Local\KVNBroadcastLauncher')
if (-not $script:mutex.WaitOne(0)) {
    [System.Windows.Forms.MessageBox]::Show('Окно запуска КВН уже открыто.', 'КВН') | Out-Null
    exit
}

function Find-Browser($relative) {
    foreach ($base in @($env:LOCALAPPDATA, ${env:ProgramFiles}, ${env:ProgramFiles(x86)})) {
        if ($base) {
            $candidate = Join-Path $base $relative
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        }
    }
    return ''
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'КВН — запуск рабочего места'
$form.ClientSize = New-Object System.Drawing.Size(700, 485)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
function Label($text, $x, $y, $width = 660) {
    $control = New-Object System.Windows.Forms.Label
    $control.Text = $text
    $control.SetBounds($x, $y, $width, 25)
    $form.Controls.Add($control)
}
function TextBox($y, $value) {
    $control = New-Object System.Windows.Forms.TextBox
    $control.SetBounds(20, $y, 600, 27)
    $control.Text = $value
    $form.Controls.Add($control)
    return $control
}
function Button($text, $x, $y, $width) {
    $control = New-Object System.Windows.Forms.Button
    $control.Text = $text
    $control.SetBounds($x, $y, $width, 34)
    $form.Controls.Add($control)
    return $control
}
Label 'Браузер для дашбордов — Яндекс' 20 15
$yandex = TextBox 43 (Find-Browser 'Yandex\YandexBrowser\Application\browser.exe')
$browseYandex = Button '…' 630 40 45
Label 'Браузер для графики — Google Chrome' 20 81
$chrome = TextBox 109 (Find-Browser 'Google\Chrome\Application\chrome.exe')
$browseChrome = Button '…' 630 106 45
$screens = @([System.Windows.Forms.Screen]::AllScreens)
function ScreenBox($text, $y, $default) {
    Label $text 20 $y 200
    $control = New-Object System.Windows.Forms.ComboBox
    $control.DropDownStyle = 'DropDownList'
    $control.SetBounds(230, $y, 445, 28)
    foreach ($screen in $screens) {
        $b = $screen.Bounds
        $primary = if ($screen.Primary) { ' — основной' } else { '' }
        [void]$control.Items.Add("$($screen.DeviceName): $($b.Width)×$($b.Height)$primary")
    }
    $control.SelectedIndex = [Math]::Min($default, $screens.Count - 1)
    $form.Controls.Add($control)
    return $control
}
$primaryIndex = 0
for ($i = 0; $i -lt $screens.Count; $i++) { if ($screens[$i].Primary) { $primaryIndex = $i } }
$otherIndex = $primaryIndex
for ($i = 0; $i -lt $screens.Count; $i++) { if (-not $screens[$i].Primary) { $otherIndex = $i; break } }
$dashboardScreen = ScreenBox 'Экран управления' 155 $primaryIndex
$graphicsScreen = ScreenBox 'Экран графики' 195 $otherIndex
$key = New-Object System.Windows.Forms.CheckBox
$key.Text = 'Открывать отдельное окно key'
$key.SetBounds(20, 238, 650, 28)
$form.Controls.Add($key)
$keyScreen = ScreenBox 'Экран key' 276 $otherIndex
$keyScreen.Enabled = $false
$key.Add_CheckedChanged({ $keyScreen.Enabled = $key.Checked })
Label 'Графика открывается на весь экран. Выход из этого режима: Alt+F4.' 20 320
$start = Button 'Запустить' 20 360 150
$stop = Button 'Остановить сервер' 180 360 190
$stop.Enabled = $false
$status = New-Object System.Windows.Forms.Label
$status.SetBounds(20, 410, 655, 65)
$status.Text = 'Выберите экраны и нажмите «Запустить». Настройки сохранятся автоматически.'
$form.Controls.Add($status)

if (Test-Path -LiteralPath $settingsPath) {
    try {
        $saved = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $yandex.Text = $saved.yandex
        $chrome.Text = $saved.chrome
        $key.Checked = [bool]$saved.key
        foreach ($pair in @(@($dashboardScreen, $saved.dashboardScreen), @($graphicsScreen, $saved.graphicsScreen), @($keyScreen, $saved.keyScreen))) {
            for ($i = 0; $i -lt $screens.Count; $i++) {
                if ($screens[$i].DeviceName -eq $pair[1]) { $pair[0].SelectedIndex = $i }
            }
        }
    } catch { $status.Text = 'Не удалось прочитать настройки. Выберите их заново.' }
}
function Browse($target) {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = 'Программы (*.exe)|*.exe'
    if ($dialog.ShowDialog() -eq 'OK') { $target.Text = $dialog.FileName }
    $dialog.Dispose()
}
$browseYandex.Add_Click({ Browse $yandex })
$browseChrome.Add_Click({ Browse $chrome })

function Open-Browser($exe, $url, $screen, $profile, $fullscreen) {
    $bounds = $screen.Bounds
    $profilePath = Join-Path $root "cfg\browser-$profile"
    # Separate profiles make browser window placement independent of existing windows.
    $arguments = @("--user-data-dir=`"$profilePath`"", '--no-first-run', '--no-default-browser-check',
        "--window-position=$($bounds.X),$($bounds.Y)", "--window-size=$($bounds.Width),$($bounds.Height)")
    if ($fullscreen) { $arguments += @('--kiosk', "`"$url`"") }
    else { $arguments += @('--new-window', "`"$url`"") }
    Start-Process -FilePath $exe -ArgumentList $arguments | Out-Null
}
function Stop-OwnedServer {
    if ($script:server -and -not $script:server.HasExited) {
        $script:server.Kill()
        $script:server.WaitForExit()
    }
    $script:server = $null
    $stop.Enabled = $false
}
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 750
$timer.Add_Tick({
    if (-not $script:opening) { return }
    try {
        if ($script:server -and $script:server.HasExited) { throw 'Сервер завершился. Подробности в logs\launcher-server-error.log и logs\launcher-server.log.' }
        $ready = $false
        try {
            $response = Invoke-WebRequest -Uri "$script:baseUrl/bundles/kvn-file-upload/graphics/master.html" -UseBasicParsing -TimeoutSec 1
            $ready = $response.StatusCode -eq 200 -and $response.Content.Contains('<title>master.html</title>')
        } catch { }
        if (-not $ready) {
            if ((Get-Date) -gt $script:deadline) { throw 'Сервер не готов за 60 секунд. Проверьте журнал и занятость порта.' }
            return
        }
        $script:opening = $false
        $timer.Stop()
        Open-Browser $yandex.Text "$script:baseUrl/dashboard/" $screens[$dashboardScreen.SelectedIndex] 'dashboard' $false
        Open-Browser $chrome.Text "$script:baseUrl/bundles/kvn-file-upload/graphics/master.html" $screens[$graphicsScreen.SelectedIndex] 'graphics' $true
        if ($key.Checked) {
            Open-Browser $chrome.Text "$script:baseUrl/bundles/kvn-file-upload/graphics/master.html?mode=key" $screens[$keyScreen.SelectedIndex] 'key' $true
        }
        if ($script:server) {
            $status.Text = 'Окна открыты. Сервер запущен лаунчером и остановится при его закрытии.'
        } else {
            $status.Text = 'Окна открыты. Используется ранее запущенный сервер: остановите его там, где он был запущен. Закрытие лаунчера его не остановит.'
        }
        $start.Enabled = $true
    } catch {
        $script:opening = $false
        $timer.Stop()
        $start.Enabled = $true
        $status.Text = $_.Exception.Message
    }
})
$start.Add_Click({
    try {
        foreach ($browser in @($yandex.Text, $chrome.Text)) {
            if (-not $browser -or -not (Test-Path -LiteralPath $browser -PathType Leaf) -or [IO.Path]::GetExtension($browser) -ne '.exe') {
                throw 'Укажите существующие exe-файлы Яндекс Браузера и Google Chrome.'
            }
        }
        if ($key.Checked -and $keyScreen.SelectedIndex -eq $graphicsScreen.SelectedIndex) {
            throw 'Для графики и key выберите разные экраны: два полноэкранных окна перекроют друг друга.'
        }
        $port = 9090
        $nodecgConfig = Join-Path $root 'cfg\nodecg.json'
        if (Test-Path -LiteralPath $nodecgConfig) {
            $config = Get-Content -LiteralPath $nodecgConfig -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($config.ssl.enabled) { throw 'Для этого лаунчера нужен NodeCG без SSL на локальном компьютере.' }
            if ($config.port) { $port = [int]$config.port }
        }
        $script:baseUrl = "http://127.0.0.1:$port"
        New-Item -ItemType Directory -Force -Path (Join-Path $root 'cfg') | Out-Null
        @{ yandex = $yandex.Text; chrome = $chrome.Text; key = $key.Checked
            dashboardScreen = $screens[$dashboardScreen.SelectedIndex].DeviceName
            graphicsScreen = $screens[$graphicsScreen.SelectedIndex].DeviceName
            keyScreen = $screens[$keyScreen.SelectedIndex].DeviceName
        } | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
        $listener = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq $port
        if (-not $listener) {
            $node = (Get-Command node.exe -ErrorAction Stop).Source
            if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules\nodecg'))) { throw 'Не установлены зависимости. Выполните npm ci --omit=dev в папке проекта.' }
            New-Item -ItemType Directory -Force -Path (Join-Path $root 'logs') | Out-Null
            $script:server = Start-Process -FilePath $node -ArgumentList @(('"' + (Join-Path $PSScriptRoot 'start.cjs') + '"'), "--launcher-parent=$PID") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root 'logs\launcher-server.log') -RedirectStandardError (Join-Path $root 'logs\launcher-server-error.log')
            $stop.Enabled = $true
        }
        $start.Enabled = $false
        $status.Text = 'Ожидание готовности сервера…'
        $script:deadline = (Get-Date).AddSeconds(60)
        $script:opening = $true
        $timer.Start()
    } catch { $status.Text = $_.Exception.Message }
})
$stop.Add_Click({
    $timer.Stop()
    $script:opening = $false
    Stop-OwnedServer
    $start.Enabled = $true
    $status.Text = 'Сервер остановлен. Окна браузеров можно закрыть. Данные игры сохранены.'
})
$form.Add_FormClosing({
    $timer.Stop()
    Stop-OwnedServer
})
try { [void]$form.ShowDialog() }
finally {
    Stop-OwnedServer
    $timer.Dispose()
    $form.Dispose()
    $script:mutex.ReleaseMutex()
    $script:mutex.Dispose()
}
