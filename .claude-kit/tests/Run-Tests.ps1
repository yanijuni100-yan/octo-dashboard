#Requires -Module Pester

$ErrorActionPreference = 'Stop'

# Install Pester kalau belum
if (-not (Get-Module -ListAvailable -Name Pester | Where-Object { $_.Version.Major -ge 5 })) {
    Write-Host "Installing Pester 5.x..."
    Install-Module -Name Pester -MinimumVersion 5.0 -Force -SkipPublisherCheck -Scope CurrentUser
}

Import-Module Pester -MinimumVersion 5.0

$testsDir = $PSScriptRoot
$config = New-PesterConfiguration
$config.Run.Path = $testsDir
$config.Output.Verbosity = 'Detailed'
$config.Run.Exit = $true

Invoke-Pester -Configuration $config
