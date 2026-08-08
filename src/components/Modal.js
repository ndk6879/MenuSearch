import React from "react";

export default function Modal({ open, onClose, darkMode, hideClose, children, preventClose }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target !== e.currentTarget) return; if (preventClose?.()) return; onClose(); }}
    >
      <div className={`modal-content ${darkMode ? "modal-dark" : "modal-light"}`}>
        <div className="modal-drag-handle-area" onClick={onClose}>
          <div className="modal-drag-handle" />
        </div>
        {!hideClose && (
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
