
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PHOTO_STANDARDS, CATEGORY_LABELS, PAPER_FORMATS } from './constants';
import { PassportStandard, CropState, GeminiAnalysis, UsageCategory } from './types';
import { PassportAI } from './services/geminiService';
import { ImageProcessor } from './services/imageProcessing';

const App: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>(PHOTO_STANDARDS[0].country);
  const [selectedCategory, setSelectedCategory] = useState<UsageCategory>('standard');
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, scale: 1 });
  const [finalRender, setFinalRender] = useState<string | null>(null);
  const [sheetRender, setSheetRender] = useState<string | null>(null);

  // Custom Printing Options
  const [photoCount, setPhotoCount] = useState<number>(4);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('10x15');
  const [customPaperSize, setCustomPaperSize] = useState<{ width: number, height: number }>({ width: 100, height: 150 });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isAutoWorking, setIsAutoWorking] = useState(false);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Position de la barre flottante - On l'initialise au centre bas
  const [controlBarPos, setControlBarPos] = useState({ x: window.innerWidth / 2 - 250, y: window.innerHeight - 120 });
  const [isDraggingBar, setIsDraggingBar] = useState(false);
  const [barDragStart, setBarDragStart] = useState({ x: 0, y: 0 });

  const workspaceRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const availableStandards = useMemo(() => {
    return PHOTO_STANDARDS.filter(s => s.country === selectedCountry);
  }, [selectedCountry]);

  const selectedStandard = useMemo(() => {
    return availableStandards.find(s => s.category === selectedCategory) || availableStandards[0];
  }, [availableStandards, selectedCategory]);

  const countries = useMemo(() => Array.from(new Set(PHOTO_STANDARDS.map(s => s.country))));
  const categories = useMemo(() => Array.from(new Set(availableStandards.map(s => s.category))), [availableStandards]);

  // Ajustement parfait de l'image au cadre
  const fitImageToFrame = useCallback(() => {
    if (!workspaceRef.current || !imageRef.current) return;
    const frame = workspaceRef.current.getBoundingClientRect();
    const img = imageRef.current;

    // On calcule l'échelle pour que l'image couvre tout le cadre sans déborder inutilement
    const scaleW = frame.width / img.naturalWidth;
    const scaleH = frame.height / img.naturalHeight;
    const initialScale = Math.max(scaleW, scaleH);

    const newX = (frame.width - (img.naturalWidth * initialScale)) / 2;
    const newY = (frame.height - (img.naturalHeight * initialScale)) / 2;

    setCrop({ x: newX, y: newY, scale: initialScale });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setFinalRender(null);
        setSheetRender(null);
        setAnalysis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = () => {
    fitImageToFrame();
  };

  const centerImage = useCallback(() => {
    if (!workspaceRef.current || !imageRef.current) return;
    const frame = workspaceRef.current.getBoundingClientRect();
    const img = imageRef.current;
    const newX = (frame.width - (img.naturalWidth * crop.scale)) / 2;
    const newY = (frame.height - (img.naturalHeight * crop.scale)) / 2;
    setCrop(prev => ({ ...prev, x: newX, y: newY }));
  }, [crop.scale]);

  // ... (existing imports)

  const handleBackgroundRemoval = async () => {
    if (!sourceImage) return;
    setIsRemovingBg(true);
    try {
      // Use local WASM model
      const result = await ImageProcessor.removeBackground(sourceImage);
      setSourceImage(result);
    } catch (err) {
      console.error(err);
      alert("Erreur de détourage. Veuillez réessayer.");
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleAutoWork = async () => {
    if (!sourceImage) return;
    setIsAutoWorking(true);
    try {
      // 1. Remove Background
      const bgRemoved = await ImageProcessor.removeBackground(sourceImage);
      // 2. Auto Crop (Center for now)
      const cropped = await ImageProcessor.autoCrop(bgRemoved);

      setSourceImage(cropped);
      // 3. Reset crop state to fit new image
      setCrop({ x: 0, y: 0, scale: 1 });
      setTimeout(fitImageToFrame, 100);
    } catch (err) {
      console.error(err);
      alert("Erreur du traitement automatique.");
    } finally {
      setIsAutoWorking(false);
    }
  };

  const analyzeWithAI = async (imageData: string) => {
    setIsAnalyzing(true);
    try {
      const ai = new PassportAI();
      const result = await ai.analyzePassportPhoto(imageData);
      if (result) setAnalysis(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Drag de l'image
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sourceImage || isRemovingBg || isAutoWorking || isDraggingBar) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - crop.x, y: clientY - crop.y });
  };

  // Drag de la barre d'outils
  const handleBarMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingBar(true);
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    setBarDragStart({ x: clientX - controlBarPos.x, y: clientY - controlBarPos.y });
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

    if (isDragging) {
      setCrop(prev => ({ ...prev, x: clientX - dragStart.x, y: clientY - dragStart.y }));
    } else if (isDraggingBar) {
      setControlBarPos({ x: clientX - barDragStart.x, y: clientY - barDragStart.y });
    }
  }, [isDragging, isDraggingBar, dragStart, barDragStart]);

  const handleGlobalMouseUp = () => {
    setIsDragging(false);
    setIsDraggingBar(false);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalMouseMove);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalMouseMove);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove]);

  const generateFinalRender = () => {
    if (!imageRef.current || !workspaceRef.current) return;

    const singleCanvas = document.createElement('canvas');
    const sCtx = singleCanvas.getContext('2d');
    if (!sCtx) return;

    const dpiScale = 11.811;
    const pWidth = Math.round(selectedStandard.widthMm * dpiScale);
    const pHeight = Math.round(selectedStandard.heightMm * dpiScale);
    singleCanvas.width = pWidth;
    singleCanvas.height = pHeight;

    const frame = workspaceRef.current.getBoundingClientRect();
    const imgRect = imageRef.current.getBoundingClientRect();
    const scaleFactor = imageRef.current.naturalWidth / imgRect.width;

    const sourceX = (frame.left - imgRect.left) * scaleFactor;
    const sourceY = (frame.top - imgRect.top) * scaleFactor;
    const sourceWidth = frame.width * scaleFactor;
    const sourceHeight = frame.height * scaleFactor;

    sCtx.drawImage(imageRef.current, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, pWidth, pHeight);
    const singleDataUrl = singleCanvas.toDataURL('image/jpeg', 0.98);
    setFinalRender(singleDataUrl);

    const sheetCanvas = document.createElement('canvas');
    const shCtx = sheetCanvas.getContext('2d');
    if (!shCtx) return;

    // Determine paper size
    let paperWidthMm = 0;
    let paperHeightMm = 0;

    if (selectedPaperId === 'custom') {
      paperWidthMm = customPaperSize.width;
      paperHeightMm = customPaperSize.height;
    } else {
      const format = PAPER_FORMATS.find(f => f.id === selectedPaperId);
      if (format) {
        paperWidthMm = format.widthMm;
        paperHeightMm = format.heightMm;
      }
    }

    // Default to 10x15 if something is wrong
    if (paperWidthMm <= 0) paperWidthMm = 100;
    if (paperHeightMm <= 0) paperHeightMm = 150;

    const sheetWidth = Math.round(paperWidthMm * dpiScale);
    const sheetHeight = Math.round(paperHeightMm * dpiScale);

    sheetCanvas.width = sheetWidth;
    sheetCanvas.height = sheetHeight;

    shCtx.fillStyle = '#FFFFFF';
    shCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    // Layout calculation
    const margin = Math.round(4 * dpiScale);
    const photoW = pWidth;
    const photoH = pHeight;

    // Simple grid layout
    let currentX = margin;
    let currentY = margin;
    let photosDrawn = 0;

    for (let i = 0; i < photoCount; i++) {
      // Check if we need to wrap to next line
      if (currentX + photoW + margin > sheetWidth) {
        currentX = margin;
        currentY += photoH + margin;
      }

      // Check if we fit properly
      if (currentY + photoH + margin <= sheetHeight) {
        shCtx.drawImage(singleCanvas, currentX, currentY);
        currentX += photoW + margin;
        photosDrawn++;
      } else {
        // Out of space on paper
        break;
      }
    }

    const sheetDataUrl = sheetCanvas.toDataURL('image/jpeg', 0.98);
    setSheetRender(sheetDataUrl);
    analyzeWithAI(singleDataUrl);
  };

  const handlePrint = () => {
    if (!sheetRender) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Impression - PasseportPro</title><style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
          img { width: 100%; max-width: 12cm; height: auto; border: 1px solid #eee; }
          @page { size: portrait; margin: 10mm; }
        </style></head>
        <body onload="window.print(); window.close();"><img src="${sheetRender}" /></body>
      </html>
    `);
    printWindow.document.close();
  };

  const aspectRatio = selectedStandard.widthMm / selectedStandard.heightMm;

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">

      {/* HEADER PROFESSIONNEL */}
      <header className="px-6 lg:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100 rotate-2">
            <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-1">PasseportPro</h1>
            <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">Biometric Editor Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="group bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl cursor-pointer transition-all duration-300 font-bold flex items-center gap-3 shadow-xl shadow-slate-200 hover:-translate-y-1">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" />
            </svg>
            Importer Photo
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-[1600px] w-full mx-auto p-6 lg:p-12 grid grid-cols-1 xl:grid-cols-12 gap-10 flex-grow">

        {/* LEFT: SETTINGS & WORKSPACE */}
        <div className="xl:col-span-8 flex flex-col gap-8 h-full">

          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 flex flex-col h-full relative">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination</label>
                <select
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-base font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 outline-none transition-all cursor-pointer shadow-inner"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                >
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                <select
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-base font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 outline-none transition-all cursor-pointer shadow-inner"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as UsageCategory)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Format Papier</label>
                <div className="flex gap-2">
                  <select
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-base font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 outline-none transition-all cursor-pointer shadow-inner"
                    value={selectedPaperId}
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                  >
                    {PAPER_FORMATS.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {selectedPaperId === 'custom' && (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="W"
                        className="w-20 bg-slate-50 rounded-2xl px-4 font-bold text-center outline-none focus:ring-2 focus:ring-indigo-100"
                        value={customPaperSize.width}
                        onChange={(e) => setCustomPaperSize(p => ({ ...p, width: parseInt(e.target.value) || 0 }))}
                      />
                      <input
                        type="number"
                        placeholder="H"
                        className="w-20 bg-slate-50 rounded-2xl px-4 font-bold text-center outline-none focus:ring-2 focus:ring-indigo-100"
                        value={customPaperSize.height}
                        onChange={(e) => setCustomPaperSize(p => ({ ...p, height: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de Photos</label>
                <div className="flex items-center gap-4 bg-slate-50 rounded-2xl p-2 pr-6">
                  <button
                    onClick={() => setPhotoCount(Math.max(1, photoCount - 1))}
                    className="w-10 h-10 bg-white shadow-sm rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                  >-</button>
                  <span className="flex-grow text-center font-black text-xl text-slate-800">{photoCount}</span>
                  <button
                    onClick={() => setPhotoCount(Math.min(50, photoCount + 1))}
                    className="w-10 h-10 bg-white shadow-sm rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                  >+</button>
                </div>
              </div>
            </div>

            {/* ZONE DE TRAVAIL - NO OVERFLOW HIDDEN HERE TO SEE TOOLBAR */}
            <div className="relative flex-grow flex items-center justify-center rounded-[32px] bg-slate-50 border-2 border-dashed border-slate-100 min-h-[500px]">

              {sourceImage ? (
                <div
                  className={`relative overflow-hidden shadow-2xl bg-white ring-[12px] ring-white transition-all duration-700 ${isRemovingBg || isAutoWorking ? 'opacity-40 grayscale blur-sm' : 'opacity-100'}`}
                  style={{
                    width: '340px',
                    height: `${340 / aspectRatio}px`,
                  }}
                  ref={workspaceRef}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleMouseDown}
                >
                  <img
                    ref={imageRef}
                    src={sourceImage}
                    onLoad={onImageLoad}
                    alt="Source"
                    className="absolute cursor-move select-none"
                    style={{
                      transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`,
                      transformOrigin: '0 0',
                      maxWidth: 'none',
                    }}
                    draggable={false}
                  />

                  {/* GUIDES BIOMÉTRIQUES VISIBLES */}
                  <div className="absolute inset-0 pointer-events-none border-[1px] border-slate-200">
                    <div className="w-full h-px bg-indigo-500/20 absolute top-[30%]"></div>
                    <div className="w-full h-px bg-indigo-500/20 absolute top-[65%]"></div>
                    <div className="w-[62%] h-[68%] border-2 border-dashed border-indigo-400/30 rounded-[45%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%]"></div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-20 animate-in fade-in zoom-in duration-700">
                  <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 text-slate-200 shadow-xl border border-slate-50">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">En attente de photo...</h3>
                  <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm leading-relaxed">Importez un portrait pour commencer l'édition haute précision.</p>
                </div>
              )}

              {/* CHARGEMENT ÉTAT IA */}
              {(isRemovingBg || isAutoWorking) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-xl z-30 transition-all rounded-[32px]">
                  <div className="w-16 h-16 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                  <p className="text-sm font-black text-indigo-900 uppercase tracking-widest">{isAutoWorking ? 'Magic Process...' : 'Background Cleanup...'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: RENDER & ANALYSIS */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 flex-grow flex flex-col min-h-[600px] relative overflow-hidden">
            {/* DECORATIVE BLOB */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

            <h2 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-3 relative z-10">
              Rendu Final
              <span className={`px-3 py-1 text-[10px] rounded-full uppercase tracking-widest ${analysis?.isCompliant ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {analysis?.isCompliant ? 'Validé' : 'Aperçu'}
              </span>
            </h2>

            <div className="flex-grow flex flex-col gap-6 relative z-10">
              {sheetRender ? (
                <div className="animate-in slide-in-from-right duration-500 flex flex-col h-full">

                  {/* PREVIEW CONTAINER */}
                  <div className="flex-grow flex items-center justify-center p-4">
                    <div className="relative group perspective-[1000px]">
                      <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="relative bg-white p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded border border-slate-100 transition-transform duration-500 group-hover:rotate-x-2 group-hover:-translate-y-2">
                        <img src={sheetRender} alt="Final" className="w-[280px] h-auto object-contain" />
                        {/* PAPER TEXTURE OVERLAY (Optional) */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent pointer-events-none mix-blend-multiply"></div>
                      </div>
                    </div>
                  </div>

                  {/* ACTION GRID */}
                  <div className="grid grid-cols-2 gap-3 mt-auto pt-6 border-t border-slate-50">
                    <a
                      href={sheetRender}
                      download="PasseportPro_Planche.jpg"
                      className="col-span-2 bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-slate-500/20 hover:-translate-y-0.5"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
                      Télécharger HD
                    </a>

                    <button
                      onClick={handlePrint}
                      className="col-span-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Imprimer
                    </button>

                    <button
                      onClick={() => setSheetRender(null)}
                      className="col-span-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      Retour
                    </button>
                  </div>

                  {/* AI FEEDBACK COMPACT */}
                  {analysis && (
                    <div className={`mt-4 p-4 rounded-xl border text-xs ${analysis.isCompliant ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' : 'bg-rose-50/50 border-rose-100 text-rose-800'}`}>
                      <div className="flex items-center justify-between font-bold mb-2">
                        <span>Conformité IA</span>
                        <span>{analysis.score}%</span>
                      </div>
                      <div className="w-full bg-slate-200/50 h-1.5 rounded-full overflow-hidden mb-2">
                        <div className={`h-full rounded-full ${analysis.isCompliant ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${analysis.score}%` }}></div>
                      </div>
                      {/* Just showing first feedback item for compactness */}
                      <p className="opacity-80 truncate">{analysis.feedback[0]}</p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 group hover:bg-slate-50 transition-colors">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center">Aucun rendu généré</p>
                  <p className="text-slate-300 text-[10px] text-center mt-1">Cliquez sur VALIDER pour créer la planche</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* DRAGGABLE FLOATING TOOLBAR - FIXED Z-INDEX & NO CLIPPING */}
      {sourceImage && (
        <div
          className={`fixed z-[9999] flex items-center gap-4 bg-slate-900/95 backdrop-blur-2xl p-4 pr-5 rounded-[28px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-all duration-300 ${isDraggingBar ? 'scale-105 opacity-90' : 'opacity-100 hover:shadow-indigo-500/10'}`}
          style={{
            left: `${controlBarPos.x}px`,
            top: `${controlBarPos.y}px`,
            cursor: isDraggingBar ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleBarMouseDown}
          onTouchStart={handleBarMouseDown}
        >
          {/* DRAG HANDLE */}
          <div className="pr-4 text-slate-600 border-r border-slate-800 flex items-center">
            <svg className="w-6 h-6 opacity-30" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-12a2 2 0 10.001 4.001A2 2 0 0013 2zm0 6a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" /></svg>
          </div>

          {/* ZOOM GROUP */}
          <div className="flex items-center gap-4 px-2">
            <button onClick={() => setCrop(p => ({ ...p, scale: Math.max(0.01, p.scale * 0.9) }))} className="text-white/40 hover:text-white transition-colors p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
            </button>
            <input
              type="range" min="0.01" max="3" step="0.001"
              value={crop.scale}
              onChange={(e) => setCrop(p => ({ ...p, scale: parseFloat(e.target.value) }))}
              className="w-32 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <button onClick={() => setCrop(p => ({ ...p, scale: Math.min(5, p.scale * 1.1) }))} className="text-white/40 hover:text-white transition-colors p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="w-px h-10 bg-slate-800 mx-2"></div>

          {/* ACTIONS GROUP */}
          <div className="flex items-center gap-2">
            <button onClick={centerImage} className="text-white/70 hover:bg-slate-800 p-3 rounded-2xl transition-all" title="Centrer Photo">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <button onClick={handleBackgroundRemoval} disabled={isRemovingBg || isAutoWorking} className="text-white/70 hover:bg-slate-800 p-3 rounded-2xl transition-all disabled:opacity-20" title="Nettoyage Fond (IA)">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </button>
            <button
              onClick={handleAutoWork}
              disabled={isRemovingBg || isAutoWorking}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-[20px] text-xs font-black tracking-widest transition-all shadow-lg flex items-center gap-2 disabled:opacity-30 group"
            >
              <svg className="w-4 h-4 animate-pulse group-hover:scale-125 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
              AUTO WORK
            </button>
            <button
              onClick={generateFinalRender}
              disabled={isRemovingBg || isAutoWorking}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-[20px] text-xs font-black tracking-widest transition-all shadow-lg disabled:opacity-30"
            >
              VALIDER
            </button>
          </div>
        </div>
      )}

      <footer className="px-12 py-10 flex flex-col md:flex-row items-center justify-between text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] bg-white border-t border-slate-50">
        <div className="flex items-center gap-4">
          <span className="text-indigo-400">PassportPro Engine 2.8</span>
          <span className="w-1.5 h-1.5 bg-slate-100 rounded-full"></span>
          <span>DPI Optimized Export</span>
        </div>
        <div className="flex gap-10 mt-6 md:mt-0">
          <span className="hover:text-indigo-500 cursor-help transition-colors">Normes ISO 2024</span>
          <span className="hover:text-indigo-500 cursor-help transition-colors">IA Validation Active</span>
        </div>
      </footer>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #6366f1;
          cursor: pointer;
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
          border: 4px solid #0f172a;
          margin-top: -8px;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #1e293b;
          border-radius: 2px;
        }
        body { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
};

export default App;
