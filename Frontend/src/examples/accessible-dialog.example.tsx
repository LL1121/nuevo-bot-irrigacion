// Example: Accessible Modal Dialog Component
import { useState } from 'react';
import { useFocusTrap, useKeyboardShortcuts, useAnnouncement } from '@/hooks';
import { generateId } from '@/utils/accessibility';

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const AccessibleDialog = ({
  isOpen,
  onClose,
  title,
  children,
}: AccessibleDialogProps) => {
  const dialogRef = useFocusTrap<HTMLDivElement>({ 
    enabled: isOpen,
    restoreFocus: true 
  });
  
  const { announce } = useAnnouncement();
  const titleId = generateId('dialog-title');
  const descId = generateId('dialog-desc');

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Escape',
      callback: () => {
        if (isOpen) {
          onClose();
          announce('Dialog closed');
        }
      },
      description: 'Close dialog',
    },
  ]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 z-50 max-w-md w-full"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 rounded hover:bg-gray-100"
        >
          <span aria-hidden="true">✕</span>
        </button>

        {/* Title */}
        <h2 id={titleId} className="text-xl font-bold mb-4">
          {title}
        </h2>

        {/* Content */}
        <div id={descId}>
          {children}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Action
              announce('Action completed');
              onClose();
            }}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
};

// Usage example:
function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Open Dialog
      </button>

      <AccessibleDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Delete Message"
      >
        <p>Are you sure you want to delete this message?</p>
        <p className="text-sm text-gray-500 mt-2">
          This action cannot be undone.
        </p>
      </AccessibleDialog>
    </>
  );
}
