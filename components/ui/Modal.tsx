"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  bottomSheet?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  bottomSheet = true,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className={`bg-white w-full p-6 max-h-[90vh] overflow-y-auto ${
          bottomSheet ? "rounded-t-2xl" : "rounded-2xl mx-4 mb-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        {children}
      </div>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 -z-10" />
    </div>
  );
}
