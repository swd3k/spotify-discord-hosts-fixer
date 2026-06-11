import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, RefreshCw, Sun, Moon, Info, Play, CheckCircle, XCircle, Github, ExternalLink, Settings2, ShieldCheck, Power, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IPList } from "./components/IPList";
import logoUrl from "./assets/logo.png?inline";
import { HostsBlockPreview } from "./components/HostsBlockPreview";
import { TerminalLogs } from "./components/TerminalLogs";
import { IpRecord, ToastMessage, DomainMode, ActiveBlock } from "./types";
import { pickBestIp } from "../shared/hostsBlock";

const CONSENT_KEY = "spf_consent_v1";

export default function App() {
  const [ips, setIps] = useState<IpRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [hostsActive, setHostsActive] = useState(false);
  const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  // "minimal" — без доменов авторизации (accounts/login5): логин не идёт через прокси.
  const [mode, setMode] = useState<DomainMode>(() =>
    localStorage.getItem("spf_mode") === "minimal" ? "minimal" : "full",
  );
  const [autostart, setAutostart] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("spf_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [logs, setLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Чтобы предупреждение «узел отвалился» не сыпалось каждые 90 секунд.
  const warnedDownRef = useRef(false);

  const showToast = (message: string, type: ToastMessage["type"] = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const addLog = (message: string, level: "info" | "success" | "warn" | "error" = "info") => {
    const prefix = { info: "💡", success: "✅", warn: "⚠️", error: "❌" }[level];
    const logLine = `${prefix} [${new Date().toLocaleTimeString()}] ${message}`;
    setLogs((prev) => [...prev, logLine]);
  };

  // Применение темы (вариант dark: в Tailwind v4 завязан на класс .dark — см. index.css)
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("spf_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("spf_mode", mode);
  }, [mode]);

  useEffect(() => {
    addLog("[SYSTEM] Spotify Discord Hosts Fixer запущен.", "info");
    refreshStatus();
    fetchIps();
    window.api.getAutostart().then(setAutostart).catch(() => {});
  }, []);

  // Периодическая перепроверка активного узла: если он отвалился — предупреждаем.
  useEffect(() => {
    if (!hostsActive) {
      warnedDownRef.current = false;
      return;
    }
    const check = async () => {
      try {
        const block = await window.api.getActiveBlock();
        if (!block?.ip) return;
        const latency = await window.api.pingIp(block.ip);
        if (latency === null) {
          if (!warnedDownRef.current) {
            warnedDownRef.current = true;
            addLog(`[MONITOR] Активный узел ${block.ip} перестал отвечать. Обновите список и примените заново.`, "warn");
            showToast(`Узел ${block.ip} не отвечает — выберите другой`, "warning");
          }
        } else {
          if (warnedDownRef.current) {
            addLog(`[MONITOR] Узел ${block.ip} снова в сети (${latency} мс).`, "success");
          }
          warnedDownRef.current = false;
        }
      } catch {
        // Сетевые сбои проверки не считаем поводом для предупреждения.
      }
    };
    const id = setInterval(check, 90_000);
    return () => clearInterval(id);
  }, [hostsActive]);

  const refreshStatus = async () => {
    const active = await window.api.getStatus();
    if (active === null) {
      addLog("[SYSTEM] Не удалось прочитать файл hosts (статус неизвестен).", "warn");
      return;
    }
    setHostsActive(active);
    setActiveBlock(active ? await window.api.getActiveBlock() : null);
    addLog(
      active
        ? "[SYSTEM] Обнаружен активный блок #spotify-discord-hosts."
        : "[SYSTEM] Блок перенаправлений не найден. Стандартный DNS.",
      active ? "success" : "info",
    );
  };

  const fetchIps = async () => {
    setIsLoading(true);
    addLog("[API] Резолвлю geohide.ru и проверяю доступность узлов...", "info");
    try {
      const result = await window.api.getIps();
      setIps(result);
      const upCount = result.filter((ip) => ip.status === "Up").length;
      addLog(`[API] Получено IP: всего ${result.length}, в сети ${upCount}.`, "success");
      showToast(`Список обновлён: ${upCount} активных IP`, "success");
    } catch (e: any) {
      addLog(`[API ERROR] ${e?.message || "Не удалось получить IP."}`, "error");
      showToast("Не удалось получить список IP.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFix = () => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setConsentOpen(true);
      return;
    }
    void doApply();
  };

  const doApply = async () => {
    setIsApplying(true);
    addLog("[SYSTEM] Запрос прав администратора для изменения hosts...", "info");
    // Применяется один лучший узел (с наименьшей задержкой) — система
    // всё равно использует только первую запись hosts для домена.
    const best = pickBestIp(ips);
    try {
      const res = await window.api.apply(best ? [best] : [], mode);
      if (res.success) {
        setHostsActive(true);
        setActiveBlock(await window.api.getActiveBlock());
        warnedDownRef.current = false;
        addLog(`[SUCCESS] ${res.message}`, "success");
        showToast("Файл hosts успешно обновлён!", "success");
      } else {
        addLog(`[ERROR] ${res.message}`, "error");
        showToast(res.message, "error");
      }
    } catch (e: any) {
      addLog(`[ERROR] ${e?.message || "Ошибка при изменении hosts."}`, "error");
      showToast("Ошибка при изменении hosts.", "error");
    } finally {
      setIsApplying(false);
    }
  };

  const handleConsentAccept = () => {
    localStorage.setItem(CONSENT_KEY, "1");
    setConsentOpen(false);
    void doApply();
  };

  const handleRemoveFix = async () => {
    setIsRemoving(true);
    addLog("[SYSTEM] Запрос прав администратора для очистки hosts...", "info");
    try {
      const res = await window.api.remove();
      if (res.success) {
        setHostsActive(false);
        setActiveBlock(null);
        addLog(`[SUCCESS] ${res.message}`, "success");
        showToast("Записи hosts удалены", "info");
      } else {
        addLog(`[ERROR] ${res.message}`, "error");
        showToast(res.message, "error");
      }
    } catch (e: any) {
      addLog(`[ERROR] ${e?.message || "Ошибка при очистке hosts."}`, "error");
      showToast("Ошибка при очистке hosts.", "error");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleAutostartToggle = async () => {
    try {
      const enabled = await window.api.setAutostart(!autostart);
      setAutostart(enabled);
      addLog(`[SYSTEM] Автозапуск ${enabled ? "включён (свёрнуто в трей)" : "выключен"}.`, "info");
    } catch {
      showToast("Не удалось изменить автозапуск.", "error");
    }
  };

  const upCount = ips.filter((ip) => ip.status === "Up").length;

  return (
    <div className="min-h-screen bg-white/60 dark:bg-[#0c0c0c]/55 backdrop-blur-sm text-neutral-850 dark:text-neutral-100 flex flex-col items-center justify-center p-4 select-none selection:bg-[#1ED760]/30 selection:text-[#19B850] transition-all duration-300 relative overflow-x-hidden">
      <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-[#1DB954]/5 to-transparent pointer-events-none blur-3xl rounded-full opacity-60 dark:opacity-30"></div>

      <main className="w-full max-w-lg bg-white dark:bg-[#1c1b1f] rounded-[28px] border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden relative z-10 duration-250">
        <div className="px-6 py-4 border-b border-neutral-150 dark:border-white/5 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Spotify Discord Fixer" className="w-9 h-9 rounded-lg shadow-md shadow-[#1DB954]/20" />

            <div>
              <h1 className="text-sm font-bold tracking-tight text-neutral-800 dark:text-[#e6e1e5]">Spotify Discord Fixer</h1>
              <p className="text-[10px] font-mono text-neutral-450 dark:text-[#938f99] font-medium">v{__APP_VERSION__} • GeoHide Linker</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href="https://github.com/swd3k/spotify-discord-hosts-fixer"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-all text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              title="Открыть страницу проекта на GitHub"
            >
              <Github size={14} />
            </a>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-all text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              title="Переключить тему"
            >
              {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="p-5 rounded-[20px] border transition-all duration-300 flex items-center gap-4 shadow-md bg-[#333333] dark:bg-[#2a292d] border-white/10 text-white">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${hostsActive ? "bg-[#1DB954] shadow-[0_0_12px_#1DB954]" : "bg-[#febc2e] shadow-[0_0_12px_#febc2e]"}`}></div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  {hostsActive ? "Перенаправления активны" : "Перенаправления не активны"}
                </h2>
                {hostsActive && (
                  <span className="text-[10px] text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-md font-mono self-start">Активно</span>
                )}
              </div>
              <p className="text-xs text-neutral-300/90 leading-relaxed font-medium">
                {hostsActive
                  ? activeBlock?.ip
                    ? `Hosts перенаправляет ${activeBlock.domains.length} доменов на узел ${activeBlock.ip}`
                    : "Hosts настроен через прокси-узел GeoHide"
                  : "Запросы к Spotify идут через стандартный DNS. Примените перенаправления, чтобы восстановить синхронизацию презенса в Discord."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleApplyFix}
              disabled={isApplying || isRemoving || upCount === 0}
              className="h-[48px] bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-neutral-200 dark:disabled:bg-[#333333] text-[#003912] font-semibold rounded-full transition-all duration-200 shadow-md flex items-center justify-center gap-2 text-sm disabled:text-neutral-500 cursor-pointer active:scale-[0.98]"
            >
              {isApplying ? (
                <>
                  <RefreshCw size={15} className="animate-spin text-[#003912]" />
                  Применяю...
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  Обновить и применить
                </>
              )}
            </button>
            <button
              onClick={handleRemoveFix}
              disabled={isApplying || isRemoving || !hostsActive}
              className="h-[48px] border border-neutral-300 dark:border-[#49454f] bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-[#1DB954] disabled:opacity-30 disabled:pointer-events-none font-semibold rounded-full transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              {isRemoving ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Сбросить hosts
            </button>
          </div>

          <div className="bg-neutral-50 dark:bg-[#1c1b1f] border border-neutral-200/80 dark:border-white/10 rounded-[24px] p-5 transition-all duration-300 shadow-md">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-500 dark:text-[#938f99] flex items-center gap-2 mb-4 border-b border-neutral-150 dark:border-white/5 pb-2.5">
              <Settings2 size={14} className="text-[#1DB954]" />
              Настройки
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ShieldCheck size={15} className="text-[#1DB954] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-[#e6e1e5]">Минимальный режим</p>
                    <p className="text-[10px] text-neutral-450 dark:text-[#938f99] leading-relaxed">
                      Не перенаправлять домены авторизации (accounts, login5) — логин в Spotify не пойдёт через прокси.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMode(mode === "minimal" ? "full" : "minimal")}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${mode === "minimal" ? "bg-[#1DB954]" : "bg-neutral-300 dark:bg-neutral-700"}`}
                  title="Переключить минимальный режим"
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${mode === "minimal" ? "translate-x-4" : ""}`} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Power size={15} className="text-[#1DB954] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-[#e6e1e5]">Запускать вместе с Windows</p>
                    <p className="text-[10px] text-neutral-450 dark:text-[#938f99] leading-relaxed">
                      Программа стартует свёрнутой в трей при входе в систему.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAutostartToggle}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${autostart ? "bg-[#1DB954]" : "bg-neutral-300 dark:bg-neutral-700"}`}
                  title="Переключить автозапуск"
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autostart ? "translate-x-4" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          <IPList ips={ips} isLoading={isLoading} onRefresh={fetchIps} />
          <HostsBlockPreview activeIps={ips} mode={mode} hostsActive={hostsActive} addLog={addLog} showToast={showToast} />
          <TerminalLogs logs={logs} onClear={() => setLogs([])} />

          <div className="p-5 bg-neutral-50 dark:bg-black/25 rounded-[20px] border border-neutral-200/60 dark:border-white/5 text-[11px] text-neutral-500 dark:text-[#938f99] space-y-2">
            <span className="font-bold flex items-center gap-1.5 text-neutral-700 dark:text-[#e6e1e5] mb-0.5">
              <Info size={12} className="text-[#1DB954]" />
              Как это работает и что важно понимать
            </span>
            <p className="leading-relaxed">
              Программа добавляет в системный файл hosts строки, которые направляют домены Spotify на прокси-узлы GeoHide. Изменения вносятся с правами администратора (появится запрос UAC), исходный hosts сохраняется в резервную копию, а блок можно удалить кнопкой «Сбросить hosts».
            </p>
            <p className="leading-relaxed">
              Учтите: весь трафик указанных доменов Spotify, включая авторизацию, будет идти через серверы GeoHide — это сторонний сервис, и доверие к нему остаётся на ваше усмотрение. Включите «Минимальный режим», чтобы исключить домены авторизации. Проект неофициальный и не связан со Spotify, Discord или GeoHide.
            </p>
            <a
              href="https://github.com/swd3k/spotify-discord-hosts-fixer"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[#1DB954] hover:text-[#1ed760] font-semibold transition-colors mt-1"
            >
              <Github size={12} />
              Помощь и исходный код на GitHub
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        <div className="px-6 py-4.5 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-[#171719]/40 text-[10px] text-neutral-400 dark:text-[#938f99] font-mono text-center flex items-center justify-between">
          <span>Неофициальный инструмент с открытым кодом</span>
          <span>Используйте на свой риск</span>
        </div>
      </main>

      {/* Портал в body: у корневого контейнера есть backdrop-filter, из-за которого
          position:fixed считался бы от всей прокручиваемой страницы, а не от окна. */}
      {createPortal(
      <AnimatePresence>
        {consentOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-[#1c1b1f] rounded-[24px] border border-neutral-200 dark:border-white/10 shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                <h2 className="text-sm font-bold text-neutral-800 dark:text-[#e6e1e5]">Что сейчас произойдёт</h2>
              </div>
              <div className="text-xs text-neutral-600 dark:text-[#cac5cd] leading-relaxed space-y-2">
                <p>
                  Программа изменит системный файл hosts: домены Spotify будут направлены на прокси-узлы GeoHide — сторонний сервис, которому вы должны доверять. Потребуются права администратора (запрос UAC).
                </p>
                <p>
                  Перед изменением создаётся резервная копия hosts, и всё полностью обратимо кнопкой «Сбросить hosts».
                </p>
                <p>
                  {mode === "minimal"
                    ? "Включён минимальный режим: домены авторизации (accounts, login5) затронуты не будут."
                    : "Будут перенаправлены в том числе домены авторизации (accounts.spotify.com, login5.spotify.com). Включите «Минимальный режим» в настройках, чтобы их исключить."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setConsentOpen(false)}
                  className="h-[42px] border border-neutral-300 dark:border-[#49454f] bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-neutral-600 dark:text-[#cac5cd] font-semibold rounded-full transition-all duration-200 text-sm cursor-pointer active:scale-[0.98]"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConsentAccept}
                  className="h-[42px] bg-[#1DB954] hover:bg-[#1ed760] text-[#003912] font-semibold rounded-full transition-all duration-200 shadow-md text-sm cursor-pointer active:scale-[0.98]"
                >
                  Понимаю, применить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}

      {/* Тосты — тоже через портал, иначе «прилипают» к низу прокручиваемой страницы. */}
      {createPortal(
      <div className="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              layout
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.15 } }}
              className="pointer-events-auto w-full p-4 rounded-2xl border shadow-xl bg-white dark:bg-[#1c1b1f] border-neutral-200 dark:border-white/10 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                {toast.type === "success" ? (
                  <CheckCircle className="text-[#1DB954] flex-shrink-0" size={16} />
                ) : toast.type === "error" ? (
                  <XCircle className="text-rose-500 flex-shrink-0" size={16} />
                ) : toast.type === "warning" ? (
                  <AlertTriangle className="text-amber-500 flex-shrink-0" size={16} />
                ) : (
                  <Info className="text-sky-500 flex-shrink-0" size={16} />
                )}
                <span className="text-neutral-800 dark:text-[#e6e1e5] font-semibold">{toast.message}</span>
              </div>
              <button onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-[#e6e1e5] p-1 cursor-pointer">
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>,
      document.body)}
    </div>
  );
}
