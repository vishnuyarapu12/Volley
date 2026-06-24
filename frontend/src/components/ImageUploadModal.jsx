import React, { useRef, useState, useCallback, useEffect } from 'react';
import { playerAPI, storage } from '../utils/api';
import { X, Upload, AlertCircle, Image as ImageIcon, CheckCircle } from 'lucide-react';

export default function ImageUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [pictureName, setPictureName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setPreview(null);
    setFileName('');
    setPictureName('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const info = storage.getPlayerInfo();
    setPictureName(info?.name || '');
  }, [isOpen]);

  const processFile = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image');
      return;
    }
    if (file.size >  10* 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileSelect = e => processFile(e.target.files?.[0]);

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  }, []);

  const handleDragOver = e => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      setError('Please select an image first');
      return;
    }
    if (!pictureName.trim()) {
      setError('Please enter a name for this photo');
      return;
    }
    try {
      setLoading(true);
      const playerId = storage.getPlayerId();
      const response = await playerAPI.uploadProfilePicture(
        playerId,
        fileInputRef.current.files[0],
        pictureName.trim()
      );
      if (response.success) {
        resetState();
        onUploadSuccess?.();
      }
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lightbox-backdrop">
      <div className="upload-modal w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-lightboxIn">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-yellow-500/10 to-transparent border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-400/20 rounded-xl">
              <Upload className="text-yellow-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Upload Player Photo</h2>
              <p className="text-xs text-gray-400">Add a photo and display name for the showcase</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 bg-slate-900">

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`drop-zone relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? 'border-yellow-400 bg-yellow-400/10 scale-[1.02]'
                : preview
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-white/20 bg-white/3 hover:border-yellow-400/50 hover:bg-yellow-400/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />

            {preview ? (
              <div className="space-y-3">
                <div className="relative w-32 h-32 mx-auto rounded-2xl overflow-hidden border-2 border-green-500/50 shadow-lg">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle size={16} />
                  <span className="text-sm font-semibold">Photo ready</span>
                </div>
                {fileName && (
                  <p className="text-xs text-gray-500 truncate max-w-full px-4">{fileName}</p>
                )}
                <p className="text-xs text-gray-500">Click to change photo</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`inline-flex p-4 rounded-2xl ${isDragging ? 'bg-yellow-400/20' : 'bg-white/5'} transition-colors`}>
                  <ImageIcon size={32} className={isDragging ? 'text-yellow-400' : 'text-gray-500'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-300">
                    {isDragging ? 'Drop your photo here' : 'Click to upload or drag & drop'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP up to 5MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Display name */}
          <div>
            <label htmlFor="picture-name" className="block text-sm font-semibold text-gray-300 mb-1.5">
              Photo name
            </label>
            <input
              id="picture-name"
              type="text"
              value={pictureName}
              onChange={e => setPictureName(e.target.value)}
              placeholder="e.g. Spike King, Team Captain"
              maxLength={60}
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/30 transition-all text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-sm animate-fadeIn">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !preview || !pictureName.trim()}
              id="upload-confirm-btn"
              className="flex-1 py-2.5 px-4 rounded-xl btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Upload Photo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
