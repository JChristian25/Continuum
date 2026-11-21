import { useRef, useState } from 'react';
import { FolderPlus, FileCode2, FileText, GitBranch, Globe, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
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
  const inputs = descriptorRepo?.inputs || [];
  const gitInput = inputs.find(i => i.id === ctx.selection?.inventoryId && (i.gitRepoPath || i.gitRemoteUrl))
    || inputs.findLast(i => i.gitRepoPath || i.gitRemoteUrl);
  const defaultGitPath = gitInput?.gitRepoPath || '';
  const defaultGitUrl = isAddRevision ? gitInput?.gitRemoteUrl || '' : '';
  const localGitEnabled = Boolean(ctx.descriptor?.capabilities?.localGit);

  const [sourceMode, setSourceMode] = useState(() => {
    if (localGitEnabled && (!isAddRevision || defaultGitUrl)) return 'git_clone';
    return localGitEnabled && defaultGitPath ? 'local_git' : 'bundle';
  });
  const [name, setName] = useState('');
  const [revisionLabel, setRevisionLabel] = useState(isAddRevision ? `R${Math.max(1, totalRevisions)}` : 'R0');
  const [files, setFiles] = useState([]);
  const [inlinePath, setInlinePath] = useState('src/service.py');
  const [inlineContent, setInlineContent] = useState('');
  const [runDiscovery, setRunDiscovery] = useState(!isAddRevision);

  const [gitRepoPath, setGitRepoPath] = useState(defaultGitPath);
  const [gitRepoUrl, setGitRepoUrl] = useState(defaultGitUrl);
  const [gitBranch, setGitBranch] = useState(defaultGitUrl ? gitInput.gitBranch || '' : '');
  const [gitCommits, setGitCommits] = useState('');
  const [gitMaxCommits, setGitMaxCommits] = useState(isAddRevision ? 1 : 4);
  const [gitPaths, setGitPaths] = useState('');
  const [inspectedGit, setInspectedGit] = useState(null);
  const [selectedCommitShas, setSelectedCommitShas] = useState(() => new Set());
  const [inspecting, setInspecting] = useState(false);
  const inspection = useRef(0);

  const [localError, setLocalError] = useState('');

  const totalBytes = files.reduce((sum, f) => sum + new Blob([f.content]).size, 0);

  const changeGitSource = (setValue, value) => {
    inspection.current += 1;
    setInspecting(false);
    setInspectedGit(null);
    setSelectedCommitShas(new Set());
    setGitCommits('');
    setLocalError('');
    setValue(value);
  };

  const handleInspectGit = async () => {
    const request = ++inspection.current;
    setLocalError('');
    setInspecting(true);
    try {
      const payload = sourceMode === 'git_clone'
        ? { repoUrl: gitRepoUrl.trim(), branch: gitBranch.trim() || null, limit: 40 }
        : { repoPath: gitRepoPath.trim(), limit: 40 };
      const res = await ctx.api.inspectGit(payload);
      if (request !== inspection.current) return;
      setInspectedGit(res);
      if (!name.trim() && res.name) setName(res.name);
      if (res.commits?.length) {
        const initialShas = res.commits.slice(0, isAddRevision ? 1 : 4).map(c => c.commitId).reverse();
        setSelectedCommitShas(new Set(initialShas));
        setGitCommits(initialShas.join(', '));
      }
    } catch (err) {
      if (request === inspection.current) setLocalError(err.details?.reason || err.message);
    } finally {
      if (request === inspection.current) setInspecting(false);
    }
  };

  const toggleInspectedCommit = sha => {
    setSelectedCommitShas(prev => {
      const next = new Set(prev);
      if (next.has(sha)) next.delete(sha);
      else next.add(sha);
      const ordered = (inspectedGit?.commits || [])
        .map(c => c.commitId)
        .filter(id => next.has(id))
        .reverse();
      setGitCommits(ordered.join(', '));
      return next;
    });
  };

  const handleFileInput = async event => {
    setLocalError('');
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;
    const next = [...files];
    const byPath = new Map(next.map((f, idx) => [f.path, idx]));
    for (const file of picked) {
      const rawRel = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
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
      setLocalError(`Inline file bundles accept at most ${MAX_FILES} files (${next.length} selected). Use Local Git or Clone Git URL for full repositories.`);
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
        setLocalError(`Maximum ${MAX_FILES} files allowed in inline bundle mode.`);
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

    if (sourceMode === 'git_clone') {
      if (!gitRepoUrl.trim()) {
        setLocalError('Provide a remote Git repository URL to clone.');
        return;
      }
      const fallbackName = gitRepoUrl.trim().replace(/\.git$/, '').split('/').filter(Boolean).slice(-2).join('/') || 'cloned-repo';
      const payload = {
        ...(isAddRevision ? {} : { name: name.trim() || fallbackName }),
        mode: 'git_clone',
        gitClone: {
          repoUrl: gitRepoUrl.trim(),
          branch: gitBranch.trim() || null,
          commits: commits.length ? commits : null,
          maxCommits: Number(gitMaxCommits) || 4,
          paths: paths.length ? paths : null,
        },
      };
      const res = isAddRevision
        ? await ctx.addCustomRevision(activeRepo.id, payload, { runDiscovery })
        : await ctx.createCustomWorkspace(payload, { runDiscovery });
      if (res) onOpenChange(false);
      return;
    }

    if (!gitRepoPath.trim()) {
      setLocalError('Provide a local Git repository path on disk.');
      return;
    }
    const payload = {
      ...(isAddRevision ? {} : { name: name.trim() || gitRepoPath.split(/[\\/]/).filter(Boolean).pop() || 'local-git' }),
      mode: 'local_git',
      localGit: {
        repoPath: gitRepoPath.trim(),
        commits: commits.length ? commits : null,
        maxCommits: Number(gitMaxCommits) || 4,
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
        className="service-dialog service-workspace-dialog service-dialog--sticky"
        padded={false}
        showClose={false}
        aria-labelledby="custom-workspace-title"
        aria-describedby="custom-workspace-desc"
      >
        <div className="service-dialog-head">
          <div>
            <DialogTitle id="custom-workspace-title">
              {isAddRevision ? `Add revision to ${activeRepoName}` : 'Import or create workspace'}
            </DialogTitle>
            <DialogDescription id="custom-workspace-desc">
              {isAddRevision
                ? 'Ingest new commits from the repository on disk, clone a remote Git URL, or upload a file bundle.'
                : 'Connect a remote or local Git repository to capture regular UTF-8 text files at selected commits, or upload a file bundle.'}
            </DialogDescription>
          </div>
          <Button
            variant="unstyled"
            className="btn service-dialog-close"
            onClick={() => onOpenChange(false)}
            aria-label="Close custom workspace modal"
          >
            <X size={18} />
          </Button>
        </div>

        <form className="service-dialog-form" onSubmit={handleSubmit}>
          <div className="service-dialog-body journey-form">
            {!isAddRevision && (
              <label>
                Workspace name
                <Input
                  value={name}
                  required={sourceMode === 'bundle'}
                  maxLength={200}
                  placeholder="e.g. team/billing-service"
                  onChange={e => setName(e.target.value)}
                />
              </label>
            )}

            {localGitEnabled && (
              <div className="service-view-toggle" role="group" aria-label="Import source">
                <button type="button" className={sourceMode === 'bundle' ? 'is-active' : ''} onClick={() => changeGitSource(setSourceMode, 'bundle')}>
                  <Upload size={12} aria-hidden="true" /> File bundle
                </button>
                <button type="button" className={sourceMode === 'local_git' ? 'is-active' : ''} onClick={() => changeGitSource(setSourceMode, 'local_git')}>
                  <GitBranch size={12} aria-hidden="true" /> Local Git commits
                </button>
                <button type="button" className={sourceMode === 'git_clone' ? 'is-active' : ''} onClick={() => changeGitSource(setSourceMode, 'git_clone')}>
                  <Globe size={12} aria-hidden="true" /> Clone Git URL
                </button>
              </div>
            )}

            {sourceMode === 'bundle' ? (
              <>
                <div className="service-form-grid-2">
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
                  <div className="service-upload-summary">
                    <span>Bundle limits</span>
                    <small>{files.length} / {MAX_FILES} files · {(totalBytes / 1024).toFixed(1)} KiB / 4 MiB</small>
                  </div>
                </div>

                <div className="service-upload-row">
                  <label className="btn btn--secondary service-file-btn">
                    <Upload size={14} aria-hidden="true" /> Pick files (.py, .md, .txt)
                    <input type="file" multiple accept=".py,.md,.txt" onChange={handleFileInput} hidden />
                  </label>
                  <label className="btn btn--secondary service-file-btn">
                    <FolderPlus size={14} aria-hidden="true" /> Pick folder
                    <input type="file" multiple webkitdirectory="" onChange={handleFileInput} hidden />
                  </label>
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
                        rows={3}
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
                {sourceMode === 'local_git' ? (
                  <label>
                    Local Git repository path on disk
                    <div className="service-git-inspect-row">
                      <Input
                        value={gitRepoPath}
                        required
                        placeholder="/repositories/billing-service"
                        onChange={e => changeGitSource(setGitRepoPath, e.target.value)}
                      />
                      <Button type="button" variant="secondary" size="sm" disabled={inspecting || !gitRepoPath.trim()} onClick={handleInspectGit}>
                        <RefreshCw size={13} /> {inspecting ? 'Reading Git…' : 'Browse commits'}
                      </Button>
                    </div>
                  </label>
                ) : (
                  <div className="service-form-grid-2">
                    <label>
                      Remote Git URL to clone
                      <div className="service-git-inspect-row">
                        <Input
                          value={gitRepoUrl}
                          required
                          placeholder="https://github.com/your-team/your-repo.git"
                          onChange={e => changeGitSource(setGitRepoUrl, e.target.value)}
                        />
                        <Button type="button" variant="secondary" size="sm" disabled={inspecting || !gitRepoUrl.trim()} onClick={handleInspectGit}>
                          <RefreshCw size={13} /> {inspecting ? 'Fetching commits…' : defaultGitUrl ? 'Refresh commits' : 'Clone & browse'}
                        </Button>
                      </div>
                    </label>
                    <label>
                      Branch (optional)
                      <Input
                        value={gitBranch}
                        placeholder="master or main"
                        onChange={e => changeGitSource(setGitBranch, e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {inspectedGit?.commits?.length > 0 && (
                  <div className="service-git-commit-picker" aria-label="Repository commit history">
                    <div className="service-git-commit-picker__head">
                      <strong>Repository commit log ({inspectedGit.commits.length} recent commits)</strong>
                      <small>{selectedCommitShas.size} selected · Click commits to include</small>
                    </div>
                    <div className="service-git-commit-picker__list">
                      {inspectedGit.commits.map(c => {
                        const checked = selectedCommitShas.has(c.commitId);
                        return (
                          <label className={`service-git-commit-row ${checked ? 'is-checked' : ''}`} key={c.commitId}>
                            <Checkbox checked={checked} onChange={() => toggleInspectedCommit(c.commitId)} />
                            <code className="service-commit-pill">{c.shortCommitId}</code>
                            <div className="service-git-commit-row__body">
                              <strong>{c.subject}</strong>
                              <small>{c.authorName} · {(c.authoredAt || '').slice(0, 16).replace('T', ' ')}</small>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="service-form-grid-2">
                  <label>
                    Commit SHA(s) or refs (leave blank to auto-ingest latest commits)
                    <Input
                      value={gitCommits}
                      placeholder="e.g. HEAD~3, HEAD~2, HEAD~1, HEAD or commit SHAs"
                      onChange={e => setGitCommits(e.target.value)}
                    />
                  </label>
                  <label>
                    Recent commits to auto-ingest (when SHA field is blank)
                    <Input
                      type="number"
                      min={1}
                      value={gitMaxCommits}
                      onChange={e => setGitMaxCommits(e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Specific relative paths (optional)
                  <Textarea
                    rows={2}
                    value={gitPaths}
                    placeholder="Leave empty to capture regular UTF-8 text files across the repository."
                    onChange={e => setGitPaths(e.target.value)}
                  />
                </label>
              </>
            )}

            <label className="service-checkbox">
              <Checkbox checked={runDiscovery} onChange={e => setRunDiscovery(e.target.checked)} />
              Run candidate discovery automatically after capturing this revision
            </label>

            {(localError || ctx.error) && (
              <p className="form-error" role="alert">{localError || ctx.error}</p>
            )}
          </div>

          <div className="service-dialog-footer">
            <Button type="submit" disabled={ctx.busy || inspecting}>
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
