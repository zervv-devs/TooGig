import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  serverTimestamp,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase";
import Navbar from "../components/Navbar";

/* ─── helpers ──────────────────────────────────────────────── */
const avatar = (name = "?") => name.charAt(0).toUpperCase();

const fmt = (ts) =>
  ts?.toDate
    ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

const isImage = (url = "") =>
  /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url);

/* ─── component ────────────────────────────────────────────── */
const Chat = () => {
  const [messages, setMessages]             = useState([]);
  const [chatId, setChatId]                 = useState(null);
  const [text, setText]                     = useState("");
  const [conversations, setConversations]   = useState([]);
  const [userNames, setUserNames]           = useState({});
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver]             = useState(false);
  const [sellerProfile, setSellerProfile]   = useState(null);
  const [sellerGigs, setSellerGigs]         = useState([]);
  const [sellerLoading, setSellerLoading]   = useState(false);
  const [sidebarOpen, setSidebarOpen]       = useState(false);

  const messagesEndRef = useRef();
  const fileInputRef   = useRef();
  const initDone       = useRef(false);
  const navigate       = useNavigate();
  const currentUser    = auth.currentUser;

  if (!currentUser) return <div className="loading-screen">Loading…</div>;

  /* ── init chat from URL param ─────────────────────────────── */
  useEffect(() => {
    if (!currentUser || initDone.current) return;
    initDone.current = true;

    const initChat = async () => {
      try {
        const sellerName = new URLSearchParams(window.location.search).get("seller");
        if (!sellerName) return;

        const usersSnapshot = await getDocs(
          query(collection(db, "users"), where("name", "==", sellerName))
        );
        if (usersSnapshot.empty) return;

        const sellerUid = usersSnapshot.docs[0].id;
        if (sellerUid === currentUser.uid) return;

        const snapshot = await getDocs(
          query(collection(db, "conversations"), where("members", "array-contains", currentUser.uid))
        );

        const existing = snapshot.docs.find(d => d.data().members.includes(sellerUid));
        if (existing) {
          setChatId(existing.id);
        } else {
          const newChat = await addDoc(collection(db, "conversations"), {
            members: [currentUser.uid, sellerUid],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setChatId(newChat.id);
        }
      } catch (err) {
        console.error("Init chat error:", err);
      }
    };
    initChat();
  }, [currentUser]);

  /* ── load conversations ───────────────────────────────────── */
  useEffect(() => {
    const q = query(
      collection(db, "conversations"),
      where("members", "array-contains", currentUser.uid)
    );

    return onSnapshot(q, async (snapshot) => {
      const convos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const seen   = new Set();
      const unique = convos.filter(c => {
        const uid = c.members.find(id => id !== currentUser.uid);
        if (seen.has(uid)) return false;
        seen.add(uid); return true;
      });

      setConversations(unique);
      if (!chatId && unique.length > 0) setChatId(p => p || unique[0].id);

      const toFetch = unique
        .map(c => c.members.find(id => id !== currentUser.uid))
        .filter(uid => uid && !userNames[uid]);

      if (!toFetch.length) return;

      const names = {};
      await Promise.all(toFetch.map(async uid => {
        try {
          const d = await getDoc(doc(db, "users", uid));
          names[uid] = d.exists()
            ? d.data().name || d.data().displayName || d.data().email || "Unknown"
            : uid.slice(0, 8) + "…";
        } catch { names[uid] = "Unknown"; }
      }));
      setUserNames(p => ({ ...p, ...names }));
    });
  }, [currentUser, chatId]);

  /* ── load messages ────────────────────────────────────────── */
  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(
      query(collection(db, "conversations", chatId, "messages"), orderBy("createdAt")),
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [chatId]);

  /* ── mark as read ─────────────────────────────────────────── */
  useEffect(() => {
    if (!chatId || !currentUser) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, "conversations", chatId, "messages"), where("read", "==", false))
      );
      snap.docs.forEach(async md => {
        if (md.data().senderId !== currentUser.uid)
          await updateDoc(doc(db, "conversations", chatId, "messages", md.id), { read: true });
      });
    })();
  }, [chatId]);

  /* ── load seller profile ──────────────────────────────────── */
  useEffect(() => {
    if (!chatId || !conversations.length) {
      setSellerProfile(null);
      setSellerGigs([]);
      return;
    }

    const loadSeller = async () => {
      setSellerLoading(true);
      try {
        const conv = conversations.find(c => c.id === chatId);
        if (!conv) return;
        const sellerUid = conv.members.find(id => id !== currentUser.uid);
        if (!sellerUid) return;

        const userDoc = await getDoc(doc(db, "users", sellerUid));
        if (!userDoc.exists()) return;

        const data = { uid: sellerUid, ...userDoc.data() };
        setSellerProfile(data);

        if (data.email) {
          const gigsSnap = await getDocs(
            query(
              collection(db, "promotedGigs"),
              where("sellerEmail", "==", data.email),
              where("status", "==", "approved")
            )
          );
          const gigs = gigsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(g => g.visible !== false)
            .slice(0, 3);
          setSellerGigs(gigs);
        }
      } catch (err) {
        console.error("Load seller error:", err);
      } finally {
        setSellerLoading(false);
      }
    };

    loadSeller();
  }, [chatId, conversations]);

  /* ── auto scroll ──────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── send text ────────────────────────────────────────────── */
  const sendMessage = async (extraData = {}) => {
    if (!text.trim() && !extraData.fileUrl) return;
    try {
      await addDoc(collection(db, "conversations", chatId, "messages"), {
        text: text.trim(),
        senderId: currentUser.uid,
        read: false,
        createdAt: serverTimestamp(),
        ...extraData,
      });
      setText("");
    } catch (err) { console.error("Send error:", err); }
  };

  /* ── upload file ──────────────────────────────────────────── */
  const handleFile = (file) => {
    if (!file || !chatId) return;
    const storageRef = ref(storage, `chat-files/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    setUploading(true);
    setUploadProgress(0);

    task.on(
      "state_changed",
      snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err  => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, "conversations", chatId, "messages"), {
          text: "",
          fileUrl: url,
          fileName: file.name,
          fileType: file.type,
          senderId: currentUser.uid,
          read: false,
          createdAt: serverTimestamp(),
        });
        setUploading(false);
        setUploadProgress(0);
      }
    );
  };

  const onFileChange = e => handleFile(e.target.files[0]);
  const onDrop = e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  /* ── helpers ──────────────────────────────────────────────── */
  const activeName = () => {
    const conv = conversations.find(c => c.id === chatId);
    if (!conv) return "";
    const uid = conv.members.find(id => id !== currentUser.uid);
    return userNames[uid] || "…";
  };

  /* ── FIX: use sellerName for navigation like Buyer page does ─ */
  const handleViewProfile = () => {
    const name = sellerProfile?.name || sellerProfile?.displayName;
    if (name) {
      navigate(`/seller/${name}`);
    }
  };

  /* ────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Syne:wght@600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:         #f8faf9;
          --surface:    #ffffff;
          --surface2:   #f0f7f3;
          --surface3:   #e6f4ec;
          --border:     #d4e8db;
          --border2:    #c0ddc9;
          --accent:     #1a7a45;
          --accent-lt:  #22a05a;
          --accent-bg:  #edf7f1;
          --text:       #0d2118;
          --text2:      #3d5a4a;
          --muted:      #7fa892;
          --danger:     #e05252;
          --bubble-me:  linear-gradient(145deg, #1a7a45 0%, #0f5c32 100%);
          --bubble-in:  #ffffff;
          --radius-lg:  20px;
          --radius-md:  14px;
          --radius-sm:  8px;
          --font:       'Outfit', sans-serif;
          --font-head:  'Syne', sans-serif;
          --shadow-sm:  0 1px 4px rgba(0,0,0,.06);
          --shadow-md:  0 4px 16px rgba(0,0,0,.08);
          --shadow-lg:  0 8px 32px rgba(0,0,0,.10);
        }

        body { font-family: var(--font); }

        .chat-root {
          display: flex; flex-direction: column;
          height: 100vh; background: var(--bg);
          color: var(--text); overflow: hidden;
        }

        /* ── TOP BAR ──────────────────────────────────────────── */
        .chat-topbar {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 10px 24px;
          display: flex; align-items: center; gap: 12px;
        }
        .chat-topbar-back {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 7px 14px;
          font: 500 13px var(--font);
          color: var(--text2);
          cursor: pointer;
          transition: all .18s;
          display: flex; align-items: center; gap: 6px;
        }
        .chat-topbar-back:hover {
          background: var(--surface3);
          color: var(--accent);
          border-color: var(--border2);
        }
        .chat-topbar-title {
          font: 700 15px var(--font-head);
          color: var(--text);
          letter-spacing: -.2px;
        }
        .chat-topbar-title span { color: var(--accent); }

        /* ── BODY ─────────────────────────────────────────────── */
        .chat-body { display: flex; flex: 1; overflow: hidden; }

        /* ── SIDEBAR ──────────────────────────────────────────── */
        .sidebar {
          width: 270px; flex-shrink: 0;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
        }
        .sidebar-head {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border);
        }
        .sidebar-head h3 {
          font: 700 16px var(--font-head);
          letter-spacing: -.3px;
          color: var(--text);
        }
        .sidebar-head p {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .convo-list { overflow-y: auto; flex: 1; padding: 8px; }
        .convo-list::-webkit-scrollbar { width: 3px; }
        .convo-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

        .convo-item {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 12px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background .15s;
          margin-bottom: 2px;
        }
        .convo-item:hover { background: var(--surface2); }
        .convo-item.active {
          background: var(--accent-bg);
          box-shadow: inset 3px 0 0 var(--accent);
        }
        .convo-item.active .convo-name { color: var(--accent); }

        .av {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-lt), var(--accent));
          display: flex; align-items: center; justify-content: center;
          font: 700 15px var(--font-head); color: #fff;
          flex-shrink: 0; letter-spacing: 0;
        }
        .av-sm {
          width: 34px; height: 34px; font-size: 13px;
        }
        .convo-name { font: 500 14px var(--font); color: var(--text); }
        .convo-preview { font-size: 12px; color: var(--muted); margin-top: 1px; }
        .convo-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 8px; padding: 40px 20px;
          text-align: center; color: var(--muted);
        }
        .convo-empty .ce-icon { font-size: 32px; opacity: .5; }
        .convo-empty p { font-size: 13px; }

        /* ── CHAT PANE ────────────────────────────────────────── */
        .chat-pane {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
          overflow: hidden; position: relative;
          background: var(--bg);
        }

        .chat-header {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 14px 20px;
          display: flex; align-items: center; gap: 12px;
          box-shadow: var(--shadow-sm);
        }
        .chat-header-info { flex: 1; }
        .chat-header-name { font: 600 15px var(--font); color: var(--text); }
        .chat-header-status {
          font-size: 12px; color: var(--accent-lt);
          display: flex; align-items: center; gap: 5px;
          margin-top: 2px;
        }
        .online-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--accent-lt);
          animation: blink 2.4s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }

        .header-action {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 7px 14px;
          font: 500 13px var(--font);
          color: var(--text2);
          cursor: pointer;
          transition: all .18s;
        }
        .header-action:hover {
          background: var(--accent-bg);
          color: var(--accent);
          border-color: var(--border2);
        }

        /* ── MESSAGES ─────────────────────────────────────────── */
        .messages-area {
          flex: 1; overflow-y: auto;
          padding: 20px 24px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .messages-area::-webkit-scrollbar { width: 4px; }
        .messages-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

        /* Date separator */
        .date-sep {
          text-align: center;
          margin: 12px 0 8px;
        }
        .date-sep span {
          font-size: 11px;
          color: var(--muted);
          background: var(--surface3);
          border: 1px solid var(--border);
          border-radius: 99px;
          padding: 3px 12px;
          letter-spacing: .04em;
        }

        .msg-row { display: flex; margin-bottom: 2px; }
        .msg-row.me   { justify-content: flex-end; }
        .msg-row.them { justify-content: flex-start; align-items: flex-end; gap: 8px; }

        .msg-avatar { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--accent-lt), var(--accent));
          display: flex; align-items: center; justify-content: center;
          font: 700 11px var(--font-head); color: #fff; }

        .bubble {
          max-width: 62%;
          padding: 10px 14px 8px;
          border-radius: var(--radius-lg);
          font-size: 14px; line-height: 1.6;
          animation: msgPop .2s cubic-bezier(.34,1.56,.64,1);
          position: relative;
          word-break: break-word;
        }
        @keyframes msgPop {
          from { opacity: 0; transform: scale(.88) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .bubble.me {
          background: var(--bubble-me);
          color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 12px rgba(26,122,69,.25);
        }
        .bubble.them {
          background: var(--bubble-in);
          color: var(--text);
          border-bottom-left-radius: 4px;
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }

        .msg-time {
          display: block;
          font-size: 10px;
          margin-top: 4px;
          opacity: .55;
          text-align: right;
          letter-spacing: .02em;
        }
        .bubble.them .msg-time { text-align: left; }

        /* Consecutive messages */
        .msg-row.me + .msg-row.me .bubble   { border-bottom-right-radius: var(--radius-lg); margin-top: -1px; }
        .msg-row.them + .msg-row.them .bubble { border-bottom-left-radius: var(--radius-lg); margin-top: -1px; }
        .msg-row.them + .msg-row.them .msg-avatar { opacity: 0; }

        /* File messages */
        .file-msg {
          max-width: 62%;
          border-radius: var(--radius-lg);
          overflow: hidden;
          animation: msgPop .2s cubic-bezier(.34,1.56,.64,1);
          box-shadow: var(--shadow-sm);
        }
        .file-msg.me { margin-left: auto; border-bottom-right-radius: 4px; }
        .file-msg.them { border-bottom-left-radius: 4px; }

        .img-preview {
          max-width: 100%; display: block;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
        }
        .file-card {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px;
        }
        .file-card.me   { background: var(--bubble-me); color: #fff; }
        .file-card.them { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
        .file-icon { font-size: 20px; flex-shrink: 0; }
        .file-info { flex: 1; min-width: 0; }
        .file-name { font: 500 13px var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-dl {
          font-size: 11px; text-decoration: none; display: inline-block; margin-top: 2px;
          color: rgba(255,255,255,.75);
        }
        .file-card.them .file-dl { color: var(--accent); }
        .file-dl:hover { text-decoration: underline; }

        /* Empty state */
        .empty-chat {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          flex: 1; text-align: center; color: var(--muted);
          gap: 12px;
        }
        .empty-chat .ec-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: var(--surface3);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
        }
        .empty-chat h4 { font: 600 16px var(--font); color: var(--text2); }
        .empty-chat p { font-size: 13px; max-width: 240px; line-height: 1.55; }

        /* ── INPUT BAR ────────────────────────────────────────── */
        .input-area {
          background: var(--surface);
          border-top: 1px solid var(--border);
          padding: 14px 20px;
        }
        .upload-progress {
          margin-bottom: 10px;
          display: flex; align-items: center; gap: 10px;
        }
        .progress-track {
          flex: 1; height: 3px;
          background: var(--surface3); border-radius: 99px; overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-lt), var(--accent));
          border-radius: 99px; transition: width .12s;
        }
        .progress-label { font-size: 11px; color: var(--muted); white-space: nowrap; }

        .input-row {
          display: flex; align-items: center; gap: 8px;
        }
        .input-wrap {
          flex: 1;
          background: var(--surface2);
          border: 1.5px solid var(--border);
          border-radius: 999px;
          display: flex; align-items: center;
          padding: 0 6px 0 16px;
          transition: border-color .2s, box-shadow .2s;
        }
        .input-wrap:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(26,122,69,.10);
        }
        .input-wrap input {
          flex: 1; background: transparent; border: none; outline: none;
          font: 400 14px var(--font); color: var(--text);
          padding: 11px 4px;
        }
        .input-wrap input::placeholder { color: var(--muted); }

        .attach-btn {
          width: 34px; height: 34px; border-radius: 50%;
          background: transparent; border: none;
          color: var(--muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; transition: color .15s;
          flex-shrink: 0;
        }
        .attach-btn:hover { color: var(--accent); }

        .send-btn {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(145deg, var(--accent-lt), var(--accent));
          border: none; color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
          box-shadow: 0 4px 16px rgba(26,122,69,.30);
          transition: transform .15s, box-shadow .15s;
        }
        .send-btn:hover { transform: scale(1.07); box-shadow: 0 6px 22px rgba(26,122,69,.40); }
        .send-btn:active { transform: scale(.95); }

        /* Drop overlay */
        .drop-overlay {
          position: absolute; inset: 0; z-index: 50;
          background: rgba(15,33,24,.85);
          backdrop-filter: blur(6px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 14px; pointer-events: none;
          border-radius: 0;
        }
        .drop-icon {
          width: 72px; height: 72px; border-radius: 50%;
          border: 2px dashed var(--accent-lt);
          display: flex; align-items: center; justify-content: center;
          font-size: 32px;
          animation: dropPulse 1.2s ease-in-out infinite;
        }
        @keyframes dropPulse { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.08); } }
        .drop-overlay p { font: 600 16px var(--font); color: #fff; }
        .drop-overlay span { font-size: 12px; color: rgba(255,255,255,.55); }

        /* ── RIGHT SELLER PANEL ───────────────────────────────── */
        .seller-panel {
          width: 280px; flex-shrink: 0;
          background: var(--surface);
          border-left: 1px solid var(--border);
          display: flex; flex-direction: column;
          overflow-y: auto;
        }
        .seller-panel::-webkit-scrollbar { width: 3px; }
        .seller-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

        .sp-head {
          padding: 14px 18px 12px;
          background: var(--surface2);
          border-bottom: 1px solid var(--border);
        }
        .sp-head h4 {
          font: 700 11px var(--font-head);
          text-transform: uppercase; letter-spacing: .12em;
          color: var(--muted);
        }

        .sp-card {
          padding: 22px 18px 18px;
          border-bottom: 1px solid var(--border);
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; text-align: center;
        }

        .sp-avatar-wrap { position: relative; display: inline-block; }
        .sp-avatar-img {
          width: 72px; height: 72px; border-radius: 50%;
          object-fit: cover; display: block;
          border: 3px solid var(--surface3);
          box-shadow: 0 0 0 2px var(--border);
        }
        .sp-avatar-fallback {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-lt), var(--accent));
          display: flex; align-items: center; justify-content: center;
          font: 700 26px var(--font-head); color: #fff;
          border: 3px solid var(--surface3);
          box-shadow: 0 0 0 2px var(--border);
        }
        .sp-online-dot {
          position: absolute; bottom: 4px; right: 4px;
          width: 14px; height: 14px; border-radius: 50%;
          background: #2ecc71; border: 2.5px solid var(--surface);
        }

        .sp-name { font: 700 16px var(--font-head); color: var(--text); }
        .sp-email { font-size: 12px; color: var(--muted); margin-top: -4px; }
        .sp-bio {
          font-size: 12.5px; color: var(--text2); line-height: 1.6;
          display: -webkit-box; -webkit-line-clamp: 3;
          -webkit-box-orient: vertical; overflow: hidden;
        }

        .sp-stats {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; width: 100%;
        }
        .sp-stat {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 9px 6px; text-align: center;
        }
        .sp-stat-val {
          display: block;
          font: 700 13px var(--font-head);
          color: var(--accent);
        }
        .sp-stat-lbl {
          display: block;
          font-size: 10px; color: var(--muted);
          text-transform: uppercase; letter-spacing: .06em;
          margin-top: 2px;
        }

        /* ── FIX: View Profile button now uses navigate() ─────── */
        .sp-btn {
          display: block; width: 100%; text-align: center;
          background: linear-gradient(145deg, var(--accent-lt), var(--accent));
          color: #fff; border: none; border-radius: 999px;
          padding: 11px 0; font: 600 13px var(--font);
          cursor: pointer; text-decoration: none;
          box-shadow: 0 4px 16px rgba(26,122,69,.25);
          transition: transform .15s, box-shadow .15s;
          letter-spacing: .01em;
        }
        .sp-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(26,122,69,.35); }
        .sp-btn:active { transform: translateY(0); }

        .sp-divider {
          height: 1px; background: var(--border); margin: 0 18px;
        }

        .sp-gigs { padding: 16px 18px 20px; display: flex; flex-direction: column; gap: 10px; }
        .sp-gigs-title {
          font: 700 11px var(--font-head);
          text-transform: uppercase; letter-spacing: .12em;
          color: var(--muted); margin-bottom: 2px;
        }

        .sp-gig {
          border: 1px solid var(--border); border-radius: var(--radius-md);
          overflow: hidden; text-decoration: none; color: var(--text);
          display: block; background: var(--surface);
          transition: box-shadow .2s, transform .18s;
        }
        .sp-gig:hover { box-shadow: 0 4px 20px rgba(26,122,69,.15); transform: translateY(-2px); }
        .sp-gig-img { width: 100%; height: 80px; object-fit: cover; display: block; }
        .sp-gig-body { padding: 9px 11px 11px; }
        .sp-gig-title {
          font-size: 12.5px; font-weight: 600; line-height: 1.45;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
          color: var(--text);
        }
        .sp-gig-badge {
          display: inline-block; margin-top: 6px;
          background: var(--accent-bg); color: var(--accent);
          font-size: 10px; font-weight: 600; padding: 2px 8px;
          border-radius: 99px; border: 1px solid rgba(26,122,69,.2);
        }

        .sp-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 36px 18px; text-align: center;
          color: var(--muted); gap: 10px;
        }
        .sp-empty-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: var(--surface2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; opacity: .7;
        }
        .sp-empty p { font-size: 13px; line-height: 1.55; max-width: 180px; }

        .sp-loader { flex: 1; display: flex; align-items: center; justify-content: center; }
        .sp-spinner {
          width: 26px; height: 26px; border-radius: 50%;
          border: 2.5px solid var(--border);
          border-top-color: var(--accent);
          animation: spin .65s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .loading-screen {
          height: 100vh; display: flex; align-items: center;
          justify-content: center; background: var(--bg);
          color: var(--muted); font-family: var(--font); font-size: 15px;
        }

        /* ── RESPONSIVE ───────────────────────────────────────── */
        @media (max-width: 900px) {
          .seller-panel { display: none; }
        }
        @media (max-width: 640px) {
          .sidebar { width: 220px; }
        }
      `}</style>

      <div className="chat-root">
        <Navbar user={currentUser} />

        <div className="chat-topbar">
          <button className="chat-topbar-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div className="chat-topbar-title">Messages <span>·</span></div>
        </div>

        <div className="chat-body">

          {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
          <aside className="sidebar">
            <div className="sidebar-head">
              <h3>Inbox</h3>
              <p>{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="convo-list">
              {conversations.length === 0 ? (
                <div className="convo-empty">
                  <div className="ce-icon">💬</div>
                  <p>No conversations yet</p>
                </div>
              ) : conversations.map(conv => {
                const uid  = conv.members.find(id => id !== currentUser.uid);
                const name = userNames[uid] || "…";
                return (
                  <div
                    key={conv.id}
                    className={`convo-item ${chatId === conv.id ? "active" : ""}`}
                    onClick={() => setChatId(conv.id)}
                  >
                    <div className="av">{avatar(name)}</div>
                    <div>
                      <div className="convo-name">{name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ── CHAT PANE ────────────────────────────────────── */}
          <section
            className="chat-pane"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {dragOver && (
              <div className="drop-overlay">
                <div className="drop-icon">📂</div>
                <p>Drop to send file</p>
                <span>Supports images, PDFs and more</span>
              </div>
            )}

            {chatId ? (
              <>
                <div className="chat-header">
                  <div className="av av-sm">{avatar(activeName())}</div>
                  <div className="chat-header-info">
                    <div className="chat-header-name">{activeName()}</div>
                    <div className="chat-header-status">
                      <span className="online-dot" /> Active now
                    </div>
                  </div>
                  {sellerProfile && (
                    <button
                      className="header-action"
                      onClick={handleViewProfile}
                    >
                      View Profile →
                    </button>
                  )}
                </div>

                <div className="messages-area">
                  {messages.length === 0 && (
                    <div className="empty-chat">
                      <div className="ec-icon">👋</div>
                      <h4>Start the conversation</h4>
                      <p>Send a message to get things going!</p>
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const mine = msg.senderId === currentUser.uid;
                    if (msg.fileUrl) {
                      return (
                        <div key={msg.id} className={`msg-row ${mine ? "me" : "them"}`}>
                          {!mine && <div className="msg-avatar">{avatar(activeName())}</div>}
                          <div className={`file-msg ${mine ? "me" : "them"}`}>
                            {isImage(msg.fileUrl) ? (
                              <div style={{ padding: "6px" }}>
                                <img src={msg.fileUrl} alt={msg.fileName} className="img-preview" />
                                <span className="msg-time" style={{ color: mine ? "rgba(255,255,255,.6)" : undefined }}>
                                  {fmt(msg.createdAt)}
                                </span>
                              </div>
                            ) : (
                              <div className={`file-card ${mine ? "me" : "them"}`}>
                                <span className="file-icon">📎</span>
                                <div className="file-info">
                                  <div className="file-name">{msg.fileName}</div>
                                  <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="file-dl">
                                    Download ↗
                                  </a>
                                </div>
                                <span className="msg-time">{fmt(msg.createdAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className={`msg-row ${mine ? "me" : "them"}`}>
                        {!mine && <div className="msg-avatar">{avatar(activeName())}</div>}
                        <div className={`bubble ${mine ? "me" : "them"}`}>
                          {msg.text}
                          <span className="msg-time">{fmt(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="input-area">
                  {uploading && (
                    <div className="upload-progress">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <span className="progress-label">Uploading… {uploadProgress}%</span>
                    </div>
                  )}
                  <div className="input-row">
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: "none" }}
                      onChange={onFileChange}
                    />
                    <div className="input-wrap">
                      <button className="attach-btn" title="Attach file" onClick={() => fileInputRef.current.click()}>
                        📎
                      </button>
                      <input
                        type="text"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Type a message…"
                        onKeyDown={e => e.key === "Enter" && sendMessage()}
                      />
                    </div>
                    <button className="send-btn" onClick={() => sendMessage()} title="Send">
                      ➤
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-chat" style={{ flex: 1, display: "flex" }}>
                <div className="ec-icon">💬</div>
                <h4>No chat selected</h4>
                <p>Choose a conversation from the sidebar to start messaging</p>
              </div>
            )}
          </section>

          {/* ── RIGHT SELLER PANEL ───────────────────────────── */}
          <aside className="seller-panel">
            <div className="sp-head">
              <h4>Seller Info</h4>
            </div>

            {!chatId ? (
              <div className="sp-empty">
                <div className="sp-empty-icon">💬</div>
                <p>Select a conversation to see seller details</p>
              </div>
            ) : sellerLoading ? (
              <div className="sp-loader">
                <div className="sp-spinner" />
              </div>
            ) : sellerProfile ? (
              <>
                <div className="sp-card">
                  <div className="sp-avatar-wrap">
                    {sellerProfile.profileImage ? (
                      <img
                        src={sellerProfile.profileImage}
                        alt={sellerProfile.name}
                        className="sp-avatar-img"
                      />
                    ) : (
                      <div className="sp-avatar-fallback">
                        {avatar(sellerProfile.name || sellerProfile.email || "?")}
                      </div>
                    )}
                    <span className="sp-online-dot" />
                  </div>

                  <div className="sp-name">
                    {sellerProfile.name || sellerProfile.displayName || "Seller"}
                  </div>
                  {sellerProfile.email && (
                    <div className="sp-email">{sellerProfile.email}</div>
                  )}
                  {sellerProfile.about && (
                    <div className="sp-bio">{sellerProfile.about}</div>
                  )}

                  <div className="sp-stats">
                    <div className="sp-stat">
                      <span className="sp-stat-val">⭐ {sellerProfile.rating || "4.9"}</span>
                      <span className="sp-stat-lbl">Rating</span>
                    </div>
                    <div className="sp-stat">
                      <span className="sp-stat-val">⚡ {sellerProfile.responseTime || "1 hr"}</span>
                      <span className="sp-stat-lbl">Response</span>
                    </div>
                    <div className="sp-stat">
                      <span className="sp-stat-val">📅 {sellerProfile.memberSince || "2024"}</span>
                      <span className="sp-stat-lbl">Member</span>
                    </div>
                    <div className="sp-stat">
                      <span className="sp-stat-val">{sellerGigs.length || "—"}</span>
                      <span className="sp-stat-lbl">Gigs</span>
                    </div>
                  </div>

                  {/* ── FIXED: navigate to /seller/:name like Buyer page ── */}
                  <button className="sp-btn" onClick={handleViewProfile}>
                    View Full Profile →
                  </button>
                </div>

                {sellerGigs.length > 0 && (
                  <>
                    <div className="sp-divider" />
                    <div className="sp-gigs">
                      <div className="sp-gigs-title">Active Gigs</div>
                      {sellerGigs.map(gig => (
                        <a
                          key={gig.id}
                          href={gig.affiliateLink || gig.gigLink || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sp-gig"
                        >
                          {gig.gigImage && (
                            <img src={gig.gigImage} alt={gig.gigTitle} className="sp-gig-img" />
                          )}
                          <div className="sp-gig-body">
                            <div className="sp-gig-title">{gig.gigTitle}</div>
                            {(gig.discount > 0 || gig.category) && (
                              <span className="sp-gig-badge">
                                {gig.discount > 0 ? `${gig.discount}% off · ` : ""}{gig.category}
                              </span>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="sp-empty">
                <div className="sp-empty-icon">🙁</div>
                <p>Could not load seller info</p>
              </div>
            )}
          </aside>

        </div>
      </div>
    </>
  );
};

export default Chat;