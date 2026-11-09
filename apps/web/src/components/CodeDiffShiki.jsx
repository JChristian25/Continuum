import { useState, useEffect } from 'react';
import { codeToHtml } from 'shiki';
import { transformerNotationDiff } from '@shikijs/transformers';
import { Copy, Check, FileCode2 } from 'lucide-react';
import { Button } from './ui/index.js';

const R0_CODE = `def createRequest(payload: dict) -> str:
    req_id = generate_uuid()
    redis_client.rpush("q:req", req_id)
    return req_id  # Plain string return`.trim();

const R1_CODE = `def createRequest(payload: dict) -> dict:
    req_id = generate_uuid()
    redis_client.rpush("q:req", req_id)
    return {"id": req_id, "status": "PENDING"}  # Object return`.trim();

const UNIFIED_DIFF_CODE = `def createRequest(payload: dict):
    req_id = generate_uuid()
    redis_client.rpush("q:req", req_id)
// [!code --]
    return req_id  # Scalar string return (R0 a41c90e)
// [!code ++]
    return {"id": req_id, "status": "PENDING"}  # Dict contract (R1 DEC-04)`.trim();

export default function CodeDiffShiki({
  viewMode = 'split',
  theme = 'dark'
}) {
  const [splitR0Html, setSplitR0Html] = useState('');
  const [splitR1Html, setSplitR1Html] = useState('');
  const [unifiedHtml, setUnifiedHtml] = useState('');
  const [copied, setCopied] = useState(false);

  const loading = !splitR0Html;
  const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light';

  useEffect(() => {
    let isCancelled = false;

    async function highlight() {
      try {
        const [r0, r1, uni] = await Promise.all([
          codeToHtml(R0_CODE, {
            lang: 'python',
            theme: shikiTheme
          }),
          codeToHtml(R1_CODE, {
            lang: 'python',
            theme: shikiTheme
          }),
          codeToHtml(UNIFIED_DIFF_CODE, {
            lang: 'python',
            theme: shikiTheme,
            transformers: [transformerNotationDiff({ matchAlgorithm: 'v3' })]
          })
        ]);

        if (!isCancelled) {
          setSplitR0Html(r0);
          setSplitR1Html(r1);
          setUnifiedHtml(uni);
        }
      } catch (err) {
        console.error('Shiki highlight error:', err);
      }
    }

    highlight();
    return () => { isCancelled = true; };
  }, [shikiTheme]);

  const handleCopy = () => {
    const textToCopy = viewMode === 'split' ? `R0 Baseline:\n${R0_CODE}\n\nR1 Target:\n${R1_CODE}` : UNIFIED_DIFF_CODE;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="shiki-container">
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--ground-sunken)',
        fontSize: 11
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
          <FileCode2 size={13} color="var(--accent)" />
          <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>src/bbb.py:14-18</span>
          <span>· TextMate Python Grammar (Shiki)</span>
        </div>

        <Button
          variant="subtle"
          size="xs"
          onClick={handleCopy}
          className="gap-1 h-6 text-[11px]"
          title="Copy diff to clipboard"
        >
          {copied ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy Code'}</span>
        </Button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
          Highlighting code AST diff with Shiki…
        </div>
      ) : viewMode === 'split' ? (
        /* Side-by-side split view */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Left: R0 */}
          <div style={{ borderRight: '1px solid var(--border)' }}>
            <div style={{
              padding: '6px 14px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--red)',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }}>
              − R0 Baseline (a41c90e) · Scalar Contract
            </div>
            <div
              className="shiki-split-pane"
              dangerouslySetInnerHTML={{ __html: splitR0Html }}
            />
          </div>

          {/* Right: R1 */}
          <div>
            <div style={{
              padding: '6px 14px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(16, 185, 129, 0.08)',
              color: 'var(--green)',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }}>
              + R1 Changed (8f3b21d) · Object Dict Contract
            </div>
            <div
              className="shiki-split-pane"
              dangerouslySetInnerHTML={{ __html: splitR1Html }}
            />
          </div>
        </div>
      ) : (
        /* Unified diff view */
        <div>
          <div style={{
            padding: '6px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--ground-sunken)',
            color: 'var(--ink-2)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)'
          }}>
            Unified Diff · R0 (a41c90e) → R1 (8f3b21d)
          </div>
          <div dangerouslySetInnerHTML={{ __html: unifiedHtml }} />
        </div>
      )}
    </div>
  );
}
