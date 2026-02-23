import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONFIG - GitHub raw URL로 JSON 가져오기
   ⚠️  GITHUB_REPO를 본인 레포지토리로 변경하세요!
   예: "username/kina-sanctuary"
═══════════════════════════════════════════════════════════════ */
const GITHUB_REPO   = "Jiseokjun/kina-sanctuary"; // ← 수정 필요
const GITHUB_BRANCH = "main";
const DATA_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/data/legion-data.json`;

/* ═══════════════════════════════════════════════════════════════
   STORAGE HELPERS
═══════════════════════════════════════════════════════════════ */
async function sGet(key) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function sSet(key, val) {
  try { await window.storage.set(key, JSON.stringify(val), true); } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ADMIN_CODE = "test1234";
const MAX_SLOT   = 8;

const JOB_ICONS = {
  검성:"⚔️", 수호성:"🛡️", 살성:"🗡️", 궁성:"🏹",
  마도성:"🔮", 정령성:"🌿", 치유성:"💚", 호법성:"✨", "알 수 없음":"❓"
};
const JOB_COLORS = {
  검성:"#e05050", 수호성:"#5080e0", 살성:"#c060c0", 궁성:"#50b050",
  마도성:"#8050e0", 정령성:"#50c0a0", 치유성:"#e0a050", 호법성:"#e0e050"
};

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToWed = day >= 3 ? day - 3 : day + 4;
  const wed = new Date(now);
  wed.setDate(now.getDate() - diffToWed);
  wed.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(wed);
    d.setDate(wed.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function todayKey()    { return new Date().toISOString().slice(0, 10); }
function nowSlotKey()  {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${n.getMinutes() < 30 ? "00" : "30"}`;
}
function fmtDate(ds) {
  const d = new Date(ds);
  return `${d.getMonth()+1}/${d.getDate()}(${"일월화수목금토"[d.getDay()]})`;
}
function fmtTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

/* ═══════════════════════════════════════════════════════════════
   FETCH LEGION FROM GITHUB
═══════════════════════════════════════════════════════════════ */
async function fetchLegionData() {
  const res = await fetch(DATA_URL + "?t=" + Date.now()); // 캐시 방지
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/* ═══════════════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen]         = useState("login");
  const [user, setUser]             = useState(null);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [legion, setLegion]         = useState(null);
  const [legionLoading, setLegionLoading] = useState(false);
  const [legionError, setLegionError]     = useState(null);
  const [schedule, setSchedule]     = useState({});
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [weekDays, setWeekDays]     = useState([]);
  const [loginForm, setLoginForm]   = useState({ nick: "", code: "" });
  const [loginError, setLoginError] = useState("");
  const [toast, setToast]           = useState(null);
  const [confirm, setConfirm]       = useState(null);
  const [adminTab, setAdminTab]     = useState("schedule");
  const [tick, setTick]             = useState(0);
  const currentRef = useRef(null);

  useEffect(() => { setWeekDays(getWeekRange()); }, []);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    (async () => {
      const s = await sGet("kina:schedule");
      if (s) setSchedule(s);
      // GitHub에서 레기온 데이터 자동 로드
      loadLegion();
    })();
  }, []);

  useEffect(() => {
    if (screen === "schedule" && currentRef.current) {
      setTimeout(() => currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [screen]);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── GitHub에서 레기온 데이터 로드 ── */
  const loadLegion = async () => {
    setLegionLoading(true);
    setLegionError(null);
    try {
      const data = await fetchLegionData();
      setLegion(data);
      showToast(`✅ ${data.legionName} 레기온 데이터 로드 완료 (${data.memberCount}명)`, "success");
    } catch (err) {
      setLegionError("GitHub에서 데이터를 불러오지 못했습니다. GITHUB_REPO를 확인하세요.");
      // 저장된 캐시 사용
      const cached = await sGet("kina:legion");
      if (cached) { setLegion(cached); showToast("⚠️ 캐시된 레기온 데이터를 사용합니다.", "warn"); }
    }
    setLegionLoading(false);
  };

  /* ── 로그인 ── */
  const handleLogin = () => {
    const nick = loginForm.nick.trim();
    const code = loginForm.code.trim();
    if (code === ADMIN_CODE) {
      setUser({ nick: "관리자", isAdmin: true });
      setIsAdmin(true);
      setScreen("schedule");
      return;
    }
    if (!nick) { setLoginError("닉네임을 입력해주세요."); return; }
    if (!legion) { setLoginError("레기온 데이터 로드 중입니다. 잠시 후 다시 시도해주세요."); return; }
    const member = legion.members.find(m => m.nick === nick);
    if (!member) { setLoginError("등록되지 않은 멤버입니다."); return; }
    setUser({ ...member, legionName: legion.legionName });
    setLoginError("");
    setScreen("schedule");
  };

  /* ── 스케줄 ── */
  const getSlot  = (d, s) => schedule?.[d]?.[s] || [];
  const findMine = (d) => {
    if (!user || isAdmin) return null;
    return TIME_SLOTS.find(s => getSlot(d, s).some(e => e.nick === user.nick)) || null;
  };

  const joinSlot = async (slot) => {
    if (!user || isAdmin) return;
    const data = getSlot(selectedDate, slot);
    if (data.length >= MAX_SLOT) { showToast("해당 시간은 마감되었습니다.", "error"); return; }
    if (data.some(e => e.nick === user.nick)) { showToast("이미 등록된 시간입니다.", "warn"); return; }
    const mySlot = findMine(selectedDate);
    if (mySlot) {
      setConfirm({
        msg: `이미 ${mySlot}에 등록되어 있습니다.\n${slot}으로 이동하시겠습니까?`,
        onOk: () => { setConfirm(null); doJoin(slot, mySlot); },
        onCancel: () => setConfirm(null),
      });
      return;
    }
    doJoin(slot, null);
  };

  const doJoin = async (newSlot, oldSlot) => {
    let upd = { ...schedule };
    if (oldSlot) {
      upd = { ...upd, [selectedDate]: { ...upd[selectedDate], [oldSlot]: getSlot(selectedDate, oldSlot).filter(e => e.nick !== user.nick) } };
    }
    const prev = upd[selectedDate]?.[newSlot] || [];
    upd = { ...upd, [selectedDate]: { ...upd[selectedDate], [newSlot]: [...prev, { nick: user.nick, job: user.job, atul: user.atul, power: user.power, joinedAt: Date.now() }] } };
    setSchedule(upd);
    await sSet("kina:schedule", upd);
    showToast(oldSlot ? `🔄 ${oldSlot} → ${newSlot} 이동 완료` : `⚔️ ${newSlot} 성역 참가 등록!`, "success");
  };

  const leaveSlot = async (slot) => {
    const upd = { ...schedule, [selectedDate]: { ...schedule[selectedDate], [slot]: getSlot(selectedDate, slot).filter(e => e.nick !== user.nick) } };
    setSchedule(upd);
    await sSet("kina:schedule", upd);
    showToast("등록이 취소되었습니다.", "info");
  };

  const adminRemove = async (date, slot, nick) => {
    const upd = { ...schedule, [date]: { ...schedule[date], [slot]: getSlot(date, slot).filter(e => e.nick !== nick) } };
    setSchedule(upd);
    await sSet("kina:schedule", upd);
    showToast(`${nick} 제거됨`, "info");
  };

  const adminClearSlot = async (date, slot) => {
    const upd = { ...schedule, [date]: { ...schedule[date], [slot]: [] } };
    setSchedule(upd);
    await sSet("kina:schedule", upd);
    showToast(`${slot} 슬롯 초기화됨`, "info");
  };

  const nowSlot = nowSlotKey();
  const today   = todayKey();
  const mySlotToday = findMine(selectedDate);
  const totalReg = (d) => TIME_SLOTS.reduce((a, s) => a + getSlot(d, s).length, 0);

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={S.root}>
      <style>{css}</style>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {confirm && (
        <div style={S.overlay}>
          <div style={S.dialog}>
            <div style={{ fontSize: 28, textAlign:"center", marginBottom:12 }}>⚠️</div>
            <p style={{ color:"#e0d0ff", lineHeight:1.7, whiteSpace:"pre-line", textAlign:"center" }}>{confirm.msg}</p>
            <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"center" }}>
              <button className="btn-ghost" onClick={confirm.onCancel}>유지</button>
              <button className="btn-primary" onClick={confirm.onOk}>이동하기</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOGIN ══ */}
      {screen === "login" && (
        <div style={S.center}>
          <div style={S.loginCard}>
            <div style={S.rune}>✦ ✦ ✦</div>
            <div style={{ fontSize:52 }}>⚔️</div>
            <h1 style={S.title}>키나의 성역</h1>
            <p style={S.subtitle}>AION 2 · 성역 공략 스케줄러</p>

            {/* Legion status */}
            <div style={S.legionStatus}>
              {legionLoading ? (
                <span style={{ color:"#7060a0", fontSize:12 }}>🔄 레기온 데이터 로딩 중...</span>
              ) : legion ? (
                <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
                  <span style={{ color:"#a064ff", fontSize:13, fontWeight:700 }}>⚔️ {legion.legionName} · {legion.memberCount}명</span>
                  <span style={{ color:"#5040a0", fontSize:11 }}>
                    최근 동기화: {fmtTime(legion.lastSync)}
                  </span>
                  <button className="btn-ghost sm" onClick={loadLegion} style={{ marginTop:4 }}>🔄 재연동</button>
                </div>
              ) : (
                <div style={{ color:"#e07070", fontSize:12 }}>
                  {legionError || "데이터 없음"}
                  <button className="btn-ghost sm" onClick={loadLegion} style={{ marginTop:6, display:"block" }}>재시도</button>
                </div>
              )}
            </div>

            <div style={S.fields}>
              <input className="inp" placeholder="닉네임 (관리자는 비워두기)"
                value={loginForm.nick} onChange={e => setLoginForm({...loginForm, nick:e.target.value})}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <input className="inp" type="password" placeholder="관리자 코드 (일반 멤버는 비워두기)"
                value={loginForm.code} onChange={e => setLoginForm({...loginForm, code:e.target.value})}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
              {loginError && <p style={{ color:"#e07070", fontSize:13 }}>{loginError}</p>}
              <button className="btn-primary" onClick={handleLogin}>⚔️ 성역 입장</button>
            </div>
            <div style={S.runeBot}>— KINA SANCTUARY —</div>
          </div>
        </div>
      )}

      {/* ══ SCHEDULE ══ */}
      {screen === "schedule" && (
        <div style={S.appWrap}>
          {/* HEADER */}
          <header style={S.header}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:22 }}>⚔️</span>
              <div>
                <h1 style={S.headerTitle}>키나의 성역</h1>
                <p style={S.headerSub}>{isAdmin ? "🔑 관리자 모드" : `⚔️ ${user?.legionName} · ${user?.nick}`}</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              {isAdmin && (
                <>
                  <button className={`tab-btn ${adminTab==="schedule"?"active":""}`} onClick={()=>setAdminTab("schedule")}>스케줄</button>
                  <button className={`tab-btn ${adminTab==="legion"?"active":""}`} onClick={()=>setAdminTab("legion")}>레기온</button>
                  <button className={`tab-btn ${adminTab==="stats"?"active":""}`} onClick={()=>setAdminTab("stats")}>통계</button>
                </>
              )}
              <button className="btn-ghost sm" onClick={()=>{setUser(null);setIsAdmin(false);setScreen("login");}}>나가기</button>
            </div>
          </header>

          {/* ADMIN LEGION TAB */}
          {isAdmin && adminTab === "legion" && (
            <div style={S.adminWrap}>
              <AdminLegion legion={legion} loading={legionLoading} error={legionError} onReload={loadLegion} dataUrl={DATA_URL} />
            </div>
          )}

          {/* ADMIN STATS TAB */}
          {isAdmin && adminTab === "stats" && (
            <div style={S.adminWrap}>
              <StatsPanel schedule={schedule} weekDays={weekDays} legion={legion} getSlot={getSlot} />
            </div>
          )}

          {/* SCHEDULE TAB */}
          {(!isAdmin || adminTab === "schedule") && (
            <>
              <div style={S.dateTabs}>
                {weekDays.map(d => {
                  const isToday = d === today;
                  const reg = totalReg(d);
                  return (
                    <button key={d} className={`date-tab ${d===selectedDate?"active":""} ${isToday?"today":""}`}
                      onClick={()=>{setSelectedDate(d);setSelectedSlot(null);}}>
                      <span className="date-label">{fmtDate(d)}</span>
                      {reg > 0 && <span className="date-badge">{reg}</span>}
                    </button>
                  );
                })}
              </div>

              <div style={S.body}>
                {/* SLOT LIST */}
                <div style={S.slotCol}>
                  <div style={S.slotHdr}>
                    <span style={{ color:"#7060a0", fontSize:12 }}>슬롯당 최대 {MAX_SLOT}명</span>
                    {mySlotToday && !isAdmin && (
                      <span style={{ color:"#a064ff", fontSize:12 }}>✦ {mySlotToday} 등록됨</span>
                    )}
                  </div>
                  <div style={{ overflowY:"auto", flex:1 }}>
                    {TIME_SLOTS.map(slot => {
                      const data   = getSlot(selectedDate, slot);
                      const isFull = data.length >= MAX_SLOT;
                      const isJoined = !isAdmin && data.some(e => e.nick === user?.nick);
                      const isNow  = slot === nowSlot && selectedDate === today;
                      const isSel  = selectedSlot === slot;
                      return (
                        <div key={slot} ref={isNow ? currentRef : null}
                          className={`slot-row ${isSel?"sel":""} ${isNow?"now":""}`}
                          onClick={()=>setSelectedSlot(isSel ? null : slot)}>
                          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              {isNow && <span className="now-tag">▶NOW</span>}
                              <span className="slot-time">{slot}</span>
                              <div className="prog-bar">
                                <div className="prog-fill" style={{ width:`${(data.length/MAX_SLOT)*100}%`, background: isFull?"linear-gradient(90deg,#c03030,#e05050)":"linear-gradient(90deg,#5030a0,#9060e0)" }} />
                              </div>
                              <span style={{ fontSize:11, color:"#7060a0", minWidth:32 }}>{data.length}/{MAX_SLOT}</span>
                            </div>
                            {data.length > 0 && (
                              <div style={{ display:"flex", gap:4, paddingLeft:2 }}>
                                {data.slice(0,6).map((m,i)=>(
                                  <span key={i} title={`${m.nick}(${m.job})`} style={{ fontSize:13 }}>{JOB_ICONS[m.job]||"❓"}</span>
                                ))}
                                {data.length > 6 && <span style={{ fontSize:11, color:"#7060a0" }}>+{data.length-6}</span>}
                              </div>
                            )}
                          </div>
                          <span className={`status-badge ${isFull?"full":"open"}`}>{isFull?"🔴 마감":"🟢 모집중"}</span>
                          {isJoined && <span style={{ fontSize:14 }}>✦</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DETAIL */}
                <div style={S.detailCol}>
                  {selectedSlot
                    ? <SlotDetail slot={selectedSlot} date={selectedDate}
                        data={getSlot(selectedDate, selectedSlot)}
                        user={user} isAdmin={isAdmin}
                        onJoin={()=>joinSlot(selectedSlot)}
                        onLeave={()=>leaveSlot(selectedSlot)}
                        onAdminRemove={(nick)=>adminRemove(selectedDate,selectedSlot,nick)}
                        onAdminClear={()=>adminClearSlot(selectedDate,selectedSlot)} />
                    : <div style={S.empty}><div style={{fontSize:52}}>🗺️</div><p style={{color:"#5040a0",marginTop:12,fontSize:14}}>시간 슬롯을 선택하면<br/>상세 정보가 표시됩니다</p></div>
                  }
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── SlotDetail ── */
function SlotDetail({ slot, date, data, user, isAdmin, onJoin, onLeave, onAdminRemove, onAdminClear }) {
  const isFull   = data.length >= MAX_SLOT;
  const isJoined = !isAdmin && data.some(e => e.nick === user?.nick);
  const remaining = MAX_SLOT - data.length;
  return (
    <div className="detail-panel fade-in">
      <div style={S.detailTop}>
        <div>
          <h2 style={{ fontFamily:"Cinzel,serif", fontSize:30, color:"#e0d0ff", letterSpacing:3 }}>{slot}</h2>
          <p style={{ color:"#7060a0", fontSize:12, marginTop:2 }}>{date} · 성역 공략</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {!isAdmin && !isJoined && !isFull && <button className="act-btn join" onClick={onJoin}>✚ 참가</button>}
          {!isAdmin && isJoined          && <button className="act-btn leave" onClick={onLeave}>✕ 취소</button>}
          {isAdmin                       && <button className="act-btn leave" onClick={onAdminClear}>🗑 초기화</button>}
          <span className={`status-badge lg ${isFull?"full":"open"}`}>{isFull?"🔴 마감":`🟢 모집중 · ${remaining}자리`}</span>
        </div>
      </div>
      <div style={{ padding:"12px 24px 6px", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <span style={{ color:"#7060a0", fontSize:12 }}>참가 현황</span>
          <span style={{ color:"#e0d0ff", fontSize:12, fontWeight:700 }}>{data.length} / {MAX_SLOT}</span>
        </div>
        <div className="prog-bar lg">
          <div className="prog-fill" style={{ width:`${(data.length/MAX_SLOT)*100}%`, background: isFull?"linear-gradient(90deg,#c03030,#e05050)":"linear-gradient(90deg,#5030a0,#9060e0)" }} />
        </div>
      </div>
      <div style={{ padding:"8px 20px", overflowY:"auto", flex:1 }}>
        {data.map((m,i) => (
          <div key={i} className={`member-card ${m.nick===user?.nick?"me":""}`}>
            <div className="avatar" style={{ background: JOB_COLORS[m.job]||"#5040a0" }}>{JOB_ICONS[m.job]||"❓"}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14, fontWeight:700, color:"#e0d0ff" }}>{m.nick}</span>
                {m.nick === user?.nick && <span style={{ fontSize:10, color:"#a064ff" }}>(나)</span>}
                <span style={{ fontSize:11, color:JOB_COLORS[m.job], fontWeight:600 }}>{m.job}</span>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:3 }}>
                <span style={{ fontSize:11, color:"#7060a0" }}>아툴 <b style={{ color:"#c0a0e0" }}>{m.atul?.toLocaleString()||"-"}</b></span>
                <span style={{ fontSize:11, color:"#7060a0" }}>전투력 <b style={{ color:"#c0a0e0" }}>{m.power?.toLocaleString()||"-"}</b></span>
              </div>
            </div>
            {isAdmin && <button className="act-btn leave sm" onClick={()=>onAdminRemove(m.nick)}>제거</button>}
          </div>
        ))}
        {Array.from({length:remaining}).map((_,i) => (
          <div key={`e${i}`} className="member-card empty">
            <div className="avatar empty">?</div>
            <span style={{ color:"#3030a0", fontSize:13 }}>빈 자리</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── AdminLegion ── */
function AdminLegion({ legion, loading, error, onReload, dataUrl }) {
  return (
    <div style={S.adminPanel}>
      <h2 style={S.panelTitle}>⚔️ 레기온 데이터 관리</h2>

      <div style={S.infoBox}>
        <p style={{ color:"#a064ff", fontSize:14, fontWeight:700, marginBottom:8 }}>📡 GitHub Actions 자동 동기화</p>
        <p style={{ color:"#7060a0", fontSize:13, lineHeight:1.7 }}>
          레기온 데이터는 GitHub Actions가 <b style={{color:"#c0a0ff"}}>매일 오전 9시</b>에 자동으로 크롤링 & 업데이트합니다.<br/>
          수동 업데이트가 필요하면 GitHub → Actions → 수동 실행을 클릭하세요.
        </p>
        <div style={{ marginTop:12, padding:"10px 14px", background:"rgba(0,0,0,.3)", borderRadius:8, fontSize:12, color:"#6050a0", fontFamily:"monospace", wordBreak:"break-all" }}>
          📂 {dataUrl}
        </div>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        <button className="btn-primary" onClick={onReload} disabled={loading}>
          {loading ? "🔄 로딩 중..." : "🔄 지금 즉시 재연동"}
        </button>
        <a href="https://github.com" target="_blank" rel="noreferrer">
          <button className="btn-ghost">🐙 GitHub Actions 열기</button>
        </a>
      </div>

      {error && <div style={{ color:"#e07070", fontSize:13, marginBottom:16 }}>❌ {error}</div>}

      {legion && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ color:"#e0d0ff", fontSize:16 }}>
              ⚔️ {legion.legionName}
              <span style={{ color:"#7060a0", fontSize:13, marginLeft:8 }}>({legion.server} / {legion.faction})</span>
              <span style={{ color:"#a064ff", fontSize:13, marginLeft:8 }}>{legion.memberCount}명</span>
            </h3>
            <span style={{ color:"#5040a0", fontSize:12 }}>최근 동기화: {fmtTime(legion.lastSync)}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
            {legion.members.map((m,i) => (
              <div key={i} style={S.memberMini}>
                <span style={{ fontSize:20 }}>{JOB_ICONS[m.job]||"❓"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#e0d0ff" }}>{m.nick}</div>
                  <div style={{ fontSize:11, color:JOB_COLORS[m.job] }}>{m.job}</div>
                  <div style={{ fontSize:11, color:"#6050a0" }}>아툴 {m.atul?.toLocaleString()} · 전투력 {m.power?.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── StatsPanel ── */
function StatsPanel({ schedule, weekDays, legion, getSlot }) {
  const all = weekDays.flatMap(d => TIME_SLOTS.flatMap(s => getSlot(d, s).map(e => ({...e, date:d, slot:s}))));
  const nickCnt = {}, jobCnt = {};
  all.forEach(e => { nickCnt[e.nick] = (nickCnt[e.nick]||0)+1; jobCnt[e.job] = (jobCnt[e.job]||0)+1; });
  const sorted = Object.entries(nickCnt).sort((a,b)=>b[1]-a[1]);
  return (
    <div style={S.adminPanel}>
      <h2 style={S.panelTitle}>📊 금주 통계</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:12, marginBottom:28 }}>
        {[
          { label:"총 등록 수", value:all.length, icon:"📋" },
          { label:"활동 멤버", value:Object.keys(nickCnt).length, icon:"👥" },
          { label:"활성 슬롯", value:weekDays.reduce((a,d)=>a+TIME_SLOTS.filter(s=>getSlot(d,s).length>0).length,0), icon:"⏰" },
          { label:"전체 레기온", value:legion?.memberCount||0, icon:"⚔️" },
        ].map((s,i) => (
          <div key={i} style={S.statCard}>
            <span style={{ fontSize:24 }}>{s.icon}</span>
            <span style={{ fontSize:28, fontWeight:800, color:"#a064ff", fontFamily:"Cinzel,serif" }}>{s.value}</span>
            <span style={{ fontSize:12, color:"#7060a0" }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div>
          <h3 style={{ color:"#e0d0ff", fontSize:14, marginBottom:12 }}>🏆 참가 횟수 TOP</h3>
          {sorted.slice(0,8).map(([nick,cnt],i) => {
            const m = legion?.members.find(x=>x.nick===nick);
            return (
              <div key={nick} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                <span style={{ color:i<3?"#e0b040":"#6050a0", fontSize:13, minWidth:20 }}>#{i+1}</span>
                <span style={{ fontSize:16 }}>{JOB_ICONS[m?.job]||"❓"}</span>
                <span style={{ flex:1, fontSize:13, color:"#e0d0ff" }}>{nick}</span>
                <span style={{ fontSize:12, color:"#a064ff", fontWeight:700 }}>{cnt}회</span>
              </div>
            );
          })}
        </div>
        <div>
          <h3 style={{ color:"#e0d0ff", fontSize:14, marginBottom:12 }}>직업별 참가 현황</h3>
          {Object.entries(jobCnt).sort((a,b)=>b[1]-a[1]).map(([job,cnt])=>(
            <div key={job} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0" }}>
              <span style={{ fontSize:16 }}>{JOB_ICONS[job]}</span>
              <span style={{ fontSize:13, color:JOB_COLORS[job], flex:1 }}>{job}</span>
              <div style={{ width:80, height:6, background:"rgba(255,255,255,.06)", borderRadius:3 }}>
                <div style={{ width:`${(cnt/all.length)*100}%`, height:"100%", background:JOB_COLORS[job], borderRadius:3 }} />
              </div>
              <span style={{ fontSize:12, color:"#7060a0", minWidth:28 }}>{cnt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CSS & STYLES
═══════════════════════════════════════════════════════════════ */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#070512;} ::-webkit-scrollbar-thumb{background:#4a2a7a;border-radius:3px;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
  @keyframes slideRight{from{transform:translateX(100%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes glow{0%,100%{text-shadow:0 0 8px rgba(160,100,255,.5);}50%{text-shadow:0 0 20px rgba(160,100,255,1),0 0 40px rgba(100,50,200,.6);}}
  .fade-in{animation:fadeIn .25s ease;}
  .toast{position:fixed;top:20px;right:20px;z-index:9999;background:#100828;border:1px solid #7040c0;border-radius:12px;padding:12px 20px;font-size:14px;color:#e0d0ff;box-shadow:0 8px 32px rgba(0,0,0,.6);animation:slideRight .3s ease;font-family:'Noto Sans KR',sans-serif;}
  .toast-success{border-color:#40a060;} .toast-error{border-color:#c03030;} .toast-warn{border-color:#c08030;}
  .inp{background:rgba(255,255,255,.04);border:1px solid rgba(120,60,200,.3);border-radius:10px;padding:12px 16px;color:#e0d0ff;font-size:14px;width:100%;font-family:'Noto Sans KR',sans-serif;transition:border-color .2s;}
  .inp:focus{outline:none;border-color:#a064ff;}
  .btn-primary{background:linear-gradient(135deg,#5020b0,#8040d0);border:none;border-radius:10px;padding:12px 20px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:transform .15s,box-shadow .15s;box-shadow:0 4px 20px rgba(80,20,160,.4);}
  .btn-primary:hover{transform:translateY(-1px);} .btn-primary:disabled{opacity:.5;cursor:not-allowed;}
  .btn-ghost{background:transparent;border:1px solid rgba(120,60,200,.3);border-radius:10px;padding:11px 18px;color:#9080c0;font-size:14px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:border-color .2s,color .2s;}
  .btn-ghost:hover{border-color:#a064ff;color:#e0d0ff;} .btn-ghost.sm{padding:6px 12px;font-size:12px;}
  .tab-btn{background:transparent;border:1px solid rgba(120,60,200,.25);border-radius:8px;padding:7px 14px;color:#7060a0;font-size:13px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:all .2s;}
  .tab-btn.active,.tab-btn:hover{background:rgba(120,60,200,.2);border-color:#a064ff;color:#e0d0ff;}
  .date-tab{background:rgba(255,255,255,.03);border:1px solid rgba(120,60,200,.15);border-radius:10px;padding:8px 14px;color:#7060a0;font-size:13px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:72px;}
  .date-tab.active{background:rgba(120,60,200,.2);border-color:#a064ff;color:#e0d0ff;} .date-tab.today .date-label{color:#c090ff;}
  .date-badge{background:#a064ff;color:#fff;border-radius:20px;font-size:10px;padding:1px 7px;font-weight:700;}
  .slot-row{display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s;border-left:3px solid transparent;}
  .slot-row:hover{background:rgba(120,60,200,.12);} .slot-row.sel{background:rgba(120,60,200,.18);} .slot-row.now{border-left-color:#a064ff;background:rgba(100,50,200,.07);}
  .slot-time{font-family:'Cinzel',serif;font-size:15px;font-weight:600;color:#e0d0ff;min-width:52px;}
  .now-tag{font-size:9px;color:#a064ff;animation:glow 2s infinite;min-width:36px;}
  .prog-bar{flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;} .prog-bar.lg{height:8px;border-radius:4px;}
  .prog-fill{height:100%;border-radius:inherit;transition:width .4s;}
  .status-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;}
  .status-badge.open{background:rgba(50,140,80,.15);color:#50c870;border:1px solid rgba(50,140,80,.3);}
  .status-badge.full{background:rgba(200,40,40,.15);color:#e06060;border:1px solid rgba(200,40,40,.3);}
  .status-badge.lg{padding:7px 14px;font-size:13px;}
  .detail-panel{height:100%;display:flex;flex-direction:column;}
  .member-card{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;margin-bottom:8px;border:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.02);transition:background .15s;}
  .member-card.me{background:rgba(160,100,255,.08);border-color:rgba(160,100,255,.2);} .member-card.empty{opacity:.4;border-style:dashed;}
  .avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
  .avatar.empty{background:rgba(255,255,255,.04);color:#3030a0;font-size:14px;}
  .act-btn{padding:8px 16px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:700;font-family:'Noto Sans KR',sans-serif;transition:all .2s;border:1px solid;}
  .act-btn.join{background:rgba(40,130,70,.1);color:#50c870;border-color:rgba(40,130,70,.3);} .act-btn.join:hover{background:rgba(40,130,70,.2);}
  .act-btn.leave{background:rgba(180,40,40,.1);color:#e06060;border-color:rgba(180,40,40,.3);} .act-btn.leave:hover{background:rgba(180,40,40,.2);}
  .act-btn.sm{padding:4px 10px;font-size:11px;}
`;

const S = {
  root:{minHeight:"100vh",background:"linear-gradient(135deg,#060410 0%,#0c0620 60%,#070415 100%)",fontFamily:"'Noto Sans KR',sans-serif",color:"#e0d0ff"},
  center:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20},
  loginCard:{background:"rgba(12,8,28,.97)",border:"1px solid rgba(110,50,190,.3)",borderRadius:20,padding:"44px 40px",width:"100%",maxWidth:390,boxShadow:"0 24px 80px rgba(60,10,140,.4)",textAlign:"center"},
  rune:{color:"#4a2a7a",fontSize:14,letterSpacing:8,marginBottom:16},
  title:{fontFamily:"Cinzel,serif",fontSize:34,fontWeight:900,color:"#e0d0ff",letterSpacing:5,textShadow:"0 0 40px rgba(160,100,255,.5)"},
  subtitle:{color:"#6050a0",fontSize:13,marginBottom:20},
  legionStatus:{background:"rgba(90,50,160,.1)",border:"1px solid rgba(90,50,160,.25)",borderRadius:12,padding:"14px",marginBottom:20},
  fields:{display:"flex",flexDirection:"column",gap:12},
  runeBot:{marginTop:24,color:"#3a2060",fontSize:11,letterSpacing:4},
  appWrap:{display:"flex",flexDirection:"column",height:"100vh"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 22px",background:"rgba(8,6,20,.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(80,40,160,.3)",flexShrink:0},
  headerTitle:{fontFamily:"Cinzel,serif",fontSize:18,color:"#e0d0ff",letterSpacing:3},
  headerSub:{color:"#7060a0",fontSize:12,marginTop:2},
  dateTabs:{display:"flex",gap:8,padding:"12px 18px",background:"rgba(8,5,18,.8)",borderBottom:"1px solid rgba(80,40,160,.2)",overflowX:"auto",flexShrink:0},
  body:{display:"flex",flex:1,overflow:"hidden"},
  slotCol:{width:"52%",borderRight:"1px solid rgba(80,40,160,.25)",display:"flex",flexDirection:"column",overflow:"hidden"},
  slotHdr:{padding:"10px 16px",borderBottom:"1px solid rgba(80,40,160,.2)",display:"flex",justifyContent:"space-between",flexShrink:0},
  detailCol:{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"},
  detailTop:{padding:"20px 24px 14px",borderBottom:"1px solid rgba(80,40,160,.25)",display:"flex",flexDirection:"column",gap:12,flexShrink:0},
  empty:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998},
  dialog:{background:"#100828",border:"1px solid rgba(110,50,190,.4)",borderRadius:16,padding:"28px 32px",maxWidth:360,width:"90%",boxShadow:"0 20px 60px rgba(0,0,0,.7)"},
  adminWrap:{flex:1,overflowY:"auto",padding:24},
  adminPanel:{maxWidth:900,margin:"0 auto"},
  panelTitle:{fontFamily:"Cinzel,serif",fontSize:22,color:"#e0d0ff",marginBottom:12,letterSpacing:2},
  infoBox:{background:"rgba(90,50,160,.1)",border:"1px solid rgba(90,50,160,.25)",borderRadius:12,padding:"18px 20px",marginBottom:20},
  memberMini:{background:"rgba(255,255,255,.03)",border:"1px solid rgba(80,40,160,.2)",borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"},
  statCard:{background:"rgba(255,255,255,.03)",border:"1px solid rgba(80,40,160,.2)",borderRadius:12,padding:"18px",display:"flex",flexDirection:"column",alignItems:"center",gap:6},
};
