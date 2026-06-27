"use client";

import { useState } from "react";

import type { ClassroomSessionQuickReviewQuestion } from "@/lib/types/classroom";
import { parseStructuredText } from "@/lib/utils/classroom-rich-text";

type ClassroomQuickReviewClientProps = {
  questions: ClassroomSessionQuickReviewQuestion[];
};

export function ClassroomQuickReviewClient({ questions }: ClassroomQuickReviewClientProps) {
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const [submitted, setSubmitted] = useState(false);

  function toggleAnswer(questionId: string, optionId: string, mode: "multiple_choice" | "multiple_answer") {
    setAnswers((current) => {
      const next = new Set(mode === "multiple_choice" ? [] : current[questionId] ?? []);

      if (mode === "multiple_choice") {
        next.add(optionId);
      } else if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }

      return {
        ...current,
        [questionId]: next,
      };
    });
  }

  function isCorrect(question: ClassroomSessionQuickReviewQuestion): boolean {
    const selectedIds = answers[question.id] ?? new Set<string>();
    const correctIds = new Set(question.options.filter((option) => option.isCorrect).map((option) => option.id));

    if (selectedIds.size !== correctIds.size) {
      return false;
    }

    return [...selectedIds].every((optionId) => correctIds.has(optionId));
  }

  function isSelected(questionId: string, optionId: string): boolean {
    return answers[questionId]?.has(optionId) ?? false;
  }

  function resetQuiz() {
    setAnswers({});
    setSubmitted(false);
  }

  function getOptionTone(selected: boolean, isSelectedCorrect: boolean): string {
    if (!submitted) {
      return selected
        ? "block rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-slate-800"
        : "block rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800";
    }

    if (selected) {
      if (isSelectedCorrect) {
        return "block rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-800";
      }
      return "block rounded-md border border-red-200 bg-red-50 p-3 text-sm text-slate-800";
    }

    return "block rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800";
  }

  if (questions.length === 0) {
    return <p className="text-sm text-slate-600">Chưa có câu hỏi ôn tập.</p>;
  }

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <article className="rounded-lg border border-slate-200 bg-white p-4" key={question.id}>
          <h3 className="font-semibold text-slate-900">Câu {index + 1}: {question.question}</h3>
          <div className="mt-3 space-y-2">
            {question.options.map((option) => (
              <label
                className={getOptionTone(isSelected(question.id, option.id), option.isCorrect)}
                key={option.id}
              >
                <span className="flex items-center gap-2">
                  <input
                    checked={answers[question.id]?.has(option.id) ?? false}
                    name={question.id}
                    disabled={submitted}
                    onChange={() => toggleAnswer(question.id, option.id, question.type)}
                    type={question.type === "multiple_choice" ? "radio" : "checkbox"}
                  />
                  <span className="font-medium">{option.label}</span>
                  {submitted ? (
                    isSelected(question.id, option.id) ? (
                      <span
                        className={
                          option.isCorrect
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                            : "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                        }
                      >
                        {option.isCorrect ? "Đáp án đúng" : "Đáp án của bạn"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Đáp án khác
                      </span>
                    )
                  ) : isSelected(question.id, option.id) ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                      Đang chọn
                    </span>
                  ) : null}
                </span>
                {submitted && isSelected(question.id, option.id) && option.guidance ? (
                  <div
                    className={
                      option.isCorrect
                        ? "mt-3 rounded-md border border-emerald-200 bg-white p-3 text-sm text-emerald-900"
                        : "mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                    }
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
                      {option.isCorrect ? "Gợi ý đúng" : "Gợi ý lựa chọn"}
                    </p>
                    {option.guidance}
                  </div>
                ) : null}
              </label>
            ))}
          </div>
          {submitted ? (
            <div className="mt-3 space-y-3">
              <p className={isCorrect(question) ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-700"}>
                {isCorrect(question) ? "Đúng." : "Chưa đúng, hãy xem lại nội dung buổi học."}
              </p>
              {!isCorrect(question) && question.guidance ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Hướng dẫn và gợi ý</p>
                  <div className="space-y-3">
                    {parseStructuredText(question.guidance).map((block, index) => {
                      if (block.type === "paragraph") {
                        return <p className="whitespace-pre-line leading-6" key={`paragraph-${index}`}>{block.text}</p>;
                      }

                      if (block.type === "unordered-list") {
                        return (
                          <ul className="list-disc space-y-1 pl-5 leading-6" key={`ul-${index}`}>
                            {block.items.map((item, itemIndex) => <li key={`ul-${index}-${itemIndex}`}>{item}</li>)}
                          </ul>
                        );
                      }

                      return (
                        <ol className="list-decimal space-y-1 pl-5 leading-6" key={`ol-${index}`}>
                          {block.items.map((item, itemIndex) => <li key={`ol-${index}-${itemIndex}`}>{item}</li>)}
                        </ol>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className={isCorrect(question) ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"}>
                {isCorrect(question) ? "Bạn đã chọn đúng đáp án." : "Đáp án chưa khớp, hãy thử xem lại từng lựa chọn và gợi ý bên dưới."}
              </div>
            </div>
          ) : null}
        </article>
      ))}
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={submitted}
          onClick={() => setSubmitted(true)}
          type="button"
        >
          Nộp ôn tập nhanh
        </button>
        <button
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          onClick={resetQuiz}
          type="button"
        >
          Làm lại
        </button>
      </div>
    </div>
  );
}
