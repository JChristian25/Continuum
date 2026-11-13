import { useState, useTransition, useCallback } from 'react';
import {
  ShieldCheck,
  Truck,
  ArrowRight,
  Users,
  CheckSquare,
  Check,
  FileCode
} from 'lucide-react';
import { getCoverageInfo } from '../data/helpers.js';
import CoverageVisxSpectrum from './CoverageVisxSpectrum.jsx';
import TruckFactorVisxGauge from './TruckFactorVisxGauge.jsx';
import Tooltip from './Tooltip.jsx';
import { Button, Badge, Tabs, TabsList, TabsTrigger } from './ui/index.js';

export default function CoverageModule({ ctx }) {
  const { state, setState, showToast, selectArtifact, triggerConfetti } = ctx;

  const [subtab, setSubtab] = useState(state.coverageSubtab || 'doc_coverage');
  const [filter, setFilter] = useState(state.coverageFilter || 'all');
  const [isPending, startTransition] = useTransition();

  const handleSetFilter = useCallback((newFilter) => {
    startTransition(() => {
      setFilter(newFilter);
    });
  }, []);

  const handleSetSubtab = useCallback((newSubtab) => {
    startTransition(() => {
      setSubtab(newSubtab);
    });
  }, []);

  const covIds = [
    'bbb.py::createRequest',
    'bbb.py::cancelRequest',
    'aaa.py::submitUserOrder',
    'compat.py::normalizeRequestResult',
    'docs/onboarding_notes.md',
    'docs/legacy_export.pdf'
  ];
  const covItems = covIds.map(id => state.artifacts[id]).filter(Boolean);

  const filterDefs = [
    { key: 'all', label: `All Elements (${covItems.length})` },
    { key: 'reviewed', label: `Reviewed (${covItems.filter(a => a.coverageCondition === 'reviewed').length})` },
    { key: 'attention', label: `Needs Attention (${covItems.filter(a => a.coverageCondition === 'attention').length})` },
    { key: 'candidate', label: `Candidate (${covItems.filter(a => a.coverageCondition === 'candidate').length})` },
    { key: 'no_link', label: `No Link (${covItems.filter(a => a.coverageCondition === 'no_link').length})` },
    { key: 'unknown', label: `Unknown Boundary (${covItems.filter(a => a.coverageCondition === 'unknown').length})` }
  ];

  const fileGroups = [
    {
      file: 'src/bbb.py (Request Core)',
      note: '2 code elements · Mixed conditions: createRequest has earlier support; sibling cancelRequest has zero known documentation',
      ids: ['bbb.py::createRequest', 'bbb.py::cancelRequest']
    },
    {
      file: 'src/aaa.py (Order Intake)',
      note: '1 code element · Reviewed documentation & requirement support',
      ids: ['aaa.py::submitUserOrder']
    },
    {
      file: 'src/compat.py (Adapter Layer)',
      note: '1 code element · Reviewed documentation support for incoming change',
      ids: ['compat.py::normalizeRequestResult']
    },
    {
      file: 'docs/onboarding_notes.md & docs/legacy_export.pdf',
      note: '1 unreviewed embedding candidate + 1 scanned PDF extraction boundary',
      ids: ['docs/onboarding_notes.md', 'docs/legacy_export.pdf']
    }
  ];

  const moduleCards = [
    {
      name: 'src/bbb.py (Request Core)',
      dotColor: 'dot--red',
      statusCls: 'status--red',
      tfLabel: 'Truck Factor: 1 (Critical)',
      authorPct: 88,
      breakdown: '88% C. Jimenez · 12% JC Linaban',
      warning: 'cancelRequest() has 100% single-author commits and zero recorded rationale or doc links.',
      targetId: 'bbb.py::cancelRequest'
    },
    {
      name: 'src/aaa.py (Order Intake)',
      dotColor: 'dot--amber',
      statusCls: 'status--amber',
      tfLabel: 'Truck Factor: 2 (Moderate)',
      authorPct: 55,
      breakdown: '55% JC Linaban · 45% A. Marasigan',
      warning: 'submitUserOrder() has an open caller adaptation linked to DEC-04.',
      targetId: 'aaa.py::submitUserOrder'
    },
    {
      name: 'src/compat.py (Adapter Layer)',
      dotColor: 'dot--green',
      statusCls: 'status--green',
      tfLabel: 'Truck Factor: 2 (Healthy)',
      authorPct: 50,
      breakdown: '50% C. Jimenez · 50% JC Linaban',
      warning: 'Reviewed rationale for baseline and incoming change; verified compatible with both return shapes.',
      targetId: 'compat.py::normalizeRequestResult'
    }
  ];

  const toggleOnboardingStep = (stepId) => {
    setState(s => {
      const nextSteps = s.onboardingSteps?.map(st => {
        if (st.id === stepId) {
          const updated = { ...st, done: !st.done };
          if (updated.done) {
            triggerConfetti?.({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
          }
          showToast(`${updated.done ? 'Completed' : 'Reopened'} onboarding step: ${st.title}`);
          return updated;
        }
        return st;
      }) || [];
      return { ...s, onboardingSteps: nextSteps };
    });
  };

  const doneSteps = state.onboardingSteps?.filter(s => s.done).length || 0;
  const totalSteps = state.onboardingSteps?.length || 4;

  return (
    <div className="canvas-scroll">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', margin: 0 }}>
            Coverage Spectrum &amp; Bus Factor
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge variant="accent" size="xs" className="font-mono gap-1">
              <ShieldCheck size={12} />
              <span>{covItems.length} Tracked Units</span>
            </Badge>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 660 }}>
              Element-level documentation support, parser boundary disclosures, and team knowledge concentration analysis.
            </p>
          </div>
        </div>

        {/* Subtabs Switcher */}
        <Tabs value={subtab} onValueChange={handleSetSubtab}>
          <TabsList>
            <TabsTrigger value="doc_coverage" className="gap-1.5 text-[11px]">
              <ShieldCheck size={13} />
              <span>Element-Level Coverage</span>
            </TabsTrigger>
            <TabsTrigger value="bus_factor" className="gap-1.5 text-[11px]">
              <Truck size={13} />
              <span>Bus Factor &amp; Onboarding</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {subtab === 'doc_coverage' ? (
        <div style={{ opacity: isPending ? 0.75 : 1, transition: 'opacity 0.15s ease' }}>
          {/* Visual Spectrum Bar */}
          <div className="card card--p-md" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Repository Traceability Spectrum</span>
              <span className="font-mono" style={{ color: 'var(--ink-2)' }}>6 Total Units</span>
            </div>

            {/* Visx SVG Scaled Multi-segment Spectrum Bar */}
            <CoverageVisxSpectrum items={covItems} filter={filter} onSelectFilter={handleSetFilter} />

            {/* Dynamic Spectrum Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 14, fontSize: 11.5 }}>
              <Button variant="unstyled"
                type="button"
                onClick={() => handleSetFilter(filter === 'reviewed' ? 'all' : 'reviewed')}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', cursor: 'pointer', opacity: filter === 'all' || filter === 'reviewed' ? 1 : 0.45 }}
              >
                <span className="status-dot dot--green" /> Reviewed Support ({covItems.filter(a => a.coverageCondition === 'reviewed').length})
              </Button>
              <Button variant="unstyled"
                type="button"
                onClick={() => handleSetFilter(filter === 'attention' ? 'all' : 'attention')}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', cursor: 'pointer', opacity: filter === 'all' || filter === 'attention' ? 1 : 0.45 }}
              >
                <span className="status-dot dot--amber" /> Needs Attention ({covItems.filter(a => a.coverageCondition === 'attention').length})
              </Button>
              <Button variant="unstyled"
                type="button"
                onClick={() => handleSetFilter(filter === 'candidate' ? 'all' : 'candidate')}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', cursor: 'pointer', opacity: filter === 'all' || filter === 'candidate' ? 1 : 0.45 }}
              >
                <span className="status-dot dot--indigo" /> Candidate ({covItems.filter(a => a.coverageCondition === 'candidate').length})
              </Button>
              <Button variant="unstyled"
                type="button"
                onClick={() => handleSetFilter(filter === 'no_link' ? 'all' : 'no_link')}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', cursor: 'pointer', opacity: filter === 'all' || filter === 'no_link' ? 1 : 0.45 }}
              >
                <span className="status-dot dot--red" /> No Known Doc ({covItems.filter(a => a.coverageCondition === 'no_link').length})
              </Button>
              <Button variant="unstyled"
                type="button"
                onClick={() => handleSetFilter(filter === 'unknown' ? 'all' : 'unknown')}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', cursor: 'pointer', opacity: filter === 'all' || filter === 'unknown' ? 1 : 0.45 }}
              >
                <span className="status-dot dot--neutral" /> Boundary Disclosed ({covItems.filter(a => a.coverageCondition === 'unknown').length})
              </Button>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {filterDefs.map(f => (
              <Button
                key={f.key}
                type="button"
                variant={filter === f.key ? 'default' : 'secondary'}
                size="xs"
                onClick={() => handleSetFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Grouped File Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fileGroups.map((g, idx) => {
              const rows = g.ids
                .map(id => state.artifacts[id])
                .filter(a => filter === 'all' || a?.coverageCondition === filter);

              if (rows.length === 0) return null;

              return (
                <div key={idx} className="card">
                  <div className="card__header">
                    <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                      {g.file}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{g.note}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {rows.map(art => {
                      const isSel = state.selectedArtifactId === art.id && state.inspectorOpen;
                      const cInfo = getCoverageInfo(art);

                      return (
                        <div
                          key={art.id}
                          onClick={() => selectArtifact(art.id)}
                          tabIndex="0"
                          role="button"
                          aria-label={`Inspect ${art.shortName}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectArtifact(art.id);
                            }
                          }}
                          style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--border)',
                            background: isSel ? 'var(--accent-tint)' : 'transparent',
                            borderLeft: isSel ? '1px solid var(--accent)' : '1px solid transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12,
                            transition: 'background 0.12s ease'
                          }}
                        >
                          <div style={{ minWidth: 0, maxWidth: 640 }}>
                            <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>
                              {art.shortName}
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                              {art.coverageDetail}
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className={`status-pill status-pill--sm ${cInfo.cls}`}>
                              <span className={`status-dot ${cInfo.dot}`} />
                              <span>{cInfo.text}</span>
                            </span>
                            <ArrowRight size={14} color={isSel ? 'var(--accent)' : 'var(--ink-3)'} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Subtab B: Bus Factor & Onboarding */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Truck Factor Cards */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Truck size={16} color="var(--accent)" />
              <span>Module Knowledge Concentration &amp; Truck Factor Analysis</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 16 }}>
              {moduleCards.map((mc, idx) => (
                <div key={idx} className="card card--p-md" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        {mc.name}
                      </span>
                      <Tooltip title="Bus Factor Assessment" content={mc.warning} side="top">
                        <span className={`status-pill status-pill--sm ${mc.statusCls}`} style={{ cursor: 'help' }}>
                          <span className={`status-dot ${mc.dotColor}`} />
                          <span>{mc.tfLabel}</span>
                        </span>
                      </Tooltip>
                    </div>

                    {/* Visx Arc Radial Gauge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '10px 0' }}>
                      <TruckFactorVisxGauge
                        pct={mc.authorPct}
                        label="Concentration"
                        statusColor={mc.authorPct > 75 ? 'var(--red)' : mc.authorPct > 50 ? 'var(--amber)' : 'var(--green)'}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                          {mc.breakdown}
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                          {mc.warning}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="subtle"
                      size="xs"
                      onClick={() => selectArtifact(mc.targetId)}
                      className="text-[var(--accent)] font-semibold gap-1"
                    >
                      <span>Inspect module evidence</span>
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guided Onboarding Checklist Card */}
          <div className="card">
            <div className="card__header">
              <div className="card__title">
                <CheckSquare size={16} color="var(--accent)" />
                <span>Request Processing Handover Onboarding Checklist</span>
              </div>
              <Badge variant="accent" size="xs" className="font-mono">
                {doneSteps} of {totalSteps} Complete
              </Badge>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.onboardingSteps?.map((st) => (
                <div
                  key={st.id}
                  onClick={() => toggleOnboardingStep(st.id)}
                  role="checkbox"
                  aria-checked={st.done}
                  tabIndex="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleOnboardingStep(st.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md)',
                    background: st.done ? 'var(--green-bg)' : 'var(--ground-sunken)',
                    border: st.done ? '1px solid var(--green-border)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: st.done ? 'none' : '2px solid var(--border-vis)',
                        background: st.done ? 'var(--green)' : 'transparent',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {st.done && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: st.done ? 'var(--green)' : 'var(--ink)',
                        textDecoration: st.done ? 'line-through' : 'none'
                      }}
                    >
                      {st.title}
                    </span>
                  </div>

                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {st.owner}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Contributor Matrix Table */}
          <div className="card">
            <div className="card__header">
              <div className="card__title">
                <Users size={16} color="var(--accent)" />
                <span>Contributor Knowledge Matrix</span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table" aria-label="Team Contributor Knowledge Matrix">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '32%', minWidth: 220 }}>Contributor &amp; Role</th>
                    <th scope="col" className="th-num" style={{ width: 100 }}>Commits</th>
                    <th scope="col" className="th-num" style={{ width: 110 }}>Decisions</th>
                    <th scope="col" className="th-num" style={{ width: 100 }}>Reviews</th>
                    <th scope="col" style={{ minWidth: 260 }}>Core Focus &amp; Concentration</th>
                  </tr>
                </thead>
                <tbody>
                  {state.teamMembers?.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="account-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                            {m.initials}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{m.roleTitle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono td-num" style={{ fontWeight: 600 }}>{m.commits}</td>
                      <td className="font-mono td-num" style={{ fontWeight: 600 }}>{m.decisions}</td>
                      <td className="font-mono td-num" style={{ fontWeight: 600 }}>{m.reviews}</td>
                      <td>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--ground-sunken)', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>
                          <FileCode size={11} color="var(--ink-3)" />
                          <span>{m.focus}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
