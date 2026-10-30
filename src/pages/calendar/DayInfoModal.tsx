import { CheckCircle2, Clock, Landmark } from "lucide-react";

import BaseModal from "@/modals/BaseModal";
import { formatDate } from "@/utils/dateUtils";
import type { CalendarHoliday, RealWorldEvent } from "@/data/holidaysAndEvents";

interface DayInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  tasks: any[];
  studiedHours: string | number;
  holidays?: CalendarHoliday[];
  worldEvents?: RealWorldEvent[];
}

const DayInfoModal = ({
  isOpen,
  onClose,
  date,
  tasks,
  studiedHours,
  holidays = [],
  worldEvents = [],
}: DayInfoModalProps) => {
  if (!isOpen) return null;

  const completedTasks = tasks?.filter((t: any) => t.completed).length || 0;
  const totalTasks = tasks?.length || 0;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={formatDate(date.toISOString())}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Holidays Banner if any */}
        {holidays.length > 0 && (
          <div className="space-y-2">
            {holidays.map((hol) => (
              <div
                key={hol.id}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200"
              >
                <span className="text-xl shrink-0">{hol.icon || '🎉'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-amber-300 truncate">
                    {hol.name}
                  </div>
                  <div className="text-[11px] text-amber-400/80">
                    {hol.isPublicHoliday ? 'Official Public Holiday' : 'Special Observance'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Tasks Card */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--accent-primary)]/15 rounded-lg flex items-center justify-center">
                <CheckCircle2 size={20} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider">Tasks</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">
                  {completedTasks}/{totalTasks}
                </div>
              </div>
            </div>
          </div>

          {/* Study Time Card */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--accent-primary)]/15 rounded-lg flex items-center justify-center">
                <Clock size={20} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider">Focus Time</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">
                  {studiedHours || 0}h
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        {tasks && tasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <div className="w-1 h-3.5 bg-[var(--accent-primary)] rounded-full"></div>
              Scheduled Tasks
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {tasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl hover:border-[var(--accent-primary)]/50 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task.completed ? "bg-green-500" : "bg-yellow-500"
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      task.completed
                        ? "text-[var(--text-secondary)] line-through"
                        : "text-[var(--text-primary)]"
                    }`}>
                      <span>{task.title}</span>
                    </div>
                    {task.assignment && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {task.assignment}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${
                    task.completed
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {task.completed ? "Done" : "Pending"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-World Events On This Day */}
        {worldEvents && worldEvents.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--border-primary)]/50">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Landmark size={15} className="text-[var(--accent-primary)]" />
              On This Day in History
            </h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {worldEvents.map((ev, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]/40 text-xs text-[var(--text-secondary)]"
                >
                  {ev.year && (
                    <span className="font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                      {ev.year}
                    </span>
                  )}
                  <span className="text-[var(--text-primary)] leading-relaxed">
                    {ev.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State when no tasks and no events */}
        {(!tasks || tasks.length === 0) && holidays.length === 0 && (!worldEvents || worldEvents.length === 0) && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={24} className="text-[var(--text-secondary)]" />
            </div>
            <p className="text-[var(--text-secondary)] text-sm">No tasks recorded for this day</p>
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default DayInfoModal;