<#
    Publishes decks to the live site - the gh-pages branch of
    github.com/profUmer/teaching, served at https://profumer.github.io/teaching/

    `quarto publish gh-pages` cannot do this job here (TUTORIAL.md §8): this
    folder is a plain Quarto project, not a website, and Quarto publishes a
    plain project only while it has exactly one deck to render. So this does
    the same job by hand:

      1. renders each deck named, and checks the render came out as slides
      2. downloads the gh-pages branch, on its own, into C:\gwt
      3. copies in each deck's .html and _files\, plus index.html,
         assets\*.js, assets\slides.css and any figs\ the decks use
      4. shows what changed and asks before committing and pushing
      5. deletes C:\gwt, waits for GitHub Pages to build this push, then
         checks the site serves the new files - not merely that they exist,
         since every file but a new deck's already did before the push

    C:\gwt is a separate one-branch clone rather than a git worktree. A
    worktree keeps its bookkeeping in this repo's .git folder, which is inside
    OneDrive, and OneDrive's file locks made removing it fail ("Deletion of
    directory ... failed. Should I try again?"). The clone writes nothing into
    OneDrive at all.

    Every run copies the shared files (index.html, the lab modules and the
    stylesheet), since they are what every deck depends on and copying an
    unchanged file adds nothing to the commit.

    Usage (from the quarto folder):
        pwsh -File tools\publish.ps1 rayIntersections
        pwsh -File tools\publish.ps1 rayIntersections matricesIn3d
        pwsh -File tools\publish.ps1                       # shared files only
        pwsh -File tools\publish.ps1 rayIntersections -DryRun
        pwsh -File tools\publish.ps1 rayIntersections -VerifyOnly

    Options:
        -DryRun      do everything up to the commit, show what would change,
                     then stop - nothing is pushed
        -NoRender    publish the .html already on disk instead of re-rendering
        -Yes         do not ask before pushing
        -NoVerify    do not wait for GitHub Pages afterwards
        -VerifyOnly  publish nothing; just check that the live site serves the
                     same files as this folder (e.g. after a slow build)
#>

param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]] $Decks = @(),
    [switch] $DryRun,
    [switch] $NoRender,
    [switch] $Yes,
    [switch] $NoVerify,
    [switch] $VerifyOnly
)

$ErrorActionPreference = 'Stop'

$quarto = Split-Path -Parent $PSScriptRoot      # ...\Slides\quarto
$repo = Split-Path -Parent $quarto              # ...\Slides, the git repo
# Outside OneDrive, and short: matrices_files\ nests deep enough to hit
# Windows' path-length limit inside OneDrive's long path.
$wt = 'C:\gwt'
$site = 'https://profumer.github.io/teaching'

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }

# git, stopping the script if it fails. (Not named "Git": PowerShell names
# are case-insensitive, so a function Git would call itself instead of git.)
# Native commands do not trip $ErrorActionPreference, so the exit code is
# checked by hand.
function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

# "rayIntersections.qmd" and "rayIntersections" both name the same deck.
$Decks = @($Decks | ForEach-Object { $_ -replace '\.(qmd|html)$', '' } | Where-Object { $_ })

$origin = (& git -C $repo remote get-url origin).Trim()
# owner/repo, for GitHub's Pages API: github.com/profUmer/teaching(.git)
$slug = $origin -replace '^.*github\.com[:/]', '' -replace '\.git$', ''

# ------------------------------------------------------------- checks ---
Step 'Checking the decks'

# A deck missing from the render list renders as a bare web page - no
# reveal.js, theme or labs - so refuse before rendering anything.
$yml = Get-Content (Join-Path $quarto '_quarto.yml') -Raw
foreach ($d in $Decks) {
    if (-not (Test-Path (Join-Path $quarto "$d.qmd"))) {
        throw "no $d.qmd in $quarto"
    }
    $listed = $yml -match "(?m)^\s*-\s*$([regex]::Escape($d))\.qmd\s*(#.*)?$" -or $yml -match '(?m)^\s*-\s*"\*\.qmd"'
    if (-not $listed) {
        throw "$d.qmd is not in _quarto.yml's project: render: list. Add it there first, or it renders as a bare page without slides or labs."
    }
    Write-Host "  $d.qmd"
}
if ($Decks.Count -eq 0) { Write-Host '  no decks named - just the shared files' }

if (-not $NoRender -and -not $VerifyOnly) {
    foreach ($d in $Decks) {
        Step "Rendering $d.qmd"
        Push-Location $quarto
        try {
            & quarto render "$d.qmd"
            if ($LASTEXITCODE -ne 0) { throw "quarto render $d.qmd failed" }
        } finally { Pop-Location }
    }
}

# Whatever is about to be published must be a real deck: reveal.js slides
# that load the lab script, not the bare page an unlisted deck turns into.
$figs = @()
foreach ($d in $Decks) {
    $html = Join-Path $quarto "$d.html"
    $files = Join-Path $quarto "${d}_files"
    if (-not (Test-Path $html) -or -not (Test-Path $files)) {
        throw "$d.html or ${d}_files\ is missing - render it (drop -NoRender)"
    }
    $text = Get-Content $html -Raw
    if ($text -notmatch 'class="reveal"' -or $text -notmatch 'assets/labs\.js') {
        throw "$d.html is not a reveal.js deck with the lab script - it rendered without _quarto.yml. Check the render list, then re-render."
    }
    $figs += [regex]::Matches($text, 'figs/[^"''()\s<>]+') | ForEach-Object { $_.Value }
}
$figs = @($figs | Sort-Object -Unique)
foreach ($f in $figs) {
    if (-not (Test-Path (Join-Path $quarto $f))) { throw "a deck uses $f, which is not on disk" }
}

# ------------------------------------------------------------ publish ---
$pushedSha = $null
if (-not $VerifyOnly) {
    if (Test-Path $wt) {
        # A clone this script left behind (a run stopped part way) is safe to
        # throw away; anything else at that path is not this script's to delete.
        $gitDir = Join-Path $wt '.git'
        $leftover = (Test-Path $gitDir -PathType Container) -and
            ((& git -C $wt remote get-url origin 2>$null) -eq $origin)
        if (-not $leftover) {
            throw "$wt already exists and is not a clone this script made. Move or delete it, then run again."
        }
        Remove-Item $wt -Recurse -Force
    }

    Step "Downloading gh-pages into $wt"
    Invoke-Git clone --quiet --depth 1 --branch gh-pages --single-branch $origin $wt

    try {
        # Commit as this repo does, not as the global git config says. A fresh
        # clone only sees the global settings, and this repo sets its own
        # email - GitHub's private noreply address. Committing with the global
        # one instead made GitHub refuse the push (GH007: "would publish a
        # private email address").
        foreach ($key in 'user.name', 'user.email') {
            $value = & git -C $repo config $key
            if ($value) { Invoke-Git -C $wt config $key $value.Trim() }
        }

        Step 'Copying'
        foreach ($d in $Decks) {
            Copy-Item (Join-Path $quarto "$d.html") $wt -Force
            # Replace the _files folder outright, so a file a re-render dropped
            # does not linger on the live site.
            $dest = Join-Path $wt "${d}_files"
            if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
            Copy-Item (Join-Path $quarto "${d}_files") $wt -Recurse -Force
            Write-Host "  $d.html, ${d}_files\"
        }

        Copy-Item (Join-Path $quarto 'index.html') $wt -Force
        New-Item -ItemType Directory -Path (Join-Path $wt 'assets') -Force | Out-Null
        Copy-Item (Join-Path $quarto 'assets\*.js') (Join-Path $wt 'assets') -Force
        Copy-Item (Join-Path $quarto 'assets\slides.css') (Join-Path $wt 'assets') -Force
        Write-Host '  index.html, assets\*.js, assets\slides.css'

        foreach ($f in $figs) {
            $dest = Join-Path $wt $f
            New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
            Copy-Item (Join-Path $quarto $f) $dest -Force
        }
        if ($figs.Count) { Write-Host "  $($figs.Count) figure(s) from figs\" }

        # core.safecrlf=false: without it git prints a line-ending warning for
        # every one of the ~120 files, which buries the summary below
        Invoke-Git -C $wt -c core.safecrlf=false add -A
        $changes = @(git -C $wt status --short)
        if ($changes.Count -eq 0) {
            Step 'Nothing to publish - the live site''s branch already has all of this'
            Write-Host '  To check the site is serving it, run again with -VerifyOnly.'
            return
        }

        # Each deck's _files folder is ~120 copies of reveal.js and its fonts,
        # which would bury the lines worth reading - so one summary line each.
        Step "$($changes.Count) file(s) would change on the live site"
        $bundled = $changes | Where-Object { $_ -match '^\S+\s+"?(\w+)_files/' }
        $changes | Where-Object { $_ -notmatch '^\S+\s+"?\w+_files/' } | ForEach-Object { Write-Host "  $_" }
        $bundled | Group-Object { ($_ -replace '^\S+\s+"?', '') -replace '/.*', '' } | ForEach-Object {
            Write-Host "  $($_.Name)/  ($($_.Count) files: reveal.js, MathJax and fonts for the deck)"
        }

        if ($DryRun) {
            Step 'Dry run - stopping before the commit. Nothing was pushed.'
            return
        }

        if (-not $Yes) {
            $answer = Read-Host "`nCommit and push these to the live site? [y/N]"
            if ($answer -notmatch '^(y|yes)$') {
                Step 'Cancelled. Nothing was pushed.'
                return
            }
        }

        $what = if ($Decks.Count) { $Decks -join ', ' } else { 'shared lab files' }
        Invoke-Git -C $wt commit --quiet -m "Publish $what"
        Step 'Pushing to gh-pages'
        Invoke-Git -C $wt push origin gh-pages
        $pushedSha = (& git -C $wt rev-parse HEAD).Trim()
    }
    finally {
        # Just a folder now - no worktree for git to unregister. Git marks its
        # pack files read-only, which -Force deletes anyway.
        Remove-Item $wt -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $wt) { Write-Warning "$wt could not be deleted - delete it by hand; the next run would refuse." }
    }

    if ($NoVerify) {
        Step 'Pushed. Skipped checking the live site (-NoVerify).'
        return
    }
}

# ------------------------------------------------------------- verify ---

# 1. GitHub's build of this push. Pages reports which commit its latest build
#    is of, so this waits for *this* push - not just any finished build.
#    Usually a minute or two, but GitHub's queue has taken 10 minutes and more.
if ($pushedSha -and (Get-Command gh -ErrorAction SilentlyContinue)) {
    Step "Waiting for GitHub Pages to build $($pushedSha.Substring(0, 7))"
    Write-Host '  Usually 1-2 minutes; GitHub''s queue sometimes adds 10 or more. The push is'
    Write-Host '  done either way - stopping here (Ctrl+C) only stops the waiting; check later'
    Write-Host '  with -VerifyOnly.'
    $deadline = (Get-Date).AddMinutes(30)
    $last = ''
    while ($true) {
        $b = $null
        try { $b = & gh api "repos/$slug/pages/builds/latest" 2>$null | ConvertFrom-Json } catch { }
        if ($b -and $b.commit -eq $pushedSha -and $b.status -eq 'built') { break }
        if ($b -and $b.commit -eq $pushedSha -and $b.status -eq 'errored') {
            Write-Warning "GitHub's build of this push failed: $($b.error.message)"
            Write-Warning "See the Actions tab: https://github.com/$slug/actions"
            exit 1
        }
        $state = if (-not $b) { 'no answer from GitHub yet' }
                 elseif ($b.commit -ne $pushedSha) { 'queued behind the previous build' }
                 else { $b.status }
        if ($state -ne $last) { Write-Host "  $(Get-Date -Format HH:mm:ss)  $state"; $last = $state }
        if ((Get-Date) -gt $deadline) {
            Write-Warning "GitHub has not built this push after 30 minutes. See https://github.com/$slug/actions, then run again with -VerifyOnly."
            exit 1
        }
        Start-Sleep -Seconds 20
    }
}

# 2. What the site actually serves. Each text file is fetched with a
#    throwaway query string, past GitHub's 10-minute cache, and compared with
#    the copy in this folder (line endings aside). Figures are only checked to
#    exist. A missing or stale lab module leaves its demo blank with no error.
Step 'Checking the live site serves these files'
$textFiles = @('index.html', 'assets/slides.css') +
    @($Decks | ForEach-Object { "$_.html" }) +
    @(Get-ChildItem (Join-Path $quarto 'assets\*.js') | ForEach-Object { "assets/$($_.Name)" })
$norm = { param($s) ($s -replace "`r", '').TrimEnd() }
$pending = [System.Collections.Generic.List[string]]::new()
($textFiles + $figs) | ForEach-Object { $pending.Add($_) }
# right after a build the site's servers can lag a little; outside that, a
# mismatch means the live file really differs
$deadline = (Get-Date).AddMinutes($(if ($pushedSha) { 5 } else { 1 }))

while ($true) {
    foreach ($p in @($pending)) {
        $url = "$site/$p`?check=$([DateTime]::UtcNow.Ticks)"
        try {
            if ($p -in $figs) {
                $r = Invoke-WebRequest $url -Method Head -UseBasicParsing -TimeoutSec 20
                if ($r.StatusCode -eq 200) { $pending.Remove($p) | Out-Null }
                continue
            }
            $live = (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 20).Content
            if ($live -is [byte[]]) { $live = [Text.Encoding]::UTF8.GetString($live) }
            $local = Get-Content -Raw -LiteralPath (Join-Path $quarto ($p -replace '/', '\'))
            if ((& $norm $live) -eq (& $norm $local)) { $pending.Remove($p) | Out-Null }
        } catch { }   # a 404 just leaves it pending
    }
    if (-not $pending.Count -or (Get-Date) -gt $deadline) { break }
    Write-Host "  waiting on $($pending.Count): $(($pending | Select-Object -First 4) -join ', ')$(if ($pending.Count -gt 4) { ', ...' })"
    Start-Sleep -Seconds 15
}

if ($pending.Count) {
    Write-Warning "The live site does not match this folder for:`n  $($pending -join "`n  ")"
    if ($pushedSha) {
        Write-Warning 'GitHub built the push, so this is unexpected - check one of these URLs in a browser.'
    } else {
        Write-Warning 'Either GitHub has not finished building the last push (see the Actions tab), or these changed here since it was published - publish them.'
    }
    exit 1
}

Step 'Live. The site serves the same files as this folder.'
foreach ($d in $Decks) { Write-Host "  $site/$d.html" }
Write-Host ''
Write-Host '  Open each deck and drag a slider or click a lab button - a page that loads is'
Write-Host '  not yet proof the demos run. Your browser may hold old copies for up to 10'
Write-Host '  minutes; if something looks stale, hard reload with Ctrl+Shift+R.'
