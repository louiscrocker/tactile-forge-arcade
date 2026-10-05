# =====================================================
# Tactile Forge Arcade · audit
#   pwsh tools/audit.ps1
# Compares the live site with every game repo, flags new or unpublished game
# folders, uncommitted/unpushed work, checks the live pages load clean, and
# reports feedback issues and Cabinet Edition download counts.
# =====================================================
$ErrorActionPreference = 'Continue'
$Base = 'https://louiscrocker.github.io/tactile-forge-arcade/'
$Repo = 'louiscrocker/tactile-forge-arcade'
$GH   = 'C:\Program Files\GitHub CLI\gh.exe'
$Dev  = 'C:\Development'

# slug -> source folder (browser builds)
$web = [ordered]@{
  'last-silo'='MISSILE_ATTACK'; 'soft-touchdown'='LUNAR_LANDER'; 'rubble-drift'='ASTEROIDS'; 'periscope-front'='TANK_BATTLE';
  'lightwake'='TRON'; 'trenchfire'='TRENCHFIRE_GO'; 'close-hauled'='YACHT_RACE'; 'frog-pond'='FROG_POND';
  'ladybug-life'='LADYBUG'; 'monarch-journey'='MONARCH_JOURNEY'; 'alicorn-skies'='ALICORN';
  'burrow-and-brood'='ANT_KINGDOM'; 'hercules'='HERCULES'; 'storm-lab'='TORNADO'
}
# slug -> Go source folder (Cabinet Editions)
$cab = [ordered]@{
  'last-silo'='MISSILE_ATTACK_GO'; 'soft-touchdown'='LUNAR_LANDER_GO'; 'rubble-drift'='ASTEROIDS_GO';
  'periscope-front'='TANK_BATTLE_GO'; 'lightwake'='TRON_GO'; 'trenchfire'='TRENCHFIRE_GO'
}
$notGames = 'FORGEKIT','VECTORFX','ONLINE','ARCADE'
$heldBack = @{ 'POKEMON'='Nintendo characters — never public'; 'POKEMON_GO'='Nintendo characters — never public'; 'WAR_GAMES'='terminal app'; 'WAR_GAMES_GO'='terminal app'; 'TRENCH_RUN'='Star Wars theme — replaced by Trenchfire' }

function Repo-State($path) {
  $s = [ordered]@{ head = (git -C $path rev-parse --short HEAD 2>$null); branch = (git -C $path rev-parse --abbrev-ref HEAD 2>$null) }
  $s.dirty = @(git -C $path status --porcelain 2>$null | Where-Object { $_ -notmatch '^\?\? shots/' }).Count
  $s.remote = [bool](git -C $path remote 2>$null)
  $s.ahead = 0
  if ($s.remote) { git -C $path fetch -q 2>$null; $s.ahead = [int](git -C $path rev-list --count '@{u}..HEAD' 2>$null) }
  $s
}

"=== 1. Browser games: live build vs repo"
$problems = @()
foreach ($slug in $web.Keys) {
  $path = Join-Path $Dev "TACTILE_FORGE_$($web[$slug])"
  $st = Repo-State $path
  try { $live = (Invoke-RestMethod "$Base$slug/build.json" -TimeoutSec 20).commit } catch { $live = $null }
  $verdict = if (-not $live) { 'NOT LIVE' }
    elseif ((git -C $path rev-parse $live 2>$null) -eq (git -C $path rev-parse HEAD)) { 'current' }
    else { "BEHIND ($(git -C $path rev-list --count "$live..HEAD") commit(s))" }
  $flags = @(); if ($st.dirty) { $flags += "$($st.dirty) uncommitted" }; if ($st.ahead) { $flags += "$($st.ahead) unpushed" }
  if ($verdict -ne 'current') { $problems += "$slug $verdict" }
  '{0,-17} live={1,-8} repo={2,-8} {3,-12} {4}' -f $slug, $live, $st.head, $verdict, ($flags -join ', ')
}

"`n=== 2. Cabinet Editions: latest release vs Go repo"
$rel = & $GH release view -R $Repo --json tagName,assets | ConvertFrom-Json
foreach ($slug in $cab.Keys) {
  $path = Join-Path $Dev "TACTILE_FORGE_$($cab[$slug])"
  $notes = (& $GH release view $rel.tagName -R $Repo --json body --jq .body)
  $assets = @($rel.assets | Where-Object { $_.name -like "$slug-*.zip" })
  $dl = ($assets | Measure-Object downloadCount -Sum).Sum
  $st = Repo-State $path
  '{0,-17} {1} assets in {2}, downloads={3}, go repo={4}{5}' -f $slug, $assets.Count, $rel.tagName, $dl, $st.head, $(if ($st.dirty) { " ($($st.dirty) uncommitted)" } else { '' })
}

"`n=== 3. Game folders not on the site"
Get-ChildItem $Dev -Directory -Filter 'TACTILE_FORGE_*' | ForEach-Object {
  $k = $_.Name -replace '^TACTILE_FORGE_',''
  if ($notGames -contains $k) { return }
  if ($web.Values -contains $k -or $cab.Values -contains $k) { return }
  $why = if ($heldBack.ContainsKey($k)) { "held back: $($heldBack[$k])" } else { 'NEW — not published, needs review' }
  if ($why -like 'NEW*') { $problems += "$($_.Name) unpublished" }
  '{0,-34} {1}' -f $_.Name, $why
}

"`n=== 4. Live pages load clean (probe)"
$probe = Join-Path $PSScriptRoot 'probe.mjs'
foreach ($u in @('', 'downloads/') + @($web.Keys | ForEach-Object { "$_/" })) {
  $o = node $probe "$Base$u" 'wait:4000' 2>&1 | Out-String; $code = $LASTEXITCODE
  try { $j = $o | ConvertFrom-Json } catch { $j = $null }
  if ($code -ne 0 -or -not $j) { $problems += "/$u probe exit $code" }
  '{0,-20} exit={1} failed={2} third-party={3} errors={4}' -f "/$u", $code, $j.failed.Count, $j.thirdParty.Count, $j.errors.Count
}

"`n=== 5. Feedback"
$issues = & $GH issue list -R $Repo --label feedback --state open --json number,title,createdAt | ConvertFrom-Json
if ($issues.Count) { $issues | ForEach-Object { '#{0} {1} ({2})' -f $_.number, $_.title, $_.createdAt } } else { 'no open feedback issues' }

"`n=== Summary"
if ($problems.Count) { $problems | ForEach-Object { "• $_" } } else { 'Everything live is current and loads clean.' }
