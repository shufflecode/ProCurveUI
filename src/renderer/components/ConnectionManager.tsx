import React, { useState, useEffect, useRef } from 'react';
import type { SSHProfile } from '@types/ipc';

const S = {
  btn: (variant: 'primary' | 'ghost' | 'danger' = 'ghost', disabled = false): React.CSSProperties => ({
    padding: '10px 20px',
    backgroundColor: variant === 'primary' ? '#ffffff' : variant === 'danger' ? 'rgba(239,68,68,0.1)' : 'transparent',
    color: variant === 'primary' ? '#1f2228' : variant === 'danger' ? '#fca5a5' : '#ffffff',
    border: `1px solid ${variant === 'primary' ? '#ffffff' : variant === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.2)'}`,
    fontFamily: 'Geist Mono, monospace',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    borderRadius: 0,
    minWidth: 0,
    flex: 1,
    whiteSpace: 'nowrap',
  }),
  input: (): React.CSSProperties => ({
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#ffffff',
    fontSize: '14px',
    borderRadius: 0,
    outline: 'none',
    boxSizing: 'border-box' as const,
  }),
  label: (): React.CSSProperties => ({
    display: 'block',
    marginBottom: '7px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    fontFamily: 'Geist Mono, monospace',
  }),
  formGroup: (): React.CSSProperties => ({ marginBottom: '20px' }),
};

interface Props {
  onConnected: (profile: SSHProfile) => void;
}

type View = 'connect' | 'new' | 'manage' | 'edit';

export default function ConnectionManager({ onConnected }: Props) {
  const [view, setView] = useState<View>('connect');
  const [profiles, setProfiles] = useState<SSHProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New profile form
  const [newName, setNewName] = useState('');
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState('22');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newSavePass, setNewSavePass] = useState(false);
  // refs for inputs to preserve focus and caret
  const nameRef = useRef<HTMLInputElement | null>(null);
  const hostRef = useRef<HTMLInputElement | null>(null);
  const portRef = useRef<HTMLInputElement | null>(null);
  const userRef = useRef<HTMLInputElement | null>(null);
  const passRef = useRef<HTMLInputElement | null>(null);
  const focusedFieldRef = useRef<string | null>(null);
  const caretRef = useRef<number | null>(null);

  // Edit profile state
  const [editId, setEditId] = useState('');
  const [editHost, setEditHost] = useState('');
  const [editPort, setEditPort] = useState('22');
  const [editUser, setEditUser] = useState('');
  const [editPass, setEditPass] = useState('');
  const [editSavePass, setEditSavePass] = useState(false);
  const editHostRef = useRef<HTMLInputElement | null>(null);
  const editPortRef = useRef<HTMLInputElement | null>(null);
  const editUserRef = useRef<HTMLInputElement | null>(null);
  const editPassRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { loadProfiles(); }, []);

  // Restore focus and caret position when controlled inputs re-render
  useEffect(() => {
    const name = focusedFieldRef.current;
    if (!name) return;
    let el: HTMLInputElement | null = null;
    if (name === 'newName') el = nameRef.current;
    else if (name === 'newHost') el = hostRef.current;
    else if (name === 'newPort') el = portRef.current;
    else if (name === 'newUser') el = userRef.current;
    else if (name === 'newPass') el = passRef.current;
    else if (name === 'editHost') el = editHostRef.current;
    else if (name === 'editPort') el = editPortRef.current;
    else if (name === 'editUser') el = editUserRef.current;
    else if (name === 'editPass') el = editPassRef.current;
    if (el && document.activeElement !== el) {
      el.focus();
      const pos = caretRef.current ?? el.value.length;
      try { el.setSelectionRange(pos, pos); } catch (e) {}
    }
  });

  const loadProfiles = async () => {
    try {
      const list = await window.ipc.profileList();
      setProfiles(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    } catch (e) {
      setError(`Failed to load profiles: ${e}`);
    }
  };

  const handleConnect = async () => {
    if (!selectedId) return setError('Select a profile');
    if (!password) return setError('Enter password');
    setLoading(true);
    setError(null);
    try {
      const profile = profiles.find(p => p.id === selectedId);
      if (!profile) { setError('Profile not found'); return; }
      await window.ipc.sshConnect({ ...profile, password });
      onConnected(profile);
    } catch (e: any) {
      setError(String(e).replace('Error: ', ''));
    } finally { setLoading(false); }
  };

  const handleNewProfile = async () => {
    if (!newName.trim()) return setError('Profile name required');
    if (!newHost.trim()) return setError('Host required');
    if (!newUser.trim()) return setError('Username required');
    const port = parseInt(newPort, 10);
    if (!port || port < 1 || port > 65535) return setError('Valid port required (1–65535)');

    setLoading(true);
    setError(null);
    try {
      const saved = await window.ipc.profileSave({
        id: '',
        name: newName.trim(),
        host: newHost.trim(),
        port,
        username: newUser.trim(),
        password: newSavePass ? newPass : undefined,
        savePassword: newSavePass,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await loadProfiles();
      setSelectedId(saved.id);
      setView('connect');
      setPassword(newPass);
      // reset form
      setNewName(''); setNewHost(''); setNewPort('22'); setNewUser('manager'); setNewPass(''); setNewSavePass(false);
    } catch (e: any) {
      setError(String(e));
    } finally { setLoading(false); }
  };

  const handleDeleteProfile = async (id: string) => {
    await window.ipc.profileDelete(id);
    await loadProfiles();
    if (selectedId === id) setSelectedId('');
  };

  const handleStartEdit = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;
    setEditId(id);
    setEditHost(profile.host);
    setEditPort(profile.port.toString());
    setEditUser(profile.username);
    setEditPass(profile.password || '');
    setEditSavePass(profile.savePassword || false);
    setView('edit');
    setError(null);
  };

  const handleEditProfile = async () => {
    if (!editHost.trim()) return setError('Host required');
    if (!editUser.trim()) return setError('Username required');
    const port = parseInt(editPort, 10);
    if (!port || port < 1 || port > 65535) return setError('Valid port required (1–65535)');

    setLoading(true);
    setError(null);
    try {
      const profile = profiles.find(p => p.id === editId);
      if (!profile) { setError('Profile not found'); return; }
      const updated = await window.ipc.profileSave({
        ...profile,
        host: editHost.trim(),
        port,
        username: editUser.trim(),
        password: editSavePass ? editPass : undefined,
        savePassword: editSavePass,
        updatedAt: new Date(),
      });
      await loadProfiles();
      setSelectedId(updated.id);
      setView('manage');
      setEditId(''); setEditHost(''); setEditPort('22'); setEditUser(''); setEditPass(''); setEditSavePass(false);
    } catch (e: any) {
      setError(String(e));
    } finally { setLoading(false); }
  };

  const currentProfile = profiles.find(p => p.id === selectedId);

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      width: '100%',
      maxWidth: 440,
      padding: '40px',
      border: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(255,255,255,0.02)',
    }}>
      {children}
    </div>
  );

  const Title = ({ children }: { children: React.ReactNode }) => (
    <h2 style={{ fontFamily: 'Geist Mono, monospace', fontSize: '22px', fontWeight: 300, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1.4px', marginTop: 0, marginBottom: 32 }}>
      {children}
    </h2>
  );

  const ErrorBox = () => error ? (
    <div style={{ marginBottom: 20, padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '12px', borderRadius: 0 }}>
      {error}
    </div>
  ) : null;

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', backgroundColor: '#1f2228' }}>
      {view === 'connect' && (
        <Card>
          <Title>Connect</Title>
          <ErrorBox />

          {profiles.length === 0 ? (
            <div style={{ marginBottom: 24, padding: '16px', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: '13px', textAlign: 'center' }}>
              No profiles yet. Create one first.
            </div>
          ) : (
            <>
              <div style={S.formGroup()}>
                <label style={S.label()}>Switch Profile</label>
                <select
                  value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); setPassword(''); }}
                  style={{ ...S.input(), cursor: 'pointer' }}
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.host}:{p.port}</option>
                  ))}
                </select>
              </div>

              {currentProfile && (
                <div style={{ marginBottom: 20, padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)' }}>user </span>{currentProfile.username}
                    <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 16 }}>host </span>{currentProfile.host}:{currentProfile.port}
                  </div>
                </div>
              )}

              <div style={S.formGroup()}>
                <label style={S.label()}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  placeholder="SSH password"
                  style={S.input()}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <button style={S.btn('primary', !selectedId || !password || loading)} onClick={handleConnect} disabled={!selectedId || !password || loading}>
                  {loading ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...S.btn('ghost'), flex: 1 }} onClick={() => { setView('new'); setError(null); }}>
              New Profile
            </button>
            {profiles.length > 0 && (
              <button style={{ ...S.btn('ghost'), flex: 1 }} onClick={() => { setView('manage'); setError(null); }}>
                Manage
              </button>
            )}
          </div>
        </Card>
      )}

      {view === 'new' && (
        <Card>
          <Title>New Profile</Title>
          <ErrorBox />

          <div style={S.formGroup()}>
            <label style={S.label()}>Profile Name</label>
            <input
              ref={nameRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onFocus={() => { focusedFieldRef.current = 'newName'; }}
              onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
              onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
              style={S.input()}
              placeholder="Core Switch"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 20 }}>
            <div>
              <label style={S.label()}>Host / IP</label>
              <input
                ref={hostRef}
                value={newHost}
                onChange={e => setNewHost(e.target.value)}
                onFocus={() => { focusedFieldRef.current = 'newHost'; }}
                onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                style={S.input()}
                placeholder="Switch IP"
              />
            </div>
            <div>
              <label style={S.label()}>Port</label>
              <input
                ref={portRef}
                value={newPort}
                onChange={e => setNewPort(e.target.value)}
                onFocus={() => { focusedFieldRef.current = 'newPort'; }}
                onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                style={S.input()}
                placeholder="22"
              />
            </div>
          </div>
          <div style={S.formGroup()}>
            <label style={S.label()}>Username</label>
            <input
              ref={userRef}
              value={newUser}
              onChange={e => setNewUser(e.target.value)}
              onFocus={() => { focusedFieldRef.current = 'newUser'; }}
              onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
              onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
              style={S.input()}
              placeholder="SSH User"
            />
          </div>
          <div style={S.formGroup()}>
            <label style={S.label()}>Password</label>
            <input
              ref={passRef}
              type="password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              onFocus={() => { focusedFieldRef.current = 'newPass'; }}
              onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
              onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
              style={S.input()}
              placeholder="SSH password"
            />
          </div>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="savepass" checked={newSavePass} onChange={e => setNewSavePass(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label htmlFor="savepass" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer' }}>
              Save password (encrypted)
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={S.btn('primary', loading)} onClick={handleNewProfile} disabled={loading}>
              {loading ? 'Saving…' : 'Save Profile'}
            </button>
            <button style={S.btn()} onClick={() => { setView('connect'); setError(null); }}>Cancel</button>
          </div>
        </Card>
      )}

      {view === 'manage' && (
        <Card>
          <Title>Profiles</Title>
          <ErrorBox />

          <div style={{ marginBottom: 20 }}>
            {profiles.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', minWidth: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: '#ffffff', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'Geist Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.username}@{p.host}:{p.port}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                  <button
                    style={{ padding: '4px 10px', backgroundColor: 'rgba(100,150,255,0.1)', border: '1px solid rgba(100,150,255,0.3)', color: '#a5d6ff', fontFamily: 'Geist Mono, monospace', fontSize: '10px', cursor: 'pointer', borderRadius: 0 }}
                    onClick={() => handleStartEdit(p.id)}
                  >
                    Edit
                  </button>
                  <button
                    style={{ padding: '4px 10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontFamily: 'Geist Mono, monospace', fontSize: '10px', cursor: 'pointer', borderRadius: 0 }}
                    onClick={() => handleDeleteProfile(p.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={S.btn()} onClick={() => setView('connect')}>Back</button>
            <button style={S.btn()} onClick={() => { setView('new'); setError(null); }}>New Profile</button>
          </div>
        </Card>
      )}

      {view === 'edit' && (
        <Card>
          <Title>Edit Profile</Title>
          <ErrorBox />

          {profiles.find(p => p.id === editId) && (
            <>
              <div style={S.formGroup()}>
                <label style={S.label()}>Profile Name</label>
                <div style={{ ...S.input(), backgroundColor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.6)' }}>
                  {profiles.find(p => p.id === editId)?.name}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 20 }}>
                <div>
                  <label style={S.label()}>Host / IP</label>
                  <input
                    ref={editHostRef}
                    value={editHost}
                    onChange={e => setEditHost(e.target.value)}
                    onFocus={() => { focusedFieldRef.current = 'editHost'; }}
                    onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                    onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                    style={S.input()}
                    placeholder="Switch IP"
                  />
                </div>
                <div>
                  <label style={S.label()}>Port</label>
                  <input
                    ref={editPortRef}
                    value={editPort}
                    onChange={e => setEditPort(e.target.value)}
                    onFocus={() => { focusedFieldRef.current = 'editPort'; }}
                    onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                    onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                    style={S.input()}
                    placeholder="22"
                  />
                </div>
              </div>
              <div style={S.formGroup()}>
                <label style={S.label()}>Username</label>
                <input
                  ref={editUserRef}
                  value={editUser}
                  onChange={e => setEditUser(e.target.value)}
                  onFocus={() => { focusedFieldRef.current = 'editUser'; }}
                  onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                  onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                  style={S.input()}
                  placeholder="SSH User"
                />
              </div>
              <div style={S.formGroup()}>
                <label style={S.label()}>Password</label>
                <input
                  ref={editPassRef}
                  type="password"
                  value={editPass}
                  onChange={e => setEditPass(e.target.value)}
                  onFocus={() => { focusedFieldRef.current = 'editPass'; }}
                  onKeyUp={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                  onSelect={e => { caretRef.current = (e.target as HTMLInputElement).selectionStart; }}
                  style={S.input()}
                  placeholder="SSH password"
                />
              </div>
              <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="editsavepass" checked={editSavePass} onChange={e => setEditSavePass(e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="editsavepass" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer' }}>
                  Save password (encrypted)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button style={S.btn('primary', loading)} onClick={handleEditProfile} disabled={loading}>
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
                <button style={S.btn()} onClick={() => { setView('manage'); setError(null); }}>Cancel</button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
