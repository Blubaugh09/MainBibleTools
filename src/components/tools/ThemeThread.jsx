import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../firebase/AuthContext";
import { db } from "../../firebase/config";
import {
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import axios from "axios";
import BibleVerseModal from '../common/BibleVerseModal';
import { extractVerseReferences, containsVerseReferences } from '../common/VerseReferenceParser';

/**
 * ThemeThread component
 * Displays a "theme thread" – a JSON object returned by the /api/tools/theme-thread endpoint.
 * Expected JSON shape:
 * {
 *   theme: string,
 *   summary: string,
 *   occurrences: [ { ref, book, chapter, verse } ],
 *   timeline: [ { book, start, end, density } ],
 *   memoryAids: [ string ]
 * }
 */
const ThemeThread = () => {
  /* --------------------------------------------------
   * React state & refs
   * -------------------------------------------------- */
  const [themeQuery, setThemeQuery] = useState("");
  const [threadData, setThreadData] = useState(null); // holds JSON response
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [serverStatus, setServerStatus] = useState("checking");
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [savedThreads, setSavedThreads] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  // Bible verse modal state
  const [isVerseModalOpen, setIsVerseModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();

  /* --------------------------------------------------
   * Effects
   * -------------------------------------------------- */
  // 1. Auto-scroll to results
  useEffect(() => {
    if (threadData) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [threadData, activeTab]);

  // 2. Check server health + fetch saved threads on mount
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus("checking");
        const res = await axios.get("/api/health");
        setServerStatus(res.data?.status === "ok" ? "online" : "offline");
        if (res.data?.status !== "ok") setError("Cannot connect to the server");
      } catch (err) {
        console.error("Server health check failed", err);
        setServerStatus("offline");
        setError("Cannot connect to the server. Please try again later.");
      }
    };

    checkServerHealth();
    if (currentUser) fetchSavedThreads();
  }, [currentUser]);

  // 3. Setup global verse click handler
  useEffect(() => {
    // Add a global click handler for verse references
    const handleGlobalVerseClick = (e) => {
      const target = e.target.closest('.verse-reference');
      if (target && target.dataset && target.dataset.verse) {
        handleVerseClick(target.dataset.verse);
      }
    };
    
    // Add a custom event handler for verse clicks
    const handleCustomVerseClick = (e) => {
      if (e.detail && e.detail.verse) {
        handleVerseClick(e.detail.verse);
      }
    };

    // Add event listeners
    document.addEventListener('click', handleGlobalVerseClick);
    document.addEventListener('verse-click', handleCustomVerseClick);
    
    // Cleanup
    return () => {
      document.removeEventListener('click', handleGlobalVerseClick);
      document.removeEventListener('verse-click', handleCustomVerseClick);
    };
  }, []);

  /* --------------------------------------------------
   * Verse reference handling
   * -------------------------------------------------- */
  // Process content to identify and make verse references clickable
  const processContentWithVerseReferences = (content) => {
    if (!content || typeof content !== 'string') return content;
    
    if (!containsVerseReferences(content)) {
      return content;
    }

    const references = extractVerseReferences(content);
    
    // Sort references by length (descending) to handle overlapping references
    const sortedReferences = [...references].sort((a, b) => b.length - a.length);

    // Store the matches for each reference to avoid double-processing
    const matches = {};

    // First identify all references in the content 
    sortedReferences.forEach(ref => {
      // Escape special regex characters in the reference
      const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Use more precise regex that requires word boundaries to avoid capturing preceding words
      const regex = new RegExp(`(^|\\s|[;:.,>"'])(${escapedRef})\\b`, 'g');
      
      // Find all matches in the content
      let match;
      matches[ref] = [];
      while ((match = regex.exec(content)) !== null) {
        // The actual reference is in the second capturing group
        const actualRef = match[2];
        const startIndex = match.index + match[1].length; // Skip the preceding character/space
        
        matches[ref].push({
          index: startIndex,
          length: actualRef.length,
          text: actualRef,
          fullMatch: match[0],
          beforeText: match[1]
        });
      }
    });
    
    // No references found in the actual content
    if (Object.values(matches).every(arr => arr.length === 0)) {
      return content;
    }
    
    // Process the content to replace references with clickable spans
    // We'll build a new string character by character
    let result = '';
    let skipTo = 0;
    
    for (let i = 0; i < content.length; i++) {
      // Skip if we've already processed this part
      if (i < skipTo) continue;
      
      // Check if any reference starts at this position
      let matched = false;
      
      for (const ref of sortedReferences) {
        for (const match of matches[ref]) {
          if (match.index === i) {
            // Create a clickable span for this reference
            const span = `<span class="verse-reference" data-verse="${ref}" onclick="(function(e) { var event = new CustomEvent('verse-click', { detail: { verse: '${ref}' } }); document.dispatchEvent(event); })(event)" style="color: #4f46e5; cursor: pointer; text-decoration: underline; font-weight: 500;">${match.text}</span>`;
            result += span;
            
            // Skip the length of the reference
            skipTo = i + match.length;
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      
      // If no reference matched at this position, just add the character
      if (!matched && i >= skipTo) {
        result += content[i];
      }
    }
    
    return result;
  };

  // Handle verse reference click
  const handleVerseClick = (verseRef) => {
    setSelectedVerse(verseRef);
    setIsVerseModalOpen(true);
  };

  /* --------------------------------------------------
   * Firestore helpers
   * -------------------------------------------------- */
  const fetchSavedThreads = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, "mainBibleTools_themeThreads"),
        where("userId", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const threads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      threads.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSavedThreads(threads);
    } catch (e) {
      console.error("Fetch saved threads failed", e);
    }
  };

  const persistThread = async (data) => {
    if (!currentUser) return;
    try {
      if (!currentThreadId) {
        // create new doc
        const docRef = await addDoc(collection(db, "mainBibleTools_themeThreads"), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          theme: data.theme,
          threadData: data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setCurrentThreadId(docRef.id);
      } else {
        const ref = doc(db, "mainBibleTools_themeThreads", currentThreadId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, { threadData: data, updatedAt: serverTimestamp() });
        }
      }
      fetchSavedThreads();
    } catch (e) {
      console.error("Persist thread failed", e);
    }
  };

  const findExistingThread = async (theme) => {
    if (!currentUser) return null;
    try {
      const q = query(
        collection(db, "mainBibleTools_themeThreads"),
        where("userId", "==", currentUser.uid),
        where("theme", "==", theme)
      );
      const snap = await getDocs(q);
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
      console.error("findExistingThread failed", e);
      return null;
    }
  };

  /* --------------------------------------------------
   * UI helpers
   * -------------------------------------------------- */
  const renderList = (items) => {
    if (!items?.length) return <p className="italic text-gray-500">None</p>;
    return (
      <ul className="space-y-1 list-disc list-inside">
        {items.map((it, idx) => (
          <li key={idx}>
            {containsVerseReferences(it) ? (
              <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(it) }} />
            ) : (
              it
            )}
          </li>
        ))}
      </ul>
    );
  };

  const renderOccurrences = () => {
    if (!threadData?.occurrences?.length) return <p>No occurrences found.</p>;
    return (
      <div className="space-y-1">
        {threadData.occurrences.map((o, i) => (
          <div key={i} className="border-b py-1 text-sm">
            <span 
              className="font-medium cursor-pointer verse-reference" 
              data-verse={o.ref}
              onClick={() => handleVerseClick(o.ref)}
            >
              {o.ref}
            </span> – {o.book} {o.chapter}:{o.verse}
          </div>
        ))}
      </div>
    );
  };

  const renderTimeline = () => {
    if (!threadData?.timeline?.length) return <p>No timeline data.</p>;
  
    const totalRefs = threadData.timeline.reduce((sum, t) => sum + t.density, 0);
  
    return (
      <div className="space-y-2">
        {threadData.timeline.map((t, i) => {
          const pct = totalRefs ? (t.density / totalRefs) * 100 : 0;
          return (
            <div key={i} className="flex items-center space-x-2 text-sm">
              <span className="w-32 font-medium">{t.book}</span>
              <div className="flex-1 bg-gray-100 rounded h-2">
                <div
                  className="bg-indigo-500 h-2 rounded"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="w-24 text-right">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    );
  };
  

  /* --------------------------------------------------
   * Handlers
   * -------------------------------------------------- */
  const resetThread = () => {
    setThreadData(null);
    setCurrentThreadId(null);
    setActiveTab("summary");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!themeQuery.trim() || serverStatus !== "online") return;
    setError("");
    setIsLoading(true);
    resetThread();

    try {
      // Check Firestore cache first
      if (currentUser) {
        const existing = await findExistingThread(themeQuery.trim());
        if (existing) {
          setCurrentThreadId(existing.id);
          setThreadData(existing.threadData);
          setIsLoading(false);
          return;
        }
      }

      // API request
      const res = await axios.post("/api/tools/theme-thread", { theme: themeQuery.trim() });
      if (!res.data) throw new Error("Invalid response from server");
      setThreadData(res.data);
      if (currentUser) persistThread(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  /* --------------------------------------------------
   * Tab content renderer
   * -------------------------------------------------- */
  const getTabContent = () => {
    if (!threadData) return null;
    switch (activeTab) {
      case "summary":
        return (
          <div className="prose max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({node, ...props}) => {
                  const rawContent = node.children
                    .map(n => n.type === 'text' ? n.value : '')
                    .join('');
                  
                  if (containsVerseReferences(rawContent)) {
                    const processedContent = processContentWithVerseReferences(rawContent);
                    return <p dangerouslySetInnerHTML={{ __html: processedContent }} />;
                  }
                  return <p {...props} />;
                }
              }}
            >
              {threadData.summary}
            </ReactMarkdown>
          </div>
        );
      case "occurrences":
        return renderOccurrences();
      case "timeline":
        return renderTimeline();
      case "memoryAids":
        return renderList(threadData.memoryAids);
      default:
        return null;
    }
  };

  /* --------------------------------------------------
   * Render
   * -------------------------------------------------- */
  return (
    <div className="w-full flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
      {/* status / error bars */}
      {error && (
        <div className="px-4 py-2 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      {serverStatus === "checking" && (
        <div className="px-4 py-2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 text-sm">
          Checking server status…
        </div>
      )}
      {serverStatus === "offline" && !error && (
        <div className="px-4 py-2 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
          Server is offline.
        </div>
      )}

      <div className="flex flex-col lg:flex-row">
        {/* left column: input */}
        <div className="p-4 bg-gray-50 lg:w-1/3">
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label
                htmlFor="theme-query"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Biblical theme
              </label>
              <textarea
                id="theme-query"
                value={themeQuery}
                onChange={(e) => setThemeQuery(e.target.value)}
                placeholder="e.g., Covenant, Shepherd, Living Water…"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-24"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !themeQuery.trim() || serverStatus !== "online"}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Create Theme Thread"}
            </button>
            {threadData && (
              <button
                type="button"
                onClick={resetThread}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                New Theme
              </button>
            )}
          </form>

          {/* saved threads list */}
          {currentUser && savedThreads.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Saved Threads</h3>
              <ul className="space-y-1 text-sm">
                {savedThreads.map((t) => (
                  <li key={t.id}>
                    <button
                      className="text-indigo-600 hover:underline"
                      onClick={() => {
                        setThreadData(t.threadData);
                        setCurrentThreadId(t.id);
                        setActiveTab("summary");
                      }}
                    >
                      {t.theme}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* right column: results */}
        <div ref={resultsRef} className="flex-1 p-4 overflow-y-auto bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : threadData ? (
            <div>
              <div className="bg-indigo-50 p-4 rounded-lg mb-4">
                <h2 className="text-2xl font-bold text-indigo-800">
                  {threadData.theme}
                </h2>
              </div>

              {/* tab nav */}
              <div className="border-b mb-4 overflow-x-auto">
                <nav className="flex -mb-px">
                  {[
                    { id: "summary", label: "Summary", icon: "📋" },
                    { id: "occurrences", label: "Occurrences", icon: "📖" },
                    { id: "timeline", label: "Timeline", icon: "🗓️" },
                    { id: "memoryAids", label: "Memory Aids", icon: "🧠" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-3 px-4 text-sm whitespace-nowrap border-b-2 ${{
                        [tab.id]: activeTab === tab.id,
                      }[tab.id] ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    >
                      <span className="mr-1">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* tab content */}
              <div>{getTabContent()}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-5xl mb-2">📚</div>
              <p className="text-gray-500">Enter a biblical theme to generate a thread</p>
            </div>
          )}
        </div>
      </div>

      {/* Bible Verse Modal */}
      <BibleVerseModal 
        isOpen={isVerseModalOpen}
        onClose={() => setIsVerseModalOpen(false)}
        verseReference={selectedVerse}
      />
    </div>
  );
};

export default ThemeThread;
