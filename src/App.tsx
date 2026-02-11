
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

  // --- INTERACTIVE LAYOUT STATE ---
  const [layoutOffset, setLayoutOffset] = useState({ x: 0, y: 0 });
  const [isDraggingLayout, setIsDraggingLayout] = useState(false);
  const layoutDragRef = useRef({ startX: 0, startY: 0, initialOffsetX: 0, initialOffsetY: 0 });
  const [layoutConfig, setLayoutConfig] = useState<{
    sheetWidth: number;
    sheetHeight: number;
    photoWidth: number;
    photoHeight: number;
    gap: number;
    cols: number;
    rows: number;
    startX: number;
    startY: number;
    columnsUsed: number;
    dpiScale: number;
  } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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
    } else if (isDraggingLayout) {
      if (!layoutConfig || !previewContainerRef.current) return;

      const rect = previewContainerRef.current.getBoundingClientRect();
      const scale = rect.width > 0 ? rect.width / layoutConfig.sheetWidth : 1;

      const deltaX = (clientX - layoutDragRef.current.startX) / scale;
      const deltaY = (clientY - layoutDragRef.current.startY) / scale;

      setLayoutOffset({
        x: layoutDragRef.current.initialOffsetX + deltaX,
        y: layoutDragRef.current.initialOffsetY + deltaY
      });
    }
  }, [isDragging, isDraggingBar, isDraggingLayout, dragStart, barDragStart, layoutConfig]);

  const handleGlobalMouseUp = () => {
    setIsDragging(false);
    setIsDraggingBar(false);
    setIsDraggingLayout(false);
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

  // --- NOUVELLE LOGIQUE INTERACTIVE ---

  const handleLayoutMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!layoutConfig) return;
    setIsDraggingLayout(true);
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

    layoutDragRef.current = {
      startX: clientX,
      startY: clientY,
      initialOffsetX: layoutOffset.x,
      initialOffsetY: layoutOffset.y
    };
  };

  const updateLayout = () => {
    if (!imageRef.current || !workspaceRef.current) return;

    // 1. Générer la photo individuelle
    const singleCanvas = document.createElement('canvas');
    const sCtx = singleCanvas.getContext('2d');
    if (!sCtx) return;

    const dpiScale = 11.811; // 300 DPI
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

    // Fill white background first (fix for transparent images becoming black in JPEG)
    sCtx.fillStyle = '#FFFFFF';
    sCtx.fillRect(0, 0, pWidth, pHeight);

    sCtx.drawImage(imageRef.current, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, pWidth, pHeight);

    // Add black border for cutting guide
    sCtx.lineWidth = 4; // ~0.33mm at 300 DPI
    sCtx.strokeStyle = '#000000';
    sCtx.strokeRect(0, 0, pWidth, pHeight);

    const singleDataUrl = singleCanvas.toDataURL('image/jpeg', 0.98);
    setFinalRender(singleDataUrl);

    // 2. Calculer les dimensions du papier
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
    if (paperWidthMm <= 0) paperWidthMm = 100;
    if (paperHeightMm <= 0) paperHeightMm = 150;

    const sheetWidth = Math.round(paperWidthMm * dpiScale);
    const sheetHeight = Math.round(paperHeightMm * dpiScale);

    // 3. Calculer la grille optimale
    const gap = Math.round(1 * dpiScale); // 1mm
    const photoW = pWidth;
    const photoH = pHeight;

    const cols = Math.floor((sheetWidth + gap) / (photoW + gap));
    let effectiveGap = gap;
    let effectiveCols = cols;
    if (cols * photoW > sheetWidth || (cols * (photoW + gap) - gap) > sheetWidth) {
      const tightCols = Math.floor(sheetWidth / photoW);
      if (tightCols >= cols) {
        effectiveGap = 0;
        effectiveCols = tightCols;
      }
    }

    const rowsNeeded = Math.ceil(photoCount / effectiveCols);
    const columnsUsed = Math.min(photoCount, effectiveCols);

    const blockWidth = columnsUsed * photoW + (columnsUsed - 1) * effectiveGap;
    const blockHeight = rowsNeeded * photoH + (rowsNeeded - 1) * effectiveGap;

    const startX = (sheetWidth - blockWidth) / 2;
    const startY = (sheetHeight - blockHeight) / 2;

    setLayoutConfig({
      sheetWidth,
      sheetHeight,
      photoWidth: photoW,
      photoHeight: photoH,
      gap: effectiveGap,
      cols: effectiveCols,
      rows: rowsNeeded,
      startX,
      startY,
      columnsUsed,
      dpiScale
    });
    setLayoutOffset({ x: 0, y: 0 });
    setSheetRender("true"); // Signale qu'on est en mode rendu

    analyzeWithAI(singleDataUrl);
  };

  const generateHiResSheet = async () => {
    if (!layoutConfig || !finalRender) return null;

    const canvas = document.createElement('canvas');
    canvas.width = layoutConfig.sheetWidth;
    canvas.height = layoutConfig.sheetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.src = finalRender;

    return new Promise<string>((resolve) => {
      img.onload = () => {
        const startX = layoutConfig.startX + layoutOffset.x;
        const startY = layoutConfig.startY + layoutOffset.y;

        let currentX = startX;
        let currentY = startY;

        for (let i = 0; i < photoCount; i++) {
          ctx.drawImage(img, currentX, currentY, layoutConfig.photoWidth, layoutConfig.photoHeight);

          if ((i + 1) % layoutConfig.columnsUsed === 0) {
            currentX = startX;
            currentY += layoutConfig.photoHeight + layoutConfig.gap;
          } else {
            currentX += layoutConfig.photoWidth + layoutConfig.gap;
          }
        }
        resolve(canvas.toDataURL('image/jpeg', 0.98));
      };
      img.onerror = () => resolve('');
    });
  };

  const handleDownloadSheet = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const dataUrl = await generateHiResSheet();
    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'PasseportPro_Planche.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadSingle = () => {
    if (finalRender) {
      const link = document.createElement('a');
      link.href = finalRender;
      link.download = 'PasseportPro_Single.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = async () => {
    const dataUrl = await generateHiResSheet();
    if (!dataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Impression - PasseportPro</title><style>
           body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
           img { width: 100%; max-width: 100%; height: auto; border: 1px solid #eee; }
           @page { size: auto; margin: 0mm; }
        </style></head>
        <body onload="window.print(); window.close();"><img src="${dataUrl}" /></body>
      </html>
    `);
    printWindow.document.close();
  };

  const aspectRatio = selectedStandard.widthMm / selectedStandard.heightMm;

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 flex flex-col font-sans selection:bg-brand-100 selection:text-brand-900 overflow-x-hidden">

      {/* HEADER PROFESSIONNEL */}
      <header className="px-6 lg:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
        <div
          className="flex items-center gap-6 cursor-pointer group"
          onClick={() => window.location.reload()}
        >
          <div className="w-14 h-14 bg-gradient-to-br from-brand-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-brand-200 rotate-2 group-hover:rotate-0 transition-transform duration-300">
            <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-1">PasseportPro</h1>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">Biometric Editor Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="group bg-slate-950 hover:bg-black text-white px-8 py-4 rounded-2xl cursor-pointer transition-all duration-500 font-bold flex items-center gap-3 shadow-2xl shadow-slate-200 hover:-translate-y-1 active:scale-95">
            <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" />
            </svg>
            <span className="tracking-wide">Importer Photo</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-[1700px] w-full mx-auto p-6 lg:p-12 grid grid-cols-1 xl:grid-cols-12 gap-10 flex-grow">

        {/* LEFT: SETTINGS & WORKSPACE */}
        <div className="xl:col-span-8 flex flex-col gap-8">

          <div className="bg-white rounded-[40px] p-8 lg:p-12 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col relative overflow-hidden group/card">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50/30 rounded-full blur-3xl -mr-32 -mt-32"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination</label>
                <select
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all cursor-pointer shadow-sm"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                >
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                <select
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all cursor-pointer shadow-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as UsageCategory)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Papier</label>
                <div className={`flex gap-2 ${selectedPaperId === 'custom' ? 'flex-col' : ''}`}>
                  <select
                    className="flex-grow bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all cursor-pointer shadow-sm"
                    value={selectedPaperId}
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                  >
                    {PAPER_FORMATS.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {selectedPaperId === 'custom' && (
                    <div className="flex gap-2 animate-in slide-in-from-top duration-300">
                      <div className="flex-grow relative group">
                        <input
                          type="number"
                          placeholder="Largeur (mm)"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all shadow-sm"
                          value={customPaperSize.width}
                          onChange={(e) => setCustomPaperSize(p => ({ ...p, width: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 pointer-events-none">W</span>
                      </div>
                      <div className="flex-grow relative group">
                        <input
                          type="number"
                          placeholder="Hauteur (mm)"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all shadow-sm"
                          value={customPaperSize.height}
                          onChange={(e) => setCustomPaperSize(p => ({ ...p, height: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 pointer-events-none">H</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-1.5 shadow-sm">
                  <button
                    onClick={() => setPhotoCount(Math.max(1, photoCount - 1))}
                    className="w-10 h-10 bg-white shadow-sm rounded-xl text-slate-600 font-bold hover:bg-slate-100 active:scale-90 transition-all"
                  >-</button>
                  <span className="flex-grow text-center font-black text-base text-slate-800">{photoCount}</span>
                  <button
                    onClick={() => setPhotoCount(Math.min(50, photoCount + 1))}
                    className="w-10 h-10 bg-white shadow-sm rounded-xl text-slate-600 font-bold hover:bg-slate-100 active:scale-90 transition-all"
                  >+</button>
                </div>
              </div>
            </div>

            {/* ZONE DE TRAVAIL */}
            <div className="relative flex-grow flex items-center justify-center rounded-[40px] bg-slate-50/50 border-2 border-dashed border-slate-200 min-h-[550px] group-hover/card:bg-slate-50 transition-colors duration-700">

              {sourceImage ? (
                <div
                  className={`relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] bg-white ring-[16px] ring-white transition-all duration-700 ${isRemovingBg || isAutoWorking ? 'opacity-40 grayscale blur-sm' : 'opacity-100 hover:shadow-brand-500/10'}`}
                  style={{
                    width: '380px',
                    height: `${380 / aspectRatio}px`,
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
                  <div className="absolute inset-0 pointer-events-none border-[1px] border-slate-100">
                    <div className="w-full h-px bg-brand-500/10 absolute top-[30%] shadow-[0_0_10px_rgba(96,165,250,0.2)]"></div>
                    <div className="w-full h-px bg-brand-500/10 absolute top-[65%] shadow-[0_0_10px_rgba(96,165,250,0.2)]"></div>
                    <div className="w-[62%] h-[68%] border-2 border-dashed border-brand-400/20 rounded-[45%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%]"></div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-20 animate-in fade-in zoom-in duration-1000">
                  <div className="w-28 h-28 bg-white rounded-[40px] flex items-center justify-center mx-auto mb-10 text-slate-200 shadow-2xl border border-slate-50 rotate-3 animate-pulse">
                    <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-4">Prêt pour le shooting ?</h3>
                  <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm leading-relaxed">Glissez votre photo ici ou utilisez le bouton d'importation.</p>
                </div>
              )}

              {/* CHARGEMENT ÉTAT IA */}
              {(isRemovingBg || isAutoWorking) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-2xl z-40 transition-all rounded-[40px]">
                  <div className="w-20 h-20 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin mb-8 shadow-2xl shadow-brand-200"></div>
                  <p className="text-sm font-black text-brand-900 uppercase tracking-[0.3em] font-mono animate-pulse">{isAutoWorking ? 'Neural Analysis...' : 'Cleaning Canvas...'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: RENDER & ANALYSIS */}
        <div className="xl:col-span-4 flex flex-col gap-8">
          <div className="bg-white rounded-[40px] p-8 lg:p-10 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.06)] border border-slate-100 flex-grow flex flex-col min-h-[600px] relative overflow-hidden group/render">

            <div className="flex items-center justify-between mb-8 relative z-10">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Rendu Final</h2>
              <span className={`px-4 py-1.5 text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm ${analysis?.isCompliant ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {analysis?.isCompliant ? 'Bio-Validé' : 'Aperçu'}
              </span>
            </div>

            <div className="flex-grow flex flex-col gap-8 relative z-10">
              {layoutConfig ? (
                <div className="animate-in slide-in-from-right duration-1000 flex flex-col h-full">

                  {/* INTERACTIVE PREVIEW CONTAINER */}
                  <div className="flex-grow flex items-center justify-center p-6 bg-slate-50/50 rounded-[32px] border border-slate-100 shadow-inner relative overflow-hidden group/preview">

                    {/* PAPER SIMULATION */}
                    <div
                      ref={previewContainerRef}
                      className="relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] border border-slate-100 overflow-hidden"
                      style={{
                        aspectRatio: `${layoutConfig.sheetWidth} / ${layoutConfig.sheetHeight}`,
                        width: '100%',
                        maxWidth: '300px'
                      }}
                    >
                      {/* THE GRID (DRAGGABLE) */}
                      <div
                        onMouseDown={handleLayoutMouseDown}
                        onTouchStart={handleLayoutMouseDown}
                        className={`absolute cursor-move select-none transition-shadow ${isDraggingLayout ? 'shadow-2xl ring-2 ring-brand-500/20' : ''}`}
                        style={{
                          left: `${(layoutConfig.startX + layoutOffset.x) / layoutConfig.sheetWidth * 100}%`,
                          top: `${(layoutConfig.startY + layoutOffset.y) / layoutConfig.sheetHeight * 100}%`,
                          width: `${(layoutConfig.columnsUsed * layoutConfig.photoWidth + (layoutConfig.columnsUsed - 1) * layoutConfig.gap) / layoutConfig.sheetWidth * 100}%`,
                          height: `${(layoutConfig.rows * layoutConfig.photoHeight + (layoutConfig.rows - 1) * layoutConfig.gap) / layoutConfig.sheetHeight * 100}%`,
                          display: 'grid',
                          gridTemplateColumns: `repeat(${layoutConfig.columnsUsed}, 1fr)`,
                          gap: `${layoutConfig.gap / layoutConfig.sheetWidth * 100}%`
                        }}
                      >
                        {Array.from({ length: photoCount }).map((_, i) => (
                          <div key={i} className="bg-slate-100 overflow-hidden" style={{ aspectRatio: `${layoutConfig.photoWidth} / ${layoutConfig.photoHeight}` }}>
                            <img src={finalRender || ''} alt="" className="w-full h-full object-cover" draggable={false} />
                          </div>
                        ))}
                      </div>

                      {/* PAPER TEXTURE OVERLAY */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/5 to-transparent pointer-events-none mix-blend-multiply opacity-30"></div>
                      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-lg text-white text-[8px] font-black uppercase tracking-widest px-4 py-2 rounded-full opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 pointer-events-none">
                      Glisser pour ajuster
                    </div>
                  </div>

                  {/* ACTION GRID */}
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100">
                    <button
                      onClick={handlePrint}
                      className="col-span-1 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 shadow-sm"
                    >
                      <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Imprimer
                    </button>

                    <a
                      onClick={handleDownloadSheet}
                      href="#"
                      className="col-span-1 bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-100 active:scale-95"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
                      Exporter Planche
                    </a>

                    <button
                      onClick={handleDownloadSingle}
                      className="col-span-1 bg-brand-50 hover:bg-brand-100 text-brand-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 border border-brand-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
                      Photo Unique
                    </button>

                    <button
                      onClick={() => setLayoutConfig(null)}
                      className="col-span-2 bg-slate-50 hover:bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      Nouvelle Édition
                    </button>
                  </div>

                  {/* AI FEEDBACK PREMIUM */}
                  {analysis && (
                    <div className={`mt-6 p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom duration-700 ${analysis.isCompliant ? 'bg-emerald-50/50 border-emerald-100 shadow-emerald-100/20' : 'bg-rose-50/50 border-rose-100 shadow-rose-100/20'} shadow-lg`}>
                      <div className="flex items-center justify-between font-black uppercase tracking-widest text-[10px] mb-4">
                        <span className="text-slate-400">Analyse Biométrique</span>
                        <span className={analysis.isCompliant ? 'text-emerald-600' : 'text-rose-600'}>{analysis.score}% Match</span>
                      </div>
                      <div className="w-full bg-slate-200/30 h-2 rounded-full overflow-hidden mb-4 shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-1000 ${analysis.isCompliant ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${analysis.score}%` }}></div>
                      </div>
                      <ul className="space-y-2">
                        {analysis.feedback.slice(0, 2).map((item, i) => (
                          <li key={i} className="text-[11px] font-bold text-slate-600 flex items-start gap-3">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${analysis.isCompliant ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-10 bg-slate-50/30 rounded-[40px] border-2 border-dashed border-slate-100 group/empty hover:bg-slate-50 transition-colors duration-500">
                  <div className="w-20 h-20 bg-white rounded-[32px] shadow-sm border border-slate-100 mb-6 flex items-center justify-center group-hover/empty:scale-110 transition-transform duration-500">
                    <svg className="w-8 h-8 text-slate-200 group-hover/empty:text-brand-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] text-center">Aucun résultat</p>
                  <p className="text-slate-300 text-[10px] font-bold text-center mt-2 group-hover/empty:text-slate-400 transition-colors">Appuyez sur VALIDER pour traiter la planche</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* DRAGGABLE FLOATING TOOLBAR */}
      {sourceImage && (
        <div
          className={`fixed z-[100] flex items-center gap-5 bg-slate-900/90 backdrop-blur-3xl p-4 pr-6 rounded-[32px] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-all duration-500 ${isDraggingBar ? 'scale-105 opacity-80 cursor-grabbing' : 'opacity-100 hover:shadow-brand-500/20 cursor-grab hover:-translate-y-1'}`}
          style={{
            left: `${controlBarPos.x}px`,
            top: `${controlBarPos.y}px`,
          }}
          onMouseDown={handleBarMouseDown}
          onTouchStart={handleBarMouseDown}
        >
          {/* DRAG HANDLE */}
          <div className="pr-4 text-slate-700 border-r border-slate-800 flex items-center">
            <svg className="w-6 h-6 opacity-40" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-12a2 2 0 10.001 4.001A2 2 0 0013 2zm0 6a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" /></svg>
          </div>

          {/* ZOOM GROUP */}
          <div className="flex items-center gap-5 px-2">
            <button onClick={() => setCrop(p => ({ ...p, scale: Math.max(0.01, p.scale * 0.9) }))} className="text-white/40 hover:text-white transition-colors p-1 active:scale-75">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
            </button>
            <div className="relative group/slider">
              <input
                type="range" min="0.01" max="3" step="0.001"
                value={crop.scale}
                onChange={(e) => setCrop(p => ({ ...p, scale: parseFloat(e.target.value) }))}
                className="w-32 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>
            <button onClick={() => setCrop(p => ({ ...p, scale: Math.min(5, p.scale * 1.1) }))} className="text-white/40 hover:text-white transition-colors p-1 active:scale-75">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="w-px h-10 bg-slate-800/50 mx-2"></div>

          {/* ACTIONS GROUP */}
          <div className="flex items-center gap-3">
            <button onClick={centerImage} className="text-white/60 hover:text-white hover:bg-slate-800/50 p-3.5 rounded-2xl transition-all active:scale-90" title="Centrer Photo">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <button onClick={handleBackgroundRemoval} disabled={isRemovingBg || isAutoWorking} className="text-white/60 hover:text-white hover:bg-slate-800/50 p-3.5 rounded-2xl transition-all disabled:opacity-20 active:scale-90" title="Nettoyage Fond (IA)">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </button>
            <button
              onClick={handleAutoWork}
              disabled={isRemovingBg || isAutoWorking}
              className="bg-brand-600 hover:bg-brand-500 text-white px-7 py-4 rounded-[22px] text-[10px] font-black tracking-widest transition-all shadow-xl shadow-brand-900/20 flex items-center gap-3 disabled:opacity-30 group active:scale-95"
            >
              <svg className="w-4 h-4 animate-pulse group-hover:scale-125 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
              MAGIC WORK
            </button>
            <button
              onClick={updateLayout}
              disabled={isRemovingBg || isAutoWorking}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-4 rounded-[22px] text-[10px] font-black tracking-widest transition-all shadow-xl shadow-emerald-900/20 disabled:opacity-30 active:scale-95"
            >
              VALIDER
            </button>
          </div>
        </div>
      )}

      <footer className="px-12 py-10 flex flex-col md:flex-row items-center justify-between text-slate-300 text-[10px] font-black uppercase tracking-[0.4em] bg-white border-t border-slate-50 mt-auto">
        <div className="flex items-center gap-6">
          <span className="text-brand-500">PassportPro Engine 4.0</span>
          <span className="w-2 h-2 bg-slate-100 rounded-full"></span>
          <span>DPI Optimized Export</span>
        </div>
        <div className="flex gap-12 mt-8 md:mt-0">
          <span className="hover:text-brand-500 cursor-help transition-colors">Normes ISO 2024</span>
          <span className="hover:text-brand-500 cursor-help transition-colors">IA Match Active</span>
        </div>
      </footer>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 22px;
          width: 22px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);
          border: 4px solid #0f172a;
          margin-top: -9px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          background: #60a5fa;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #1e293b;
          border-radius: 4px;
        }
        body { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
};

export default App;
