import React, { useRef, useEffect } from "react";
import { Terminal, Trash2, ShieldAlert } from "lucide-react";

interface TerminalLogsProps {
  logs: string[];
  onClear: () => void;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({ logs, onClear }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Прокручиваем только сам контейнер логов, а не всю страницу
    // (scrollIntoView утягивал окно вниз при каждом новом логе).
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div id="terminal-logs-panel" className="bg-[#0c0c0c] border border-neutral-200/80 dark:border-white/10 rounded-[24px] overflow-hidden shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200/10 dark:border-white/5 bg-[#171719]/40">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#938f99] flex items-center gap-1.5 font-mono">
          <Terminal size={12} className="text-[#1DB954] animate-pulse" />
          Поток отладочных логов
        </span>
        <button
          onClick={onClear}
          className="text-neutral-500 hover:text-rose-450 dark:hover:text-rose-400 p-1 rounded-md transition-all text-xs flex items-center gap-1 font-semibold font-mono cursor-pointer"
          title="Очистить логи консоли"
          id="btn-clear-logs"
        >
          <Trash2 size={11} />
          Очистить
        </button>
      </div>

      <div ref={logContainerRef} className="p-4 font-mono text-[10px] leading-relaxed max-h-40 overflow-y-auto space-y-1.5 text-[#e6e1e5] selection:bg-[#1DB954]/30 selection:text-white">
        {logs.length === 0 ? (
          <div className="text-neutral-600 italic py-2">Нет активных логов. Запустите обновление, чтобы увидеть поток.</div>
        ) : (
          logs.map((log, i) => {
            let colorClass = "text-[#e6e1e5]/90";
            if (log.startsWith("❌") || log.includes("[ERROR]") || log.includes("[API ERROR]")) {
              colorClass = "text-rose-400 font-bold";
            } else if (log.startsWith("⚠️") || log.includes("[WARNING]")) {
              colorClass = "text-amber-400";
            } else if (log.startsWith("✅") || log.includes("[SUCCESS]")) {
              colorClass = "text-[#1DB954] font-bold drop-shadow-[0_0_2px_rgba(29,185,84,0.25)]";
            } else if (log.includes("[SYSTEM]")) {
              colorClass = "text-sky-400";
            } else if (log.includes("[UTILITY]") || log.includes("[SHELL]")) {
              colorClass = "text-fuchsia-400";
            }

            return (
              <div key={i} className={`${colorClass} whitespace-pre-wrap break-all`}>
                {log}
              </div>
            );
          })
        )}
      </div>

      <div className="px-5 py-2 bg-neutral-900/20 border-t border-neutral-200/10 dark:border-white/5 flex items-center gap-2 text-[9px] text-neutral-500 dark:text-[#938f99]/80 font-mono">
        <ShieldAlert size={10} className="text-amber-500 flex-shrink-0" />
        <span>Изменения затрагивают системные настройки. Всегда проверяйте резервные копии.</span>
      </div>
    </div>
  );
};
