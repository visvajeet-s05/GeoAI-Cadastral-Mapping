import React, { useState } from "react";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FolderOpen,
  Calendar,
  MapPin,
  FileKey,
  Eye,
  Settings,
} from "lucide-react";
import type { 
  DocumentType, 
  GovernmentSource, 
  DocumentUploadRequest,
  DocumentStatus 
} from "../types/documents";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (documentId: string) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Step 1: File Selection
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Step 2: Metadata
  const [documentType, setDocumentType] = useState<DocumentType>('FMB_SKETCH');
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');
  const [village, setVillage] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [subdivisionNumber, setSubdivisionNumber] = useState('');
  const [documentYear, setDocumentYear] = useState<number>(new Date().getFullYear());
  const [documentReference, setDocumentReference] = useState('');
  const [source, setSource] = useState<GovernmentSource>('USER_UPLOADED');
  const [coordinateSystem, setCoordinateSystem] = useState('EPSG:4326');
  const [scale, setScale] = useState('');
  const [orientation, setOrientation] = useState('');

  const documentTypes: { value: DocumentType; label: string; icon: string }[] = [
    { value: 'FMB_SKETCH', label: 'FMB Sketch', icon: '📋' },
    { value: 'F_LINE_SKETCH', label: 'F-Line Sketch', icon: '📐' },
    { value: 'TSLR', label: 'TSLR', icon: '🗺️' },
    { value: 'TSLR_SKETCH', label: 'TSLR Sketch', icon: '🗺️' },
    { value: 'PATTA', label: 'Patta', icon: '📄' },
    { value: 'CHITTA', label: 'Chitta', icon: '📋' },
    { value: 'A_REGISTER', label: 'A-Register', icon: '📑' },
    { value: 'ADANGAL', label: 'Adangal', icon: '📋' },
    { value: 'PATTA_ORDER', label: 'Patta Order', icon: '📜' },
    { value: 'SURVEY_RECORD', label: 'Survey Record', icon: '📐' },
    { value: 'SUBDIVISION_RECORD', label: 'Subdivision Record', icon: '✂️' },
    { value: 'APPROVED_LAYOUT', label: 'Approved Layout', icon: '🏗️' },
    { value: 'MASTER_PLAN', label: 'Master Plan', icon: '📊' },
    { value: 'HISTORICAL_RECORD', label: 'Historical Record', icon: '📜' },
    { value: 'UAV_ORTHOPHOTO', label: 'UAV Orthophoto', icon: '🚁' },
    { value: 'UAV_IMAGE', label: 'UAV Image', icon: '📷' },
  ];

  const governmentSources: { value: GovernmentSource; label: string }[] = [
    { value: 'TAMILNILAM', label: 'TamilNilam' },
    { value: 'TAMILNILAM_URBAN', label: 'TamilNilam Urban' },
    { value: 'CLA_COMMISSIONERATE', label: 'CLA Commissionerate' },
    { value: 'SURVEY_LAND_RECORDS', label: 'Survey & Land Records' },
    { value: 'TNGIS', label: 'TNGIS' },
    { value: 'CMDA', label: 'CMDA' },
    { value: 'DTCP', label: 'DTCP' },
    { value: 'TNREGINET', label: 'TNREGINET' },
    { value: 'E_ADANGAL', label: 'e-Adangal' },
    { value: 'RURAL_DEVELOPMENT', label: 'Rural Development' },
    { value: 'MUNICIPALITY', label: 'Municipality' },
    { value: 'CORPORATION', label: 'Corporation' },
    { value: 'USER_UPLOADED', label: 'User Uploaded' },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', documentType);
      formData.append('district', district || '');
      formData.append('taluk', taluk || '');
      formData.append('village', village || '');
      formData.append('surveyNumber', surveyNumber || '');
      formData.append('subdivisionNumber', subdivisionNumber || '');
      formData.append('documentYear', documentYear.toString());
      formData.append('documentReference', documentReference || '');
      formData.append('source', source);
      formData.append('coordinateSystem', coordinateSystem);
      formData.append('scale', scale || '');
      formData.append('orientation', orientation || '');

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'success') {
        setUploadStatus('success');
        onUploadComplete?.(data.documentId);
        
        // Reset after successful upload
        setTimeout(() => {
          setStep(1);
          setSelectedFile(null);
          setDistrict('');
          setTaluk('');
          setVillage('');
          setSurveyNumber('');
          setSubdivisionNumber('');
          setDocumentReference('');
          setScale('');
          setOrientation('');
          setUploadProgress(0);
          setUploading(false);
          onClose();
        }, 2000);
      } else {
        setUploadStatus('error');
        setErrorMessage(data.error || 'Upload failed');
        setUploading(false);
      }

    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Document Upload</h2>
              <p className="text-xs text-slate-400">Upload cadastral documents for processing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            step >= 1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
          }`}>
            <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Select File</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            step >= 2 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
          }`}>
            <span className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Metadata</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            step >= 3 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
          }`}>
            <span className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Upload</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-4">
              {/* File Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${
                  dragActive
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-600 hover:border-cyan-500/50 bg-slate-800/30'
                }`}
              >
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.geojson,.csv,.kml,.kmz,.tif"
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <UploadCloud className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-300 mb-2">
                    Drag and drop your document here, or click to browse
                  </p>
                  <p className="text-xs text-slate-500">
                    Supports: PDF, JPG, PNG, TIFF, GeoJSON, CSV, KML, GeoTIFF
                  </p>
                </label>
              </div>

              {/* Selected File */}
              {selectedFile && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                  <FileText className="w-8 h-8 text-cyan-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Continue Button */}
              {selectedFile && (
                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-500/25 transition"
                >
                  Continue to Metadata
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Document Type */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-2">
                  <FileKey className="w-3.5 h-3.5" />
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Administrative Context */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    District
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g., Chennai"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    Taluk
                  </label>
                  <input
                    type="text"
                    value={taluk}
                    onChange={(e) => setTaluk(e.target.value)}
                    placeholder="e.g., Velachery"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    Village
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g., Velachery Town"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-2">
                    <FileKey className="w-3.5 h-3.5" />
                    Survey Number
                  </label>
                  <input
                    type="text"
                    value={surveyNumber}
                    onChange={(e) => setSurveyNumber(e.target.value)}
                    placeholder="e.g., 142"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block">Subdivision</label>
                  <input
                    type="text"
                    value={subdivisionNumber}
                    onChange={(e) => setSubdivisionNumber(e.target.value)}
                    placeholder="e.g., 1A"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Document Year
                  </label>
                  <input
                    type="number"
                    value={documentYear}
                    onChange={(e) => setDocumentYear(parseInt(e.target.value))}
                    min="1900"
                    max="2030"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              </div>

              {/* Document Reference */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block">Document Reference</label>
                <input
                  type="text"
                  value={documentReference}
                  onChange={(e) => setDocumentReference(e.target.value)}
                  placeholder="e.g., FMB/142/2024"
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Source */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Source
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as GovernmentSource)}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {governmentSources.map((src) => (
                    <option key={src.value} value={src.value}>
                      {src.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Technical Information */}
              <div className="border-t border-slate-700 pt-4">
                <label className="text-xs font-medium text-slate-400 mb-3 block flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  Technical Information
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">Coordinate System</label>
                    <input
                      type="text"
                      value={coordinateSystem}
                      onChange={(e) => setCoordinateSystem(e.target.value)}
                      placeholder="EPSG:4326"
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">Scale</label>
                    <input
                      type="text"
                      value={scale}
                      onChange={(e) => setScale(e.target.value)}
                      placeholder="1:1000"
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 mb-1 block">Orientation</label>
                    <input
                      type="text"
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value)}
                      placeholder="True North 0.0°"
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 transition"
                >
                  Review & Upload
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {/* Review */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Review Upload
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">File:</span>
                    <span className="text-white">{selectedFile?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-white">{documentTypes.find(t => t.value === documentType)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Source:</span>
                    <span className="text-white">{governmentSources.find(s => s.value === source)?.label}</span>
                  </div>
                  {district && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-white">{district}{taluk ? `, ${taluk}` : ''}{village ? `, ${village}` : ''}</span>
                    </div>
                  )}
                  {surveyNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Survey:</span>
                      <span className="text-white">{surveyNumber}{subdivisionNumber ? `/${subdivisionNumber}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white">Uploading...</span>
                    <span className="text-xs text-cyan-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {uploadStatus === 'success' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Upload Successful</p>
                    <p className="text-xs text-emerald-400/80">Document has been uploaded and queued for processing</p>
                  </div>
                </div>
              )}

              {uploadStatus === 'error' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Upload Failed</p>
                    <p className="text-xs text-red-400/80">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <p className="text-[10px] text-amber-300/80">
                  ⚠️ Uploaded documents will be processed using OCR and computer vision. 
                  Extracted data requires human verification before use in legal proceedings.
                </p>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  disabled={uploading}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};