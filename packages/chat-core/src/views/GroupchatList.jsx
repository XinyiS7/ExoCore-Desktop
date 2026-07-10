import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, ChevronRight, Users } from 'lucide-react';
import { groupchatApi } from 'exo-shared';
import GroupchatRoom from './GroupchatRoom';
import CreateGroupchatModal from '../components/groupchat/CreateGroupchatModal';

/**
 * GroupchatList — main view at /groupchat.
 *
 * Desktop: left sidebar (list) + right content (GroupchatRoom or placeholder)
 * Mobile: full-width list → tap → full-width room (back button returns to list)
 *
 * Props (from App.jsx route wrapper):
 * - appState: { presets, refreshKey, ... }
 * - viewParams: { id } — optional pre-selected groupchat ID from route param
 * - goBack: () => void
 */
export default function GroupchatList({ appState, viewParams, goBack }) {
 const { presets, refreshKey } = appState;
  const navigate = useNavigate();
  const [groupchats, setGroupchats] = useState([]);
  const selectedId = viewParams?.id || null;
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [editingGroupchat, setEditingGroupchat] = useState(null);

 // ── Fetch groupchats ──
 const fetchGroupchats = () => {
 groupchatApi.listGroupchats()
  .then(data => setGroupchats(Array.isArray(data) ? data : []))
  .catch(() => {});
 };

  useEffect(() => { fetchGroupchats(); }, [refreshKey]);

  const selected = groupchats.find(g => g.id === selectedId) || null;

 // ── Handlers ──
  const handleSelect = (gc) => {
  navigate(`/groupchat/${gc.id}`);
  };

 const handleManage = () => {
 if (selected) {
  setEditingGroupchat(selected);
  setShowCreateModal(true);
 }
 };

 const handleModalClose = () => {
 setShowCreateModal(false);
 setEditingGroupchat(null);
 };

 const handleSaved = () => {
 fetchGroupchats();
 };

 const sortedGroupchats = [...groupchats].sort(
 (a, b) => new Date(b.created_at) - new Date(a.created_at)
 );

 const isMobileRoom = selectedId && selected;

 return (
 <div className="flex-1 h-full flex bg-exo-bg overflow-hidden">
  {/* === Left Panel: Groupchat Sidebar === */}
  <div className={`${isMobileRoom ? 'hidden md:flex' : 'flex'} md:flex w-full md:w-72 lg:w-80 flex-shrink-0 flex-col border-r border-exo-mist-8 h-full`}>
  {/* Sidebar Header */}
  <div className="flex-shrink-0 px-5 py-4 border-b border-exo-mist-8 flex items-center justify-between">
   <div>
   <h2 className="text-[0.625rem] font-bold tracking-[0.4em] tx-body-accent">Groupchats</h2>
   <p className="text-[0.5625rem] tx-body-mute mt-0.5">{sortedGroupchats.length} groupchat{sortedGroupchats.length !== 1 ? 's' : ''}</p>
   </div>
   <button
   onClick={() => { setEditingGroupchat(null); setShowCreateModal(true); }}
   className="p-2 rounded-[4px] bg-exo-accent/10 tx-body-accent border border-exo-accent/20 hover:bg-exo-accent hover:text-black transition-colors"
   title="New groupchat"
   >
   <Plus size={16} />
   </button>
  </div>

  {/* Groupchat List */}
  <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-1">
   {sortedGroupchats.length === 0 && (
   <div className="text-center py-12 tx-body-mute">
    <MessageSquare size={24} className="mx-auto mb-2 opacity-20" />
    <p className="text-[0.625rem] tracking-wider">No groupchats</p>
    <p className="text-[0.5625rem] tx-body-mute opacity-40 mt-1">Create one to start</p>
   </div>
   )}
   {sortedGroupchats.map(gc => {
   const isSelected = selectedId === gc.id;
   const participantCount = gc.participant_ids?.length || 0;
   return (
    <button
    key={gc.id}
    onClick={() => handleSelect(gc)}
    className={`group flex items-center gap-3 w-full p-3 rounded-md transition-all text-left ${
     isSelected
     ? 'bg-exo-accent/10 border border-exo-accent/20 tx-body-accent'
     : 'border border-transparent hover:bg-exo-accent/[0.02] hover:border-exo-mist-10 tx-body-mute hover:tx-body-normal'
    }`}
    >
    <div className={`p-2 rounded-md transition-all shrink-0 ${
     isSelected ? 'bg-exo-accent/10 tx-body-accent' : 'bg-white/5 tx-body-mute'
    }`}>
     <Users size={16} />
    </div>
    <div className="flex-1 min-w-0">
     <p className="text-sm font-medium truncate">{gc.name}</p>
     <p className="text-[0.5625rem] tx-body-mute opacity-50 ">
     {participantCount} participant{participantCount !== 1 ? 's' : ''}
     </p>
    </div>
    <ChevronRight size={12} className="tx-body-mute opacity-30 group-hover:tx-body-accent opacity-60 transition-all shrink-0" />
    </button>
   );
   })}
  </div>
  </div>

  {/* === Right Panel: Content === */}
  <div className={`${isMobileRoom ? 'flex' : 'hidden md:flex'} md:flex flex-1 min-w-0 h-full flex-col`}>
  {selected ? (
   <GroupchatRoom
   groupchat={selected}
   presets={presets}
    onBack={() => navigate('/groupchat')}
   onManage={handleManage}
   />
  ) : (
   <div className="flex-1 flex items-center justify-center">
   <div className="text-center space-y-3">
    <div className="p-4 rounded-full bg-chat-accent/10 inline-block">
    <Users size={32} className="tx-body-accent opacity-50" />
    </div>
    <h2 className="text-xl font-light tx-body-normal">Groupchat</h2>
    <p className="text-sm tx-body-mute opacity-60 max-w-xs">
    Select a groupchat from the sidebar or create a new one to start messaging.
    </p>
   </div>
   </div>
  )}
  </div>

  {/* Create / Edit Modal */}
  <CreateGroupchatModal
  isOpen={showCreateModal}
  onClose={handleModalClose}
  onSaved={handleSaved}
  presets={presets}
  editing={editingGroupchat}
  />
 </div>
 );
}
