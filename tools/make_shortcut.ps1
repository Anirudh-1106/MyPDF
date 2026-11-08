# Creates a "MyPDF" shortcut on the Desktop and in the Start menu.
$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root "venv\Scripts\pythonw.exe"
$icon = Join-Path $root "static\icons\icon.ico"
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath("Desktop"), (Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"))) {
    $lnk = $shell.CreateShortcut((Join-Path $dir "MyPDF.lnk"))
    $lnk.TargetPath = $target
    $lnk.Arguments = "`"$(Join-Path $root 'main.py')`""
    $lnk.WorkingDirectory = $root
    $lnk.Description = "MyPDF - PDF & document toolkit"
    if (Test-Path $icon) { $lnk.IconLocation = $icon }
    $lnk.Save()
}
Write-Host "Shortcuts created."
