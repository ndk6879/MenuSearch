import React from "react";

export default function Modal({ open, onClose, darkMode, children }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`modal-content ${darkMode ? "modal-dark" : "modal-light"}`}>
        <div className="modal-drag-handle-area" onClick={onClose}>
          <div className="modal-drag-handle" />
        </div>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
