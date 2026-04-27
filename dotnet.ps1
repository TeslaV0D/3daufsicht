param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

$dotnet = Join-Path $PSScriptRoot "tools\\dotnet\\dotnet.exe"
if (!(Test-Path $dotnet)) {
  throw "Local dotnet not found at $dotnet. Run tools/dotnet-install first."
}

& $dotnet @Args
exit $LASTEXITCODE
