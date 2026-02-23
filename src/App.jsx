import React, { useState, useEffect, useRef } from 'react';
import {
    Send,
    Upload,
    Database,
    MessageSquare,
    Image as ImageIcon,
    FileText,
    RefreshCw,
    X,
    ChevronRight,
    Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatWithGroq, extractTextFromFile } from './utils/GroqClient';
import { fetchTasks, saveTask } from './utils/SheetsClient';

const App = () => {
    const [activeTab, setActiveTab] = useState('chat');
    const [grade, setGrade] = useState('4');
    const [messages, setMessages] = useState([
        {
            id: 1,
            role: 'assistant',
            content: "Zdravo! 👋 Ja sam MatBot, tvoj matematički pomoćnik! 🤖\n\nMogu da ti pomognem sa zadacima iz matematike za 4, 5 i 6 razred.\n\nŠta mogu da uradim:\n✏️ Dodaj zadatak kao tekst\n🖼️ Pošalji sliku zadatka\n📄 Uploaduj PDF sa zadacima\n📚 Analiziraj zadatak iz baze (npr: 'zadatak iz reda 3')\n\nHajde da počnemo! Koji zadatak te muči? 😊"
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState('');
    const [manualMode, setManualMode] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [novZadatakToast, setNovZadatakToast] = useState(false);

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async (text = inputValue) => {
        if (!text.trim() || isLoading) return;

        setManualMode(false);
        const userMessage = { id: Date.now(), role: 'user', content: text };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        setLoadingStatus('Razmišljam...');

        try {
            const systemPrompt = `Ti si MatBot, veseli i strpljiv matematički asistent za decu osnovne škole (4, 5 i 6 razred). Trenutno pomažeš detetu u ${grade}. razredu. Uvek govoriš srpskim jezikom. Objašnjavaš korak po korak, jednostavnim rečima koje dete od 10-12 godina može da razume. Kada rešavaš zadatak, uvek pohvališ dete i ohrabruješ ga. Koristiš emoji-je da bude zabavnije. Nikada ne daješ samo odgovor - uvek objašnjavaš HOW i ZAŠTO. Kada ti se da tekst zadatka, analiziraj ga pažljivo i budi spreman da odgovaraš na pitanja. Ako zadatak ima više delova, rešavaj jedan po jedan.`;

            const context = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
            context.push({ role: 'system', content: systemPrompt });
            context.push({ role: 'user', content: text });

            const aiResponse = await chatWithGroq(context);

            const assistantMessage = { id: Date.now() + 1, role: 'assistant', content: aiResponse };

            /* Auto-save logic removed as per user request for manual save */
            /*
            if (text.length > 20 && (/\d/.test(text) || ['izračunaj', 'koliko', 'zadatak'].some(word => text.toLowerCase().includes(word)))) {
                setLoadingStatus('Čuvam u bazu...');
                const taskData = {
                    Datum: new Date().toLocaleDateString('sr-RS'),
                    Razred: grade,
                    TipUnosa: 'tekst',
                    OriginalniZadatak: text,
                    AIResenje: aiResponse.substring(0, 200),
                    AIObjasnjenje: aiResponse,
                    Status: 'aktivan'
                };
                await saveTask(taskData);
                assistantMessage.content += "\n\n💾 Zadatak automatski sačuvan u bazu!";
            }
            */

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: "😅 Ups! Desila se neočekivana greška. Pokušaj ponovo ili prepiši zadatak kao tekst!"
            }]);
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const handleManualSave = async (msg) => {
        if (msg.isSaved) return;

        // Find the user query that preceded this AI response
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        const userQuery = msgIndex > 0 ? messages[msgIndex - 1].content : "Nepoznato";

        setLoadingStatus('Čuvam u bazu...');
        const taskData = {
            Datum: new Date().toLocaleDateString('sr-RS'),
            Razred: grade,
            TipUnosa: 'ručno',
            OriginalniZadatak: userQuery,
            AIResenje: msg.content.substring(0, 200),
            AIObjasnjenje: msg.content,
            Status: 'sačuvano'
        };

        try {
            await saveTask(taskData);
            setMessages(prev => prev.map(m =>
                m.id === msg.id ? { ...m, isSaved: true } : m
            ));
            // Show toast
            setNovZadatakToast(true);
            setTimeout(() => setNovZadatakToast(false), 2000);
        } catch (error) {
            console.error("Manual save failed:", error);
        } finally {
            setLoadingStatus('');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        setActiveTab('chat');

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;
                try {
                    const extractedText = await extractTextFromFile(dataUrl, (status) => setLoadingStatus(status));

                    // Regex for multiple tasks
                    const taskRegex = /ZADATAK\s*\d+\s*:([\s\S]*?)(?=ZADATAK\s*\d+\s*:|$)/gi;
                    const matches = [...extractedText.matchAll(taskRegex)];

                    if (matches.length > 1) {
                        setMessages(prev => [...prev, {
                            id: Date.now(),
                            role: 'assistant',
                            content: `🔍 Pronašao/la sam ${matches.length} zadataka! Obrađujem svaki posebno...`
                        }]);

                        for (const match of matches) {
                            const taskText = match[1].trim();
                            await handleSend(taskText);
                        }
                    } else {
                        await handleSend(extractedText);
                    }
                } catch (visionError) {
                    setManualMode(true);
                    setMessages(prev => [...prev, {
                        id: Date.now(),
                        role: 'assistant',
                        content: "😅 Nisam uspeo da automatski pročitam sliku. Možeš mi prepisati tekst zadatka?"
                    }]);
                } finally {
                    setIsLoading(false);
                    setLoadingStatus('');
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(error);
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const loadBaza = async () => {
        setIsRefreshing(true);
        const data = await fetchTasks();
        setTasks(data || []);
        setIsRefreshing(false);
    };

    useEffect(() => {
        if (activeTab === 'baza') loadBaza();
    }, [activeTab]);

    const handleNoviZadatak = async () => {
        setInputValue('');
        setManualMode(false);
        setLoadingStatus('');

        // Refresh task list in background
        await loadBaza();

        // Add assistant message
        const assistantMessage = {
            id: Date.now(),
            role: 'assistant',
            content: "Super! 🎉 Spreman sam za novi zadatak! Koji sledeći zadatak te muči? 💪"
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Show toast
        setNovZadatakToast(true);
        setTimeout(() => setNovZadatakToast(false), 2500);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <header style={{
                background: 'var(--primary-gradient)',
                padding: '20px',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
                        <Bot size={28} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px' }}>MatBot</h1>
                        <p style={{ fontSize: '12px', opacity: 0.8 }}>Tvoj matematički asistent</p>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    background: 'rgba(0,0,0,0.1)',
                    padding: '4px',
                    borderRadius: '12px',
                    width: 'fit-content'
                }}>
                    {['4', '5', '6'].map(g => (
                        <button
                            key={g}
                            onClick={() => setGrade(g)}
                            style={{
                                padding: '6px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                background: grade === g ? 'white' : 'transparent',
                                color: grade === g ? '#764ba2' : 'white',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {g}. razred
                        </button>
                    ))}
                </div>

                <div style={{ position: 'absolute', right: '20px', top: '20px' }}>
                    <button
                        onClick={handleNoviZadatak}
                        disabled={isLoading}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '14px',
                            border: 'none',
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            fontWeight: '800',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        <span>➕</span> Novi zadatak
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <nav style={{
                display: 'flex',
                background: 'var(--accent-light)',
                padding: '0 10px'
            }}>
                {[
                    { id: 'chat', label: '💬 Chat', icon: <MessageSquare size={18} /> },
                    { id: 'upload', label: '📤 Dodaj zadatak', icon: <Upload size={18} /> },
                    { id: 'baza', label: '📚 Baza zadataka', icon: <Database size={18} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1,
                            padding: '14px 0',
                            border: 'none',
                            background: 'transparent',
                            color: activeTab === tab.id ? 'var(--text-accent)' : 'var(--text-muted)',
                            fontWeight: activeTab === tab.id ? '800' : '600',
                            cursor: 'pointer',
                            borderBottom: activeTab === tab.id ? '3px solid var(--text-accent)' : '3px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* Main Content Area */}
            <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <AnimatePresence>
                    {novZadatakToast && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, x: '-50%' }}
                            animate={{ opacity: 1, y: 0, x: '-50%' }}
                            exit={{ opacity: 0, y: -20, x: '-50%' }}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                left: '50%',
                                background: 'white',
                                color: '#764ba2',
                                padding: '12px 24px',
                                borderRadius: '16px',
                                fontWeight: '800',
                                fontSize: '14px',
                                zIndex: 1000,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                                pointerEvents: 'none'
                            }}
                        >
                            ✅ Baza osvežena — spreman za novi zadatak!
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence mode="wait">
                    {activeTab === 'chat' && (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                        >
                            {messages.map(msg => (
                                <div key={msg.id} style={{
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    gap: '10px'
                                }}>
                                    {msg.role === 'assistant' && (
                                        <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontSize: '20px' }}>🤖</span>
                                        </div>
                                    )}
                                    <div style={{
                                        maxWidth: '80%',
                                        position: 'relative',
                                        padding: '14px 18px',
                                        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                                        background: msg.role === 'user' ? 'var(--primary-gradient)' : 'white',
                                        color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                        fontSize: '15px',
                                        lineHeight: '1.6',
                                        whiteSpace: 'pre-wrap',
                                        border: msg.role === 'assistant' ? '1px solid var(--border-light)' : 'none'
                                    }}>
                                        {msg.content}

                                        {msg.role === 'assistant' && msg.id !== 1 && (
                                            <button
                                                onClick={() => handleManualSave(msg)}
                                                title={msg.isSaved ? "Sačuvano u bazu" : "Sačuvaj u Google Sheets"}
                                                style={{
                                                    position: 'absolute',
                                                    right: '-40px',
                                                    bottom: '0',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '10px',
                                                    background: msg.isSaved ? '#10b981' : 'white',
                                                    color: msg.isSaved ? 'white' : 'var(--text-accent)',
                                                    border: '1px solid var(--border-light)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: msg.isSaved ? 'default' : 'pointer',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {msg.isSaved ? "✅" : <Database size={16} />}
                                            </button>
                                        )}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--secondary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontSize: '20px' }}>🧒</span>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '20px' }}>🤖</span>
                                        </div>
                                        <div style={{ padding: '12px 18px', background: 'white', borderRadius: '4px 20px 20px 20px', border: '1px solid var(--border-light)' }}>
                                            <div className="loading-dots">
                                                <span></span><span></span><span></span>
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ marginLeft: '46px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>{loadingStatus}</p>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </motion.div>
                    )}

                    {activeTab === 'upload' && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}
                        >
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    flex: 1,
                                    maxHeight: '300px',
                                    border: '2px dashed var(--text-muted)',
                                    borderRadius: '24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '16px',
                                    cursor: 'pointer',
                                    background: 'var(--surface_light)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div style={{ padding: '20px', background: '#f0ebff', borderRadius: '50%', color: 'var(--text-accent)' }}>
                                    <Upload size={40} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>Klikni ili prevuci fajl</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Podržani formati: JPG, PNG, PDF</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <button onClick={() => fileInputRef.current?.click()} style={{ ...squareButtonStyle, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                                    <span style={{ fontSize: '24px' }}>🖼️</span>
                                    <span style={{ fontWeight: '700' }}>Slika zadatka</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} style={{ ...squareButtonStyle, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                                    <span style={{ fontSize: '24px' }}>📄</span>
                                    <span style={{ fontWeight: '700' }}>PDF dokument</span>
                                </button>
                            </div>

                            <div style={{ padding: '20px', background: 'var(--accent-light)', borderRadius: '16px', display: 'flex', gap: '12px' }}>
                                <div style={{ color: 'var(--text-accent)' }}><ImageIcon size={20} /></div>
                                <p style={{ fontSize: '13px', color: 'var(--text-accent)', fontWeight: '600', lineHeight: '1.5' }}>
                                    Savet: Ako na jednoj slici imaš više zadataka, MatBot će ih prepoznati i rešiti jedan po jedan! 🚀
                                </p>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                                accept="image/*,application/pdf"
                            />
                        </motion.div>
                    )}

                    {activeTab === 'baza' && (
                        <motion.div
                            key="baza"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Sačuvani zadaci ({tasks.length})</h2>
                                <button
                                    onClick={loadBaza}
                                    disabled={isRefreshing}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'var(--accent-light)',
                                        color: 'var(--text-accent)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <RefreshCw size={14} className={isRefreshing ? 'animate-bounce' : ''} />
                                    Osveži
                                </button>
                            </div>

                            {tasks.length === 0 ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px 0' }}>
                                    <span style={{ fontSize: '60px' }}>📭</span>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Još uvek nema sačuvanih zadataka.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {tasks.map((task, idx) => (
                                        <div key={idx} className="task-card" style={{
                                            padding: '16px',
                                            background: 'white',
                                            borderRadius: '20px',
                                            border: '1px solid var(--border-light)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            transition: 'all 0.2s ease',
                                            cursor: 'pointer'
                                        }}>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'var(--primary-gradient)', color: 'white', fontSize: '11px', fontWeight: '800' }}>#{task.ID || idx + 1}</span>
                                                <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'var(--accent-light)', color: 'var(--text-accent)', fontSize: '11px', fontWeight: '800' }}>{task.Razred}. razred</span>
                                                <span style={{ padding: '4px 10px', borderRadius: '8px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: '800' }}>{task['Tip unosa']}</span>
                                            </div>
                                            <p style={{ fontSize: '14px', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {task['Originalni zadatak']}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setInputValue(`Analiziraj zadatak iz baze: ${task['Originalni zadatak']}`);
                                                    setActiveTab('chat');
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    marginTop: '4px',
                                                    color: 'var(--text-accent)',
                                                    fontSize: '13px',
                                                    fontWeight: '800',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Razgovaraj o zadatku <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Manual Mode / Warning Banner */}
                {manualMode && (
                    <div style={{
                        position: 'absolute',
                        bottom: '90px',
                        left: '20px',
                        right: '20px',
                        background: 'var(--warning)',
                        border: '1px solid var(--warning-border)',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10
                    }}>
                        <p style={{ color: 'var(--warning-text)', fontSize: '13px', fontWeight: '700' }}>
                            ✏️ Ručni unos aktivan — prepiši zadatak iz slike/PDF-a
                        </p>
                        <button onClick={() => setManualMode(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--warning-text)' }}>
                            <X size={18} />
                        </button>
                    </div>
                )}
            </main>

            {/* Input Area */}
            <footer style={{ padding: '20px', background: 'white', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Napiši zadatak ovde..."
                            style={{
                                width: '100%',
                                padding: '14px 18px',
                                borderRadius: '18px',
                                border: '2px solid var(--border-light)',
                                background: 'var(--surface-light)',
                                fontSize: '15px',
                                resize: 'none',
                                height: '52px',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>
                    <button
                        onClick={() => handleSend()}
                        disabled={!inputValue.trim() || isLoading}
                        style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '16px',
                            background: inputValue.trim() ? 'var(--primary-gradient)' : 'var(--border-light)',
                            color: 'white',
                            border: 'none',
                            cursor: inputValue.trim() ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: inputValue.trim() ? '0 4px 12px rgba(102, 126, 234, 0.4)' : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Send size={24} />
                    </button>
                </div>
            </footer>

            {/* Inline styles for hover effects and animations */}
            <style>
                {`
          .task-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.06);
            border-color: var(--text-muted);
          }
          button:active {
            transform: scale(0.95);
          }
          textarea:focus {
            border-color: var(--text-muted) !important;
            background: white !important;
          }
        `}
            </style>
        </div>
    );
};

const squareButtonStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '20px',
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
};

export default App;
