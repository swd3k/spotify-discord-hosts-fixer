import React from "react";
import { AlertCircle, RefreshCw, Server, Zap } from "lucide-react";
import { IpRecord } from "../types";

interface IPListProps {
  ips: IpRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const IPList: React.FC<IPListProps> = ({ ips, isLoading, onRefresh }) => {
  return (
    <div id="ip-list-panel" className="bg-neutral-50 dark:bg-[#1c1b1f] border border-neutral-200/80 dark:border-white/10 rounded-[24px] p-5 transition-all duration-300 shadow-md">
      <div className="flex items-center justify-between mb-4 border-b border-neutral-150 dark:border-white/5 pb-2.5">
        <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-500 dark:text-[#938f99] flex items-center gap-2">
          <Server size={14} className="text-[#1DB954]" />
          Активные прокси-узлы
        </h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs flex items-center gap-1.5 font-bold bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#19B850] dark:text-[#1DB954] px-3 py-1 rounded-full transition-all disabled:opacity-50 cursor-pointer"
          id="btn-refresh-ips"
        >
          <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
          Обновить список
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2.5">
          <RefreshCw size={22} className="animate-spin text-[#1DB954]" />
          <span className="text-[11px] text-neutral-400 dark:text-[#938f99] font-mono">Загрузка статусов в реальном времени...</span>
        </div>
      ) : ips.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle size={20} className="mx-auto text-yellow-500 mb-1.5" />
          <p className="text-xs text-neutral-500 dark:text-[#938f99]">Доступных прокси-узлов GeoHide не найдено.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {ips.map((item, index) => (
            <div
              key={`${item.ip}-${index}`}
              className="flex items-center justify-between p-3 bg-neutral-100/50 dark:bg-white/[0.03] border border-transparent hover:border-neutral-250 dark:hover:border-white/10 dark:hover:bg-white/[0.05] rounded-xl transition-all duration-200"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.status === "Up" ? (
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954] shadow-[0_0_8px_#1DB954]"></span>
                  </div>
                ) : (
                  <span className="inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
                <div className="truncate">
                  <p className="text-xs font-mono font-medium text-neutral-800 dark:text-[#e6e1e5] tracking-tight">{item.ip}</p>
                  <p className="text-[9px] text-neutral-400 dark:text-[#938f99] uppercase font-bold tracking-wider mt-0.5">{item.provider}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.latency && (
                  <span className="text-[9px] font-mono text-neutral-500 dark:text-[#938f99] flex items-center gap-1 bg-neutral-200/40 dark:bg-white/5 px-2 py-0.5 rounded-full">
                    <Zap size={9} className="text-amber-500" />
                    {item.latency} мс
                  </span>
                )}
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    item.status === "Up"
                      ? "bg-[#1DB954]/15 text-[#1DB954] dark:bg-[#1DB954]/20"
                      : "bg-rose-500/15 text-rose-500 dark:bg-rose-500/20"
                  }`}
                >
                  {item.status === "Up" ? "В сети" : "Не в сети"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
