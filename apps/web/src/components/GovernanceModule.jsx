import { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Eye,
  Users,
  UserPlus,
  Sliders,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  GitFork,
  WifiOff,
  UserCheck,
  FileCode,
  User,
  Briefcase,
  AlertTriangle
} from 'lucide-react';
import { createInitialState } from '../data/state.js';
import { Button, Badge, Input, Select } from './ui/index.js';

export default function GovernanceModule({ ctx, showToast }) {
  const { state, setState, switchActiveUser } = ctx;

  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newAuth, setNewAuth] = useState('Authorized Reviewer');

  const toggleMemberAuthority = (memberId) => {
    setState(s => {
      const updated = s.teamMembers.map(m => {
        if (m.id === memberId) {
          const nextAuth = m.authority === 'Authorized Reviewer'
            ? 'Read-Only / Commenter'
            : 'Authorized Reviewer';
          showToast(`Updated ${m.name}'s review authority to "${nextAuth}".`);
          return { ...m, authority: nextAuth };
        }
        return m;
      });
      return { ...s, teamMembers: updated };
    });
  };

  const handleAddMember = (e) => {
    e.preventDefault();
    const name = newName.trim();
    const role = newRole.trim();
    if (!name || !role) return;

    const parts = name.split(/\s+/);
    const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();

    const newMember = {
      id: 'user-' + Date.now(),
      initials,
      name,
      shortName: name,
      roleTitle: role,
      authority: newAuth,
      focus: 'Newly added contributor',
      commits: 0,
      decisions: 0,
      reviews: 0
    };

    setState(s => ({ ...s, teamMembers: [...s.teamMembers, newMember] }));
    setNewName('');
    setNewRole('');
    ctx.triggerConfetti?.({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
    showToast(`Added ${name} (${role}) to team roster.`);
  };

  const togglePolicy = (key) => {
    setState(s => {
      const updated = { ...s.policies, [key]: !s.policies[key] };
      showToast(`Updated governance policy "${key}".`);
      return { ...s, policies: updated };
    });
  };

  const toggleSimError = () => {
    setState(s => {
      const nextVal = !s.simulateSaveError;
      showToast(nextVal
        ? 'Simulated Network Failure enabled: reviews will fail to save, testing draft persistence.'
        : 'Simulated Network Failure disabled.');
      return { ...s, simulateSaveError: nextVal };
    });
  };

  const resetAll = () => {
    if (window.confirm('Reset all reviews, logs, and decisions back to initial prototype state?')) {
      setState(createInitialState());
      showToast('Prototype reset to clean baseline and incoming change state.');
    }
  };

  const policyDefs = [
    {
      key: 'requireRationale',
      icon: CheckCircle2,
      title: 'Require explicit rationale before marking any change review complete',
      desc: 'Prevents blank rubber-stamp approvals while allowing source ingestion, graph exploration, and impact analysis to continue unobstructed.'
    },
    {
      key: 'allowAiDrafts',
      icon: Sparkles,
      title: 'Allow AI-assisted rationale drafts from source diffs (human confirmation required)',
      desc: 'Maintainers can generate a source-backed draft from the source diff, but must explicitly confirm or edit it before saving.'
    },
    {
      key: 'separateWorkFromReview',
      icon: GitFork,
      title: 'Separate Knowledge Review completion from Corrective Work completion',
      desc: 'Allows completing an impact review while tracking follow-up work as "Code update open" or "Doc update deferred".'
    }
  ];

  return (
    <div className="canvas-scroll">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>
            Team Roster &amp; Governance Policies
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge variant="accent" size="xs" className="font-mono gap-1">
              <Shield size={12} />
              <span>Active Policy Gate</span>
            </Badge>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Manage review authority, accountability policies, persona switching, and system resilience.
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="subtle"
          size="sm"
          onClick={resetAll}
          title="Reset to default prototype state"
          className="gap-1.5"
        >
          <RotateCcw size={13} />
          <span>Reset Prototype State</span>
        </Button>
      </div>

      {/* Team Roster Table Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__header">
          <div className="card__title">
            <Users size={16} color="var(--accent)" />
            <span>Active Team Members &amp; Review Authorities</span>
          </div>
          <Badge variant="neutral" size="xs">
            {state.teamMembers.length} Contributors
          </Badge>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '28%', minWidth: 220 }}>Contributor</th>
                <th style={{ width: '20%', minWidth: 160 }}>Role</th>
                <th style={{ width: '18%', minWidth: 170 }}>Review Authority</th>
                <th style={{ width: '22%', minWidth: 200 }}>Focus Area</th>
                <th style={{ textAlign: 'right', width: '12%', minWidth: 150 }}>Active Persona</th>
              </tr>
            </thead>
            <tbody>
              {state.teamMembers.map(m => {
                const isCurrent = m.id === state.activeUserId;
                const isAuth = m.authority === 'Authorized Reviewer';

                return (
                  <tr key={m.id} style={{ background: isCurrent ? 'var(--accent-tint)' : undefined }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="account-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {m.initials}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{m.name}</span>
                            {isCurrent && (
                              <Badge variant="accent" size="xs">
                                Current Session
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-2)' }}>{m.roleTitle}</td>
                    <td>
                      <button
                        type="button"
                        className={`status-pill ${isAuth ? 'status--green' : 'status--neutral'}`}
                        onClick={() => toggleMemberAuthority(m.id)}
                        title="Click to toggle review authority"
                        style={{ cursor: 'pointer', border: '1px solid', borderColor: isAuth ? 'var(--green-border)' : 'var(--neutral-border)' }}
                      >
                        {isAuth ? <ShieldCheck size={13} /> : <Eye size={13} />}
                        <span>{m.authority}</span>
                      </button>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--ground-sunken)', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>
                        <FileCode size={11} color="var(--ink-3)" />
                        <span>{m.focus}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isCurrent ? (
                        <Badge variant="accent" size="xs" className="gap-1">
                          <CheckCircle2 size={12} />
                          <span>Currently Active</span>
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() => switchActiveUser(m.id)}
                          title={`Switch active persona to ${m.name}`}
                          className="gap-1.5"
                        >
                          <UserCheck size={12} />
                          <span>Switch to Persona</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contributor Form */}
      <div className="card card--p-md" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <UserPlus size={16} color="var(--accent)" />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Add New Contributor
          </h2>
        </div>

        <form
          onSubmit={handleAddMember}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end'
          }}
        >
          <div className="space-y-1.5" style={{ flex: '2 1 200px', minWidth: 180 }}>
            <label htmlFor="new-contributor-name" className="text-[12px] font-semibold text-[var(--ink-2)]">Full Name</label>
            <Input
              id="new-contributor-name"
              icon={User}
              type="text"
              placeholder="e.g. Maria Santos"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              aria-required="true"
            />
          </div>

          <div className="space-y-1.5" style={{ flex: '2 1 200px', minWidth: 180 }}>
            <label htmlFor="new-contributor-role" className="text-[12px] font-semibold text-[var(--ink-2)]">Role Title</label>
            <Input
              id="new-contributor-role"
              icon={Briefcase}
              type="text"
              placeholder="e.g. Security Auditor"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              required
              aria-required="true"
            />
          </div>

          <div className="space-y-1.5" style={{ flex: '1.5 1 180px', minWidth: 160 }}>
            <label htmlFor="new-contributor-auth" className="text-[12px] font-semibold text-[var(--ink-2)]">Review Authority</label>
            <Select
              id="new-contributor-auth"
              value={newAuth}
              onChange={(e) => setNewAuth(e.target.value)}
              aria-label="Review Authority Level"
            >
              <option value="Authorized Reviewer">Authorized Reviewer</option>
              <option value="Read-Only / Commenter">Read-Only / Commenter</option>
            </Select>
          </div>

          <Button type="submit" variant="default" size="default" className="gap-1.5 shrink-0 px-4">
            <UserPlus size={14} />
            <span>Add Member</span>
          </Button>
        </form>
      </div>

      {/* Governance Policy Toggles */}
      <div className="card card--p-md" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Sliders size={16} color="var(--accent)" />
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              Team Accountability Policies
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
              High-integrity guardrails ensuring code updates cannot be rubber-stamped without verified rationale.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {policyDefs.map(p => {
            const checked = state.policies[p.key];
            const Icon = p.icon;
            return (
              <div
                key={p.key}
                className="switch-card"
                onClick={() => togglePolicy(p.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePolicy(p.key); } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: checked ? 'var(--accent-tint)' : 'var(--ground-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: checked ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0, marginTop: 2 }}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.45 }}>{p.desc}</div>
                  </div>
                </div>

                <div className={`switch-track ${checked ? 'is-checked' : ''}`}>
                  <div className="switch-thumb" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Network Fault Resilience Simulation */}
      <div className="card card--p-md">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: state.simulateSaveError ? 'var(--amber-bg)' : 'var(--ground-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: state.simulateSaveError ? 'var(--amber)' : 'var(--ink-3)' }}>
                <WifiOff size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                  Network Resilience &amp; Offline Draft Preservation
                </h2>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                  Simulates network or local disk I/O errors during accountable review saves to confirm draft rationale preservation without data loss.
                </div>
              </div>
            </div>

            {state.simulateSaveError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 12px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--amber)' }}>
                <AlertTriangle size={15} className="shrink-0" />
                <span>Simulated Network Failure is <strong>ACTIVE</strong>: reviews will reject save and preserve draft text for rollback verification.</span>
              </div>
            )}
          </div>

          <div
            className="switch-card"
            style={{ padding: '8px 14px', alignItems: 'center', width: 'auto' }}
            onClick={toggleSimError}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSimError(); } }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
              {state.simulateSaveError ? 'Simulating Offline' : 'Normal Network'}
            </span>
            <div className={`switch-track ${state.simulateSaveError ? 'is-checked' : ''}`}>
              <div className="switch-thumb" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
