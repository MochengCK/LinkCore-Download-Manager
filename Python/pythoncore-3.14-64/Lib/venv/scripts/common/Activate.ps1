<#
.Synopsis
Activate a Python virtual environment for the current PowerShell session.

.Description
Pushes the python executable for a virtual environment to the front of the
$Env:PATH environment variable and sets the prompt to signify that you are
in a Python virtual environment. Makes use of the command line switches as
well as the `pyvenv.cfg` file values present in the virtual environment.

.Parameter VenvDir
Path to the directory that contains the virtual environment to activate. The
default value for this is the parent of the directory that the Activate.ps1
script is located within.

.Parameter Prompt
The prompt prefix to display when this virtual environment is activated. By
default, this prompt is the name of the virtual environment folder (VenvDir)
surrounded by parentheses and followed by a single space (ie. '(.venv) ').

.Example
Activate.ps1
Activates the Python virtual environment that contains the Activate.ps1 script.

.Example
Activate.ps1 -Verbose
Activates the Python virtual environment that contains the Activate.ps1 script,
and shows extra information about the activation as it executes.

.Example
Activate.ps1 -VenvDir C:\Users\MyUser\Common\.venv
Activates the Python virtual environment located in the specified location.

.Example
Activate.ps1 -Prompt "MyPython"
Activates the Python virtual environment that contains the Activate.ps1 script,
and prefixes the current prompt with the specified string (surrounded in
parentheses) while the virtual environment is active.

.Notes
On Windows, it may be required to enable this Activate.ps1 script by setting the
execution policy for the user. You can do this by issuing the following PowerShell
command:

PS C:\> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

For more information on Execution Policies: 
https://go.microsoft.com/fwlink/?LinkID=135170

#>
Param(
    [Parameter(Mandatory = $false)]
    [String]
    $VenvDir,
    [Parameter(Mandatory = $false)]
    [String]
    $Prompt
)

<# Function declarations --------------------------------------------------- #>

<#
.Synopsis
Remove all shell session elements added by the Activate script, including the
addition of the virtual environment's Python executable from the beginning of
the PATH variable.

.Parameter NonDestructive
If present, do not remove this function from the global namespace for the
session.

#>
function global:deactivate ([switch]$NonDestructive) {
    # Revert to original values

    # The prior prompt:
    if (Test-Path -Path Function:_OLD_VIRTUAL_PROMPT) {
        Copy-Item -Path Function:_OLD_VIRTUAL_PROMPT -Destination Function:prompt
        Remove-Item -Path Function:_OLD_VIRTUAL_PROMPT
    }

    # The prior PYTHONHOME:
    if (Test-Path -Path Env:_OLD_VIRTUAL_PYTHONHOME) {
        Copy-Item -Path Env:_OLD_VIRTUAL_PYTHONHOME -Destination Env:PYTHONHOME
        Remove-Item -Path Env:_OLD_VIRTUAL_PYTHONHOME
    }

    # The prior PATH:
    if (Test-Path -Path Env:_OLD_VIRTUAL_PATH) {
        Copy-Item -Path Env:_OLD_VIRTUAL_PATH -Destination Env:PATH
        Remove-Item -Path Env:_OLD_VIRTUAL_PATH
    }

    # Just remove the VIRTUAL_ENV altogether:
    if (Test-Path -Path Env:VIRTUAL_ENV) {
        Remove-Item -Path env:VIRTUAL_ENV
    }

    # Just remove VIRTUAL_ENV_PROMPT altogether.
    if (Test-Path -Path Env:VIRTUAL_ENV_PROMPT) {
        Remove-Item -Path env:VIRTUAL_ENV_PROMPT
    }

    # Just remove the _PYTHON_VENV_PROMPT_PREFIX altogether:
    if (Get-Variable -Name "_PYTHON_VENV_PROMPT_PREFIX" -ErrorAction SilentlyContinue) {
        Remove-Variable -Name _PYTHON_VENV_PROMPT_PREFIX -Scope Global -Force
    }

    # Leave deactivate function in the global namespace if requested:
    if (-not $NonDestructive) {
        Remove-Item -Path function:deactivate
    }
}

<#
.Description
Get-PyVenvConfig parses the values from the pyvenv.cfg file located in the
given folder, and returns them in a map.

For each line in the pyvenv.cfg file, if that line can be parsed into exactly
two strings separated by `=` (with any amount of whitespace surrounding the =)
then it is considered a `key = value` line. The left hand string is the key,
the right hand is the value.

If the value starts with a `'` or a `"` then the first and last character is
stripped from the value before being captured.

.Parameter ConfigDir
Path to the directory that contains the `pyvenv.cfg` file.
#>
function Get-PyVenvConfig(
    [String]
    $ConfigDir
) {
    Write-Verbose "Given ConfigDir=$ConfigDir, obtain values in pyvenv.cfg"

    # Ensure the file exists, and issue a warning if it doesn't (but still allow the function to continue).
    $pyvenvConfigPath = Join-Path -Resolve -Path $ConfigDir -ChildPath 'pyvenv.cfg' -ErrorAction Continue

    # An empty map will be returned if no config file is found.
    $pyvenvConfig = @{ }

    if ($pyvenvConfigPath) {

        Write-Verbose "File exists, parse `key = value` lines"
        $pyvenvConfigContent = Get-Content -Path $pyvenvConfigPath

        $pyvenvConfigContent | ForEach-Object {
            $keyval = $PSItem -split "\s*=\s*", 2
            if ($keyval[0] -and $keyval[1]) {
                $val = $keyval[1]

                # Remove extraneous quotations around a string value.
                if ("'""".Contains($val.Substring(0, 1))) {
                    $val = $val.Substring(1, $val.Length - 2)
                }

                $pyvenvConfig[$keyval[0]] = $val
                Write-Verbose "Adding Key: '$($keyval[0])'='$val'"
            }
        }
    }
    return $pyvenvConfig
}


<# Begin Activate script --------------------------------------------------- #>

# Determine the containing directory of this script
$VenvExecPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$VenvExecDir = Get-Item -Path $VenvExecPath

Write-Verbose "Activation script is located in path: '$VenvExecPath'"
Write-Verbose "VenvExecDir Fullname: '$($VenvExecDir.FullName)"
Write-Verbose "VenvExecDir Name: '$($VenvExecDir.Name)"

# Set values required in priority: CmdLine, ConfigFile, Default
# First, get the location of the virtual environment, it might not be
# VenvExecDir if specified on the command line.
if ($VenvDir) {
    Write-Verbose "VenvDir given as parameter, using '$VenvDir' to determine values"
}
else {
    Write-Verbose "VenvDir not given as a parameter, using parent directory name as VenvDir."
    $VenvDir = $VenvExecDir.Parent.FullName.TrimEnd("\\/")
    Write-Verbose "VenvDir=$VenvDir"
}

# Next, read the `pyvenv.cfg` file to determine any required value such
# as `prompt`.
$pyvenvCfg = Get-PyVenvConfig -ConfigDir $VenvDir

# Next, set the prompt from the command line, or the config file, or
# just use the name of the virtual environment folder.
if ($Prompt) {
    Write-Verbose "Prompt specified as argument, using '$Prompt'"
}
else {
    Write-Verbose "Prompt not specified as argument to script, checking pyvenv.cfg value"
    if ($pyvenvCfg -and $pyvenvCfg['prompt']) {
        Write-Verbose "  Setting based on value in pyvenv.cfg='$($pyvenvCfg['prompt'])'"
        $Prompt = $pyvenvCfg['prompt'];
    }
    else {
        Write-Verbose "  Setting prompt based on parent's directory's name. (Is the directory name passed to venv module when creating the virtual environment)"
        Write-Verbose "  Got leaf-name of $VenvDir='$(Split-Path -Path $venvDir -Leaf)'"
        $Prompt = Split-Path -Path $venvDir -Leaf
    }
}

Write-Verbose "Prompt = '$Prompt'"
Write-Verbose "VenvDir='$VenvDir'"

# Deactivate any currently active virtual environment, but leave the
# deactivate function in place.
deactivate -nondestructive

# Now set the environment variable VIRTUAL_ENV, used by many tools to determine
# that there is an activated venv.
$env:VIRTUAL_ENV = $VenvDir

$env:VIRTUAL_ENV_PROMPT = $Prompt

if (-not $Env:VIRTUAL_ENV_DISABLE_PROMPT) {

    Write-Verbose "Setting prompt to '$Prompt'"

    # Set the prompt to include the env name
    # Make sure _OLD_VIRTUAL_PROMPT is global
    function global:_OLD_VIRTUAL_PROMPT { "" }
    Copy-Item -Path function:prompt -Destination function:_OLD_VIRTUAL_PROMPT
    New-Variable -Name _PYTHON_VENV_PROMPT_PREFIX -Description "Python virtual environment prompt prefix" -Scope Global -Option ReadOnly -Visibility Public -Value $Prompt

    function global:prompt {
        Write-Host -NoNewline -ForegroundColor Green "($_PYTHON_VENV_PROMPT_PREFIX) "
        _OLD_VIRTUAL_PROMPT
    }
}

# Clear PYTHONHOME
if (Test-Path -Path Env:PYTHONHOME) {
    Copy-Item -Path Env:PYTHONHOME -Destination Env:_OLD_VIRTUAL_PYTHONHOME
    Remove-Item -Path Env:PYTHONHOME
}

# Add the venv to the PATH
Copy-Item -Path Env:PATH -Destination Env:_OLD_VIRTUAL_PATH
$Env:PATH = "$VenvExecDir$([System.IO.Path]::PathSeparator)$Env:PATH"

# SIG # Begin signature block
# MII3YgYJKoZIhvcNAQcCoII3UzCCN08CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCBALKwKRFIhr2RY
# IW/WJLd9pc8a9sj/IoThKU92fTfKsKCCG9IwggXMMIIDtKADAgECAhBUmNLR1FsZ
# lUgTecgRwIeZMA0GCSqGSIb3DQEBDAUAMHcxCzAJBgNVBAYTAlVTMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xSDBGBgNVBAMTP01pY3Jvc29mdCBJZGVu
# dGl0eSBWZXJpZmljYXRpb24gUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgMjAy
# MDAeFw0yMDA0MTYxODM2MTZaFw00NTA0MTYxODQ0NDBaMHcxCzAJBgNVBAYTAlVT
# MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xSDBGBgNVBAMTP01pY3Jv
# c29mdCBJZGVudGl0eSBWZXJpZmljYXRpb24gUm9vdCBDZXJ0aWZpY2F0ZSBBdXRo
# b3JpdHkgMjAyMDCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBALORKgeD
# Bmf9np3gx8C3pOZCBH8Ppttf+9Va10Wg+3cL8IDzpm1aTXlT2KCGhFdFIMeiVPvH
# or+Kx24186IVxC9O40qFlkkN/76Z2BT2vCcH7kKbK/ULkgbk/WkTZaiRcvKYhOuD
# PQ7k13ESSCHLDe32R0m3m/nJxxe2hE//uKya13NnSYXjhr03QNAlhtTetcJtYmrV
# qXi8LW9J+eVsFBT9FMfTZRY33stuvF4pjf1imxUs1gXmuYkyM6Nix9fWUmcIxC70
# ViueC4fM7Ke0pqrrBc0ZV6U6CwQnHJFnni1iLS8evtrAIMsEGcoz+4m+mOJyoHI1
# vnnhnINv5G0Xb5DzPQCGdTiO0OBJmrvb0/gwytVXiGhNctO/bX9x2P29Da6SZEi3
# W295JrXNm5UhhNHvDzI9e1eM80UHTHzgXhgONXaLbZ7LNnSrBfjgc10yVpRnlyUK
# xjU9lJfnwUSLgP3B+PR0GeUw9gb7IVc+BhyLaxWGJ0l7gpPKWeh1R+g/OPTHU3mg
# trTiXFHvvV84wRPmeAyVWi7FQFkozA8kwOy6CXcjmTimthzax7ogttc32H83rwjj
# O3HbbnMbfZlysOSGM1l0tRYAe1BtxoYT2v3EOYI9JACaYNq6lMAFUSw0rFCZE4e7
# swWAsk0wAly4JoNdtGNz764jlU9gKL431VulAgMBAAGjVDBSMA4GA1UdDwEB/wQE
# AwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBTIftJqhSobyhmYBAcnz1AQ
# T2ioojAQBgkrBgEEAYI3FQEEAwIBADANBgkqhkiG9w0BAQwFAAOCAgEAr2rd5hnn
# LZRDGU7L6VCVZKUDkQKL4jaAOxWiUsIWGbZqWl10QzD0m/9gdAmxIR6QFm3FJI9c
# Zohj9E/MffISTEAQiwGf2qnIrvKVG8+dBetJPnSgaFvlVixlHIJ+U9pW2UYXeZJF
# xBA2CFIpF8svpvJ+1Gkkih6PsHMNzBxKq7Kq7aeRYwFkIqgyuH4yKLNncy2RtNwx
# AQv3Rwqm8ddK7VZgxCwIo3tAsLx0J1KH1r6I3TeKiW5niB31yV2g/rarOoDXGpc8
# FzYiQR6sTdWD5jw4vU8w6VSp07YEwzJ2YbuwGMUrGLPAgNW3lbBeUU0i/OxYqujY
# lLSlLu2S3ucYfCFX3VVj979tzR/SpncocMfiWzpbCNJbTsgAlrPhgzavhgplXHT2
# 6ux6anSg8Evu75SjrFDyh+3XOjCDyft9V77l4/hByuVkrrOj7FjshZrM77nq81YY
# uVxzmq/FdxeDWds3GhhyVKVB0rYjdaNDmuV3fJZ5t0GNv+zcgKCf0Xd1WF81E+Al
# GmcLfc4l+gcK5GEh2NQc5QfGNpn0ltDGFf5Ozdeui53bFv0ExpK91IjmqaOqu/dk
# ODtfzAzQNb50GQOmxapMomE2gj4d8yu8l13bS3g7LfU772Aj6PXsCyM2la+YZr9T
# 03u4aUoqlmZpxJTG9F9urJh4iIAGXKKy7aIwggb+MIIE5qADAgECAhMzAAWfGea8
# rjY3w0nDAAAABZ8ZMA0GCSqGSIb3DQEBDAUAMFoxCzAJBgNVBAYTAlVTMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKzApBgNVBAMTIk1pY3Jvc29mdCBJ
# RCBWZXJpZmllZCBDUyBFT0MgQ0EgMDEwHhcNMjUxMjA1MTA0OTA5WhcNMjUxMjA4
# MTA0OTA5WjB8MQswCQYDVQQGEwJVUzEPMA0GA1UECBMGT3JlZ29uMRIwEAYDVQQH
# EwlCZWF2ZXJ0b24xIzAhBgNVBAoTGlB5dGhvbiBTb2Z0d2FyZSBGb3VuZGF0aW9u
# MSMwIQYDVQQDExpQeXRob24gU29mdHdhcmUgRm91bmRhdGlvbjCCAaIwDQYJKoZI
# hvcNAQEBBQADggGPADCCAYoCggGBANp/HFgvVAeHPUjIG/5lpI1SRXBF1osVBwa8
# gwebIvAZF6pOeDw7hDT1AN45q3n6NmrJ7yg4jzmWWltjbJ1o3zv8bjTgvuNL/Ht9
# NK09a1k81CduIbDrA/R+V5wED6mOL1S1zVAiojpxTXyTrsuMEx2nAZbDA96VUZ2m
# tuAZTESsCXplGG3QWUEd84kKaBv6le8BjTemrdaRoIHDCFlJQ9wf3a5ned1KAZmO
# 3QNStUPLihm5siajMw3+LkKoVg2DJAGd4Cb8FuJFq6JZm1ywYT0EDE9OfAs5nsjv
# 31BUYSUerlriGRsd1HgSwwG2F0ZYvrRzBVm1XE5lNNXyabRUJFTFb9ID8U4aAoaE
# huAW/p19vpMWciYmQhG0NCtqu5dNhpLrkuCex6AcFwXpGGVe6l6m0sPSFwoslgs/
# IN8oaQ2Qwsy+Sulh9AsYdlp5qCLMgOfNKVuC2HCE7KuLMnNanQwRpLnXFKD1BM8+
# rJe8Eb2dDcT2HrqSs5w0q8TbhZFeYQIDAQABo4ICGTCCAhUwDAYDVR0TAQH/BAIw
# ADAOBgNVHQ8BAf8EBAMCB4AwPAYDVR0lBDUwMwYKKwYBBAGCN2EBAAYIKwYBBQUH
# AwMGGysGAQQBgjdhgqKNuwqmkohkgZH0oEWCk/3hbzAdBgNVHQ4EFgQU6paLWZnR
# 2CTJ4aKD90ietaU0dDowHwYDVR0jBBgwFoAUdpw2dBPRkH1hX7MC64D0mUulPoUw
# ZwYDVR0fBGAwXjBcoFqgWIZWaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9w
# cy9jcmwvTWljcm9zb2Z0JTIwSUQlMjBWZXJpZmllZCUyMENTJTIwRU9DJTIwQ0El
# MjAwMS5jcmwwgaUGCCsGAQUFBwEBBIGYMIGVMGQGCCsGAQUFBzAChlhodHRwOi8v
# d3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL01pY3Jvc29mdCUyMElEJTIw
# VmVyaWZpZWQlMjBDUyUyMEVPQyUyMENBJTIwMDEuY3J0MC0GCCsGAQUFBzABhiFo
# dHRwOi8vb25lb2NzcC5taWNyb3NvZnQuY29tL29jc3AwZgYDVR0gBF8wXTBRBgwr
# BgEEAYI3TIN9AQEwQTA/BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNyb3NvZnQu
# Y29tL3BraW9wcy9Eb2NzL1JlcG9zaXRvcnkuaHRtMAgGBmeBDAEEATANBgkqhkiG
# 9w0BAQwFAAOCAgEAiDwgis7KEYsBSEV+pp80e/tGMYFipo0nuc8qIGTHhA4pCQ5c
# VWmue0fq7BzoCsqemacQCDLOjQZuw15IhpCqa9MbWrJimlr4v5ngbWomrsZxYspK
# A3Is6ha6nYXdCDeZ2CSb/8Hf9ryNVYHdtd25H2nM+hEG1x8SebmZYraKEFcWmuqF
# T0a59YLeuLDK5g3GWuS9nn4IzeOVTYlp8HkoArsOgK142QFf1q5NxFm9/R5Bm4QS
# V5D597eFHjoCQz12++CrbUP4yCXecOBfOOk8HWgSosl1FiLcX0E+WF0K7oElwiLY
# esNmUWAj0jII/ZdSwZAJd+RjDLPn/YbwH6jSo97dLlCCF0PB0Luk/8i6OIYjtNxg
# t6T17ImHELaU2j2GROCuVxIfSE+st2KFx5tyVWtlcPE4mgJg7GG0DG3107Mxs6KD
# QvYl5FC50qfOEd+8chtYhl4qn+6VZhCUvw5TlCFhQh/emDkLap6FCeyusIPh75NC
# V92gXmUCmX2IjrpUZ48hmAx5ZxC9RZMI43WJA/t7gyxtAUcNDsSgcpdfegU9Vtce
# goiQRk+E8m7gmsebmeqKHEKMd3cOhvN3hVYKUDtvgcuIiASDSIqZLPefEpDOVVmF
# 9Y9XLiKlA+7+rBqm+BRvacWg+CGHED8DJv+/Ky94Ing2amhMowqdHRknP3Awggda
# MIIFQqADAgECAhMzAAAABkoa+s8FYWp0AAAAAAAGMA0GCSqGSIb3DQEBDAUAMGMx
# CzAJBgNVBAYTAlVTMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xNDAy
# BgNVBAMTK01pY3Jvc29mdCBJRCBWZXJpZmllZCBDb2RlIFNpZ25pbmcgUENBIDIw
# MjEwHhcNMjEwNDEzMTczMTU0WhcNMjYwNDEzMTczMTU0WjBaMQswCQYDVQQGEwJV
# UzEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSswKQYDVQQDEyJNaWNy
# b3NvZnQgSUQgVmVyaWZpZWQgQ1MgRU9DIENBIDAxMIICIjANBgkqhkiG9w0BAQEF
# AAOCAg8AMIICCgKCAgEAx+PIP/Qh3cYZwLvFy6uuJ4fTp3ln7Gqs7s8lTVyfgOJW
# P1aABwk2/oxdVjfSHUq4MTPXilL57qi/fH7YndEK4Knd3u5cedFwr2aHSTp6vl/P
# L1dAL9sfoDvNpdG0N/R84AhYNpBQThpO4/BqxmCgl3iIRfhh2oFVOuiTiDVWvXBg
# 76bcjnHnEEtXzvAWwJu0bBU7oRRqQed4VXJtICVt+ZoKUSjqY5wUlhAdwHh+31Bn
# pBPCzFtKViLp6zEtRyOxRegagFU+yLgXvvmd07IDN0S2TLYuiZjTw+kcYOtoNgKr
# 7k0C6E9Wf3H4jHavk2MxqFptgfL0gL+zbSb+VBNKiVT0mqzXJIJmWmqw0K+D3MKf
# mCer3e3CbrP+F5RtCb0XaE0uRcJPZJjWwciDBxBIbkNF4GL12hl5vydgFMmzQcNu
# odKyX//3lLJ1q22roHVS1cgtsLgpjWYZlBlhCTcXJeZ3xuaJvXZB9rcLCX15OgXL
# 21tUUwJCLE27V5AGZxkO3i54mgSCswtOmWU4AKd/B/e3KtXv6XBURKuAteez1Epg
# loaZwQej9l5dN9Uh8W19BZg9IlLl+xHRX4vDiMWAUf/7ANe4MoS98F45r76IGJ0h
# C02EMuMZxAErwZj0ln0aL53EzlMa5JCiRObb0UoLHfGSdNJsMg0uj3DAQDdVWTEC
# AwEAAaOCAg4wggIKMA4GA1UdDwEB/wQEAwIBhjAQBgkrBgEEAYI3FQEEAwIBADAd
# BgNVHQ4EFgQUdpw2dBPRkH1hX7MC64D0mUulPoUwVAYDVR0gBE0wSzBJBgRVHSAA
# MEEwPwYIKwYBBQUHAgEWM2h0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# RG9jcy9SZXBvc2l0b3J5Lmh0bTAZBgkrBgEEAYI3FAIEDB4KAFMAdQBiAEMAQTAS
# BgNVHRMBAf8ECDAGAQH/AgEAMB8GA1UdIwQYMBaAFNlBKbAPD2Ns72nX9c0pnqRI
# ajDmMHAGA1UdHwRpMGcwZaBjoGGGX2h0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9w
# a2lvcHMvY3JsL01pY3Jvc29mdCUyMElEJTIwVmVyaWZpZWQlMjBDb2RlJTIwU2ln
# bmluZyUyMFBDQSUyMDIwMjEuY3JsMIGuBggrBgEFBQcBAQSBoTCBnjBtBggrBgEF
# BQcwAoZhaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNy
# b3NvZnQlMjBJRCUyMFZlcmlmaWVkJTIwQ29kZSUyMFNpZ25pbmclMjBQQ0ElMjAy
# MDIxLmNydDAtBggrBgEFBQcwAYYhaHR0cDovL29uZW9jc3AubWljcm9zb2Z0LmNv
# bS9vY3NwMA0GCSqGSIb3DQEBDAUAA4ICAQBqLwmf2LB1QjUga0G7zFkbGd8NBQLH
# P0KOFBWNJFZiTtKfpO0bZ2Wfs6v5vqIKjE32Q6M89G4ZkVcvWuEAA+dvjLThSy89
# Y0//m/WTSKwYtiR1Ewn7x1kw/Fg93wQps2C1WUj+00/6uNrF+d4MVJxV1HoBID+9
# 5ZIW0KkqZopnOA4w5vP4T5cBprZQAlP/vMGyB0H9+pHNo0jT9Q8gfKJNzHS9i1Dg
# BmmufGdW9TByuno8GAizFMhLlIs08b5lilIkE5z3FMAUAr+XgII1FNZnb43OI6Qd
# 2zOijbjYfursXUCNHC+RSwJGm5ULzPymYggnJ+khJOq7oSlqPGpbr70hGBePw/J7
# /mmSqp7hTgt0mPikS1i4ap8x+P3yemYShnFrgV1752TI+As69LfgLthkITvf7bFH
# B8vmIhadZCOS0vTCx3B+/OVcEMLNO2bJ0O9ikc1JqR0Fvqx7nAwMRSh3FVqosgzB
# bWnVkQJq7oWFwMVfFIYn6LPRZMt48u6iMUCFBSPddsPA/6k85mEv+08U5WCQ7ydj
# 1KVV2THre/8mLHiem9wf/CzohqRntxM2E/x+NHy6TBMnSPQRqhhNfuOgUDAWEYml
# M/ZHGaPIb7xOvfVyLQ/7l6YfogT3eptwp4GOGRjH5z+gG9kpBIx8QrRl6OilnlxR
# ExokmMflL7l12TCCB54wggWGoAMCAQICEzMAAAAHh6M0o3uljhwAAAAAAAcwDQYJ
# KoZIhvcNAQEMBQAwdzELMAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBD
# b3Jwb3JhdGlvbjFIMEYGA1UEAxM/TWljcm9zb2Z0IElkZW50aXR5IFZlcmlmaWNh
# dGlvbiBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDIwMB4XDTIxMDQwMTIw
# MDUyMFoXDTM2MDQwMTIwMTUyMFowYzELMAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjE0MDIGA1UEAxMrTWljcm9zb2Z0IElEIFZlcmlm
# aWVkIENvZGUgU2lnbmluZyBQQ0EgMjAyMTCCAiIwDQYJKoZIhvcNAQEBBQADggIP
# ADCCAgoCggIBALLwwK8ZiCji3VR6TElsaQhVCbRS/3pK+MHrJSj3Zxd3KU3rlfL3
# qrZilYKJNqztA9OQacr1AwoNcHbKBLbsQAhBnIB34zxf52bDpIO3NJlfIaTE/xrw
# eLoQ71lzCHkD7A4As1Bs076Iu+mA6cQzsYYH/Cbl1icwQ6C65rU4V9NQhNUwgrx9
# rGQ//h890Q8JdjLLw0nV+ayQ2Fbkd242o9kH82RZsH3HEyqjAB5a8+Ae2nPIPc8s
# ZU6ZE7iRrRZywRmrKDp5+TcmJX9MRff241UaOBs4NmHOyke8oU1TYrkxh+YeHgfW
# o5tTgkoSMoayqoDpHOLJs+qG8Tvh8SnifW2Jj3+ii11TS8/FGngEaNAWrbyfNrC6
# 9oKpRQXY9bGH6jn9NEJv9weFxhTwyvx9OJLXmRGbAUXN1U9nf4lXezky6Uh/cgjk
# Vd6CGUAf0K+Jw+GE/5VpIVbcNr9rNE50Sbmy/4RTCEGvOq3GhjITbCa4crCzTTHg
# YYjHs1NbOc6brH+eKpWLtr+bGecy9CrwQyx7S/BfYJ+ozst7+yZtG2wR461uckFu
# 0t+gCwLdN0A6cFtSRtR8bvxVFyWwTtgMMFRuBa3vmUOTnfKLsLefRaQcVTgRnzeL
# zdpt32cdYKp+dhr2ogc+qM6K4CBI5/j4VFyC4QFeUP2YAidLtvpXRRo3AgMBAAGj
# ggI1MIICMTAOBgNVHQ8BAf8EBAMCAYYwEAYJKwYBBAGCNxUBBAMCAQAwHQYDVR0O
# BBYEFNlBKbAPD2Ns72nX9c0pnqRIajDmMFQGA1UdIARNMEswSQYEVR0gADBBMD8G
# CCsGAQUFBwIBFjNodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL0RvY3Mv
# UmVwb3NpdG9yeS5odG0wGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwDwYDVR0T
# AQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTIftJqhSobyhmYBAcnz1AQT2ioojCBhAYD
# VR0fBH0wezB5oHegdYZzaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9j
# cmwvTWljcm9zb2Z0JTIwSWRlbnRpdHklMjBWZXJpZmljYXRpb24lMjBSb290JTIw
# Q2VydGlmaWNhdGUlMjBBdXRob3JpdHklMjAyMDIwLmNybDCBwwYIKwYBBQUHAQEE
# gbYwgbMwgYEGCCsGAQUFBzAChnVodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtp
# b3BzL2NlcnRzL01pY3Jvc29mdCUyMElkZW50aXR5JTIwVmVyaWZpY2F0aW9uJTIw
# Um9vdCUyMENlcnRpZmljYXRlJTIwQXV0aG9yaXR5JTIwMjAyMC5jcnQwLQYIKwYB
# BQUHMAGGIWh0dHA6Ly9vbmVvY3NwLm1pY3Jvc29mdC5jb20vb2NzcDANBgkqhkiG
# 9w0BAQwFAAOCAgEAfyUqnv7Uq+rdZgrbVyNMul5skONbhls5fccPlmIbzi+OwVdP
# Q4H55v7VOInnmezQEeW4LqK0wja+fBznANbXLB0KrdMCbHQpbLvG6UA/Xv2pfpVI
# E1CRFfNF4XKO8XYEa3oW8oVH+KZHgIQRIwAbyFKQ9iyj4aOWeAzwk+f9E5StNp5T
# 8FG7/VEURIVWArbAzPt9ThVN3w1fAZkF7+YU9kbq1bCR2YD+MtunSQ1Rft6XG7b4
# e0ejRA7mB2IoX5hNh3UEauY0byxNRG+fT2MCEhQl9g2i2fs6VOG19CNep7SquKaB
# jhWmirYyANb0RJSLWjinMLXNOAga10n8i9jqeprzSMU5ODmrMCJE12xS/NWShg/t
# uLjAsKP6SzYZ+1Ry358ZTFcx0FS/mx2vSoU8s8HRvy+rnXqyUJ9HBqS0DErVLjQw
# K8VtsBdekBmdTbQVoCgPCqr+PDPB3xajYnzevs7eidBsM71PINK2BoE2UfMwxCCX
# 3mccFgx6UsQeRSdVVVNSyALQe6PT12418xon2iDGE81OGCreLzDcMAZnrUAx4XQL
# Uz6ZTl65yPUiOh3k7Yww94lDf+8oG2oZmDh5O1Qe38E+M3vhKwmzIeoB1dVLlz4i
# 3IpaDcR+iuGjH2TdaC1ZOmBXiCRKJLj4DT2uhJ04ji+tHD6n58vhavFIrmcxghrm
# MIIa4gIBATBxMFoxCzAJBgNVBAYTAlVTMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xKzApBgNVBAMTIk1pY3Jvc29mdCBJRCBWZXJpZmllZCBDUyBFT0Mg
# Q0EgMDECEzMABZ8Z5ryuNjfDScMAAAAFnxkwDQYJYIZIAWUDBAIBBQCggbIwGQYJ
# KoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisGAQQB
# gjcCARUwLwYJKoZIhvcNAQkEMSIEICpXe3RS3b2coD0CJveEHlglqtPUYZ2FqSrO
# UfP6C6Y4MEYGCisGAQQBgjcCAQwxODA2oDCALgBQAHkAdABoAG8AbgAgADMALgAx
# ADQALgAyACAAKABkAGYANwA5ADMAMQA2ACmhAoAAMA0GCSqGSIb3DQEBAQUABIIB
# gCehO2TtAkzHcMAu7uHsEfaSUFR97HyeCipydWZs1MOp4kioH7PI3c3MeHjcv78Y
# TmNyZQ6E1jQlxpgcwS50wqmRZoCXQaLoJdQL5L65qAF3ACbDsIBpNOrE8bL8tMFk
# flN1zzSXFSQmEFf9onBIVdRTYpNYVdinhYadNHeHUFfrv+KKq5ebV8hWi9ywBdR+
# /j5ckTEhEHdA7cN5lHdsTlhWh4gskoCn6idsa8sAiA9bEMZLhIsqB8lYdXP6mNhW
# ucZ8NfyXvGnFico8jplAnfDJWTp2r0e3SfnZSt84nCWvXVqFnRDMjc7DG+m0yKFL
# d2xQa5jSF4glIbkUCozYjafcW2CCPoNjE0mhKSccKwW3/plErAu0WsVsEEfoU7XA
# TUbes0LVJ6mZpQaBpu0AiahmhLxG93Sn+PJvtmQy9mUSW2jhHE+biStcQICb7qH4
# uPWyGqiPbsGpsfQS7Duv5lnVVKGLPoWNFLcw4jQSacjavKbxCXeO0e6TQdgWI/UB
# Y6GCGBEwghgNBgorBgEEAYI3AwMBMYIX/TCCF/kGCSqGSIb3DQEHAqCCF+owghfm
# AgEDMQ8wDQYJYIZIAWUDBAIBBQAwggFiBgsqhkiG9w0BCRABBKCCAVEEggFNMIIB
# SQIBAQYKKwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCBge4hrE+JLCwPzzWVS
# hpjHuFzLlxLfvEICiAo4aG4FEgIGaR9YyGFgGBMyMDI1MTIwNTE4MTE1Ny4zMjda
# MASAAgH0oIHhpIHeMIHbMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
# bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
# aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYD
# VQQLEx5uU2hpZWxkIFRTUyBFU046NzgwMC0wNUUwLUQ5NDcxNTAzBgNVBAMTLE1p
# Y3Jvc29mdCBQdWJsaWMgUlNBIFRpbWUgU3RhbXBpbmcgQXV0aG9yaXR5oIIPITCC
# B4IwggVqoAMCAQICEzMAAAAF5c8P/2YuyYcAAAAAAAUwDQYJKoZIhvcNAQEMBQAw
# dzELMAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjFI
# MEYGA1UEAxM/TWljcm9zb2Z0IElkZW50aXR5IFZlcmlmaWNhdGlvbiBSb290IENl
# cnRpZmljYXRlIEF1dGhvcml0eSAyMDIwMB4XDTIwMTExOTIwMzIzMVoXDTM1MTEx
# OTIwNDIzMVowYTELMAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
# b3JhdGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0IFB1YmxpYyBSU0EgVGltZXN0YW1w
# aW5nIENBIDIwMjAwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCefOdS
# Y/3gxZ8FfWO1BiKjHB7X55cz0RMFvWVGR3eRwV1wb3+yq0OXDEqhUhxqoNv6iYWK
# jkMcLhEFxvJAeNcLAyT+XdM5i2CgGPGcb95WJLiw7HzLiBKrxmDj1EQB/mG5eEiR
# BEp7dDGzxKCnTYocDOcRr9KxqHydajmEkzXHOeRGwU+7qt8Md5l4bVZrXAhK+WSk
# 5CihNQsWbzT1nRliVDwunuLkX1hyIWXIArCfrKM3+RHh+Sq5RZ8aYyik2r8HxT+l
# 2hmRllBvE2Wok6IEaAJanHr24qoqFM9WLeBUSudz+qL51HwDYyIDPSQ3SeHtKog0
# ZubDk4hELQSxnfVYXdTGncaBnB60QrEuazvcob9n4yR65pUNBCF5qeA4QwYnilBk
# fnmeAjRN3LVuLr0g0FXkqfYdUmj1fFFhH8k8YBozrEaXnsSL3kdTD01X+4LfIWOu
# FzTzuoslBrBILfHNj8RfOxPgjuwNvE6YzauXi4orp4Sm6tF245DaFOSYbWFK5ZgG
# 6cUY2/bUq3g3bQAqZt65KcaewEJ3ZyNEobv35Nf6xN6FrA6jF9447+NHvCjeWLCQ
# Z3M8lgeCcnnhTFtyQX3XgCoc6IRXvFOcPVrr3D9RPHCMS6Ckg8wggTrtIVnY8yjb
# vGOUsAdZbeXUIQAWMs0d3cRDv09SvwVRd61evQIDAQABo4ICGzCCAhcwDgYDVR0P
# AQH/BAQDAgGGMBAGCSsGAQQBgjcVAQQDAgEAMB0GA1UdDgQWBBRraSg6NS9IY0DP
# e9ivSek+2T3bITBUBgNVHSAETTBLMEkGBFUdIAAwQTA/BggrBgEFBQcCARYzaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9Eb2NzL1JlcG9zaXRvcnkuaHRt
# MBMGA1UdJQQMMAoGCCsGAQUFBwMIMBkGCSsGAQQBgjcUAgQMHgoAUwB1AGIAQwBB
# MA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAUyH7SaoUqG8oZmAQHJ89QEE9o
# qKIwgYQGA1UdHwR9MHsweaB3oHWGc2h0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9w
# a2lvcHMvY3JsL01pY3Jvc29mdCUyMElkZW50aXR5JTIwVmVyaWZpY2F0aW9uJTIw
# Um9vdCUyMENlcnRpZmljYXRlJTIwQXV0aG9yaXR5JTIwMjAyMC5jcmwwgZQGCCsG
# AQUFBwEBBIGHMIGEMIGBBggrBgEFBQcwAoZ1aHR0cDovL3d3dy5taWNyb3NvZnQu
# Y29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBJZGVudGl0eSUyMFZlcmlmaWNh
# dGlvbiUyMFJvb3QlMjBDZXJ0aWZpY2F0ZSUyMEF1dGhvcml0eSUyMDIwMjAuY3J0
# MA0GCSqGSIb3DQEBDAUAA4ICAQBfiHbHfm21WhV150x4aPpO4dhEmSUVpbixNDmv
# 6TvuIHv1xIs174bNGO/ilWMm+Jx5boAXrJxagRhHQtiFprSjMktTliL4sKZyt2i+
# SXncM23gRezzsoOiBhv14YSd1Klnlkzvgs29XNjT+c8hIfPRe9rvVCMPiH7zPZcw
# 5nNjthDQ+zD563I1nUJ6y59TbXWsuyUsqw7wXZoGzZwijWT5oc6GvD3HDokJY401
# uhnj3ubBhbkR83RbfMvmzdp3he2bvIUztSOuFzRqrLfEvsPkVHYnvH1wtYyrt5vS
# hiKheGpXa2AWpsod4OJyT4/y0dggWi8g/tgbhmQlZqDUf3UqUQsZaLdIu/XSjgoZ
# qDjamzCPJtOLi2hBwL+KsCh0Nbwc21f5xvPSwym0Ukr4o5sCcMUcSy6TEP7uMV8R
# X0eH/4JLEpGyae6Ki8JYg5v4fsNGif1OXHJ2IWG+7zyjTDfkmQ1snFOTgyEX8qBp
# efQbF0fx6URrYiarjmBprwP6ZObwtZXJ23jK3Fg/9uqM3j0P01nzVygTppBabzxP
# Ah/hHhhls6kwo3QLJ6No803jUsZcd4JQxiYHHc+Q/wAMcPUnYKv/q2O444LO1+n6
# j01z5mggCSlRwD9faBIySAcA9S8h22hIAcRQqIGEjolCK9F6nK9ZyX4lhthsGHum
# aABdWzCCB5cwggV/oAMCAQICEzMAAABXJNOV4KLpyTEAAAAAAFcwDQYJKoZIhvcN
# AQEMBQAwYTELMAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
# dGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0IFB1YmxpYyBSU0EgVGltZXN0YW1waW5n
# IENBIDIwMjAwHhcNMjUxMDIzMjA0NjUzWhcNMjYxMDIyMjA0NjUzWjCB2zELMAkG
# A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
# HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9z
# b2Z0IEFtZXJpY2EgT3BlcmF0aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# Ojc4MDAtMDVFMC1EOTQ3MTUwMwYDVQQDEyxNaWNyb3NvZnQgUHVibGljIFJTQSBU
# aW1lIFN0YW1waW5nIEF1dGhvcml0eTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCC
# AgoCggIBALFspQqTCH24syS2NZD1ztnJl9h0Vr0WwJnikmeXse/4wspnVexGqfiH
# NoqkbVg5CinuYC+iVfNMLZ+QtqhySz8VGBSjRt1JB5ACNtTKAjfmFp4U/Cv2Lj4m
# +vuve9I3W3hSiImTFsHeYZ6V/Sd43rXrhHV26fw3xQSteSbg9yTs1rhdrLkAj4Km
# I0D5P4KavtygirVyUW10gkifWLSE1NiB8Jn3RO5dj32deeMNONaaPnw3k49ICTs3
# Ffyb+ekNDPsNfYwCqPyOTxM6y1dSD0J5j+KK9V+EWyV5PDjV8jjn1zsStlS6TcYJ
# JStcgHs2xT9rs6ooWl5FtYfRkCxhDShEp3s8IHUWizTWmLZvAE/6WR2Cd+ZmVapG
# XTCHJKUByZPxdX0i8gynirR+EwuHHNxEilDICLatO2WZu+CQrH4Zq0NYo1TQ4tUp
# Z/kAWpoAu1r4mW5EJ3HkEavQ2PuoQDcDq2rAGVIla9pD7o9Yxwzl81BuDvUEyu9D
# /6F0qmQDdaE791HxfCUxpgMYPpdWTzs+dDGPehwQ8P92yP8ARjby5Ony1Z68RjeQ
# ebpxf5WL441myFHcgT1UJzzil7tPEkR22NfTNR6Fl+jzWb/r80nqlXllhynSowtx
# o1Y22xqYviS24smikUsBKqOPbSS77uvXEO3VrG5LGouE1EZ1Y9pjAgMBAAGjggHL
# MIIBxzAdBgNVHQ4EFgQUjoPJXi01DgIJSGfm416Yg+0SkqcwHwYDVR0jBBgwFoAU
# a2koOjUvSGNAz3vYr0npPtk92yEwbAYDVR0fBGUwYzBhoF+gXYZbaHR0cDovL3d3
# dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwUHVibGljJTIw
# UlNBJTIwVGltZXN0YW1waW5nJTIwQ0ElMjAyMDIwLmNybDB5BggrBgEFBQcBAQRt
# MGswaQYIKwYBBQUHMAKGXWh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# Y2VydHMvTWljcm9zb2Z0JTIwUHVibGljJTIwUlNBJTIwVGltZXN0YW1waW5nJTIw
# Q0ElMjAyMDIwLmNydDAMBgNVHRMBAf8EAjAAMBYGA1UdJQEB/wQMMAoGCCsGAQUF
# BwMIMA4GA1UdDwEB/wQEAwIHgDBmBgNVHSAEXzBdMFEGDCsGAQQBgjdMg30BATBB
# MD8GCCsGAQUFBwIBFjNodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL0Rv
# Y3MvUmVwb3NpdG9yeS5odG0wCAYGZ4EMAQQCMA0GCSqGSIb3DQEBDAUAA4ICAQBy
# dcB2POmZOUlAQz2NuXf7vWCVWmjWu9bsY1+HMjv1yeLjxDQkjsJEU5zaIDy8Uw9B
# YN8+ExX/9k/9CBUsXbVlbU44c65/liyJ83kWsFIUwhVazwSShFlbIZviIO/5weyW
# yTfPPpbSJgWy+ZE9UrQS3xulJLAHA2zUkMMPdAlF4RrngcZZ0r45AF9aIYjdestW
# wdrNK70MfArHqZdgrgXn03w6zBs1v7czceWGitg/DlsHqk1mXBpSTuGI2TSPN3E6
# 0IIXx5f/AFzh4/HFi98BBZbUELNsXkWAG9ynZ5e6CFiil1mgWCWOT90D7Igvg0zK
# e3o3WCk629/en94K/sC/zLOf2d7yFmTySb9fKjcONH1Db3kZ8MzEJ8fHTNmxrl10
# Gecuz/Gl0+ByTKN+PambZ+F0MIlBPww6fvjFC9JII73fw3qO169+9TxTz2G+E26G
# YY1dcffsAhw6DqTQgbflbl1O/MrSXSs0NSb9nBD9RfR/f8Ei7DA1L1jBO7vZhhJT
# jw2TzFa/ALgRLi3W00hHWi8LGQaZc8SwXIMYWfwrN9MgYbhN0Iak9WA2dqWuekXs
# TwNkmrD3E6E+oCYCehNOgZmds0Ezb1jo7OV0Kh22Ll3KHg3MHtlGguxAzhg/Bpix
# PS4qrULLkAjO7+yNsUfrD2U9gMf/OR4yJDPtzM0ytTGCB0Mwggc/AgEBMHgwYTEL
# MAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEyMDAG
# A1UEAxMpTWljcm9zb2Z0IFB1YmxpYyBSU0EgVGltZXN0YW1waW5nIENBIDIwMjAC
# EzMAAABXJNOV4KLpyTEAAAAAAFcwDQYJYIZIAWUDBAIBBQCgggScMBEGCyqGSIb3
# DQEJEAIPMQIFADAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwHAYJKoZIhvcN
# AQkFMQ8XDTI1MTIwNTE4MTE1N1owLwYJKoZIhvcNAQkEMSIEIF7Ts6JexFV/c0MV
# 7f0xxtSl53PMZG9Ps9xgFZRehm1MMIG5BgsqhkiG9w0BCRACLzGBqTCBpjCBozCB
# oAQg9TyfZLUFbkxliGyizuH9VVDpVFNvQEQhKQ2ZhUx421IwfDBlpGMwYTELMAkG
# A1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEyMDAGA1UE
# AxMpTWljcm9zb2Z0IFB1YmxpYyBSU0EgVGltZXN0YW1waW5nIENBIDIwMjACEzMA
# AABXJNOV4KLpyTEAAAAAAFcwggNeBgsqhkiG9w0BCRACEjGCA00wggNJoYIDRTCC
# A0EwggIpAgEBMIIBCaGB4aSB3jCB2zELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
# c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBD
# b3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9u
# czEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNOOjc4MDAtMDVFMC1EOTQ3MTUwMwYD
# VQQDEyxNaWNyb3NvZnQgUHVibGljIFJTQSBUaW1lIFN0YW1waW5nIEF1dGhvcml0
# eaIjCgEBMAcGBSsOAwIaAxUA/S8xOZxCUQFBNkrN8Wiij1x5y8OgZzBlpGMwYTEL
# MAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEyMDAG
# A1UEAxMpTWljcm9zb2Z0IFB1YmxpYyBSU0EgVGltZXN0YW1waW5nIENBIDIwMjAw
# DQYJKoZIhvcNAQELBQACBQDs3Z1nMCIYDzIwMjUxMjA1MTgwNTI3WhgPMjAyNTEy
# MDYxODA1MjdaMHQwOgYKKwYBBAGEWQoEATEsMCowCgIFAOzdnWcCAQAwBwIBAAIC
# MT8wBwIBAAICEmAwCgIFAOze7ucCAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYB
# BAGEWQoDAqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOC
# AQEADCrMEv9tjwrlz0rixQ7jrtskGAI/g1qT1fZGD+TWhLbvMX13fpqKpZOWWFg4
# kpMNbv42mfenOvUUhKSyMNav46H3xYm7DG623jRSDj83mG+cN35Qhyjro1BzJZ70
# JQVZcFhp4B5np2jQFtsBTOhPFBhyN9mG+DBSEpor/aq3Jv/e+9Dk+BRDr3O4LWYq
# /bq1xcDKvxpPWqJeLNUBo3X71qbabEHkxOpy408lw+X0IXp+XnUXWwva0ZHPndQN
# tclUWivh2D7vHTeFooH3nqA3C3Y6z+zZ74OdFPerCxQdkJX1p6iqc788UuL7ZKyI
# +o1Xn2gfDLHGkzZCj4rSz2dKHTANBgkqhkiG9w0BAQEFAASCAgCHittBRlngCOZm
# sNgfsVzIylt2+IBqoxWib9uzp99fHicS5HJWtCftjUQmPu8rM9v3ltFtD7To8gia
# CAkEFPTLmOIHhrTSvxAh2bKcWfSmckbZTyImbN9eEiYd6ftUHuwwIYRpOw0LyGe+
# 3GwAxGikdzmTC4n78sc+sL6CTiUnSJQLg09PfUmoD2fo942OOKJwBIWFYqfpJmQ7
# XJeO3E2BizX1Gf+Ewg8eLeZjJy0HgeMYXyouMR3BtYn1CpSpLmNoaoiQ28cXkuhP
# 3Pfk/fgsBPwViKlVN0TOPj1XtqOZlwlC2nK5moLS4ptScoaFssbWFE/XUzvvQPeh
# ovEdZkDVzbg12YPI/xwbi41v1OW+FJccmBilAXugQ2YXzRnerxr0Fg7lEajd7JoQ
# Gi3hSNf+CzBvZVY19YLqZ1GR5EgwOSaoIuEGvOEuTeWyxkmS9FUAeEpPgUAqPQq3
# AaoNOsrye/A0d4k8g9PF7/78vdhdZxICYcyvtORwJkMe3dvWAn+m5Y2EWFedQdYc
# Gj7A3pMLR6gZ+SKhuOzS+I6PF0AL1cWLORHAZ5BlPGvSG6DTJUvD3zktl1bE5GrZ
# 6eks4kok5WaoiyiaQKqHzmVmsRr4lWvWrPZQKin8U7cgqLSjqutmxCl6MpUKLdid
# JIVMD3f+Q26gE6yjj9FotOl8kHCE4Q==
# SIG # End signature block
