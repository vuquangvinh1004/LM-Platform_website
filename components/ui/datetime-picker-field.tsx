"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type DateTimePickerFieldProps = {
  name: string;
  label: string;
  placeholder?: string;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const HOUR_OPTIONS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatForSubmission(value: Date | null): string {
  if (!value) {
    return "";
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatForDisplay(value: Date | null): string {
  if (!value) {
    return "";
  }

  return value.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getStartOfCalendar(date: Date): Date {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), 1 - firstDayOfMonth.getDay());
}

function isSameDate(left: Date | null, right: Date | null): boolean {
  if (!left || !right) {
    return false;
  }

  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function normalizeToDraft(date: Date | null): Date {
  if (date) {
    return new Date(date);
  }

  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

export function DateTimePickerField({
  name,
  label,
  placeholder = "Chọn ngày và thời gian",
}: DateTimePickerFieldProps) {
  const fieldId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState<Date | null>(null);
  const [draftValue, setDraftValue] = useState<Date>(() => normalizeToDraft(null));
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const start = getStartOfCalendar(visibleMonth);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const openPicker = () => {
    const nextDraft = normalizeToDraft(value);
    setDraftValue(nextDraft);
    setVisibleMonth(new Date(nextDraft.getFullYear(), nextDraft.getMonth(), 1));
    setIsOpen(true);
  };

  const updateDraftDate = (selectedDate: Date) => {
    setDraftValue((current) => new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      current.getHours(),
      current.getMinutes(),
      0,
      0,
    ));
  };

  const updateDraftHour = (hour12: string) => {
    setDraftValue((current) => {
      const next = new Date(current);
      const isPm = next.getHours() >= 12;
      const normalizedHour = Number(hour12) % 12 + (isPm ? 12 : 0);
      next.setHours(normalizedHour, next.getMinutes(), 0, 0);
      return next;
    });
  };

  const updateDraftMinute = (minute: string) => {
    setDraftValue((current) => {
      const next = new Date(current);
      next.setMinutes(Number(minute), 0, 0);
      return next;
    });
  };

  const updateDraftMeridiem = (meridiem: "AM" | "PM") => {
    setDraftValue((current) => {
      const next = new Date(current);
      const currentHour = next.getHours();
      const isCurrentlyPm = currentHour >= 12;

      if (meridiem === "AM" && isCurrentlyPm) {
        next.setHours(currentHour - 12);
      }

      if (meridiem === "PM" && !isCurrentlyPm) {
        next.setHours(currentHour + 12);
      }

      return next;
    });
  };

  const clearValue = () => {
    setValue(null);
    setDraftValue(normalizeToDraft(null));
    setIsOpen(false);
  };

  const setToday = () => {
    const now = normalizeToDraft(null);
    setDraftValue(now);
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const commitValue = () => {
    setValue(new Date(draftValue));
    setIsOpen(false);
  };

  const selectedHour = String(((draftValue.getHours() + 11) % 12) + 1).padStart(2, "0");
  const selectedMinute = pad(draftValue.getMinutes());
  const selectedMeridiem = draftValue.getHours() >= 12 ? "PM" : "AM";
  const today = new Date();

  return (
    <div className="text-sm text-slate-700" ref={containerRef}>
      <label className="block" htmlFor={fieldId}>
        {label}
      </label>
      <input name={name} type="hidden" value={formatForSubmission(value)} />
      <div className="relative mt-1">
        <button
          className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900"
          id={fieldId}
          onClick={openPicker}
          type="button"
        >
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {value ? formatForDisplay(value) : placeholder}
          </span>
          <CalendarDays className="h-4 w-4 text-slate-500" />
        </button>

        {isOpen ? (
          <div className="absolute z-20 mt-2 w-full min-w-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl md:w-[560px]">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="md:w-[310px]">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
                    onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-base font-semibold text-slate-900">
                    {visibleMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
                  </div>
                  <button
                    className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
                    onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                    type="button"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
                  {WEEKDAY_LABELS.map((day) => (
                    <div className="py-1" key={day}>{day}</div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const isSelected = isSameDate(day, draftValue);
                    const isToday = isSameDate(day, today);
                    const isInCurrentMonth = day.getMonth() === visibleMonth.getMonth();

                    return (
                      <button
                        className={cn(
                          "flex h-10 items-center justify-center rounded-lg border text-sm transition",
                          isSelected
                            ? "border-sky-700 bg-sky-700 font-semibold text-white"
                            : isToday
                              ? "border-amber-300 bg-amber-50 font-semibold text-amber-900"
                              : "border-transparent text-slate-700 hover:bg-slate-100",
                          !isSelected && !isToday && !isInCurrentMonth ? "text-slate-300" : null,
                        )}
                        key={day.toISOString()}
                        onClick={() => updateDraftDate(day)}
                        type="button"
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thời gian</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <select
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      onChange={(event) => updateDraftHour(event.target.value)}
                      value={selectedHour}
                    >
                      {HOUR_OPTIONS.map((hour) => (
                        <option key={hour} value={hour}>{hour}</option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      onChange={(event) => updateDraftMinute(event.target.value)}
                      value={selectedMinute}
                    >
                      {MINUTE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>{minute}</option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      onChange={(event) => updateDraftMeridiem(event.target.value as "AM" | "PM")}
                      value={selectedMeridiem}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đã chọn</span>
                  <p className="mt-1 font-medium text-slate-900">{formatForDisplay(draftValue)}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
              <button className="text-sky-700 hover:text-sky-800" onClick={clearValue} type="button">Clear</button>
              <button
                className="rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200"
                onClick={commitValue}
                type="button"
              >
                Chọn
              </button>
              <button className="text-sky-700 hover:text-sky-800" onClick={setToday} type="button">Today</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
