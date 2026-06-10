import { promises as dns } from "node:dns";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import sudo from "sudo-prompt";

export const START_MARKER = "#spotify-discord-hosts";
export const END_MARKER = "#end-spotify-discord-hosts";

// Домены Spotify, которые перенаправляются на прокси-узлы GeoHide.
export const SPOTIFY_DOMAINS = [
  "api.spotify.com",
  "login5.spotify.com",
  "encore.scdn.co",
  "gew1-spclient.spotify.com",
  "spclient.wg.spotify.com",
  "api-partner.spotify.com",
  "aet.spotify.com",
  "www.spotify.com",
  "accounts.spotify.com",
  "open.spotify.com",
  "accounts.scdn.co",
  "gew1-dealer.spotify.com",
  "open-exp.spotifycdn.com",
  "www-growth.scdn.co",
];

// Резервные адреса на случай, если резолв geohide.ru не сработал.
const FALLBACK_IPS = ["37.230.192.51", "45.155.204.190", "185.162.248.51"];

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function hostsPath(): string {
  if (process.platform === "win32") {
    return path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts");
  }
  return "/etc/hosts";
}

// Простая TCP-проверка доступности узла на :443 с замером задержки.
function tcpPing(ip: string, port = 443, timeout = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok ? Date.now() - start : null);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, ip);
  });
}

export interface IpRecord {
  ip: string;
  status: "Up" | "Down";
  provider: string;
  latency?: number;
}

// Получаем список IP: резолвим geohide.ru, добавляем резерв, дедуплицируем, проверяем доступность.
export async function getIps(): Promise<IpRecord[]> {
  let resolved: string[] = [];
  try {
    resolved = await dns.resolve4("geohide.ru");
  } catch {
    resolved = [];
  }

  const all = Array.from(new Set([...resolved, ...FALLBACK_IPS])).filter((ip) => IPV4_RE.test(ip));

  const records = await Promise.all(
    all.map(async (ip): Promise<IpRecord> => {
      const latency = await tcpPing(ip);
      return {
        ip,
        status: latency !== null ? "Up" : "Down",
        provider: resolved.includes(ip) ? "GeoHide (geohide.ru)" : "GeoHide (резерв)",
        latency: latency ?? undefined,
      };
    }),
  );

  // Доступные узлы — вперёд.
  records.sort((a, b) => (a.status === b.status ? 0 : a.status === "Up" ? -1 : 1));
  return records;
}

export function buildBlock(ips: string[]): string {
  const valid = ips.filter((ip) => IPV4_RE.test(ip));
  const lines = [START_MARKER];
  for (const ip of valid) {
    for (const domain of SPOTIFY_DOMAINS) {
      lines.push(`${ip} ${domain}`);
    }
  }
  lines.push(END_MARKER);
  return lines.join("\n");
}

// Статус читаем без повышения прав (hosts обычно доступен на чтение).
export async function getStatus(): Promise<boolean | null> {
  try {
    const content = await fsp.readFile(hostsPath(), "utf-8");
    return content.includes(START_MARKER);
  } catch {
    return null;
  }
}

const WIN_SCRIPT = `param([string]$Action, [string]$BlockFile)
$ErrorActionPreference = "Stop"
$hostsPath = Join-Path $env:SystemRoot "System32\\drivers\\etc\\hosts"
$startMarker = "${START_MARKER}"
$endMarker = "${END_MARKER}"

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item -LiteralPath $hostsPath -Destination "$hostsPath.backup.$ts" -Force

$lines = @()
if (Test-Path -LiteralPath $hostsPath) { $lines = Get-Content -LiteralPath $hostsPath }
$out = New-Object System.Collections.Generic.List[string]
$skip = $false
foreach ($line in $lines) {
  if ($line -like "*$startMarker*") { $skip = $true; continue }
  if ($line -like "*$endMarker*") { $skip = $false; continue }
  if (-not $skip) { $out.Add($line) }
}
if ($Action -eq "apply") {
  $block = Get-Content -LiteralPath $BlockFile -Raw
  $out.Add("")
  $out.Add($block.TrimEnd())
}
Set-Content -LiteralPath $hostsPath -Value $out -Encoding ASCII
try { ipconfig /flushdns | Out-Null } catch {}
Write-Output "OK"
`;

const UNIX_SCRIPT = `#!/bin/bash
set -e
ACTION="$1"
BLOCK_FILE="$2"
HOSTS="/etc/hosts"
TS=$(date +%Y%m%d_%H%M%S)
cp "$HOSTS" "$HOSTS.backup.$TS"
TMP=$(mktemp)
awk '/${START_MARKER}/{skip=1;next} /${END_MARKER}/{skip=0;next} !skip{print}' "$HOSTS" > "$TMP"
if [ "$ACTION" = "apply" ]; then
  echo "" >> "$TMP"
  cat "$BLOCK_FILE" >> "$TMP"
fi
cp "$TMP" "$HOSTS"
chmod 644 "$HOSTS"
rm -f "$TMP"
( dscacheutil -flushcache 2>/dev/null; killall -HUP mDNSResponder 2>/dev/null ) || true
echo "OK"
`;

function runElevated(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sudo.exec(command, { name: "Spotify Discord Hosts Fixer" }, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(String(stdout || stderr || ""));
    });
  });
}

async function runHostsAction(action: "apply" | "remove", ips: string[] = []): Promise<void> {
  const tmp = os.tmpdir();
  const isWin = process.platform === "win32";
  const scriptPath = path.join(tmp, isWin ? "spf_hosts.ps1" : "spf_hosts.sh");
  const blockPath = path.join(tmp, "spf_block.txt");

  fs.writeFileSync(scriptPath, isWin ? WIN_SCRIPT : UNIX_SCRIPT, "utf-8");
  if (action === "apply") {
    fs.writeFileSync(blockPath, buildBlock(ips), "utf-8");
  }

  let command: string;
  if (isWin) {
    command =
      `powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${scriptPath}" -Action ${action}` +
      (action === "apply" ? ` -BlockFile "${blockPath}"` : "");
  } else {
    command = `/bin/bash "${scriptPath}" ${action} "${action === "apply" ? blockPath : ""}"`;
  }

  await runElevated(command);
}

export async function applyHosts(ips: string[]): Promise<{ success: boolean; message: string }> {
  const valid = ips.filter((ip) => IPV4_RE.test(ip));
  if (valid.length === 0) {
    return { success: false, message: "Нет валидных IP для применения." };
  }
  try {
    await runHostsAction("apply", valid);
    return {
      success: true,
      message: `Применено: ${valid.length} IP × ${SPOTIFY_DOMAINS.length} доменов. Перезапустите Discord и Spotify.`,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Не удалось изменить hosts (отменено или нет прав)." };
  }
}

export async function removeHosts(): Promise<{ success: boolean; message: string }> {
  try {
    await runHostsAction("remove");
    return { success: true, message: "Блок #spotify-discord-hosts удалён. Восстановлен стандартный DNS." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Не удалось очистить hosts (отменено или нет прав)." };
  }
}
