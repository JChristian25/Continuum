import { useState } from 'react';
import { PlusCircle, User, GitCommit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Textarea,
  Select,
  Button
} from './ui/index.js';

export default function RecordIntentModal({ getActiveUser, onClose, onSubmit }) {
  const [kind, setKind] = useState('Architecture Decision (ADR)');
  const [targetId, setTargetId] = useState('bbb.py::createRequest');
  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const activeUser = getActiveUser();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !rationale.trim()) return;
    onSubmit({ kind, targetId, title: title.trim(), rationale: rationale.trim() });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-[var(--accent)]" />
            <span>Record Design Intent</span>
          </DialogTitle>
          <DialogDescription>
            Directly author an Architecture Decision Record (ADR) or ISO Requirement and anchor it to code.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[var(--ink-2)]">
              Intent Record Type
            </label>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="Architecture Decision (ADR)">Architecture Decision Record (ADR)</option>
              <option value="System Requirement (REQ)">System Requirement (ISO/IEC/IEEE 29148)</option>
              <option value="Refactoring Constraint">Refactoring Constraint / RFC</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[var(--ink-2)]">
              Direct Target Artifact
            </label>
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="bbb.py::createRequest">src/bbb.py · createRequest() (Changed Provider Seed)</option>
              <option value="bbb.py::cancelRequest">src/bbb.py · cancelRequest() (Undocumented Sibling)</option>
              <option value="aaa.py::submitUserOrder">src/aaa.py · submitUserOrder() (Order Intake Caller)</option>
              <option value="compat.py::normalizeRequestResult">src/compat.py · normalizeRequestResult() (Adapter Layer)</option>
              <option value="REQ-02">REQ-02 — Track request creation status</option>
              <option value="aaa.md::section-2.1">docs/aaa.md · §2.1 Request API</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[var(--ink-2)]">
              Intent Title / Proposition Summary
            </label>
            <Input
              type="text"
              placeholder="e.g. Return structured dict from createRequest to avoid follow-up queries"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[var(--ink-2)]">
              Full Technical Rationale &amp; Context
            </label>
            <Textarea
              rows={4}
              placeholder="Explain the engineering tradeoffs, affected callers, and why this design was chosen…"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-[var(--ground-sunken)] rounded-[var(--r-md)] border border-[var(--border)] text-[12px] text-[var(--ink-2)]">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span>Author: <strong className="text-[var(--ink)] font-semibold">{activeUser.name}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <GitCommit className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Target: <strong className="text-[var(--accent)] font-semibold">Incoming Change (8f3b21d)</strong></span>
            </span>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={!title.trim() || !rationale.trim()}
            >
              Record &amp; Link Intent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
