# 3D Interior Editor Phase 1 Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize an empty workspace into a reproducible .NET 8 WPF repo with local (portable) SDK, local NuGet package folder, MaterialDesign dark theme baseline, and verified build/publish commands.

**Architecture:** Keep all external tooling local to the repo (`tools/dotnet` for SDK, `.nuget/packages` for NuGet cache) so the project can build without machine-wide SDK installation. Create a minimal WPF shell project (MainWindow only) wired for later MVVM expansion.

**Tech Stack:** C# 12 / .NET 8, WPF, MaterialDesignThemes, HelixToolkit.Wpf, CommunityToolkit.Mvvm, SharpGLTF.

---

## Files to create/modify (Phase 1)

**Create:**
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\.gitignore`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\global.json`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\NuGet.config`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\dotnet.ps1`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\3DInteriorEditor.sln`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\src\3DInteriorEditor.App\App.xaml`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\src\3DInteriorEditor.App\App.xaml.cs`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\src\3DInteriorEditor.App\Views\MainWindow.xaml`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\src\3DInteriorEditor.App\Views\MainWindow.xaml.cs`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\README.md`
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\3DInteriorEditor\DOCUMENTATION.md`

**Create (local tooling directories, not committed):**
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\tools\dotnet\` (portable .NET 8 SDK)
- `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\.nuget\packages\` (NuGet cache)

---

### Task 1: Initialize git + baseline repo config

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repository (main branch)**

Run (PowerShell):

```powershell
git init
git checkout -b main
```

Expected: new repo initialized, branch `main` exists.

- [ ] **Step 2: Add `.gitignore`**

Create `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\.gitignore` with:

```gitignore
# Local SDK + package caches (keep local, not in git)
tools/dotnet/
.nuget/packages/

# .NET
**/bin/
**/obj/

# VS
.vs/

# Logs / temp
*.log
*.tmp
```

- [ ] **Step 3: Commit baseline**

Run:

```powershell
git add .gitignore
git commit -m "chore: init repo + gitignore"
```

Expected: commit created.

---

### Task 2: Install portable .NET 8 SDK into `tools/dotnet`

**Files:**
- Create: `dotnet.ps1`

- [ ] **Step 1: Create `tools/dotnet` directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path .\tools\dotnet | Out-Null
```

- [ ] **Step 2: Download dotnet-install script**

Run:

```powershell
New-Item -ItemType Directory -Force -Path .\tools\dotnet-install | Out-Null
Invoke-WebRequest -Uri "https://dot.net/v1/dotnet-install.ps1" -OutFile ".\tools\dotnet-install\dotnet-install.ps1"
```

Expected: file exists at `.\tools\dotnet-install\dotnet-install.ps1`.

- [ ] **Step 3: Install latest .NET 8 SDK locally**

Run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File ".\tools\dotnet-install\dotnet-install.ps1" -Channel 8.0 -InstallDir ".\tools\dotnet"
```

Expected: `.\tools\dotnet\dotnet.exe` exists and SDK is present.

If `pwsh` is not available, run with Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\tools\dotnet-install\dotnet-install.ps1" -Channel 8.0 -InstallDir ".\tools\dotnet"
```

- [ ] **Step 4: Verify local dotnet works**

Run:

```powershell
.\tools\dotnet\dotnet.exe --info
```

Expected: output includes `.NET SDKs installed:` with a `8.0.x` SDK.

- [ ] **Step 5: Add `dotnet.ps1` wrapper**

Create `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\dotnet.ps1`:

```powershell
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

$dotnet = Join-Path $PSScriptRoot "tools\dotnet\dotnet.exe"
if (!(Test-Path $dotnet)) {
  throw "Local dotnet not found at $dotnet. Run tools/dotnet-install first."
}

& $dotnet @Args
exit $LASTEXITCODE
```

- [ ] **Step 6: Commit wrapper (NOT the SDK)**

Run:

```powershell
git add dotnet.ps1 tools/dotnet-install/dotnet-install.ps1
git commit -m "chore: add local dotnet wrapper + installer script"
```

Expected: commit created. `tools/dotnet/` remains untracked/ignored.

---

### Task 3: Pin SDK with `global.json` and configure NuGet local packages folder

**Files:**
- Create: `global.json`
- Create: `NuGet.config`

- [ ] **Step 1: Create `global.json` (pin to 8.0 feature band)**

Create `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\global.json`:

```json
{
  "sdk": {
    "version": "8.0.0",
    "rollForward": "latestFeature"
  }
}
```

- [ ] **Step 2: Create `NuGet.config` with local cache folder**

Create `C:\Users\TeslaV0D\Desktop\Code\Project\Interior-Planner\NuGet.config`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <config>
    <add key="globalPackagesFolder" value=".nuget\packages" />
  </config>
</configuration>
```

- [ ] **Step 3: Create `.nuget/packages` directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path .\.nuget\packages | Out-Null
```

- [ ] **Step 4: Verify dotnet sees global.json**

Run:

```powershell
.\dotnet.ps1 --version
```

Expected: prints a dotnet version string.

- [ ] **Step 5: Commit**

Run:

```powershell
git add global.json NuGet.config
git commit -m "chore: pin sdk + local nuget cache"
```

---

### Task 4: Scaffold WPF solution + project (net8.0-windows)

**Files:**
- Create: `3DInteriorEditor\3DInteriorEditor.sln`
- Create: `3DInteriorEditor\src\3DInteriorEditor.App\...`

- [ ] **Step 1: Create directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path .\3DInteriorEditor\src | Out-Null
```

- [ ] **Step 2: Create solution**

Run:

```powershell
.\dotnet.ps1 new sln -n 3DInteriorEditor -o .\3DInteriorEditor
```

Expected: `.\3DInteriorEditor\3DInteriorEditor.sln` exists.

- [ ] **Step 3: Create WPF project**

Run:

```powershell
.\dotnet.ps1 new wpf -n 3DInteriorEditor.App -o .\3DInteriorEditor\src\3DInteriorEditor.App -f net8.0-windows
```

- [ ] **Step 4: Add project to solution**

Run:

```powershell
.\dotnet.ps1 sln .\3DInteriorEditor\3DInteriorEditor.sln add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj
```

- [ ] **Step 5: Build**

Run:

```powershell
.\dotnet.ps1 build .\3DInteriorEditor\3DInteriorEditor.sln -c Debug
```

Expected: `Build succeeded.`

- [ ] **Step 6: Commit scaffold**

Run:

```powershell
git add 3DInteriorEditor
git commit -m "chore: scaffold .NET 8 WPF solution"
```

---

### Task 5: Add NuGet dependencies (Phase 1 baseline)

**Files:**
- Modify: `3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj`

- [ ] **Step 1: Add packages**

Run:

```powershell
.\dotnet.ps1 add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj package HelixToolkit.Wpf
.\dotnet.ps1 add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj package MaterialDesignThemes
.\dotnet.ps1 add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj package MaterialDesignColors
.\dotnet.ps1 add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj package CommunityToolkit.Mvvm
.\dotnet.ps1 add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj package Microsoft.Xaml.Behaviors.Wpf
.\dotnet.ps1 add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj package SharpGLTF.Core
.\dotnet.ps1 add .\3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj package SharpGLTF.Runtime.WPF
```

- [ ] **Step 2: Restore + build**

Run:

```powershell
.\dotnet.ps1 restore .\3DInteriorEditor\3DInteriorEditor.sln
.\dotnet.ps1 build .\3DInteriorEditor\3DInteriorEditor.sln -c Debug
```

Expected: restore pulls packages into `.nuget\packages`; build succeeds.

- [ ] **Step 3: Commit packages**

Run:

```powershell
git add 3DInteriorEditor\src\3DInteriorEditor.App\3DInteriorEditor.App.csproj 3DInteriorEditor\3DInteriorEditor.sln
git commit -m "chore: add core nuget dependencies"
```

---

### Task 6: Configure MaterialDesign dark theme baseline

**Files:**
- Modify: `3DInteriorEditor\src\3DInteriorEditor.App\App.xaml`
- Modify: `3DInteriorEditor\src\3DInteriorEditor.App\Views\MainWindow.xaml`

- [ ] **Step 1: Update `App.xaml` to include MaterialDesign dictionaries**

Replace `App.xaml` with:

```xml
<Application x:Class="3DInteriorEditor.App.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="Views/MainWindow.xaml">
  <Application.Resources>
    <ResourceDictionary>
      <ResourceDictionary.MergedDictionaries>
        <ResourceDictionary Source="pack://application:,,,/MaterialDesignThemes.Wpf;component/Themes/MaterialDesignTheme.Light.xaml" />
        <ResourceDictionary Source="pack://application:,,,/MaterialDesignThemes.Wpf;component/Themes/MaterialDesignTheme.Defaults.xaml" />
        <ResourceDictionary Source="pack://application:,,,/MaterialDesignThemes.Wpf;component/Themes/MaterialDesignTheme.Dark.xaml" />

        <ResourceDictionary Source="pack://application:,,,/MaterialDesignColors;component/Themes/Recommended/Primary/MaterialDesignColor.Indigo.xaml" />
        <ResourceDictionary Source="pack://application:,,,/MaterialDesignColors;component/Themes/Recommended/Accent/MaterialDesignColor.Indigo.xaml" />
      </ResourceDictionary.MergedDictionaries>

      <!-- Phase 1: App palette brushes (used later by controls/templates) -->
      <SolidColorBrush x:Key="App.BackgroundBrush" Color="#0F1117" />
      <SolidColorBrush x:Key="App.PanelBrush" Color="#1A1D27" />
      <SolidColorBrush x:Key="App.ElevatedBrush" Color="#242736" />
      <SolidColorBrush x:Key="App.HoverBrush" Color="#2D3147" />
      <SolidColorBrush x:Key="App.BorderBrush" Color="#363A52" />
      <SolidColorBrush x:Key="App.TextPrimaryBrush" Color="#E8EAF6" />
      <SolidColorBrush x:Key="App.TextSecondaryBrush" Color="#8C8FA8" />
      <SolidColorBrush x:Key="App.AccentBrush" Color="#5C6BC0" />
      <SolidColorBrush x:Key="App.AccentHoverBrush" Color="#7986CB" />
      <SolidColorBrush x:Key="App.DangerBrush" Color="#EF5350" />
      <SolidColorBrush x:Key="App.SuccessBrush" Color="#66BB6A" />
    </ResourceDictionary>
  </Application.Resources>
</Application>
```

- [ ] **Step 2: Update `MainWindow.xaml` to use MaterialDesign baseline**

Replace `MainWindow.xaml` with:

```xml
<Window x:Class="3DInteriorEditor.App.Views.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
        Title="3D Interior Editor"
        Width="1280"
        Height="800"
        MinWidth="800"
        MinHeight="600"
        Background="{DynamicResource App.BackgroundBrush}"
        TextElement.Foreground="{DynamicResource App.TextPrimaryBrush}"
        FontFamily="Segoe UI"
        WindowStartupLocation="CenterScreen">

  <Grid>
    <Grid.RowDefinitions>
      <RowDefinition Height="48" />
      <RowDefinition Height="*" />
      <RowDefinition Height="28" />
    </Grid.RowDefinitions>

    <!-- Top toolbar placeholder -->
    <Border Grid.Row="0" Background="{DynamicResource App.PanelBrush}">
      <DockPanel LastChildFill="True" Margin="12,0">
        <TextBlock VerticalAlignment="Center"
                   FontSize="14"
                   FontWeight="SemiBold"
                   Text="3D Interior Editor" />
      </DockPanel>
    </Border>

    <!-- Main content placeholder -->
    <Border Grid.Row="1" Background="{DynamicResource App.BackgroundBrush}">
      <Grid>
        <TextBlock HorizontalAlignment="Center"
                   VerticalAlignment="Center"
                   Foreground="{DynamicResource App.TextSecondaryBrush}"
                   Text="Phase 1 shell — viewport comes in Phase 7" />
      </Grid>
    </Border>

    <!-- Status bar placeholder -->
    <Border Grid.Row="2" Background="{DynamicResource App.PanelBrush}">
      <DockPanel LastChildFill="True" Margin="12,0">
        <TextBlock VerticalAlignment="Center"
                   FontSize="12"
                   Foreground="{DynamicResource App.TextSecondaryBrush}"
                   Text="Ready" />
      </DockPanel>
    </Border>
  </Grid>
</Window>
```

- [ ] **Step 3: Build**

Run:

```powershell
.\dotnet.ps1 build .\3DInteriorEditor\3DInteriorEditor.sln -c Debug
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit theme baseline**

Run:

```powershell
git add 3DInteriorEditor\src\3DInteriorEditor.App\App.xaml 3DInteriorEditor\src\3DInteriorEditor.App\Views\MainWindow.xaml
git commit -m "chore: add MaterialDesign dark theme baseline"
```

---

### Task 7: Add Phase 1 README + DOCUMENTATION and verify publish

**Files:**
- Create: `3DInteriorEditor\README.md`
- Create: `3DInteriorEditor\DOCUMENTATION.md`

- [ ] **Step 1: Create `3DInteriorEditor/README.md`**

```markdown
# 3D Interior Editor (Desktop)

Native Windows Desktop App for interactive 3D interior / factory layout planning.

## Build (local portable SDK)

From repo root:

```powershell
.\dotnet.ps1 build .\3DInteriorEditor\3DInteriorEditor.sln -c Debug
```

## Publish (single-file, self-contained)

```powershell
.\dotnet.ps1 publish .\3DInteriorEditor\3DInteriorEditor.sln -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true
```

## Status

- ✅ Phase 1: project setup, local .NET 8 SDK + NuGet cache, MaterialDesign dark theme baseline
- ⏳ Next: Phase 2 (Constants + Models + Enums)
```

- [ ] **Step 2: Create `3DInteriorEditor/DOCUMENTATION.md`**

```markdown
# Documentation — 3D Interior Editor (Desktop)

## Phase 1 (Setup)

### What’s implemented

- Portable local `.NET 8 SDK` installed under `tools/dotnet/` (not committed).
- NuGet packages cached under `.nuget/packages/` via `NuGet.config` (not committed).
- WPF solution `3DInteriorEditor.sln` with a minimal app shell.
- MaterialDesignThemes wired in `App.xaml` with dark theme baseline.

### How to build

```powershell
.\dotnet.ps1 build .\3DInteriorEditor\3DInteriorEditor.sln -c Debug
```

### How to publish

```powershell
.\dotnet.ps1 publish .\3DInteriorEditor\3DInteriorEditor.sln -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true
```
```

- [ ] **Step 3: Publish verification**

Run:

```powershell
.\dotnet.ps1 publish .\3DInteriorEditor\3DInteriorEditor.sln -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true
```

Expected: publish succeeds and creates an `.exe` under:
- `3DInteriorEditor\src\3DInteriorEditor.App\bin\Release\net8.0-windows\win-x64\publish\`

- [ ] **Step 4: Phase 1 commit (required format)**

Run:

```powershell
git add 3DInteriorEditor\README.md 3DInteriorEditor\DOCUMENTATION.md
git commit -m "[Phase 1] WPF project setup + local .NET 8 SDK + MaterialDesign theme"
```

---

## Self-Review (plan vs spec)

- Spec requirement “Option A”: handled by Task 2 + Task 3.
- Local NuGet cache folder: Task 3.
- WPF + packages: Task 4 + Task 5.
- MaterialDesign dark theme baseline: Task 6.
- README + DOCUMENTATION + publish command: Task 7.

No “TODO/TBD” placeholders present in tasks; all file paths + code/commands included.

