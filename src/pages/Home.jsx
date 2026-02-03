import React, { useState, useEffect, useRef } from "react";
import "../Styles/home.css"; 

const API_URL = 'https://script.google.com/macros/s/AKfycbzlimH5E6wxzi-RNzb6ZL-3tbYVtCTEVINLdZYbgW0JznqrWfKGtOuSERIuqPAJitdn/exec';

const BASE_EMOJIS = ["🏢", "🔒", "🚗", "🍎", "🍕", "🌈", "😊", "🏀", "👧", "🍦", "📚", "🎸", "🦋", "🐈", "🚀", "💎", "🧸", "🐶", "🌻", "🍟"];

const GRADOS_OPTIONS = [
    "PRE JARDIN PJ", "JARDIN JA", "TRANSICION TR", "PRIMERO 101", "SEGUNDO 201", "TERCERO 301", 
    "CUARTO 401", "QUINTO 501", "SEXTO 601", "SEPTIMO 701", "OCTAVO 801", "NOVENO 901", 
    "DECIMO 1001", "ONCE 1101", "PERSONAL"
];

export const Home = () => {
    const [allStudents, setAllStudents] = useState([]);
    const [activePasses, setActivePasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    
    const [historicalData, setHistoricalData] = useState([]);
    const [reportFilterGrado, setReportFilterGrado] = useState("");
    const [loadingReport, setLoadingReport] = useState(false);
    
    const [selectedGrado, setSelectedGrado] = useState("");
    const [selectedStudent, setSelectedStudent] = useState(null);
    
    const [isReportAuth, setIsReportAuth] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [shuffledEmojis, setShuffledEmojis] = useState([]);
    const [userSequence, setUserSequence] = useState([]);
    const correctSequence = ["🏢", "🔒", "🚗"]; 

    const [showReport, setShowReport] = useState(false);
    const audioRef = useRef(new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"));

    const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

    useEffect(() => {
        fetchInitialData();
        const interval = setInterval(fetchActivePasses, 30000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (showLoginModal) setShuffledEmojis(shuffleArray(BASE_EMOJIS));
    }, [showLoginModal]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?sheet=Estudiantes`);
            const data = await res.json();
            setAllStudents(data);
            await fetchActivePasses();
        } catch (err) { console.error("Error inicial", err); }
        finally { setLoading(false); }
    };

    const fetchActivePasses = async () => {
        try {
            const res = await fetch(`${API_URL}?sheet=Registro_Salidas`);
            const data = await res.json();
            setActivePasses(data.filter(p => p.Status === "En curso"));
        } catch (err) { console.error("Error pases", err); }
    };

    const fetchReportData = async () => {
        setLoadingReport(true);
        try {
            const res = await fetch(`${API_URL}?sheet=Registro_Salidas`);
            const data = await res.json();
            setHistoricalData(data);
        } catch (err) { console.error("Error reporte", err); }
        finally { setLoadingReport(false); }
    };

    const handleOpenReport = () => {
        if (isReportAuth) {
            setShowReport(true);
            fetchReportData();
        } else {
            setShowLoginModal(true);
            setUserSequence([]);
        }
    };

    // Alarma de 6 minutos
    useEffect(() => {
        const timerInterval = setInterval(() => {
            activePasses.forEach(pass => {
                const salida = new Date(pass.Hora_Salida);
                const ahora = new Date();
                const diffMinutos = (ahora - salida) / 60000;
                if (diffMinutos >= 6) playAlarm();
            });
        }, 10000);
        return () => clearInterval(timerInterval);
    }, [activePasses]);

    const playAlarm = () => audioRef.current.play().catch(e => console.log("Audio bloqueado"));

    const handleAuthorizeExit = async () => {
        if (!selectedStudent) return;
        const tempId = Date.now();
        const newExit = {
            rowId: tempId,
            Nombre_Estudiante: selectedStudent.Nombre_Completo,
            Grado: selectedGrado,
            Hora_Salida: new Date().toISOString(),
            Status: "En curso"
        };
        
        setActivePasses(prev => [newExit, ...prev]);
        setSelectedStudent(null);
        setSelectedGrado(""); 
        setSyncing(true);

        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ 
                    action: 'registrar_salida', 
                    sheet: 'Registro_Salidas', 
                    data: { 
                        Nombre_Estudiante: newExit.Nombre_Estudiante, 
                        Grado: newExit.Grado 
                    } 
                })
            });
        } catch (err) { console.error("Error sync", err); }
        finally { setSyncing(false); }
    };

    const handleReturn = async (pass) => {
        setActivePasses(prev => prev.filter(p => p.rowId !== pass.rowId));
        setSyncing(true);
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ 
                    action: 'registrar_regreso', 
                    sheet: 'Registro_Salidas', 
                    rowId: pass.rowId 
                })
            });
        } catch (err) { console.error("Error sync", err); }
        finally { setSyncing(false); }
    };

    const handleEmojiClick = (emoji) => {
        const newSeq = [...userSequence, emoji].slice(0, 3);
        setUserSequence(newSeq);
        setShuffledEmojis(shuffleArray(BASE_EMOJIS));

        if (newSeq.length === 3) {
            if (JSON.stringify(newSeq) === JSON.stringify(correctSequence)) {
                setIsReportAuth(true);
                setShowLoginModal(false);
                setShowReport(true);
                fetchReportData();
            } else {
                setUserSequence([]);
                alert("Secuencia Incorrecta ❌");
            }
        }
    };

    // =========================================
    // LÓGICA DE PROCESAMIENTO (ACTUALIZADA)
    // =========================================
    const getProcessedReport = () => {
        let filtered = historicalData;
        if (reportFilterGrado) {
            filtered = historicalData.filter(d => d.Grado === reportFilterGrado);
        }

        const stats = filtered.reduce((acc, curr) => {
            const name = curr.Nombre_Estudiante;
            if (!name) return acc;
            
            if (!acc[name]) {
                acc[name] = { count: 0, grado: curr.Grado, totalMinutes: 0, completedSalidas: 0 };
            }
            
            acc[name].count += 1;

            // Calcular tiempo si tiene salida y regreso
            if (curr.Hora_Salida && curr.Hora_Regreso) {
                const salida = new Date(curr.Hora_Salida);
                const regreso = new Date(curr.Hora_Regreso);
                const diffMinutos = (regreso - salida) / 60000;
                
                if (diffMinutos > 0) {
                    acc[name].totalMinutes += diffMinutos;
                    acc[name].completedSalidas += 1;
                }
            }
            
            return acc;
        }, {});

        return Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
    };

    return (
        <div className="app-wrapper">
            <header className="main-header">
                <div className="header-logo-section">
                    <img 
                        src="https://i.pinimg.com/736x/1c/fc/8b/1cfc8b1ab0460021e731dd82d17abb72.jpg" 
                        alt="Escudo" 
                        className="school-logo"
                    />
                    <h1>HallPass 2026 🎓</h1>
                </div>
                <div className="header-actions">
                    <button className="btn-report" onClick={handleOpenReport}>
                        📊 REPORTE
                    </button>
                </div>
            </header>

            {/* SECCIÓN DE SELECCIÓN */}
            <div className="selection-area card">
                <h3>Autorizar Nueva Salida</h3>
                <div className="selectors-grid">
                    <select 
                        className="form-select" 
                        value={selectedGrado} 
                        onChange={(e) => {setSelectedGrado(e.target.value); setSelectedStudent(null);}}
                    >
                        <option value="">Selecciona Grado...</option>
                        {GRADOS_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <select 
                        className="form-select" 
                        disabled={!selectedGrado}
                        value={selectedStudent ? selectedStudent.rowId : ""}
                        onChange={(e) => setSelectedStudent(allStudents.find(s => s.rowId == e.target.value))}
                    >
                        <option value="">Selecciona Estudiante...</option>
                        {allStudents
                            .filter(s => s.Grado === selectedGrado)
                            .map(s => <option key={s.rowId} value={s.rowId}>{s.Nombre_Completo || s.Nombre_Estudiante}</option>)
                        }
                    </select>

                    <button className="btn-add-student" disabled={!selectedStudent} onClick={handleAuthorizeExit}>
                        AUTORIZAR ✅
                    </button>
                </div>
            </div>

            {/* LISTA ACTIVA */}
            <div className="content-area">
                <h2 className="section-title">En el pasillo ({activePasses.length})</h2>
                <div className="lists-container single-col">
                    {activePasses.length > 0 ? (
                        activePasses.map(pass => {
                            const salidaDate = new Date(pass.Hora_Salida);
                            const minutos = Math.floor((new Date() - salidaDate) / 60000);
                            return (
                                <div key={pass.rowId} className={`student-card ${minutos >= 6 ? 'warning-bg' : ''}`}>
                                    <div className="student-info">
                                        <span className="student-name">{pass.Nombre_Estudiante}</span>
                                        <span className="student-meta">
                                            {pass.Grado} • Salió {salidaDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <div className="timer-badge">⏱️ {minutos} min</div>
                                    <button className="btn-action check" onClick={() => handleReturn(pass)}>REGRESÓ ↩️</button>
                                </div>
                            );
                        })
                    ) : <div className="empty-msg">No hay nadie fuera del salón 🎉</div>}
                </div>
            </div>

            {/* MODAL LOGIN */}
            {showLoginModal && (
                <div className="modal-overlay">
                    <div className="login-card">
                        <h3>Acceso a Reportes 🔒</h3>
                        <div className="emoji-slots">
                            {[0, 1, 2].map(i => <div key={i} className="slot">{userSequence[i] || ""}</div>)}
                        </div>
                        <div className="emoji-grid">
                            {shuffledEmojis.map((e, i) => (
                                <button key={i} className="emoji-btn" onClick={() => handleEmojiClick(e)}>{e}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REPORTE (TABLA ACTUALIZADA) */}
            {showReport && (
                <div className="modal-overlay">
                    <div className="modal-content report-modal">
                        <div className="modal-header">
                            <h3>📊 Resumen de Salidas</h3>
                            <button className="close-modal" onClick={() => setShowReport(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="report-controls">
                                <select 
                                    className="form-select"
                                    value={reportFilterGrado}
                                    onChange={(e) => setReportFilterGrado(e.target.value)}
                                >
                                    <option value="">Todos los grados</option>
                                    {GRADOS_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            {loadingReport ? <p>Cargando datos...</p> : (
                                <div className="report-table-container">
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Estudiante</th>
                                                <th>Grado</th>
                                                <th style={{textAlign: 'center'}}>Total</th>
                                                <th style={{textAlign: 'center'}}>Promedio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getProcessedReport().map(([name, info]) => {
                                                const promedio = info.completedSalidas > 0 
                                                    ? (info.totalMinutes / info.completedSalidas).toFixed(1) 
                                                    : "---";
                                                return (
                                                    <tr key={name}>
                                                        <td>{name}</td>
                                                        <td>{info.grado}</td>
                                                        <td style={{textAlign: 'center'}}>{info.count}</td>
                                                        <td style={{textAlign: 'center', color: promedio > 7 ? 'var(--danger)' : 'inherit'}}>
                                                            <strong>{promedio} min</strong>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {loading && <div className="global-loader">Cargando...</div>}
            {syncing && <div className="sync-badge-floating">Sincronizando...</div>}
        </div>
    );
};