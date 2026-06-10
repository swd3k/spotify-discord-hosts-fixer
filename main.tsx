import React, { useState, useEffect } from "react";
import { Trash2, RefreshCw, Sun, Moon, Info, Play, CheckCircle, XCircle, Github, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IPList } from "./components/IPList";
import { HostsBlockPreview } from "./components/HostsBlockPreview";
import { TerminalLogs } from "./components/TerminalLogs";
import { IpRecord, ToastMessage } from "./types";

export default function App() {
  const [ips, setIps] = useState<IpRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [hostsActive, setHostsActive] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("spf_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [logs, setLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
    addLog("[SYSTEM] Spotify Discord Hosts Fixer запущен.", "info");
    refreshStatus();
    fetchIps();
  }, []);

  const refreshStatus = async () => {
    const active = await window.api.getStatus();
    if (active === null) {
      addLog("[SYSTEM] Не удалось прочитать файл hosts (статус неизвестен).", "warn");
      return;
    }
    setHostsActive(active);
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

  const handleApplyFix = async () => {
    setIsApplying(true);
    addLog("[SYSTEM] Запрос прав администратора для изменения hosts...", "info");
    const activeIps = ips.filter((ip) => ip.status === "Up").map((ip) => ip.ip);
    try {
      const res = await window.api.apply(activeIps);
      if (res.success) {
        setHostsActive(true);
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

  const handleRemoveFix = async () => {
    setIsRemoving(true);
    addLog("[SYSTEM] Запрос прав администратора для очистки hosts...", "info");
    try {
      const res = await window.api.remove();
      if (res.success) {
        setHostsActive(false);
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

  const upCount = ips.filter((ip) => ip.status === "Up").length;

  return (
    <div className="min-h-screen bg-white/60 dark:bg-[#0c0c0c]/55 backdrop-blur-sm text-neutral-850 dark:text-neutral-100 flex flex-col items-center justify-center p-4 select-none selection:bg-[#1ED760]/30 selection:text-[#19B850] transition-all duration-300 relative overflow-x-hidden">
      <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-[#1DB954]/5 to-transparent pointer-events-none blur-3xl rounded-full opacity-60 dark:opacity-30"></div>

      <main className="w-full max-w-lg bg-white dark:bg-[#1c1b1f] rounded-[28px] border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden relative z-10 duration-250">
        <div className="px-6 py-4 border-b border-neutral-150 dark:border-white/5 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1DB954] flex items-center justify-center shadow-md shadow-[#1DB954]/20 text-[#003912] font-bold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.49 17.306c-.215.353-.675.465-1.028.25-2.858-1.747-6.455-2.142-10.693-1.173-.404.092-.813-.16-.906-.565-.092-.403.16-.813.565-.905 4.63-1.058 8.604-.6 11.808 1.358.353.215.465.675.25 1.028zm1.467-3.264c-.27.44-.846.58-1.287.31-3.27-2.01-8.254-2.592-12.12-1.417-.497.15-1.022-.13-1.173-.627-.15-.497.13-1.022.626-1.173 4.414-1.34 9.904-.68 13.642 1.614.44.27.58.847.31 1.288zm.126-3.41c-3.92-2.328-10.375-2.544-14.133-1.403-.6.182-1.24-.162-1.422-.763-.182-.6.162-1.24.763-1.422 4.312-1.308 11.434-1.055 15.962 1.63.54.32.716 1.014.396 1.554-.32.54-1.013.717-1.554.397z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-neutral-800 dark:text-[#e6e1e5]">Spotify Discord Fixer</h1>
              <p className="text-[10px] font-mono text-neutral-450 dark:text-[#938f99] font-medium">v1.2.0 • GeoHide Linker</p>
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
                  ? `Hosts настроен через ${upCount} активных прокси-узлов GeoHide`
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

          <IPList ips={ips} isLoading={isLoading} onRefresh={fetchIps} />
          <HostsBlockPreview activeIps={ips} addLog={addLog} showToast={showToast} />
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
              Учтите: весь трафик указанных доменов Spotify, включая авторизацию, будет идти через серверы GeoHide — это сторонний сервис, и доверие к нему остаётся на ваше усмотрение. Проект неофициальный и не связан со Spotify, Discord или GeoHide.
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
      </div>
    </div>
  );
}
