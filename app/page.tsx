'use client';

import { useState } from 'react';

// --- SVG Icons ---
const InboxIcon = () => (<svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>);
const PencilIcon = () => (<svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const LogoutIcon = () => (<svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>);
const TrashIcon = () => (<svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>);
const BackIcon = () => (<svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>);
const PaperClipIcon = () => (<svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>);
const SendIcon = () => (<svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>);

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [view, setView] = useState<'inbox' | 'compose' | 'email'>('inbox');
  const [inbox, setInbox] = useState<any[]>([]);
  const [currentEmail, setCurrentEmail] = useState<any>(null);
  
  // Compose states
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : '??';
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const utcDate = new Date(dateStr.replace(' ', 'T') + 'Z');
    return utcDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const sendCommand = async (command: string, payload: any = '') => {
    setLoading(true);
    try {
      const res = await fetch('/api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload, username, password })
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.verb === '200') {
        setMessage('');
        return data.payload;
      } else {
        setMessage(`Error: ${data.error || data.payload}`);
        setTimeout(() => setMessage(''), 4000);
        return null;
      }
    } catch (e: any) {
      setLoading(false);
      setMessage(`Error: ${e.message}`);
      setTimeout(() => setMessage(''), 4000);
      return null;
    }
  };

  const handleLogin = async (isRegister: boolean) => {
    if(!username || !password) return setMessage('Please enter username and password');
    const cmd = isRegister ? 'REGISTER' : 'LOGIN';
    const payload = `${username}:${password}`;
    const res = await sendCommand(cmd, payload);
    if (res) {
      setIsLoggedIn(true);
      fetchInbox();
    }
  };

  const fetchInbox = async () => {
    const data = await sendCommand('GET_INBOX');
    if (data) {
      setInbox(data);
      setView('inbox');
    }
  };

  const fetchEmail = async (id: number) => {
    const data = await sendCommand('GET_EMAIL', id.toString());
    if (data) {
      setCurrentEmail(data);
      setView('email');
      // Update inbox list to mark as read
      setInbox(inbox.map(em => em.id === id ? { ...em, is_read: 1 } : em));
    }
  };

  const deleteEmail = async (id: number) => {
    const res = await sendCommand('DELETE_EMAIL', id.toString());
    if (res) {
      setView('inbox');
      fetchInbox();
    }
  };

  const handleFileChange = (e: any) => {
    const files = Array.from(e.target.files);
    const newAttachments: any[] = [];
    
    files.forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newAttachments.push({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: event.target?.result as string
        });
        setAttachments([...attachments, ...newAttachments]);
      };
      reader.readAsDataURL(file);
    });
  };

  const sendEmail = async () => {
    if (!recipients) return setMessage("Please enter a recipient");
    const payload = {
      recipients: recipients.split(',').map(r => r.trim()),
      subject,
      bodyText,
      attachments
    };
    const res = await sendCommand('SEND_EMAIL', payload);
    if (res) {
      setRecipients(''); setSubject(''); setBodyText(''); setAttachments([]);
      fetchInbox();
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 font-sans selection:bg-blue-500 selection:text-white">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-10 rounded-2xl shadow-2xl w-full max-w-md text-white">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4 border border-blue-500/30 shadow-inner">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">TCP Mail</h1>
            <p className="text-slate-300 mt-2 text-sm">Sign in to your custom TCP mail server</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Username</label>
              <input 
                className="w-full bg-slate-900/50 border border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-white placeholder-slate-500 shadow-inner" 
                placeholder="Enter username" 
                value={username} onChange={e => setUsername(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Password</label>
              <input 
                className="w-full bg-slate-900/50 border border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-white placeholder-slate-500 shadow-inner" 
                type="password" 
                placeholder="Enter password" 
                value={password} onChange={e => setPassword(e.target.value)} 
              />
            </div>
            
            <div className="pt-2 flex gap-3">
              <button disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center disabled:opacity-50" onClick={() => handleLogin(false)}>
                {loading ? 'Connecting...' : 'Sign In'}
              </button>
              <button disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-medium py-3 rounded-xl transition shadow-lg flex items-center justify-center disabled:opacity-50" onClick={() => handleLogin(true)}>
                Register
              </button>
            </div>
          </div>
          
          {message && (
            <div className="mt-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm text-center animate-pulse">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f3f4f6] text-slate-800 font-sans selection:bg-blue-200 selection:text-blue-900">
      
      {/* Toast Notification */}
      {message && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
            <span className={message.includes('Error') ? 'text-red-400' : 'text-blue-400'}>
              {message.includes('Error') ? '⚠️' : '✨'}
            </span>
            <span className="font-medium text-sm">{message}</span>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-[260px] bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold shadow-inner">
            {getInitials(username)}
          </div>
          <div>
            <div className="font-bold text-white tracking-wide">TCP Mail</div>
            <div className="text-xs text-blue-400 font-medium">@{username}</div>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          <button 
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${view === 'inbox' || view === 'email' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-slate-800 hover:text-white'}`} 
            onClick={fetchInbox}
          >
            <InboxIcon />
            <span className="font-medium">Inbox</span>
            {inbox.filter(e => !e.is_read).length > 0 && (
              <span className="ml-auto bg-white/20 text-white text-xs py-0.5 px-2 rounded-full font-bold">
                {inbox.filter(e => !e.is_read).length}
              </span>
            )}
          </button>
          
          <button 
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${view === 'compose' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-slate-800 hover:text-white'}`} 
            onClick={() => setView('compose')}
          >
            <PencilIcon />
            <span className="font-medium">Compose</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all" onClick={() => setIsLoggedIn(false)}>
            <LogoutIcon />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white/50 backdrop-blur-xl">
        
        {/* Top Header */}
        <header className="h-16 bg-white/80 border-b border-slate-200 flex items-center px-8 shadow-sm z-10 shrink-0 backdrop-blur-md">
          {view === 'email' && (
            <button className="flex items-center text-slate-500 hover:text-blue-600 transition-colors mr-6" onClick={() => setView('inbox')}>
              <BackIcon />
              <span className="font-medium text-sm">Back</span>
            </button>
          )}
          <h2 className="text-xl font-bold text-slate-800 capitalize tracking-tight">
            {view === 'compose' ? 'New Message' : view === 'email' ? 'Read Message' : 'Inbox'}
          </h2>
          {loading && (
            <div className="ml-4 flex items-center gap-2 text-slate-400 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Syncing...
            </div>
          )}
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-8 relative">

          {view === 'inbox' && (
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {inbox.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-slate-400">
                    <InboxIcon />
                    <p className="mt-4 text-lg font-medium">Your inbox is empty</p>
                    <p className="text-sm">When you receive emails, they'll show up here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {inbox.map((email: any) => (
                      <div key={email.id} className={`group p-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-slate-50 ${!email.is_read ? 'bg-blue-50/30' : ''}`} onClick={() => fetchEmail(email.id)}>
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                          {getInitials(email.sender)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className={`truncate mr-4 ${!email.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {email.sender}
                            </span>
                            <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                              {formatDate(email.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`truncate text-sm ${!email.is_read ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                              {email.subject || '(No Subject)'}
                            </span>
                            {!email.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'compose' && (
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
                
                <div className="flex items-center px-6 py-4 border-b border-slate-100 group focus-within:bg-blue-50/30 transition-colors">
                  <label className="w-20 text-slate-400 font-medium text-sm">To:</label>
                  <input className="flex-1 bg-transparent outline-none font-medium text-slate-800 placeholder-slate-300" placeholder="Recipient username(s)" value={recipients} onChange={e => setRecipients(e.target.value)} />
                </div>
                
                <div className="flex items-center px-6 py-4 border-b border-slate-100 group focus-within:bg-blue-50/30 transition-colors">
                  <label className="w-20 text-slate-400 font-medium text-sm">Subject:</label>
                  <input className="flex-1 bg-transparent outline-none font-medium text-slate-800 placeholder-slate-300" placeholder="What is this about?" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                
                <textarea className="flex-1 w-full p-6 outline-none text-slate-700 resize-none placeholder-slate-300 font-sans leading-relaxed" placeholder="Write your message here..." value={bodyText} onChange={e => setBodyText(e.target.value)}></textarea>
                
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                  
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition shadow-sm">
                      <PaperClipIcon />
                      Attach Files
                      <input type="file" multiple onChange={handleFileChange} className="hidden" />
                    </label>
                    
                    {attachments.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium bg-slate-200/50 px-3 py-1.5 rounded-md border border-slate-200">
                        <span>📎 {attachments.length} file{attachments.length > 1 ? 's' : ''}</span>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <span className="truncate max-w-[200px]">{attachments.map(a => a.filename).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition shadow-md shadow-blue-600/20 flex items-center" onClick={sendEmail} disabled={loading}>
                    <span>Send</span>
                    <SendIcon />
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'email' && currentEmail && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                
                {/* Email Header */}
                <div className="p-8 border-b border-slate-100">
                  <div className="flex justify-between items-start mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                      {currentEmail.subject || '(No Subject)'}
                    </h1>
                    <button className="ml-4 flex items-center text-sm font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-100" onClick={() => deleteEmail(currentEmail.id)}>
                      <TrashIcon />
                      Delete
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg border border-slate-200">
                        {getInitials(currentEmail.sender)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-lg">{currentEmail.sender}</div>
                        <div className="text-sm text-slate-500 font-medium">to me</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-400 font-medium tabular-nums">
                      {formatDate(currentEmail.timestamp)}
                    </div>
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-8 text-slate-800 leading-relaxed font-sans whitespace-pre-wrap min-h-[200px]">
                  {currentEmail.body_text}
                </div>
                
                {/* Attachments */}
                {currentEmail.attachments && currentEmail.attachments.length > 0 && (
                  <div className="bg-slate-50 p-8 border-t border-slate-200">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                      <PaperClipIcon />
                      {currentEmail.attachments.length} Attachment{currentEmail.attachments.length !== 1 && 's'}
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {currentEmail.attachments.map((att: any, i: number) => {
                        const isImg = att.mime_type.includes('image');
                        const isPdf = att.mime_type.includes('pdf');
                        return (
                          <a 
                            key={i} 
                            download={att.filename} 
                            href={`data:${att.mime_type};base64,${att.content_base64}`} 
                            className="group relative bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col overflow-hidden w-48"
                          >
                            <div className="h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                              {isImg ? (
                                <img src={`data:${att.mime_type};base64,${att.content_base64}`} alt={att.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              ) : (
                                <span className="text-5xl drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                                  {isPdf ? '📕' : '📄'}
                                </span>
                              )}
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/10 flex items-center justify-center transition-colors">
                                <div className="opacity-0 group-hover:opacity-100 bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                                  Download
                                </div>
                              </div>
                            </div>
                            <div className="p-3 border-t border-slate-100 bg-white">
                              <p className="text-sm font-medium text-slate-700 truncate" title={att.filename}>{att.filename}</p>
                              <p className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">{att.mime_type.split('/')[1]}</p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
