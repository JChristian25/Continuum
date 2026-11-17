import { useState } from 'react';
import { FolderPlus, FileCode2, FileText, GitBranch, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Textarea } from './ui/index.js';

const ALLOWED_EXT = /\.(py|md|txt)$/;
const IGNORED_SEGMENT = /(^|\/)(node_modules|\.venv|venv|__pycache__|\.git|dist|build)\//;
const MAX_FILES = 25;
const MAX_FILE_BYTES = 1048576;
const MAX_TOTAL_BYTES = 4194304;

export default function CustomWorkspaceModal({ ctx, open, onOpenChange, mode = 'create' }) {
  const isAddRevision = mode === 'add_revision';
  const activeRepo = ctx.state?.repositories?.find(r => r.id === ctx.selection?.repositoryId)
    || ctx.descriptor?.repositories?.find(r => r.id === ctx.selection?.repositoryId);
  const activeRepoName = activeRepo?.fullName || activeRepo?.inputs?.[0]?.repositoryFullName || activeRepo?.name || 'workspace';
  const descriptorRepo = ctx.descriptor?.repositories?.find(r => r.id === ctx.selection?.repositoryId) || activeRepo;
  const totalRevisions = (descriptorRepo?.inputs || []).reduce((sum, inp) => sum + (inp.revisions?.length || 0), 0);
  const localGitEnabled = Boolean(ctx.descriptor?.capabilities?.localGit);

  const [sourceMode, setSourceMode] = useState('bundle');
  const [name, setName] = useState('');
  const [revisionLabel, setRevisionLabel] = useState(isAddRevision ? `R${Math.max(1, totalRevisions)}` : 'R0');
  const [files, setFiles] = useState([]);
  const [inlinePath, setInlinePath] = useState('src/service.py');
  const [inlineContent, setInlineContent] = useState('');
  const [runDiscovery, setRunDiscovery] = useState(!isAddRevision);

  const [gitRepoPath, setGitRepoPath] = useState('');
  const [gitCommits, setGitCommits] = useState('');
  const [gitPaths, setGitPaths] = useState('');

  const [localError, setLocalError] = useState('');

  const totalBytes = files.reduce((sum, f) => sum + new Blob([f.content]).size, 0);

  const handleFileInput = async event => {
    setLocalError('');
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;
    const next = [...files];
    const byPath = new Map(next.map((f, idx) => [f.path, idx]));
    for (const file of picked) {
      const rawRel = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
      // Strip top-level picked folder prefix if webkitRelativePath was provided
      const parts = rawRel.split('/');
      const relPath = file.webkitRelativePath && parts.length > 1 ? parts.slice(1).join('/') : rawRel;
      if (!ALLOWED_EXT.test(relPath) || IGNORED_SEGMENT.test(relPath)) continue;
      if (file.size > MAX_FILE_BYTES) {
        setLocalError(`${relPath} exceeds the 1 MiB per-file limit.`);
        continue;
      }
      const text = await file.text();
      if (text.includes('\u0000')) {
        setLocalError(`${relPath} contains NUL/binary bytes and was skipped.`);
        continue;
      }
      if (byPath.has(relPath)) {
        next[byPath.get(relPath)] = { path: relPath, content: text };
      } else {
        byPath.set(relPath, next.length);
        next.push({ path: relPath, content: text });
      }
    }
    if (next.length > MAX_FILES) {
      setLocalError(`Bounded custom workspaces accept at most ${MAX_FILES} files (${next.length} selected).`);
      setFiles(next.slice(0, MAX_FILES));
    } else {
      setFiles(next);
    }
  };

  const addInlineFile = () => {
    setLocalError('');
    const clean = inlinePath.trim().replace(/^\/+/, '');
    if (!ALLOWED_EXT.test(clean)) {
      setLocalError('Path must end in .py, .md, or .txt.');
      return;
    }
    if (!inlineContent.trim()) {
      setLocalError('Provide file content before adding.');
      return;
    }
    setFiles(prev => {
      const idx = prev.findIndex(f => f.path === clean);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { path: clean, content: inlineContent };
        return copy;
      }
      if (prev.length >= MAX_FILES) {
        setLocalError(`Maximum ${MAX_FILES} files allowed.`);
        return prev;
      }
      return [...prev, { path: clean, content: inlineContent }];
    });
    setInlineContent('');
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setLocalError('');
    if (sourceMode === 'bundle') {
      if (!files.length) {
        setLocalError('Add at least one .py, .md, or .txt file.');
        return;
      }
      if (totalBytes > MAX_TOTAL_BYTES) {
        setLocalError('Total bundle size exceeds 4 MiB.');
        return;
      }
      const payload = {
        ...(isAddRevision ? {} : { name: name.trim() }),
        mode: 'bundle',
        bundle: { revisionLabel: revisionLabel.trim() || (isAddRevision ? 'R1' : 'R0'), files },
      };
      const res = isAddRevision
        ? await ctx.addCustomRevision(activeRepo.id, payload, { runDiscovery })
        : await ctx.createCustomWorkspace(payload, { runDiscovery });
      if (res) onOpenChange(false);
      return;
    }

    const commits = gitCommits.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    const paths = gitPaths.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!gitRepoPath.trim() || !commits.length) {
      setLocalError('Provide a local repository path and at least one commit SHA.');
      return;
    }
    const payload = {
      ...(isAddRevision ? {} : { name: name.trim() || gitRepoPath.split(/[\\/]/).filter(Boolean).pop() || 'custom-git' }),
      mode: 'local_git',
      localGit: {
        repoPath: gitRepoPath.trim(),
        commits,
        paths: paths.length ? paths : null,
      },
    };
    const res = isAddRevision
      ? await ctx.addCustomRevision(activeRepo.id, payload, { runDiscovery })
      : await ctx.createCustomWorkspace(payload, { runDiscovery });
    if (res) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="service-dialog service-workspace-dialog"
        padded={false}
        showClose={false}
        aria-labelledby="custom-workspace-title"
        aria-describedby="custom-workspace-desc"
      >
        <Button
          variant="unstyled"
          className="btn service-dialog-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close custom workspace modal"
        >
          <X size={18} />
        </Button>
        <DialogTitle id="custom-workspace-title">
          {isAddRevision ? `Add revision to ${activeRepoName}` : 'Import or create workspace'}
        </DialogTitle>
        <DialogDescription id="custom-workspace-desc">
          {isAddRevision
            ? 'In File bundle mode, include every file to retain in this revision (omitted paths count as deleted). Or switch to Local Git commits if enabled.'
            : 'Capture up to 25 Python (.py), Markdown (.md), or plain-text (.txt) files into PostgreSQL, Tree-sitter/Docling, and Neo4j without altering the Healthchecks baseline.'}
        </DialogDescription>

        <form className="journey-form" onSubmit={handleSubmit}>
          {!isAddRevision && (
            <label>
              Workspace name
              <Input
                value={name}
                required={sourceMode === 'bundle'}
                maxLength={200}
                placeholder="e.g. acme/billing-service"
                onChange={e => setName(e.target.value)}
              />
            </label>
          )}

          {localGitEnabled && (
            <div className="service-view-toggle" role="group" aria-label="Import source">
              <button type="button" className={sourceMode === 'bundle' ? 'is-active' : ''} onClick={() => setSourceMode('bundle')}>
                <Upload size={12} aria-hidden="true" /> File bundle
              </button>
              <button type="button" className={sourceMode === 'local_git' ? 'is-active' : ''} onClick={() => setSourceMode('local_git')}>
                <GitBranch size={12} aria-hidden="true" /> Local Git commits
              </button>
            </div>
          )}

          {sourceMode === 'bundle' ? (
            <>
              <label>
                Revision label
                <Input
                  value={revisionLabel}
                  required
                  maxLength={64}
                  placeholder={isAddRevision ? 'R1' : 'R0'}
                  onChange={e => setRevisionLabel(e.target.value)}
                />
              </label>

              <div className="service-upload-row">
                <label className="btn btn--secondary service-file-btn">
                  <Upload size={14} aria-hidden="true" /> Pick files (.py, .md, .txt)
                  <input type="file" multiple accept=".py,.md,.txt" onChange={handleFileInput} hidden />
                </label>
                <label className="btn btn--secondary service-file-btn">
                  <FolderPlus size={14} aria-hidden="true" /> Pick folder
                  <input type="file" multiple webkitdirectory="" onChange={handleFileInput} hidden />
                </label>
                <span className="service-method">
                  {files.length} / {MAX_FILES} files · {(totalBytes / 1024).toFixed(1)} KiB
                </span>
              </div>

              {files.length > 0 && (
                <div className="service-bundle-list" aria-label="Selected files">
                  {files.map(file => (
                    <div className="service-bundle-item" key={file.path}>
                      {file.path.endsWith('.py') ? <FileCode2 size={13} /> : <FileText size={13} />}
                      <span>{file.path}</span>
                      <small>{new Blob([file.content]).size} B</small>
                      <button
                        type="button"
                        className="service-bundle-remove"
                        aria-label={`Remove ${file.path}`}
                        onClick={() => setFiles(prev => prev.filter(item => item.path !== file.path))}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="service-inline-file-box">
                <strong>Or add / edit a file inline</strong>
                <div className="service-inline-file-inputs">
                  <label>
                    Relative path
                    <Input
                      value={inlinePath}
                      placeholder="src/payments.py or docs/README.md"
                      onChange={e => setInlinePath(e.target.value)}
                    />
                  </label>
                  <label>
                    File content
                    <Textarea
                      value={inlineContent}
                      placeholder="Paste Python, Markdown, or plain-text content…"
                      onChange={e => setInlineContent(e.target.value)}
                    />
                  </label>
                  <Button type="button" variant="secondary" size="sm" onClick={addInlineFile}>
                    <Plus size={13} /> Add file to bundle
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <label>
                Allowlisted local Git path
                <Input
                  value={gitRepoPath}
                  required
                  placeholder="D:\repos\my-python-project"
                  onChange={e => setGitRepoPath(e.target.value)}
                />
              </label>
              <label>
                Commit SHA(s) (1–4, comma or space separated)
                <Input
                  value={gitCommits}
                  required
                  placeholder="abc1234, def5678"
                  onChange={e => setGitCommits(e.target.value)}
                />
              </label>
              <label>
                Specific relative paths (optional; auto-selects when repo has ≤ 25 eligible files)
                <Textarea
                  value={gitPaths}
                  placeholder="src/app.py&#10;docs/overview.md"
                  onChange={e => setGitPaths(e.target.value)}
                />
              </label>
            </>
          )}

          <label className="service-checkbox">
            <Checkbox checked={runDiscovery} onChange={e => setRunDiscovery(e.target.checked)} />
            Run lexical candidate discovery automatically after capturing this revision
          </label>

          {(localError || ctx.error) && (
            <p className="form-error" role="alert">{localError || ctx.error}</p>
          )}

          <div className="service-toolbar">
            <Button type="submit" disabled={ctx.busy}>
              {ctx.busy
                ? 'Processing workspace…'
                : isAddRevision
                  ? 'Capture new revision'
                  : 'Create & capture workspace'}
            </Button>
            <Button type="button" variant="secondary" disabled={ctx.busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
