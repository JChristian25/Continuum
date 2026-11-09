import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Database,
  RotateCcw,
  User,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Badge, Input } from './ui/index.js';

export default function ChatbotModule({ ctx }) {
  const { state, setState, showToast, selectArtifact } = ctx;
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedReasoning, setExpandedReasoning] = useState({});
  const messagesEndRef = useRef(null);
  const messageCounterRef = useRef(100);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.chatMessages, isTyping, scrollToBottom]);

  const presetQuestions = [
    'Why was createRequest() modified in R1 and which callers are impacted?',
    'What is the bus factor risk for src/bbb.py and who is the sole maintainer?',
    'Explain the Docling extraction warning for docs/legacy_export.pdf',
    'How does src/compat.py normalizeRequestResult() handle the dictionary return value?',
    'What are the open onboarding steps for the Request Processing handover?'
  ];

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    showToast('Copied answer to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReasoning = (msgId) => {
    setExpandedReasoning(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const sendMessage = (question) => {
    messageCounterRef.current += 1;
    const userMsgId = `msg-${messageCounterRef.current}`;

    const userMsg = {
      id: userMsgId,
      sender: 'user',
      time: 'Just now',
      text: question,
      citations: []
    };

    setState(s => ({
      ...s,
      chatMessages: [...(s.chatMessages || []), userMsg]
    }));

    setIsTyping(true);

    // Simulate Neo4j graph traversal and Docling extraction grounding
    setTimeout(() => {
      let botResponse = '';
      let citations = [];
      let reasoning = [];
      let followUps = [];

      const qLower = question.toLowerCase();

      if (qLower.includes('createrequest') || qLower.includes('dec-04') || qLower.includes('callers') || qLower.includes('r1')) {
        botResponse = `In revision R1 (8f3b21d), \`createRequest(payload)\` in \`src/bbb.py\` was refactored to synchronously return \`{"id": req_id, "status": "PENDING"}\` rather than a plain string \`req_id\`.\n\nThis is governed by Architectural Decision Record **DEC-04**, authored by JC Linaban, which eliminates the need for callers to issue a secondary \`getStatus(req_id)\` query to verify initial queue state.\n\n**Candidate Impact Analysis**:\n- **Breaking Caller**: \`src/aaa.py · submitUserOrder()\` slices \`req_id.strip()\` at line 23, raising an \`AttributeError\` at runtime. Needs caller adaptation to \`req_id["id"]\`.\n- **Documentation Drift**: \`docs/aaa.md §2.1\` still documents the legacy string return shape; prose update is deferred.\n- **Adapter Compatible**: \`src/compat.py · normalizeRequestResult()\` already type-checks \`isinstance(res, dict)\` and operates without changes.`;
        citations = [
          { type: 'Decision Node', id: 'DEC-04', label: 'DEC-04 (Architecture Decision)' },
          { type: 'AST Node', id: 'aaa.py::submitUserOrder', label: 'src/aaa.py:22 (submitUserOrder)' },
          { type: 'Provider Seed', id: 'bbb.py::createRequest', label: 'src/bbb.py:14 (createRequest)' },
          { type: 'Docling Spec', id: 'aaa.md::section-2.1', label: 'docs/aaa.md §2.1' }
        ];
        reasoning = [
          'Traversed Neo4j Bolt graph for bbb.py:createRequest (1.2ms)',
          'Tree-sitter AST caller analysis identified 1 breaking caller in src/aaa.py',
          'Docling Markdown parser verified section §2.1 text against dictionary return shape',
          'Matched against architectural decision DEC-04 intent record'
        ];
        followUps = [
          'How does src/compat.py handle both return types?',
          'Inspect DEC-04 rationale'
        ];
      } else if (qLower.includes('bus factor') || qLower.includes('bbb.py') || qLower.includes('maintainer')) {
        botResponse = `Analysis of commit history and AST authorship indicates that **\`src/bbb.py\` has a Bus Factor of 1 (Critical Risk)**.\n\nKey findings:\n- **Maintainer Concentration**: 88% of commits to this module were made solely by **Cris Albert Jimenez (C. Jimenez)**.\n- **Undocumented Sibling**: While \`createRequest()\` is anchored by DEC-04, sibling function \`cancelRequest()\` has **zero qualifying documentation passages** in any parsed spec.\n- **Mitigation**: Continuum recommends scheduling Sam Rivera for code shadowing and documenting \`cancelRequest()\` before releasing R1 to production.`;
        citations = [
          { type: 'AST Node', id: 'bbb.py::cancelRequest', label: 'src/bbb.py · cancelRequest() (0 links)' },
          { type: 'Provider Seed', id: 'bbb.py::createRequest', label: 'src/bbb.py · createRequest()' }
        ];
        reasoning = [
          'Scanned git commit authorship for src/bbb.py (14 commits across 2 authors)',
          'Identified 88% concentration under C. Jimenez',
          'Queried Docling documentation graph for cancelRequest(): 0 passages found'
        ];
        followUps = [
          'What are the open onboarding steps for the Request Processing handover?',
          'Inspect cancelRequest() in Coverage spectrum'
        ];
      } else if (qLower.includes('docling') || qLower.includes('legacy_export') || qLower.includes('pdf')) {
        botResponse = `During Stage 2 Document Extraction, Docling processed \`docs/legacy_export.pdf\` and detected that it is a **scanned archival document without an extractable digital text layer**.\n\nPer Continuum's high-integrity boundary policy:\n- It is **not** silently marked as unaffected.\n- It is flagged as **Coverage Unknown (Parser Limit)** to prevent false all-clear approvals.\n- Human inspection or OCR enhancement is required to verify if legacy request handling specs are affected.`;
        citations = [
          { type: 'Boundary Disclosed', id: 'docs/legacy_export.pdf', label: 'docs/legacy_export.pdf (Docling Limit)' },
          { type: 'Requirement', id: 'REQ-02', label: 'REQ-02 — Track request status' }
        ];
        reasoning = [
          'Docling PDF parser executed on docs/legacy_export.pdf',
          'OCR fallback detected empty digital text stream',
          'Enforced Boundary Disclosure policy (disclosed limit rather than false clear)'
        ];
      } else if (qLower.includes('compat') || qLower.includes('normalizerequestresult')) {
        botResponse = `\`src/compat.py · normalizeRequestResult()\` is an adapter layer that safely handles both R0 and R1 return contracts.\n\nLines 8–13 branch on \`if isinstance(res, dict): return str(res.get("id", ""))\`. Because this defensive guard was verified at R0, Tree-sitter AST validation marked it as **Reviewed Support at R1** with disposition **"No edit needed"**.`;
        citations = [
          { type: 'AST Node', id: 'compat.py::normalizeRequestResult', label: 'src/compat.py · normalizeRequestResult()' },
          { type: 'Decision Node', id: 'DEC-04', label: 'DEC-04: Structured Dict' }
        ];
        reasoning = [
          'Analyzed AST control flow in src/compat.py:normalizeRequestResult',
          'Verified type-guard isinstance(res, dict) covers R1 return shape',
          'Checked R0 baseline test assertions'
        ];
      } else {
        botResponse = `Based on the Neo4j Artifact Knowledge Graph for repository \`${state.repositories?.[0]?.fullName}\`:\n\nThe current revision \`${state.revisionMode}\` is tracking 14 artifact nodes (code AST units, Docling sections, ADR records, and ISO requirements). One breaking caller change in \`src/aaa.py\` remains pending review, while \`src/bbb.py\` exhibits a bus factor risk with single-author concentration.\n\nWould you like to inspect specific call paths, review candidate impact sets, or check Docling extraction boundaries?`;
        citations = [
          { type: 'Provider Seed', id: 'bbb.py::createRequest', label: 'src/bbb.py' },
          { type: 'Decision Node', id: 'DEC-04', label: 'DEC-04' }
        ];
        reasoning = [
          'Global Neo4j graph state queried (14 nodes, 28 edges)',
          'Fetched current Candidate Impact Set for active revision'
        ];
      }

      messageCounterRef.current += 1;
      const botMsg = {
        id: `msg-${messageCounterRef.current}`,
        sender: 'assistant',
        time: 'Just now',
        text: botResponse,
        citations,
        reasoning,
        followUps
      };

      setState(s => ({
        ...s,
        chatMessages: [...(s.chatMessages || []), botMsg]
      }));
      setIsTyping(false);
    }, 600);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleResetChat = () => {
    setState(s => ({
      ...s,
      chatMessages: [
        {
          id: 'msg-0',
          sender: 'assistant',
          time: 'System Ready',
          text: 'Welcome to Continuum Graph-Grounded Assistant. Every answer is grounded directly in the Neo4j Artifact Knowledge Graph, verified AST call edges from Tree-sitter, and prose sections from Docling. What would you like to explore about your repository continuity?',
          citations: []
        }
      ]
    }));
    showToast('Reset assistant conversation.');
  };

  return (
    <div className="canvas-scroll assistant-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.03em', margin: 0 }}>
            What would you like to understand?
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge variant="accent" size="xs" className="font-mono gap-1">
              <Database size={12} />
              <span>Synthetic repository context</span>
            </Badge>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 650 }}>
              Explore the connections between your code, documentation, and decisions.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={handleResetChat}
          className="gap-1.5"
        >
          <RotateCcw size={12} />
          <span>Reset Chat</span>
        </Button>
      </div>

      {/* Preset Query Chips */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Start with a question
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {presetQuestions.map((q, idx) => (
            <Button
              key={idx}
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => sendMessage(q)}
              disabled={isTyping}
              className="rounded-full gap-1.5 text-[11.5px] px-3 py-1 font-normal text-left h-auto whitespace-normal"
            >
              <span>{q}</span>
              <ArrowRight size={11} className="text-[var(--accent)] shrink-0" />
            </Button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--ground-card)',
          minHeight: 380,
          marginBottom: 16
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {state.chatMessages?.map((msg) => {
            const isUser = msg.sender === 'user';
            const reasoningOpen = expandedReasoning[msg.id];

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  justifyContent: isUser ? 'flex-end' : 'flex-start'
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: 'var(--accent-tint)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Bot size={17} />
                  </div>
                )}

                <div
                  style={{
                    maxWidth: isUser ? '75%' : '88%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      color: 'var(--ink-3)',
                      justifyContent: isUser ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <strong style={{ color: 'var(--ink)' }}>{isUser ? 'You (Practitioner)' : 'Continuum Graph AI'}</strong>
                    <span>·</span>
                    <span>{msg.time}</span>
                  </div>

                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: 'var(--r-lg)',
                      background: isUser ? 'var(--accent)' : 'var(--ground-sunken)',
                      color: isUser ? '#FFFFFF' : 'var(--ink)',
                      border: isUser ? '1px solid var(--accent)' : '1px solid var(--border)',
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {msg.text}
                  </div>

                  {/* Collapsible Reasoning Disclosure */}
                  {!isUser && msg.reasoning && msg.reasoning.length > 0 && (
                    <div
                      style={{
                        borderRadius: 'var(--r-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--ground-card)',
                        overflow: 'hidden',
                        fontSize: 11.5
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleReasoning(msg.id)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--ink-2)',
                          fontFamily: 'inherit'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                          <Sparkles size={13} color="var(--accent)" />
                          <span>Graph Traversal &amp; Extraction Traces ({msg.reasoning.length})</span>
                        </span>
                        {reasoningOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <AnimatePresence>
                        {reasoningOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {msg.reasoning.map((step, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--ink-2)', font: '11.5px/1.45 var(--font-mono)' }}>
                                  <Check size={12} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Interactive Citation Cards */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>
                        Verified Neo4j &amp; Docling citations
                      </span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {msg.citations.map((cite, idx) => (
                          <Button
                            key={idx}
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              if (state.artifacts[cite.id]) {
                                selectArtifact(cite.id);
                              } else {
                                showToast(`${cite.label}: External boundary document disclosed.`);
                              }
                            }}
                            className="font-mono text-[11px] px-2.5 py-1 gap-1.5"
                            title={`Inspect ${cite.label} in context`}
                          >
                            <span style={{ color: 'var(--accent)', fontWeight: 800 }}>[{cite.type}]</span>
                            <span>{cite.label}</span>
                            <ArrowRight size={10} color="var(--ink-3)" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Action Footer */}
                  {!isUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="text-[11px] gap-1 text-[var(--ink-3)]"
                      >
                        {copiedId === msg.id ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                        <span>{copiedId === msg.id ? 'Copied!' : 'Copy Answer'}</span>
                      </Button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: 'var(--ground-sunken)',
                      color: 'var(--ink)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'var(--accent-tint)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bot size={17} />
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--ground-sunken)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Sparkles size={14} color="var(--accent)" />
                <span>Traversing Neo4j knowledge graph &amp; AST call paths…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--ground-sunken)',
            display: 'flex',
            gap: 10,
            alignItems: 'center'
          }}
        >
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about this repository…"
            disabled={isTyping}
            className="flex-1 h-10 text-[13px] bg-[var(--ground-card)]"
            aria-label="Ask Continuum question input"
          />
          <Button
            type="submit"
            variant="default"
            size="default"
            disabled={!inputText.trim() || isTyping}
            className="h-10 gap-1.5 px-4"
          >
            <span>Send</span>
            <Send size={14} />
          </Button>
        </form>
      </div>
    </div>
  );
}
