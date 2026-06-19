import React, { useState, useEffect, useRef } from 'react';
import {
 HardDrive, RefreshCw, UploadCloud, Activity, FileBox,
 FileText, FileImage, FileType2, FolderOpen
} from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';
import WorkDirModal from './WorkDirModal';

const ProjectFilesArea = ({ projectId, projects, setProjects, openDestructor }) => {
 const [files, setFiles] = useState([]);
 const [isUploading, setIsUploading] = useState(false);
 const [showWorkDirModal, setShowWorkDirModal] = useState(false);
 const [workDirStatus, setWorkDirStatus] = useState(null); // null | 'saved' | 'error'
 const fileInputRef = useRef(null);

 const project = projects.find(p => p.id === projectId);
 const currentWorkDir = project?.work_dir || '';

 const fetchFiles = () => {
 fetch(`${baseUrl}/api/core/projects/${projectId}/files/`, { credentials: 'include' })
  .then(res => res.json())
  .then(data => setFiles(data))
  .catch(err => console.error("文件拉取失败", err));
 };

 useEffect(() => {
 if (projectId) fetchFiles();
 }, [projectId]);

 // Sync workDirStatus from current project data
 useEffect(() => {
 if (currentWorkDir) {
  setWorkDirStatus('saved');
 } else {
  setWorkDirStatus(null);
 }
 }, [currentWorkDir]);

 const handleFileUpload = async (e) => {
 const selectedFiles = e.target.files;
 if (!selectedFiles || selectedFiles.length === 0) return;

 setIsUploading(true);
 const formData = new FormData();
 Array.from(selectedFiles).forEach(file => formData.append('file', file));

 try {
  const res = await fetch(`${baseUrl}/api/core/projects/${projectId}/files/`, {
  method: 'POST',
  headers: { 'X-CSRFToken': getCsrfToken() },
  body: formData,
  credentials: 'include'
  });
  if (res.ok) {
  fetchFiles();
  } else {
  alert("上传失败，请检查后端接口。");
  }
 } catch (err) {
  console.error("上传异常:", err);
 } finally {
  setIsUploading(false);
  e.target.value = '';
 }
 };

 const formatBytes = (bytes) => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
 };

 return (
 <div className="flex-1 flex flex-col h-full bg-noise relative">
  <div className="h-14 border-b border-exo-border flex items-center justify-between px-6 bg-exo-panel/50 backdrop-blur-md">
  <div className="flex items-center gap-3 tx-body-normal">
   <HardDrive size={18} className="text-blue-400" />
   <span className="font-semibold tracking-widest">DATABANK // {project?.name || 'UNKNOWN_PROJECT'}</span>
  </div>
  <div className="flex gap-2">
   <button onClick={fetchFiles} className="p-2 tx-body-mute hover:tx-body-normal transition-colors" title="Sync">
   <RefreshCw size={16} />
   </button>
   <button
   onClick={() => setShowWorkDirModal(true)}
   className={`p-2 transition-colors ${
    workDirStatus === 'error' ? 'text-red-400 hover:text-red-300' :
    workDirStatus === 'saved' ? 'text-green-400 hover:text-green-300' :
    'tx-body-mute hover:tx-body-normal'
   }`}
   title="工作目录设置"
   >
   <FolderOpen size={16} />
   </button>
  </div>
  </div>

  <div className="flex-1 overflow-y-auto p-8">
  <div className="max-w-5xl mx-auto space-y-8">
   <div
   onClick={() => fileInputRef.current?.click()}
   className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
    isUploading ? 'border-blue-500 bg-blue-500/10' : 'border-exo-border bg-exo-panel hover:border-exo-accent/50 hover:bg-exo-accent/[0.04]'
   }`}
   >
   <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
   {isUploading ? (
    <Activity size={32} className="text-blue-400 animate-pulse mb-3" />
   ) : (
    <UploadCloud size={32} className="tx-body-mute mb-3" />
   )}
   <p className="text-sm font-bold tx-body-normal">
    {isUploading ? 'UPLOADING DATA TO CORE...' : 'Click or Drag files to inject into Project Memory'}
   </p>
   <p className="text-xs tx-body-mute mt-2">Supports PDF, Markdown, Images, and Text Arrays.</p>
   </div>

   <div>
   <h3 className="text-sm font-bold tx-body-normal mb-4 border-b border-exo-border pb-2 flex items-center gap-2">
    <FileBox size={16} /> INDEXED FRAGMENTS ({files.length})
   </h3>

   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {files.map(file => {
    const mime = file.type || file.file_type || '';
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf';
    const FileIcon = isImage ? FileImage : isPdf ? FileType2 : FileText;
    return (
     <div key={file.id} className="bg-[#121318] border border-exo-border rounded-lg p-4 flex flex-col justify-between group hover:border-exo-accent/30 transition-all">
     <div className="flex items-start gap-3 mb-4">
      <div className={`p-2 rounded bg-opacity-10 mt-1 ${file.source === 'obsidian_sync' ? 'bg-purple-500 text-purple-400' : isImage ? 'bg-emerald-500 text-emerald-400' : isPdf ? 'bg-red-500 text-red-400' : 'bg-blue-500 text-blue-400'}`}>
      <FileIcon size={18} />
      </div>
      <div className="flex-1 overflow-hidden">
      <p className="text-sm font-bold tx-body-normal truncate" title={file.name}>{file.name}</p>
      <div className="flex items-center gap-2 mt-1">
       <span className="text-[0.625rem] tx-body-mute bg-black px-1.5 py-0.5 rounded border border-exo-border">
       {file.source === 'obsidian_sync' ? 'OBSIDIAN' : 'MANUAL'}
       </span>
       <span className="text-[0.625rem] tx-body-mute ">{formatBytes(file.size)}</span>
      </div>
      </div>
     </div>

     <div className="flex items-center justify-end gap-2 border-t border-exo-border/50 pt-3">
      <button
      onClick={() => alert(`将在此处预览或下载文件: ${file.preview_url || file.url || '暂无链接'}`)}
      className="text-xs tx-body-mute hover:tx-body-normal px-2 py-1 rounded bg-white/5 hover:bg-exo-accent/[0.08] transition-colors"
      >
      VIEW
      </button>
      <button
      onClick={() => {
       if (file.source === 'obsidian_sync') {
       alert("System Notice: Obsidian 同步文件由本地知识库管理，请在 Obsidian 客户端内删除。");
       return;
       }
       openDestructor({
       title: `Target: [${file.name}]`,
       description: "此操作将永久从项目库中抹除该文件，切断所有相关的向量链接。",
       onArchive: () => alert("文件只能彻底删除，不支持归档。"),
       onDelete: async () => {
        await fetch(`${baseUrl}/api/core/projects/${projectId}/files/${file.id}/`, { method: 'DELETE', headers: { 'X-CSRFToken': getCsrfToken() }, credentials: 'include' });
        fetchFiles();
       }
       });
      }}
      className="text-xs text-red-500/70 hover:text-red-400 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors"
      >
      PURGE
      </button>
     </div>
     </div>
    );
    })}

    {files.length === 0 && (
    <div className="col-span-full py-10 text-center tx-body-mute text-sm border border-dashed border-exo-border rounded-lg">
     [ DATABANK EMPTY ]
    </div>
    )}
   </div>
   </div>
  </div>
  </div>

  <WorkDirModal
  projectId={projectId}
  currentWorkDir={currentWorkDir}
  setProjects={setProjects}
  isOpen={showWorkDirModal}
  onClose={() => setShowWorkDirModal(false)}
  />
 </div>
 );
};

export default ProjectFilesArea;
