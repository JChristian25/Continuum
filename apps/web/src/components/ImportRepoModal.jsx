import WorkspaceSetup from './WorkspaceSetup.jsx';
import { Dialog, DialogContent } from './ui/index.js';
export default function ImportRepoModal({ isOpen, onClose, onComplete }) {
  return <Dialog open={isOpen} onOpenChange={open => !open && onClose()}><DialogContent aria-label="Set up demo workspace"><WorkspaceSetup embedded onCancel={onClose} onComplete={result => { onComplete(result); onClose(); }} /></DialogContent></Dialog>;
}
