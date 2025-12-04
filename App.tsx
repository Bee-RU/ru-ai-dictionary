import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, Search, Book, Sparkles, Brain, ArrowLeft, 
  Send, Save, Trash2, RefreshCw, X
} from 'lucide-react';
import { Language, DictionaryEntry, ChatMessage } from './types';
import { 
  fetchDefinition, 
  generateIllustration, 
  sendChatMessage, 
  generateStoryFromWords 
} from './services/geminiService';
import AudioButton from './components/AudioButton';

// --- Constants ---
const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
];

// --- Sub-Components (Defined here for file constraint, but cleanly separated) ---

// 1. Language Selection Screen
const LanguageSelector = ({ 
  onSelect 
}: { 
  onSelect: (native: Language, target: Language) => void 
}) => {
  const [native, setNative] = useState<Language | null>(null);
  const [target, setTarget] = useState<Language | null>(null);

  const handleStart = () => {
    if (native && target) onSelect(native, target);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-primary via-white to-accent">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
        <h1 className="text-4xl font-display font-bold text-primary mb-2">LingoPop</h1>
        <p className="text-gray-500 mb-8">Choose your journey</p>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">I speak...</label>
            <div className="grid grid-cols-5 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={`n-${lang.code}`}
                  onClick={() => setNative(lang)}
                  className={`p-2 rounded-xl border-2 transition-all ${
                    native?.code === lang.code ? 'border-primary bg-red-50' : 'border-gray-100 hover:border-red-200'
                  }`}
                >
                  <div className="text-2xl">{lang.flag}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">I want to learn...</label>
            <div className="grid grid-cols-5 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={`t-${lang.code}`}
                  onClick={() => setTarget(lang)}
                  className={`p-2 rounded-xl border-2 transition-all ${
                    target?.code === lang.code ? 'border-secondary bg-teal-50' : 'border-gray-100 hover:border-teal-200'
                  }`}
                >
                  <div className="text-2xl">{lang.flag}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!native || !target}
          className="w-full mt-10 bg-dark text-white font-bold py-4 rounded-2xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 shadow-lg"
        >
          Let's Go!
        </button>
      </div>
    </div>
  );
};

// 2. Flashcard Component
const Flashcard = ({ entry }: { entry: DictionaryEntry }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="relative w-full h-96 perspective-1000 cursor-pointer group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* FRONT */}
        <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-xl border-4 border-secondary flex flex-col items-center justify-center p-6 text-center">
          {entry.imageUrl && (
            <img src={entry.imageUrl} alt={entry.term} className="w-32 h-32 object-cover rounded-full mb-6 border-4 border-yellow-100" />
          )}
          <h3 className="text-4xl font-bold text-dark mb-4">{entry.term}</h3>
          <p className="text-gray-400 text-sm">(Tap to flip)</p>
        </div>

        {/* BACK */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-primary text-white rounded-3xl shadow-xl flex flex-col items-center justify-center p-6 text-center">
          <h4 className="text-2xl font-bold mb-4">{entry.explanation}</h4>
          <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
            <p className="italic text-lg">"{entry.examples[0].target}"</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. Main App Component
const App = () => {
  // --- State ---
  const [nativeLang, setNativeLang] = useState<Language | null>(null);
  const [targetLang, setTargetLang] = useState<Language | null>(null);
  const [view, setView] = useState<'search' | 'notebook' | 'learn'>('search');
  
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<DictionaryEntry | null>(null);
  const [savedWords, setSavedWords] = useState<DictionaryEntry[]>([]);
  
  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Story State
  const [story, setStory] = useState<string | null>(null);
  const [isStoryLoading, setIsStoryLoading] = useState(false);

  // --- Effects ---
  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem('lingopop_notebook');
    if (saved) setSavedWords(JSON.parse(saved));
  }, []);

  useEffect(() => {
    // Save to local storage
    localStorage.setItem('lingopop_notebook', JSON.stringify(savedWords));
  }, [savedWords]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatOpen]);

  // --- Handlers ---
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || !nativeLang || !targetLang) return;

    setIsLoading(true);
    setCurrentResult(null);
    setChatHistory([]); // Reset chat for new word

    try {
      // 1. Get Text Definition
      const defData = await fetchDefinition(query, nativeLang, targetLang);
      
      // 2. Start Image Gen (Parallel)
      const imagePromise = generateIllustration(query);
      
      // 3. Construct Entry immediately with text data
      const newEntry: DictionaryEntry = {
        id: Date.now().toString(),
        term: query,
        explanation: defData.explanation,
        examples: defData.examples,
        funUsage: defData.funUsage,
        timestamp: Date.now(),
      };
      
      setCurrentResult(newEntry);

      // 4. Resolve Image and update
      const imageUrl = await imagePromise;
      if (imageUrl) {
        setCurrentResult(prev => prev ? { ...prev, imageUrl } : null);
      }

    } catch (error) {
      console.error(error);
      alert("Oops! The AI got a bit confused. Try again?");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSave = () => {
    if (!currentResult) return;
    const exists = savedWords.find(w => w.id === currentResult.id);
    if (exists) {
      setSavedWords(savedWords.filter(w => w.id !== currentResult.id));
    } else {
      setSavedWords([currentResult, ...savedWords]);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentResult || !targetLang) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    const reply = await sendChatMessage(chatHistory, userMsg, currentResult, targetLang);
    
    setChatHistory(prev => [...prev, { role: 'model', text: reply }]);
    setIsChatLoading(false);
  };

  const generateNotebookStory = async () => {
    if (savedWords.length < 2 || !nativeLang || !targetLang) return;
    setIsStoryLoading(true);
    const result = await generateStoryFromWords(savedWords.slice(0, 10), nativeLang, targetLang);
    setStory(result);
    setIsStoryLoading(false);
  };

  // --- Renders ---

  if (!nativeLang || !targetLang) {
    return <LanguageSelector onSelect={(n, t) => { setNativeLang(n); setTargetLang(t); }} />;
  }

  const isSaved = currentResult && savedWords.some(w => w.id === currentResult.id);

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      
      {/* HEADER */}
      <header className="bg-white p-4 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">L</div>
          <span className="font-display font-bold text-dark text-lg">LingoPop</span>
        </div>
        <div className="flex gap-2">
          <span className="text-xl border rounded-md p-1 bg-gray-50">{nativeLang.flag}</span>
          <span className="text-gray-400">→</span>
          <span className="text-xl border rounded-md p-1 bg-teal-50">{targetLang.flag}</span>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-24 relative">
        
        {view === 'search' && (
          <div className="p-4 space-y-6">
            
            {/* SEARCH BAR */}
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Type in ${nativeLang.name} or ${targetLang.name}...`}
                className="w-full pl-4 pr-12 py-4 rounded-2xl border-2 border-gray-100 focus:border-secondary outline-none text-lg shadow-sm"
              />
              <button 
                type="submit" 
                className="absolute right-2 top-2 bg-secondary text-white p-2 rounded-xl hover:bg-teal-400 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? <RefreshCw className="animate-spin" /> : <Search />}
              </button>
            </form>

            {/* RESULTS */}
            {currentResult && (
              <div className="space-y-6 animate-fade-in pb-20">
                
                {/* Main Card */}
                <div className="bg-white rounded-3xl p-6 shadow-md border-b-4 border-gray-100 relative">
                  <div className="absolute top-4 right-4">
                    <button onClick={toggleSave} className={`transition-transform active:scale-90 ${isSaved ? 'text-yellow-400' : 'text-gray-200'}`}>
                      <Save fill={isSaved ? "currentColor" : "none"} size={28} />
                    </button>
                  </div>

                  {currentResult.imageUrl && (
                    <div className="mb-6 rounded-2xl overflow-hidden border-2 border-gray-50 shadow-inner">
                      <img src={currentResult.imageUrl} alt={currentResult.term} className="w-full h-48 object-cover" />
                    </div>
                  )}

                  <h2 className="text-3xl font-display font-bold text-dark mb-1 flex items-center gap-2">
                    {currentResult.term}
                    <AudioButton text={currentResult.term} />
                  </h2>
                  <p className="text-gray-500 font-medium text-lg mb-4">{currentResult.explanation}</p>

                  <div className="space-y-3">
                    {currentResult.examples.map((ex, i) => (
                      <div key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-start">
                          <p className="text-secondary font-semibold">{ex.target}</p>
                          <AudioButton text={ex.target} size="sm" />
                        </div>
                        <p className="text-gray-400 text-sm mt-1">{ex.native}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fun Usage Card */}
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-3xl p-6 shadow-lg relative overflow-hidden">
                  <Sparkles className="absolute top-4 right-4 text-white/30" size={40} />
                  <h3 className="font-display font-bold text-xl mb-3 flex items-center gap-2">
                    The Vibe Check
                  </h3>
                  <p className="leading-relaxed opacity-90">{currentResult.funUsage}</p>
                </div>

                {/* Floating Chat Button (if not open) */}
                {!chatOpen && (
                  <button
                    onClick={() => setChatOpen(true)}
                    className="fixed bottom-24 right-6 bg-dark text-white p-4 rounded-full shadow-2xl hover:bg-gray-800 transition-all z-20 flex items-center gap-2"
                  >
                    <span className="text-sm font-bold">Ask AI</span>
                    <Brain size={24} />
                  </button>
                )}
              </div>
            )}
            
            {/* Empty State */}
            {!currentResult && !isLoading && (
              <div className="text-center mt-20 text-gray-300">
                <Globe size={64} className="mx-auto mb-4 opacity-50" />
                <p>Explore the world, one word at a time.</p>
              </div>
            )}
          </div>
        )}

        {/* NOTEBOOK VIEW */}
        {view === 'notebook' && (
          <div className="p-4 space-y-6">
            <h2 className="text-2xl font-display font-bold text-dark mb-4">My Collection ({savedWords.length})</h2>
            
            {savedWords.length === 0 ? (
              <p className="text-gray-400 text-center mt-10">Nothing here yet. Go save some words!</p>
            ) : (
              <>
                {/* Story Gen */}
                <div className="bg-accent/20 border-2 border-accent rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-dark text-lg">AI Story Weaver</h3>
                    <button 
                      onClick={generateNotebookStory}
                      disabled={isStoryLoading}
                      className="bg-accent text-dark px-4 py-2 rounded-full text-sm font-bold hover:brightness-95 transition-all"
                    >
                      {isStoryLoading ? 'Weaving...' : 'Create Story'}
                    </button>
                  </div>
                  {story ? (
                     <div className="bg-white/50 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap">
                       {story}
                     </div>
                  ) : (
                    <p className="text-xs text-gray-500">Combine your saved words into a fun memorable story.</p>
                  )}
                </div>

                {/* List */}
                <div className="grid grid-cols-1 gap-3">
                  {savedWords.map(word => (
                    <div key={word.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center">
                      <div>
                        <p className="font-bold text-lg">{word.term}</p>
                        <p className="text-xs text-gray-400 truncate w-48">{word.explanation}</p>
                      </div>
                      <div className="flex gap-2">
                         <AudioButton text={word.term} size="sm" />
                         <button 
                            onClick={() => setSavedWords(savedWords.filter(w => w.id !== word.id))}
                            className="text-red-300 hover:text-red-500"
                          >
                           <Trash2 size={18} />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* LEARNING MODE */}
        {view === 'learn' && (
          <div className="p-4 h-full flex flex-col justify-center">
            {savedWords.length > 0 ? (
              <div className="space-y-8">
                 <div className="text-center mb-4">
                   <h2 className="text-2xl font-bold font-display text-primary">Flashcards</h2>
                   <p className="text-gray-400 text-sm">Tap card to flip</p>
                 </div>
                 {/* Carousel (Simplified to random one for now for better UI fit) */}
                 <Flashcard entry={savedWords[Math.floor(Math.random() * savedWords.length)]} />
                 
                 <div className="flex justify-center">
                   <button 
                     onClick={() => setView('learn')} // Trigger re-render to pick random
                     className="flex items-center gap-2 text-gray-500 hover:text-primary mt-8"
                   >
                     <RefreshCw size={20} /> Next Card
                   </button>
                 </div>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <Book size={48} className="mx-auto mb-4" />
                <p>Save words to your notebook to start learning!</p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* CHAT OVERLAY */}
      {chatOpen && currentResult && (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col animate-slide-up">
           <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm">
             <div>
               <h3 className="font-bold text-dark">Chat about "{currentResult.term}"</h3>
               <p className="text-xs text-secondary">Ask for synonyms, grammar...</p>
             </div>
             <button onClick={() => setChatOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
               <X size={20} />
             </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
             <div className="flex justify-start">
               <div className="bg-gray-200 text-dark p-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm">
                 Hi! What do you want to know about "{currentResult.term}"?
               </div>
             </div>
             {chatHistory.map((msg, i) => (
               <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${
                    msg.role === 'user' 
                    ? 'bg-dark text-white rounded-tr-none' 
                    : 'bg-gray-100 text-dark rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
               </div>
             ))}
             {isChatLoading && (
               <div className="flex justify-start">
                 <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none">
                   <div className="flex gap-1">
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                   </div>
                 </div>
               </div>
             )}
             <div ref={chatEndRef} />
           </div>

           <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t flex gap-2">
             <input
               value={chatInput}
               onChange={(e) => setChatInput(e.target.value)}
               placeholder="Ask a question..."
               className="flex-1 bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-secondary"
             />
             <button type="submit" disabled={!chatInput.trim()} className="bg-primary text-white p-3 rounded-xl disabled:opacity-50">
               <Send size={20} />
             </button>
           </form>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="bg-white border-t border-gray-100 flex justify-around items-center p-4 z-10 pb-6">
        <button 
          onClick={() => setView('search')}
          className={`flex flex-col items-center gap-1 ${view === 'search' ? 'text-primary' : 'text-gray-300'}`}
        >
          <Search size={24} strokeWidth={view === 'search' ? 3 : 2} />
          <span className="text-[10px] font-bold">Search</span>
        </button>
        <button 
          onClick={() => setView('notebook')}
          className={`flex flex-col items-center gap-1 ${view === 'notebook' ? 'text-primary' : 'text-gray-300'}`}
        >
          <Book size={24} strokeWidth={view === 'notebook' ? 3 : 2} />
          <span className="text-[10px] font-bold">Notebook</span>
        </button>
        <button 
          onClick={() => setView('learn')}
          className={`flex flex-col items-center gap-1 ${view === 'learn' ? 'text-primary' : 'text-gray-300'}`}
        >
          <Brain size={24} strokeWidth={view === 'learn' ? 3 : 2} />
          <span className="text-[10px] font-bold">Learn</span>
        </button>
      </nav>
    </div>
  );
};

export default App;