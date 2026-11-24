// Everything that differs between macOS, Windows and Linux.
import { execFile } from 'node:child_process';
import path from 'node:path';

const exec = (cmd, args, opts) => new Promise((res) => { try { execFile(cmd, args, { timeout: 4000, maxBuffer: 8e6, windowsHide: true, ...opts }, (err, out) => res(err ? '' : String(out))); } catch { res(''); } });
const POWERSHELL = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
const LSTART = /^[A-Z][a-z]{2} [A-Z][a-z]{2} +\d+ [\d:]{8} \d{4}$/;

/** Whether a process exists. No signal is sent; "not allowed to" means it exists. */
export function exists(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

/** "pid  Sat Nov 21 10:00:00 2026" lines from ps, in UTC. */
export function parsePs(out) {
  const map = new Map();
  for (const line of out.split('\n')) { const m = line.trim().match(/^(\d+)\s+(.+)$/); if (m) map.set(+m[1], Date.parse(m[2].replace(/\s+/g, ' ') + ' UTC')); }
  return map;
}
/** "pid 2026-11-21T10:00:00.0000000Z" lines from PowerShell. A process that hides its start time has none. */
export function parseWindows(out) {
  const map = new Map();
  for (const line of out.split(/\r?\n/)) { const m = line.trim().match(/^(\d+)(?:\s+(\S+))?$/); if (m) map.set(+m[1], m[2] ? Date.parse(m[2]) : NaN); }
  return map;
}

let win = { at: 0, map: new Map(), busy: null };
async function windowsStarts(now = Date.now()) { // PowerShell takes a second to start, so start times are asked for rarely and in the background
  if (now - win.at > 20_000 && !win.busy) win.busy = exec(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.ProcessId) $(if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') })\" }"], { timeout: 15_000 })
    .then((out) => { win = { at: Date.now(), map: out ? parseWindows(out) : win.map, busy: null }; });
  return win.map;
}

/** pid -> process start (ms, or NaN when unknown) for the running processes; `pids` are the ones that matter. */
export async function liveProcesses(pids = [], platform = process.platform) {
  if (platform === 'win32') { const starts = await windowsStarts(); return new Map(pids.filter((p) => Number.isInteger(p) && p > 0 && exists(p)).map((p) => [p, starts.get(p) ?? NaN])); }
  const map = parsePs(await exec(platform === 'darwin' ? '/bin/ps' : 'ps', ['-axo', 'pid=,lstart='], { env: { PATH: '/usr/bin:/bin', TZ: 'UTC', LC_ALL: 'C' } }));
  if (!map.size) for (const p of pids) if (Number.isInteger(p) && p > 0 && exists(p)) map.set(p, NaN); // a minimal Linux without a full ps
  return map;
}

/** Whether a session record belongs to the process that now has its pid, or to one that ended and whose number was reused. */
export function sameProcess(session, started) {
  if (!Number.isFinite(started)) return true;
  if (LSTART.test(String(session.procStart ?? '').trim())) return Math.abs(Date.parse(session.procStart + ' UTC') - started) <= 5000;
  const seen = Math.max(session.updatedAt ?? 0, session.statusUpdatedAt ?? 0, session.startedAt ?? 0); // another format of start time: a process born after the record was last written is not its owner
  return !seen || started <= seen + 60_000;
}

/** ids of Chums whose launchd service currently has a pid (macOS only). */
export async function liveServices(platform = process.platform) {
  if (platform !== 'darwin') return new Set();
  return new Set([...(await exec('/bin/launchctl', ['list'])).matchAll(/^\d+\t\S+\tdev\.chums\.agent\.(\S+)$/gm)].map((m) => m[1]));
}

const TOAST = `[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]; [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$e = { param($s) [System.Security.SecurityElement]::Escape($s) }; $x = New-Object Windows.Data.Xml.Dom.XmlDocument
$x.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$(& $e $env:OFFICE_TITLE)</text><text>$(& $e $env:OFFICE_BODY)</text></binding></visual></toast>")
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show((New-Object Windows.UI.Notifications.ToastNotification $x))`;
/** The command that shows a notification. The text travels as arguments or environment, never as script source. */
export function notifyCommand(title, body, platform = process.platform) {
  const clean = (s) => String(s).replace(/[\u0000-\u001f]/g, ' ').slice(0, 240); title = clean(title); body = clean(body);
  if (platform === 'darwin') return ['/usr/bin/osascript', ['-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"', '-e', 'end run', '--', title, body], {}];
  if (platform === 'win32') return [POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', TOAST], { env: { ...process.env, OFFICE_TITLE: title, OFFICE_BODY: body }, timeout: 15_000 }];
  return ['notify-send', ['--app-name=Agentloft', '--', title, body], {}];
}
export function notify(title, body) { exec(...notifyCommand(title, body)); }
