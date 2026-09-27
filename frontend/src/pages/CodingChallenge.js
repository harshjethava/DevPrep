import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import Editor from '@monaco-editor/react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from 'react-resizable-panels';
import {
  ArrowLeft,
  Play,
  Send,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  HardDrive,
  AlertTriangle,
  Loader2,
  Timer,
  Code2,
  ExternalLink
} from 'lucide-react';
import { codingAPI } from '../services/api';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', monacoId: 'javascript' },
  { value: 'python', label: 'Python 3', monacoId: 'python' },
  { value: 'cpp', label: 'C++', monacoId: 'cpp' },
  { value: 'java', label: 'Java', monacoId: 'java' },
  { value: 'c', label: 'C', monacoId: 'c' }
];

const DEFAULT_CODE = {
  javascript: '// Read from stdin and print output\nprocess.stdin.resume();\nprocess.stdin.setEncoding("utf8");\nlet _input = "";\nprocess.stdin.on("data", (d) => (_input += d));\nprocess.stdin.on("end", () => {\n  const lines = _input.trim().split("\\n");\n  \n  // Your solution here\n  \n  // Example: console.log(answer);\n});\n',
  python: '# Write your solution here\nimport sys\n\ndef solve():\n    input_data = sys.stdin.read().strip()\n    lines = input_data.split("\\n")\n    \n    # Your code here\n    \n    print()\n\nsolve()\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Your code here\n    \n    return 0;\n}\n',
  java: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        \n        // Your code here\n        \n        sc.close();\n    }\n}\n',
  c: '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nint main() {\n    // Your code here\n    \n    return 0;\n}\n'
};

const difficultyColors = {
  easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  hard: 'bg-red-500/20 text-red-300 border-red-500/30'
};

const statusLabels = {
  accepted: { label: 'Accepted', color: 'text-emerald-400', icon: CheckCircle2 },
  wrong_answer: { label: 'Wrong Answer', color: 'text-red-400', icon: XCircle },
  runtime_error: { label: 'Runtime Error', color: 'text-red-400', icon: AlertTriangle },
  compile_error: { label: 'Compile Error', color: 'text-red-400', icon: AlertTriangle },
  time_limit: { label: 'Time Limit', color: 'text-amber-400', icon: Clock },
  memory_limit: { label: 'Memory Limit', color: 'text-amber-400', icon: HardDrive },
  error: { label: 'Error', color: 'text-red-400', icon: AlertTriangle }
};

const CodingChallenge = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ready, getToken } = useReadyAuth();
  const { user } = useUser();

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE.javascript);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [activeTab, setActiveTab] = useState('testcases');
  const [hintsOpen, setHintsOpen] = useState(false);

  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const editorRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // Fetch problem
  useEffect(() => {
    if (!ready || !id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) return;
        const res = await codingAPI.getProblem(token, id);
        const prob = res.data.problem;
        setProblem(prob);

        // Load draft or starter code
        const draft = res.data.draft;
        if (draft && draft.code) {
          setCode(draft.code);
          setLanguage(draft.language || 'javascript');
        } else if (prob.starterCode && typeof prob.starterCode === 'object') {
          const starter = prob.starterCode[language] || prob.starterCode.javascript;
          if (starter) setCode(starter);
        }

        // Set custom input from first test case
        if (prob.testCases && prob.testCases.length > 0) {
          setCustomInput(prob.testCases[0].input || '');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load problem');
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, id, getToken]);

  // Timer
  useEffect(() => {
    let interval;
    if (timerActive) {
      interval = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Language change handler
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    // Load starter code for new language if user hasn't modified code much
    if (problem?.starterCode && problem.starterCode[newLang]) {
      setCode(problem.starterCode[newLang]);
    } else if (DEFAULT_CODE[newLang]) {
      setCode(DEFAULT_CODE[newLang]);
    }
  };

  // Auto-save draft
  const draftSave = useCallback(async (codeToSave) => {
    if (!ready || !id) return;
    try {
      const token = await getToken();
      if (!token) return;
      await codingAPI.saveDraft(token, id, { language, code: codeToSave });
    } catch (_) {}
  }, [ready, id, getToken, language]);

  const handleCodeChange = (value) => {
    const newCode = value || '';
    setCode(newCode);
    // Debounced auto-save
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => draftSave(newCode), 5000);
  };

  // Run code against sample test cases (or custom input)
  const handleRun = async () => {
    if (running || submitting) return;
    setRunning(true);
    setRunResults(null);
    setActiveTab('results');
    try {
      const token = await getToken();
      if (!token) return;

      // Use codingAPI which calls /coding/problems/:id/run
      // Pass customInput only when the user is on the Custom Input tab
      const payload = { language, code };
      if (showCustomInput && customInput.trim()) {
        payload.customInput = customInput.trim();
      }

      const res = await codingAPI.runCode(token, id, payload);
      const run = res.data.run;

      // The run endpoint returns { results[], passedCount, totalCount }
      // For custom input runs, passedCount is null (no expected output to compare against)
      const overallStatus =
        run.passedCount === null
          ? (run.results[0]?.status || 'accepted')  // custom input — show exec status
          : run.passedCount === run.totalCount
            ? 'accepted'
            : (run.results.find((r) => !r.passed)?.status || 'wrong_answer');

      setRunResults({
        results: run.results,
        passedCount: run.passedCount,
        totalCount:  run.totalCount,
        overallStatus,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  // Submit code against all test cases (including hidden)
  const handleSubmit = async () => {
    if (running || submitting) return;
    setSubmitting(true);
    setSubmitResult(null);
    setActiveTab('results');
    try {
      const token = await getToken();
      if (!token) return;

      // Use codingAPI which calls /coding/problems/:id/submit
      const res = await codingAPI.submitSolution(token, id, { language, code });
      const { result, message } = res.data;

      setSubmitResult(result);

      if (result?.status === 'accepted') {
        toast.success('All test cases passed! 🎉');
      } else {
        toast.error(message || 'Some test cases failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await codingAPI.saveDraft(token, id, { language, code });
      toast.success('Draft saved');
    } catch (err) {
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  // Reset code
  const handleReset = () => {
    if (problem?.starterCode && problem.starterCode[language]) {
      setCode(problem.starterCode[language]);
    } else {
      setCode(DEFAULT_CODE[language] || '');
    }
    setRunResults(null);
    setSubmitResult(null);
    toast.info('Code reset');
  };

  // Editor mount
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  // Render results
  const currentResult = submitResult || runResults;

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          <span className="text-slate-300">Loading problem...</span>
        </div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <div className="text-red-400">{error || 'Problem not found'}</div>
          <button
            onClick={() => navigate('/coding/practice')}
            className="mt-4 px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-600/30 transition"
          >
            Back to Problems
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-black/30 backdrop-blur-xl shrink-0">
        <button
          onClick={() => navigate('/coding/practice')}
          className="p-1.5 rounded-lg hover:bg-white/10 transition text-slate-300"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <Code2 className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="text-sm font-medium truncate">{problem.title}</span>
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${difficultyColors[problem.difficulty] || ''}`}>
            {problem.difficulty ? problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1) : ''}
          </span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTimerActive((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition ${
              timerActive ? 'bg-violet-600/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            {formatTime(timer)}
          </button>
          {timer > 0 && (
            <button
              onClick={() => { setTimer(0); setTimerActive(false); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Left panel — Problem description */}
          <Panel defaultSize={45} minSize={25}>
            <div className="h-full overflow-y-auto custom-scrollbar">
              <div className="p-5 space-y-5">
                {/* Title + tags */}
                <div>
                  <h1 className="text-xl font-semibold">{problem.title}</h1>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${difficultyColors[problem.difficulty] || ''}`}>
                      {problem.difficulty ? problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1) : ''}
                    </span>
                    {problem.category && (
                      <span className="px-2 py-0.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {problem.category}
                      </span>
                    )}
                    {(problem.tags || []).slice(0, 4).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md text-xs bg-white/5 text-slate-400 border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Codeforces banner */}
                {problem.source === 'codeforces' && problem.hints && problem.hints.length > 0 && (
                  (() => {
                    const cfUrl = (problem.hints[0] || '').replace('Full problem statement: ', '').trim();
                    return cfUrl.startsWith('http') ? (
                      <a
                        href={cfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-300 hover:bg-blue-600/25 hover:border-blue-400/50 transition text-sm font-medium"
                      >
                        <ExternalLink className="w-4 h-4 shrink-0" />
                        View Full Problem on Codeforces
                        <span className="ml-auto text-xs text-blue-400 opacity-70">Opens in new tab →</span>
                      </a>
                    ) : null;
                  })()
                )}

                {/* Description */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {problem.source === 'codeforces'
                      ? (
                        // For CF problems strip the markdown URL syntax and show clean text
                        problem.description
                          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // strip [text](url)
                          .replace(/\*\*([^*]+)\*\*/g, '$1')         // strip **bold**
                      )
                      : problem.description
                    }
                  </div>
                </div>

                {/* Input/Output format */}
                {problem.inputFormat && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Input</h3>
                    <div className="text-sm text-slate-400 whitespace-pre-wrap">{problem.inputFormat}</div>
                  </div>
                )}
                {problem.outputFormat && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Output</h3>
                    <div className="text-sm text-slate-400 whitespace-pre-wrap">{problem.outputFormat}</div>
                  </div>
                )}

                {/* Examples */}
                {problem.examples && problem.examples.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Examples</h3>
                    <div className="space-y-3">
                      {problem.examples.map((ex, i) => (
                        <div key={i} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                          <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 text-xs text-slate-400 font-medium">
                            Example {i + 1}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                            <div className="p-3">
                              <div className="text-xs text-slate-500 mb-1">Input</div>
                              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{ex.input || 'N/A'}</pre>
                            </div>
                            <div className="p-3">
                              <div className="text-xs text-slate-500 mb-1">Output</div>
                              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{ex.output || 'N/A'}</pre>
                            </div>
                          </div>
                          {ex.explanation && (
                            <div className="px-3 py-2 border-t border-white/10 bg-white/5">
                              <div className="text-xs text-slate-400">{ex.explanation}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints */}
                {problem.constraints && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Constraints</h3>
                    <div className="text-sm text-slate-400 whitespace-pre-wrap">{problem.constraints}</div>
                  </div>
                )}

                {/* Hints */}
                {problem.hints && problem.hints.length > 0 && (
                  <div className="rounded-xl border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setHintsOpen((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/8 transition"
                    >
                      <span className="text-sm font-medium text-amber-300">💡 Hints ({problem.hints.length})</span>
                      {hintsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {hintsOpen && (
                      <div className="px-4 py-3 space-y-2 border-t border-white/10">
                        {problem.hints.map((hint, i) => {
                          // Detect if hint contains a URL
                          const urlMatch = hint.match(/(https?:\/\/[^\s]+)/);
                          const urlPart  = urlMatch ? urlMatch[1] : null;
                          const textPart = urlPart ? hint.replace(urlPart, '').trim() : hint;
                          return (
                            <div key={i} className="text-sm text-slate-400">
                              <span className="text-amber-400 font-medium">Hint {i + 1}:</span>{' '}
                              {textPart}
                              {urlPart && (
                                <a
                                  href={urlPart}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-blue-400 hover:text-blue-300 underline underline-offset-2"
                                >
                                  {urlPart.length > 60 ? urlPart.slice(0, 60) + '…' : urlPart}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* Resize handle */}
          <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-violet-500/30 transition-colors cursor-col-resize flex items-center justify-center">
            <div className="w-0.5 h-8 rounded-full bg-white/20" />
          </PanelResizeHandle>

          {/* Right panel — Editor + Results */}
          <Panel defaultSize={55} minSize={30}>
            <PanelGroup direction="vertical" className="h-full">
              {/* Editor panel */}
              <Panel defaultSize={65} minSize={30}>
                <div className="h-full flex flex-col">
                  {/* Editor toolbar */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/30 shrink-0">
                    <select
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="appearance-none px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-violet-500/50 cursor-pointer hover:border-white/20 transition"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value} className="bg-gray-900 text-white">
                          {lang.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex-1" />

                    <button
                      onClick={handleReset}
                      disabled={running || submitting}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200 disabled:opacity-50 transition"
                      title="Reset code"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                    <button
                      onClick={handleSaveDraft}
                      disabled={saving || running || submitting}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200 disabled:opacity-50 transition"
                      title="Save draft"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Save</span>
                    </button>
                    <button
                      onClick={handleRun}
                      disabled={running || submitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50 transition font-medium"
                    >
                      {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Run
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={running || submitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 border border-violet-500 text-xs text-white font-semibold disabled:opacity-50 transition shadow-[0_0_10px_rgba(139,92,246,0.2)] hover:shadow-[0_0_15px_rgba(139,92,246,0.35)]"
                    >
                      {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Submit
                    </button>
                  </div>

                  {/* Monaco Editor */}
                  <div className="flex-1 min-h-0">
                    <Editor
                      height="100%"
                      language={LANGUAGES.find((l) => l.value === language)?.monacoId || 'javascript'}
                      value={code}
                      onChange={handleCodeChange}
                      onMount={handleEditorMount}
                      theme="vs-dark"
                      options={{
                        fontSize: 14,
                        fontFamily: "'Fira Code', 'Source Code Pro', Menlo, Monaco, 'Courier New', monospace",
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        roundedSelection: true,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        padding: { top: 12, bottom: 12 },
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true,
                        formatOnPaste: true,
                        formatOnType: true
                      }}
                    />
                  </div>
                </div>
              </Panel>

              {/* Resize handle */}
              <PanelResizeHandle className="h-1.5 bg-white/5 hover:bg-violet-500/30 transition-colors cursor-row-resize flex items-center justify-center">
                <div className="h-0.5 w-8 rounded-full bg-white/20" />
              </PanelResizeHandle>

              {/* Results panel */}
              <Panel defaultSize={35} minSize={15}>
                <div className="h-full flex flex-col overflow-hidden">
                  {/* Tabs */}
                  <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/10 bg-black/30 shrink-0">
                    <button
                      onClick={() => setActiveTab('testcases')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        activeTab === 'testcases' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      Test Cases
                    </button>
                    <button
                      onClick={() => setActiveTab('results')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        activeTab === 'results' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      Results
                      {currentResult && (
                        <span className={`ml-1.5 ${currentResult.overallStatus === 'accepted' || currentResult.status === 'accepted' ? 'text-emerald-400' : 'text-red-400'}`}>
                          ●
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('custom')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        activeTab === 'custom' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      Custom Input
                    </button>
                  </div>

                  {/* Tab content */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {/* Test Cases tab */}
                    {activeTab === 'testcases' && (
                      <div className="space-y-2">
                        {problem.testCases && problem.testCases.length > 0 ? (
                          problem.testCases.map((tc, i) => (
                            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <div className="text-xs text-slate-400 font-medium mb-1.5">Case {i + 1}</div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[10px] text-slate-500 mb-1 uppercase">Input</div>
                                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-black/30 rounded p-2">{tc.input}</pre>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-500 mb-1 uppercase">Expected</div>
                                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-black/30 rounded p-2">{tc.expectedOutput}</pre>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-500 text-center py-4">No sample test cases available</div>
                        )}
                      </div>
                    )}

                    {/* Results tab */}
                    {activeTab === 'results' && (
                      <div>
                        {(running || submitting) && (
                          <div className="flex items-center gap-3 py-8 justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                            <span className="text-sm text-slate-400">
                              {submitting ? 'Submitting and judging...' : 'Running code...'}
                            </span>
                          </div>
                        )}

                        {!running && !submitting && !currentResult && (
                          <div className="text-sm text-slate-500 text-center py-8">
                            Click Run or Submit to see results
                          </div>
                        )}

                        {!running && !submitting && currentResult && (
                          <div className="space-y-3">
                            {/* Overall status */}
                            {(() => {
                              const statusKey = currentResult.overallStatus || currentResult.status;
                              const s = statusLabels[statusKey] || statusLabels.error;
                              const Icon = s.icon;
                              // run endpoint  → passedCount / totalCount
                              // submit endpoint → passedTests / totalTests
                              const passed = currentResult.passedCount ?? currentResult.passedTests ?? null;
                              const total  = currentResult.totalCount  ?? currentResult.totalTests  ?? null;
                              return (
                                <div className={`flex items-center gap-3 rounded-xl border p-3 ${
                                  statusKey === 'accepted'
                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                    : 'border-red-500/30 bg-red-500/10'
                                }`}>
                                  <Icon className={`w-5 h-5 ${s.color}`} />
                                  <div>
                                    <div className={`text-sm font-semibold ${s.color}`}>{s.label}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                      {passed !== null
                                        ? `${passed}/${total} test cases passed`
                                        : 'Custom input executed'}
                                    </div>
                                  </div>
                                  <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
                                    {currentResult.runtime && (
                                      <span className="flex items-center gap-1">
                                        <Zap className="w-3 h-3" /> {currentResult.runtime}s
                                      </span>
                                    )}
                                    {currentResult.memory && currentResult.memory !== '0' && (
                                      <span className="flex items-center gap-1">
                                        <HardDrive className="w-3 h-3" /> {Math.round(Number(currentResult.memory) / 1024)} KB
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Individual results */}
                            {currentResult.results && currentResult.results.map((r, i) => (
                              <div key={i} className={`rounded-lg border p-3 ${
                                r.passed === true ? 'border-emerald-500/20 bg-emerald-500/5' :
                                r.passed === false ? 'border-red-500/20 bg-red-500/5' :
                                'border-white/10 bg-white/5'
                              }`}>
                                <div className="flex items-center gap-2 mb-2">
                                  {r.passed === true && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                  {r.passed === false && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                  <span className="text-xs font-medium text-slate-300">
                                    {r.passed === null ? 'Output' : r.passed ? 'Passed' : 'Failed'} — Case {i + 1}
                                  </span>
                                  {r.time && (
                                    <span className="text-[10px] text-slate-500 ml-auto">{r.time}s</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  {r.input !== undefined && (
                                    <div>
                                      <div className="text-[10px] text-slate-500 mb-0.5">Input</div>
                                      <pre className="font-mono text-slate-400 whitespace-pre-wrap bg-black/30 rounded p-1.5 max-h-20 overflow-y-auto">{r.input}</pre>
                                    </div>
                                  )}
                                  {r.expectedOutput !== undefined && (
                                    <div>
                                      <div className="text-[10px] text-slate-500 mb-0.5">Expected</div>
                                      <pre className="font-mono text-slate-400 whitespace-pre-wrap bg-black/30 rounded p-1.5 max-h-20 overflow-y-auto">{r.expectedOutput}</pre>
                                    </div>
                                  )}
                                  {r.actualOutput !== undefined && (
                                    <div>
                                      <div className="text-[10px] text-slate-500 mb-0.5">Actual</div>
                                      <pre className="font-mono text-slate-400 whitespace-pre-wrap bg-black/30 rounded p-1.5 max-h-20 overflow-y-auto">{r.actualOutput}</pre>
                                    </div>
                                  )}
                                </div>
                                {(r.stderr || r.compileOutput) && (
                                  <div className="mt-2">
                                    <div className="text-[10px] text-red-400 mb-0.5">Error</div>
                                    <pre className="font-mono text-xs text-red-300 whitespace-pre-wrap bg-red-900/20 rounded p-1.5 max-h-24 overflow-y-auto">{r.stderr || r.compileOutput}</pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Custom Input tab */}
                    {activeTab === 'custom' && (
                      <div className="space-y-3">
                        <div className="text-xs text-slate-400">
                          Enter custom input to test your code against
                        </div>
                        <textarea
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          placeholder="Enter custom input here..."
                          className="w-full h-32 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder-slate-600 p-3 font-mono resize-none focus:outline-none focus:border-violet-500/50 transition"
                        />
                        <button
                          onClick={() => { setShowCustomInput(true); handleRun(); }}
                          disabled={running || submitting || !customInput.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50 transition font-medium"
                        >
                          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Run with Custom Input
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default CodingChallenge;
