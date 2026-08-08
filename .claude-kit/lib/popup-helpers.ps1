# popup-helpers.ps1
# GUI popup helper functions for lintasAI kit
# PS 5.1 + PS 7+ compatible (no &&, ||, ternary, or ??)
# ASCII-only

$script:LintasGuiAvailable = $null
$script:LintasHeadless = $null
$script:LintasInteractiveInput = $null

function Test-LintasHeadless {
    <#
    .SYNOPSIS
        Detect whether the current session lacks an interactive desktop (headless).
    .DESCRIPTION
        Returns $true when callers should fall back to console prompts instead of
        GUI popups. Checks [Environment]::UserInteractive first; if that reports
        non-interactive, the session is headless. Otherwise attempts to load
        System.Windows.Forms and checks
        [System.Windows.Forms.SystemInformation]::UserInteractive. Result cached
        in script scope to avoid repeated probing.
    .OUTPUTS
        [bool] $true when headless (no GUI available), $false when an interactive
        desktop session is detected.
    .EXAMPLE
        if (Test-LintasHeadless) { Write-Host 'Falling back to console.' }
    #>
    [CmdletBinding()]
    [OutputType([bool])]
    param()

    if ($null -ne $script:LintasHeadless) {
        return $script:LintasHeadless
    }

    # Step 1: cheap probe via [Environment]::UserInteractive (no assembly load).
    try {
        if (-not [Environment]::UserInteractive) {
            $script:LintasHeadless = $true
            return $script:LintasHeadless
        }
    }
    catch {
        # If even [Environment] probe throws, assume headless to be safe.
        $script:LintasHeadless = $true
        return $script:LintasHeadless
    }

    # Step 2: deeper probe via WinForms SystemInformation. Add-Type is wrapped
    # in try/catch because non-Windows / Server Core may not have WinForms.
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    }
    catch {
        $script:LintasHeadless = $true
        return $script:LintasHeadless
    }

    try {
        if (-not [System.Windows.Forms.SystemInformation]::UserInteractive) {
            $script:LintasHeadless = $true
            return $script:LintasHeadless
        }
    }
    catch {
        $script:LintasHeadless = $true
        return $script:LintasHeadless
    }

    # Step 3: SESSIONNAME 'Services' indicates a non-interactive service session
    # even when WinForms assembly loads. Catches Server Core service-host case
    # where SystemInformation.UserInteractive can mis-report.
    try {
        if ($env:SESSIONNAME -eq 'Services' -or [string]::IsNullOrEmpty($env:SESSIONNAME)) {
            $script:LintasHeadless = $true
            return $script:LintasHeadless
        }
    }
    catch {
        $script:LintasHeadless = $true
        return $script:LintasHeadless
    }

    # Step 4: actual handle probe. On Server Core with WinForms refs but no
    # window station / desktop, instantiating a Form throws at native handle
    # creation. This is the only reliable signal that ShowDialog() will work.
    try {
        $probeForm = New-Object System.Windows.Forms.Form
        $probeForm.ShowInTaskbar = $false
        # Force handle creation to surface "no desktop" failures here, not later
        # inside ShowDialog() where they're harder to recover from.
        $null = $probeForm.Handle
        $probeForm.Dispose()
    }
    catch {
        $script:LintasHeadless = $true
        return $script:LintasHeadless
    }

    $script:LintasHeadless = $false
    return $script:LintasHeadless
}

function Test-LintasInteractiveInput {
    <#
    .SYNOPSIS
        Detect whether a real human keyboard is attached to standard input.
    .DESCRIPTION
        Returns $false (NON-interactive) when there is no human typing at a real
        console -- standard input is redirected (pipe or file) OR an explicit
        non-interactive environment signal is present
        (LINTASAI_NONINTERACTIVE / CLAUDECODE / CI). Returns $true only when a
        real interactive console keyboard is present.

        WHY THIS EXISTS (the bug it fixes): when the kit is launched by an AI tool
        or a CI runner, standard input is an OPEN PIPE WITH NO DATA -- it is NOT a
        closed/EOF stream and the host is NOT started with -NonInteractive. In that
        exact state Read-Host BLOCKS FOREVER waiting for a line that never arrives,
        and because it blocks (it never throws) the surrounding try/catch
        NonInteractive fallback never fires -> the installer hangs.
        [Console]::IsInputRedirected (available on .NET 4.5+, so safe on PS 5.1) is
        the ONLY signal that is $true for an open empty pipe (as well as for file
        redirect / EOF) yet $false for a real keyboard. Callers MUST consult this
        BEFORE Read-Host and skip the prompt (use a safe default) when it returns
        $false, instead of relying on the throw-based catch.

        Result cached in script scope (interactivity does not change mid-run).
    .OUTPUTS
        [bool] $true when a human keyboard is present, $false when non-interactive.
    .EXAMPLE
        if (Test-LintasInteractiveInput) { $name = Read-Host 'Nama' } else { $name = $default }
    #>
    [CmdletBinding()]
    [OutputType([bool])]
    param()

    if ($null -ne $script:LintasInteractiveInput) {
        return $script:LintasInteractiveInput
    }

    # Step 0: explicit interactive override (escape hatch). A human in Git Bash / mintty
    # has stdin backed by a pipe, so [Console]::IsInputRedirected is $true even with a
    # real keyboard. Setting LINTASAI_INTERACTIVE=1 forces interactive mode and WINS over
    # all auto-detection below. (Mirrors the launcher bin/lintasai.js escape hatch.)
    $forceVal = [Environment]::GetEnvironmentVariable('LINTASAI_INTERACTIVE')
    if (-not [string]::IsNullOrEmpty($forceVal) -and $forceVal -ne '0' -and $forceVal -ne 'false') {
        $script:LintasInteractiveInput = $true
        return $script:LintasInteractiveInput
    }

    # Step 1: explicit non-interactive env signals (AI harness / CI runners).
    # A value of '0' / 'false' / '' counts as "not set" so a user can opt back in.
    foreach ($name in @('LINTASAI_NONINTERACTIVE', 'CLAUDECODE', 'CI')) {
        $val = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrEmpty($val) -and $val -ne '0' -and $val -ne 'false') {
            $script:LintasInteractiveInput = $false
            return $script:LintasInteractiveInput
        }
    }

    # Step 2: stdin redirected => pipe/file, NOT a console keyboard. This is the
    # exact case the legacy try/catch missed (an open empty pipe blocks Read-Host
    # without throwing).
    try {
        if ([Console]::IsInputRedirected) {
            $script:LintasInteractiveInput = $false
            return $script:LintasInteractiveInput
        }
    }
    catch {
        # If the probe itself throws, assume non-interactive to be SAFE (never hang).
        $script:LintasInteractiveInput = $false
        return $script:LintasInteractiveInput
    }

    $script:LintasInteractiveInput = $true
    return $script:LintasInteractiveInput
}

function Test-LintasGuiAvailable {
    <#
    .SYNOPSIS
        Check if Windows Forms GUI is available in current session.
    .DESCRIPTION
        Attempts to load System.Windows.Forms and System.Drawing assemblies, then
        consults Test-LintasHeadless to ensure an interactive desktop actually
        exists. Result cached in script-scope variable to avoid repeat Add-Type
        calls. Returns $false on Server Core, SSH sessions, services, or any
        non-interactive context even when assembly load succeeds.
    .OUTPUTS
        [bool] $true when GUI is loadable AND session is interactive, $false
        otherwise (headless / non-Windows / assembly load failed).
    .EXAMPLE
        if (Test-LintasGuiAvailable) { Show-LintasInfoPopup -Title 'Hi' -Message 'Hello' }
    #>
    [CmdletBinding()]
    [OutputType([bool])]
    param()

    if ($null -ne $script:LintasGuiAvailable) {
        return $script:LintasGuiAvailable
    }

    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    }
    catch {
        $script:LintasGuiAvailable = $false
        return $script:LintasGuiAvailable
    }

    # Even if Add-Type succeeded, a headless session has no usable desktop.
    if (Test-LintasHeadless) {
        $script:LintasGuiAvailable = $false
        return $script:LintasGuiAvailable
    }

    $script:LintasGuiAvailable = $true
    return $script:LintasGuiAvailable
}

function Show-LintasYesNoPopup {
    <#
    .SYNOPSIS
        Show a Yes/No question popup.
    .DESCRIPTION
        Displays MessageBox with YesNo buttons, Question icon, and always-on-top.
        Default focus is on the Yes button.
    .PARAMETER Title
        Window title text.
    .PARAMETER Message
        Question message body.
    .OUTPUTS
        [string] "Yes" or "No".
    .EXAMPLE
        $answer = Show-LintasYesNoPopup -Title 'Confirm' -Message 'Proceed?'
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not (Test-LintasGuiAvailable)) {
        throw "GUI not available. Cannot show Yes/No popup."
    }

    $buttons = [System.Windows.Forms.MessageBoxButtons]::YesNo
    $icon = [System.Windows.Forms.MessageBoxIcon]::Question
    $defaultButton = [System.Windows.Forms.MessageBoxDefaultButton]::Button1
    $options = [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly

    $result = [System.Windows.Forms.MessageBox]::Show(
        $Message,
        $Title,
        $buttons,
        $icon,
        $defaultButton,
        $options
    )

    if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
        return "Yes"
    }
    return "No"
}

function Show-LintasInputPopup {
    <#
    .SYNOPSIS
        Show a single-line text input popup with unambiguous Cancel vs empty-OK return.
    .DESCRIPTION
        Builds a Windows.Forms.Form with a TextBox + OK/Cancel buttons (mirrors the
        Show-LintasChoicePopup pattern) so the caller can distinguish three cases:
        (1) user clicked OK with text  -> Status='OK', Value=<text>
        (2) user clicked OK with empty -> Status='OK', Value=''
        (3) user clicked Cancel or X   -> Status='Cancel', Value=''
        This replaces the prior Microsoft.VisualBasic.Interaction.InputBox-based
        implementation which returned empty string for BOTH Cancel and empty-OK,
        masking user intent in security-sensitive flows (e.g. git identity setup
        for role-based access lookup).
    .PARAMETER Title
        Window title text.
    .PARAMETER Message
        Instruction message above input field.
    .PARAMETER DefaultValue
        Pre-filled value in input field (optional).
    .OUTPUTS
        [hashtable] with two keys:
          - Status : 'OK' or 'Cancel' (string)
          - Value  : the raw input string (may be empty when Status='OK')
    .EXAMPLE
        $r = Show-LintasInputPopup -Title 'Name' -Message 'Your name?' -DefaultValue 'Anon'
        if ($r.Status -eq 'Cancel') { 'user cancelled' }
        elseif (-not $r.Value.Trim()) { 'user accepted empty' }
        else { "got: $($r.Value)" }
    #>
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [string]$DefaultValue = ""
    )

    if (-not (Test-LintasGuiAvailable)) {
        throw "GUI not available. Cannot show input popup."
    }

    $form = New-Object System.Windows.Forms.Form
    $form.Text = $Title
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    $form.AutoSize = $false
    $form.Width = 460
    $form.Padding = New-Object System.Windows.Forms.Padding(12)

    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Message
    $label.AutoSize = $false
    $label.Width = 420
    $label.Height = 40
    $label.Location = New-Object System.Drawing.Point(15, 15)
    $form.Controls.Add($label)

    $textBox = New-Object System.Windows.Forms.TextBox
    $textBox.Width = 420
    $textBox.Location = New-Object System.Drawing.Point(20, 60)
    $textBox.Text = $DefaultValue
    $form.Controls.Add($textBox)

    # Script-scoped sentinel so click handlers mutate it. Default = Cancel so
    # X-button / Alt+F4 / Esc all fall through as Cancel (safe default for
    # security-sensitive flows like git identity setup).
    $script:LintasInputResult = @{ Status = 'Cancel'; Value = '' }

    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Text = "OK"
    $okButton.Width = 90
    $okButton.Height = 28
    $okButton.Location = New-Object System.Drawing.Point(250, 100)
    $okButton.Add_Click({
        $script:LintasInputResult = @{ Status = 'OK'; Value = [string]$textBox.Text }
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    })
    $form.Controls.Add($okButton)
    $form.AcceptButton = $okButton

    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Width = 90
    $cancelButton.Height = 28
    $cancelButton.Location = New-Object System.Drawing.Point(345, 100)
    $cancelButton.Add_Click({
        $script:LintasInputResult = @{ Status = 'Cancel'; Value = '' }
        $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
        $form.Close()
    })
    $form.Controls.Add($cancelButton)
    $form.CancelButton = $cancelButton

    $form.Height = 180
    $form.ClientSize = New-Object System.Drawing.Size(445, 145)

    $form.Add_FormClosing({
        # Event sender/EventArgs unused; closure mutates outer $form/$result/$script:LintasInputResult.
        if ($form.DialogResult -eq [System.Windows.Forms.DialogResult]::None) {
            $script:LintasInputResult = @{ Status = 'Cancel'; Value = '' }
        }
    })

    try {
        [void]$form.ShowDialog()
    } finally {
        $form.Dispose()
    }

    return $script:LintasInputResult
}

function Show-LintasChoicePopup {
    <#
    .SYNOPSIS
        Show a multi-option choice popup with radio buttons.
    .DESCRIPTION
        Builds a Windows.Forms.Form with radio buttons for each option.
        Pre-selects DefaultIndex. Returns -1 when user closes via X.
    .PARAMETER Title
        Window title text.
    .PARAMETER Message
        Instruction message above options.
    .PARAMETER Options
        String array of option labels.
    .PARAMETER DefaultIndex
        Zero-based index of pre-selected option (default 0).
    .OUTPUTS
        [int] zero-based selected index, or -1 on cancel.
    .EXAMPLE
        $idx = Show-LintasChoicePopup -Title 'Mode' -Message 'Pick:' -Options @('A','B','C') -DefaultIndex 1
    #>
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $true)]
        [string[]]$Options,

        [Parameter(Mandatory = $false)]
        [int]$DefaultIndex = 0
    )

    if (-not (Test-LintasGuiAvailable)) {
        throw "GUI not available. Cannot show choice popup."
    }

    if ($Options.Count -lt 1) {
        throw "Options array must contain at least one item."
    }

    if ($DefaultIndex -lt 0 -or $DefaultIndex -ge $Options.Count) {
        $DefaultIndex = 0
    }

    $form = New-Object System.Windows.Forms.Form
    $form.Text = $Title
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    $form.AutoSize = $false
    $form.Width = 460
    $form.Padding = New-Object System.Windows.Forms.Padding(12)

    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Message
    $label.AutoSize = $false
    $label.Width = 420
    $label.Height = 40
    $label.Location = New-Object System.Drawing.Point(15, 15)
    $form.Controls.Add($label)

    $radioY = 60
    $radios = @()
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $rb = New-Object System.Windows.Forms.RadioButton
        $rb.Text = $Options[$i]
        $rb.AutoSize = $false
        $rb.Width = 420
        $rb.Height = 24
        $rb.Location = New-Object System.Drawing.Point(20, $radioY)
        $rb.Tag = $i
        if ($i -eq $DefaultIndex) {
            $rb.Checked = $true
        }
        $form.Controls.Add($rb)
        $radios += $rb
        $radioY += 28
    }

    # Use a closure-scoped object instead of $script: to avoid stale state across
    # invocations and to be safe under parallel runspaces (script scope is shared
    # across runspaces; an object reference captured by closures is not).
    $result = [PSCustomObject]@{ Index = -1 }

    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Text = "OK"
    $okButton.Width = 90
    $okButton.Height = 28
    $okButton.Location = New-Object System.Drawing.Point(250, ($radioY + 10))
    $okButton.Add_Click({
        for ($j = 0; $j -lt $radios.Count; $j++) {
            if ($radios[$j].Checked) {
                $result.Index = [int]$radios[$j].Tag
                break
            }
        }
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    })
    $form.Controls.Add($okButton)
    $form.AcceptButton = $okButton

    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Width = 90
    $cancelButton.Height = 28
    $cancelButton.Location = New-Object System.Drawing.Point(345, ($radioY + 10))
    $cancelButton.Add_Click({
        $result.Index = -1
        $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
        $form.Close()
    })
    $form.Controls.Add($cancelButton)
    $form.CancelButton = $cancelButton

    $form.Height = $radioY + 90
    $form.ClientSize = New-Object System.Drawing.Size(445, ($radioY + 55))

    $form.Add_FormClosing({
        # Event sender/EventArgs unused; closure mutates outer $form/$result/$script:LintasInputResult.
        if ($form.DialogResult -eq [System.Windows.Forms.DialogResult]::None) {
            $result.Index = -1
        }
    })

    try {
        [void]$form.ShowDialog()
    } finally {
        $form.Dispose()
    }

    return [int]$result.Index
}

function Show-LintasInfoPopup {
    <#
    .SYNOPSIS
        Show an information popup with OK button.
    .DESCRIPTION
        Displays MessageBox with single OK button and Information icon.
        Returns nothing.
    .PARAMETER Title
        Window title text.
    .PARAMETER Message
        Information message body.
    .EXAMPLE
        Show-LintasInfoPopup -Title 'Done' -Message 'Setup complete.'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not (Test-LintasGuiAvailable)) {
        throw "GUI not available. Cannot show info popup."
    }

    $buttons = [System.Windows.Forms.MessageBoxButtons]::OK
    $icon = [System.Windows.Forms.MessageBoxIcon]::Information
    $defaultButton = [System.Windows.Forms.MessageBoxDefaultButton]::Button1
    $options = [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly

    [void][System.Windows.Forms.MessageBox]::Show(
        $Message,
        $Title,
        $buttons,
        $icon,
        $defaultButton,
        $options
    )
}

# ============================================================================
# UNIFIED UI CHOICE CONVENTION (Section 14.1 CLAUDE_universal_v1.md)
# ----------------------------------------------------------------------------
# 3 NEW helpers below enforce the choice-FORMATTING rules (RULE-1..7) of the
# 8-rule unified choice convention (Section 14.1 CLAUDE_universal_v1.md):
#   RULE-1 numbered ascending [1] [2] [3] (no skip)
#   RULE-2 explicit default marker '(default)' / '(rekomendasi)' / '(rekomendasi, default)' / '(default, safe choice)' -- label tampil pakai Indonesia '(rekomendasi)' + alasan singkat non-programmer
#   RULE-3 special non-numbered options whitelist: [skip] [cancel] [help] [back] [stop]
#   RULE-4 inline (<=40 char) vs multi-line (>4 options or long labels)
#   RULE-5 confirmation line: 'Default (Enter/kosong) -> [N] <label>'
#   RULE-6 security-sensitive popup: risk telegraph + safest default
#   RULE-7 cross-medium consistency: console + GUI use SAME labels from single source
#   RULE-8 popup-klik-dulu: AI prefers AskUserQuestion (click) over text blocks --
#          AI-behavioral (prompt layer), NOT enforced by these formatting helpers
#
# Existing helpers (Show-LintasYesNoPopup, Show-LintasInputPopup,
# Show-LintasChoicePopup, Show-LintasInfoPopup) preserved for backward compat.
# Caller migration is gradual -- new call-sites SHOULD use these 3 helpers.
# ============================================================================

function Format-LintasChoiceLine {
    <#
    .SYNOPSIS
        Format choice options into a single-source-of-truth string for console Read-Host prompts.
    .DESCRIPTION
        Returns a formatted string that follows Section 14.1 RULE-4 (inline vs multi-line)
        and RULE-5 (confirmation line). Caller passes the SAME $Options array to
        Show-LintasNumberedChoicePopup for GUI rendering, ensuring RULE-7 cross-medium
        consistency.
    .PARAMETER Options
        Array of hashtables. Each item:
          @{ Label = '<text>'; Recommended = $true|$false; SpecialKey = $null|'skip'|'cancel'|'help'|'back'|'stop' }
    .PARAMETER DefaultIndex
        Zero-based index of default option (Enter/empty). Default 0.
    .PARAMETER Layout
        'inline' = single-line ' / '-separated. 'multiline' = each option on own line, indent 2 spaces. 'auto' picks based on option count + label length.
    .OUTPUTS
        [string] Pre-formatted prompt text caller pipes to Write-Host before Read-Host.
    .EXAMPLE
        $opts = @(
            @{ Label = 'Yes, lanjut'; Recommended = $true; SpecialKey = $null },
            @{ Label = 'No, batal';   Recommended = $false; SpecialKey = $null }
        )
        Write-Host (Format-LintasChoiceLine -Options $opts -DefaultIndex 0 -Layout 'inline')
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable[]]$Options,

        [Parameter(Mandatory = $false)]
        [int]$DefaultIndex = 0,

        [Parameter(Mandatory = $false)]
        [ValidateSet('inline', 'multiline', 'auto')]
        [string]$Layout = 'auto'
    )

    if ($Options.Count -lt 1) {
        throw "Format-LintasChoiceLine: Options array must contain at least one item."
    }

    if ($DefaultIndex -lt 0 -or $DefaultIndex -ge $Options.Count) {
        $DefaultIndex = 0
    }

    $allowedSpecial = @('skip', 'cancel', 'help', 'back', 'stop')

    # Build label parts with prefix + suffix tagging (RULE-1, RULE-2, RULE-3).
    $numberedIdx = 0
    $labelParts = New-Object System.Collections.Generic.List[string]
    $maxLabelLen = 0
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $opt = $Options[$i]
        $rawLabel = [string]$opt.Label
        $isRecommended = [bool]$opt.Recommended
        $specialKey = $null
        if ($opt.ContainsKey('SpecialKey') -and $opt.SpecialKey) {
            $specialKey = [string]$opt.SpecialKey
            if ($allowedSpecial -notcontains $specialKey) {
                throw ("Format-LintasChoiceLine: SpecialKey '{0}' not in whitelist (allowed: {1})." -f $specialKey, ($allowedSpecial -join ', '))
            }
        }

        # RULE-3: special non-numbered options use [<key>] prefix.
        if ($specialKey) {
            $prefix = "[{0}]" -f $specialKey
        } else {
            $numberedIdx++
            $prefix = "[{0}]" -f $numberedIdx
        }

        # RULE-2: default marker suffix.
        # Recommended options carry a short plain-language reason so non-programmer
        # staff understand WHY it is the suggested pick (not just "it is marked").
        $suffix = ''
        if ($i -eq $DefaultIndex -and $isRecommended) {
            $suffix = ' (rekomendasi, default) -- pilihan paling pas + aman, jadi tinggal Enter'
        } elseif ($i -eq $DefaultIndex) {
            # Default for destructive/security ops uses 'safe choice' marker.
            if ($specialKey -eq 'skip' -or $specialKey -eq 'cancel' -or $specialKey -eq 'stop') {
                $suffix = ' (default, safe choice)'
            } else {
                $suffix = ' (default)'
            }
        } elseif ($isRecommended) {
            $suffix = ' (rekomendasi) -- pilihan paling pas + aman'
        }

        $full = "$prefix $rawLabel$suffix"
        $labelParts.Add($full)
        if ($full.Length -gt $maxLabelLen) { $maxLabelLen = $full.Length }
    }

    # RULE-4: auto-pick layout. inline if <=4 options AND max label <=40 char.
    $useMultiline = $false
    if ($Layout -eq 'multiline') {
        $useMultiline = $true
    } elseif ($Layout -eq 'inline') {
        $useMultiline = $false
    } else {
        if ($Options.Count -gt 4 -or $maxLabelLen -gt 40) {
            $useMultiline = $true
        }
    }

    if ($useMultiline) {
        $body = "Pilihan:`n"
        foreach ($p in $labelParts) {
            $body += "  $p`n"
        }
    } else {
        $body = "Pilihan: " + ($labelParts -join ' / ') + "`n"
    }

    # RULE-5: confirmation line.
    $defaultLabel = $labelParts[$DefaultIndex]
    $body += "Default (Enter/kosong) -> $defaultLabel"

    return $body
}

function Show-LintasNumberedChoicePopup {
    <#
    .SYNOPSIS
        Show a numbered-choice popup that enforces Section 14.1 unified UI convention.
    .DESCRIPTION
        Wrapper over Show-LintasChoicePopup that auto-prefixes labels with [1] [2] [3]
        (ascending, no skip per RULE-1), tags default + recommended per RULE-2, supports
        whitelisted special non-numbered options [skip] [cancel] [help] [back] [stop]
        per RULE-3, and forces the confirmation message body per RULE-5.
    .PARAMETER Title
        Window title text.
    .PARAMETER Message
        Instruction message above options.
    .PARAMETER Options
        Array of hashtables (same shape as Format-LintasChoiceLine):
          @{ Label = '<text>'; Recommended = $true|$false; SpecialKey = $null|'skip'|... }
    .PARAMETER DefaultIndex
        Zero-based index of pre-selected option (default 0).
    .OUTPUTS
        [int] zero-based selected index (matches input $Options array), or -1 on Cancel/X.
    .EXAMPLE
        $opts = @(
            @{ Label = 'Yes, lanjut'; Recommended = $true; SpecialKey = $null },
            @{ Label = 'No, batal';   Recommended = $false; SpecialKey = $null },
            @{ Label = 'Lewati step'; Recommended = $false; SpecialKey = 'skip' }
        )
        $idx = Show-LintasNumberedChoicePopup -Title 'Pilih' -Message 'Lanjut?' -Options $opts -DefaultIndex 0
    #>
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $true)]
        [hashtable[]]$Options,

        [Parameter(Mandatory = $false)]
        [int]$DefaultIndex = 0
    )

    if (-not (Test-LintasGuiAvailable)) {
        throw "GUI not available. Cannot show numbered-choice popup."
    }

    # Reuse Format-LintasChoiceLine to build labels (single source of truth).
    $allowedSpecial = @('skip', 'cancel', 'help', 'back', 'stop')
    $stringLabels = @()
    $numberedIdx = 0
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $opt = $Options[$i]
        $rawLabel = [string]$opt.Label
        $isRecommended = [bool]$opt.Recommended
        $specialKey = $null
        if ($opt.ContainsKey('SpecialKey') -and $opt.SpecialKey) {
            $specialKey = [string]$opt.SpecialKey
            if ($allowedSpecial -notcontains $specialKey) {
                throw ("Show-LintasNumberedChoicePopup: SpecialKey '{0}' not in whitelist (allowed: {1})." -f $specialKey, ($allowedSpecial -join ', '))
            }
        }

        if ($specialKey) {
            $prefix = "[{0}]" -f $specialKey
        } else {
            $numberedIdx++
            $prefix = "[{0}]" -f $numberedIdx
        }

        # Recommended options carry a short plain-language reason so non-programmer
        # staff understand WHY it is the suggested pick (not just "it is marked").
        $suffix = ''
        if ($i -eq $DefaultIndex -and $isRecommended) {
            $suffix = ' (rekomendasi, default) -- pilihan paling pas + aman, jadi tinggal Enter'
        } elseif ($i -eq $DefaultIndex) {
            if ($specialKey -eq 'skip' -or $specialKey -eq 'cancel' -or $specialKey -eq 'stop') {
                $suffix = ' (default, safe choice)'
            } else {
                $suffix = ' (default)'
            }
        } elseif ($isRecommended) {
            $suffix = ' (rekomendasi) -- pilihan paling pas + aman'
        }

        $stringLabels += "$prefix $rawLabel$suffix"
    }

    # Delegate to base Show-LintasChoicePopup (radio button rendering identical).
    return (Show-LintasChoicePopup -Title $Title -Message $Message -Options $stringLabels -DefaultIndex $DefaultIndex)
}

function Show-LintasSecurityChoicePopup {
    <#
    .SYNOPSIS
        Show a security-sensitive choice popup with mandatory risk telegraph (RULE-6).
    .DESCRIPTION
        Specialized wrapper for destructive/security operations (delete, unsigned manifest,
        force overwrite, push prod). Auto-prepends $RiskStatement + $Preview to message
        body, auto-appends 'Kalau ragu, pilih [cancel] / [skip]' guidance per RULE-6.
        Enforces that DefaultIndex points to a safe option (SpecialKey 'cancel' or 'skip')
        -- throws if caller tries to set destructive option as default.
    .PARAMETER Title
        Window title text (should include 'PERINGATAN KEAMANAN' or similar).
    .PARAMETER RiskStatement
        ONE sentence describing the risk in plain Indonesian (e.g. 'Kalau backup ter-tamper, rollback bisa restore versi malicious.').
    .PARAMETER Preview
        Concrete preview (count + sample file names). Empty string allowed for non-bulk ops.
    .PARAMETER Options
        Same shape as Show-LintasNumberedChoicePopup. MUST include at least one option with
        SpecialKey 'cancel' or 'skip' as the default.
    .OUTPUTS
        [int] zero-based selected index, or -1 on Cancel/X.
    .EXAMPLE
        $opts = @(
            @{ Label = 'Yes, lanjut hapus 42 file'; Recommended = $false; SpecialKey = $null },
            @{ Label = 'No, batal';                  Recommended = $false; SpecialKey = 'cancel' }
        )
        $idx = Show-LintasSecurityChoicePopup -Title 'PERINGATAN: Hapus File' `
            -RiskStatement 'Operasi ini permanen, tidak ada undo.' `
            -Preview 'Akan hapus 42 file: a.txt, b.txt, c.txt, ... + 39 lain' `
            -Options $opts
    #>
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [string]$RiskStatement,

        [Parameter(Mandatory = $false)]
        [string]$Preview = '',

        [Parameter(Mandatory = $true)]
        [hashtable[]]$Options
    )

    if (-not (Test-LintasGuiAvailable)) {
        throw "GUI not available. Cannot show security-choice popup."
    }

    # Auto-compute DefaultIndex: prefer option with SpecialKey 'cancel' or 'skip'.
    # If none present, throw (RULE-6 requires safe default for security ops).
    $safeDefaultIdx = -1
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $opt = $Options[$i]
        if ($opt.ContainsKey('SpecialKey') -and ($opt.SpecialKey -eq 'cancel' -or $opt.SpecialKey -eq 'skip' -or $opt.SpecialKey -eq 'stop')) {
            $safeDefaultIdx = $i
            break
        }
    }
    if ($safeDefaultIdx -lt 0) {
        throw "Show-LintasSecurityChoicePopup: RULE-6 requires at least one option with SpecialKey='cancel'|'skip'|'stop' as default. None found in `$Options."
    }

    # Compose message body per RULE-6: risk + preview + guidance.
    $body = "RESIKO: $RiskStatement"
    if ($Preview -and $Preview.Trim().Length -gt 0) {
        $body += "`n`n$Preview"
    }
    $body += "`n`nKalau ragu, pilih [cancel] / [skip]."

    return (Show-LintasNumberedChoicePopup -Title $Title -Message $body -Options $Options -DefaultIndex $safeDefaultIdx)
}
