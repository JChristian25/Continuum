import { Button, Checkbox } from './ui/index.js';
import { useEffect, useState } from 'react';
import { Infinity as InfinityIcon, ArrowRight, ArrowLeft, Check, FolderGit2, AlertCircle, LoaderCircle, FlaskConical, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

const stages = ['Load the repository snapshot', 'Read code and documentation', 'Prepare candidate relationships', 'Build the review queue'];
export default function WorkspaceSetup({ onComplete, onCancel, embedded = false }) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState(0);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (step !== 2 || failed) return;
    const timer = setTimeout(() => {
      if (simulateFailure && stage === 1) setFailed(true);
      else if (stage < stages.length - 1) setStage(value => value + 1);
      else setStep(3);
    }, 550);
    return () => clearTimeout(timer);
  }, [step, stage, simulateFailure, failed]);
  const start = () => { setStage(0); setFailed(false); setStep(2); };
  return <main className={embedded ? 'setup-embedded' : 'setup-page'}>
    {!embedded && <header className="entry-brand"><InfinityIcon size={30} /><span>Continuum</span><Button variant="unstyled" className="text-link" onClick={onCancel}>Sign out</Button></header>}
    <div className="setup-content">
      <ol className="journey-steps" aria-label="Workspace setup progress">{['Workspace', 'Review scope', 'Prepare', 'Ready'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={step >= index ? 'is-current' : ''}><span>{step > index ? <Check size={13} /> : index + 1}</span>{label}</li>)}</ol>
      <motion.div key={step} initial={{ opacity: 0.7, y: 6 }} animate={{ opacity: 1, y: 0 }} className="setup-stage">
        {step === 0 && <><h1>Start with a shared context.</h1><p>Open the sample repository to see how code, evidence, and decisions stay connected.</p><div className="setup-repository"><FolderGit2 size={28} /><div><h2>core/checkout-service</h2><p>Python 3.12 · main · 24 repository files</p></div><Check size={20} /></div><p className="setup-detail">An order-intake service changes its return value from a string to a dictionary. You’ll review the caller, documentation, requirement, and a suggested relationship.</p><div className="inline-notice"><AlertCircle size={18} /><p>This demo loads a local snapshot. It does not connect to GitHub or upload any files.</p></div><div className="journey-actions"><Button variant="unstyled" className="btn btn--accent" onClick={() => setStep(1)}>Use sample repository <ArrowRight size={16} /></Button></div></>}
        {step === 1 && <><h1>Know what you’re reviewing.</h1><p>Keep the baseline and incoming change distinct throughout the review.</p><div className="revision-pair"><section><span>Baseline</span><h2>a41c90e</h2><p>createRequest() returns a string.</p></section><ArrowRight size={22} /><section><span>Incoming Change</span><h2>8f3b21d</h2><p>Returns an ID and initial status.</p></section></div><div className="scope-checks"><p><Check size={16} />Code, documentation, requirements, and recorded intent</p><p><Check size={16} />Candidates remain unconfirmed until human review</p><p><AlertCircle size={16} />One scanned PDF has unknown coverage</p></div><details className="demo-options"><summary className="demo-options-summary"><div className="demo-options-title"><FlaskConical size={14} className="demo-options-icon" /><span>Prototype simulation options</span><span className="demo-options-badge">Testing</span></div><ChevronDown size={14} className="demo-options-chevron" /></summary><div className="demo-options-content"><label className="demo-options-label"><Checkbox checked={simulateFailure} onChange={event => setSimulateFailure(event.target.checked)} /><div><span className="demo-options-toggle-title">Simulate a preparation error</span><p className="demo-options-toggle-desc">Artificially interrupts workspace preparation at stage 2 to preview the error recovery and retry flow.</p></div></label></div></details><div className="journey-actions"><Button variant="unstyled" className="btn btn--secondary" onClick={() => setStep(0)}><ArrowLeft size={15} />Back</Button><Button variant="unstyled" className="btn btn--accent" onClick={start}>Prepare review workspace <ArrowRight size={16} /></Button></div></>}
        {step === 2 && <><h1>{failed ? 'Let’s try that again.' : 'Putting the context together.'}</h1><p>{failed ? 'The demo preparation stopped. Your scope is still selected.' : 'Preparing the local demonstration snapshot. No external services are contacted.'}</p><div className="preparation-list" aria-live="polite">{stages.map((label, index) => <div key={label} className={index <= stage ? 'is-current' : ''}>{index < stage ? <Check size={18} /> : index === stage ? failed ? <AlertCircle size={18} /> : <LoaderCircle size={18} className="loading-spin" /> : <span className="stage-dot" />}<span>{label}</span><small>{index < stage ? 'Ready' : index === stage ? failed ? 'Interrupted' : 'Preparing' : 'Waiting'}</small></div>)}</div>{failed && <div className="journey-actions"><Button variant="unstyled" className="btn btn--secondary" onClick={() => setStep(1)}>Back to scope</Button><Button variant="unstyled" className="btn btn--accent" onClick={() => { setSimulateFailure(false); start(); }}>Retry preparation</Button></div>}</>}
        {step === 3 && <><Check className="setup-success" size={30} /><h1>Your workspace is ready.</h1><p>Follow the return-contract change through five review items. Two sample judgments are already recorded; your saved progress is preserved.</p><div className="inline-notice"><AlertCircle size={18} /><p>Coverage is incomplete for docs/legacy_export.pdf. Completing the queue does not mean every artifact is verified.</p></div><div className="journey-actions"><Button variant="unstyled" className="btn btn--secondary" onClick={() => onComplete({ repoId: 'repo-checkout', targetModule: 'dashboard' })}>Go to workspace</Button><Button variant="unstyled" className="btn btn--accent" onClick={() => onComplete({ repoId: 'repo-checkout', targetModule: 'changes' })}>Start reviewing <ArrowRight size={16} /></Button></div></>}
      </motion.div>
    </div>
  </main>;
}
