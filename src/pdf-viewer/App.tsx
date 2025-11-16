import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './styles.css';

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const PDFViewer: React.FC = () => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const [loading, setLoading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF 렌더링 함수
  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (error) {
      console.error('페이지 렌더링 에러:', error);
    }
  };

  // PDF 파일 로드 함수
  const loadPDF = async (file: File | string) => {
    setLoading(true);
    try {
      let fileData: string | ArrayBuffer;

      if (typeof file === 'string') {
        fileData = file;
      } else {
        const arrayBuffer = await file.arrayBuffer();
        fileData = arrayBuffer;
      }

      const loadingTask = pdfjsLib.getDocument(fileData);
      const pdf = await loadingTask.promise;

      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setPageNumber(1);
    } catch (error) {
      console.error('PDF 로딩 에러:', error);
      alert('PDF를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 파일 선택 핸들러
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      loadPDF(selectedFile);
    }
  };

  // 페이지 변경 시 렌더링
  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNumber);
    }
  }, [pdfDoc, pageNumber, scale]);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="pdf-viewer-container">
      <h1 className="title">PDF Viewer</h1>

      <div className="pdf-controls">
        <div className="file-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="file-input-hidden"
          />
          <button onClick={openFileDialog} className="file-button">
            PDF 파일 선택
          </button>
        </div>

        {numPages > 0 && (
          <>
            <div className="zoom-controls">
              <button onClick={zoomOut} disabled={scale <= 0.5}>
                축소 (-)
              </button>
              <span className="scale-indicator">{Math.round(scale * 100)}%</span>
              <button onClick={zoomIn} disabled={scale >= 3.0}>
                확대 (+)
              </button>
            </div>

            <div className="page-controls">
              <button onClick={goToPrevPage} disabled={pageNumber <= 1}>
                ← 이전
              </button>
              <span className="page-info">
                {pageNumber} / {numPages}
              </span>
              <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
                다음 →
              </button>
            </div>
          </>
        )}
      </div>

      <div className="pdf-canvas-container">
        {loading && <div className="loading">PDF 로딩 중...</div>}
        {!pdfDoc && !loading && (
          <div className="empty-state">
            <p>PDF 파일을 선택해주세요</p>
          </div>
        )}
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>

      {/* 전체 페이지 썸네일 뷰 */}
      {numPages > 0 && (
        <AllPagesView
          pdfDoc={pdfDoc}
          numPages={numPages}
          currentPage={pageNumber}
          onPageClick={setPageNumber}
        />
      )}
    </div>
  );
};

// 전체 페이지 썸네일 컴포넌트
interface AllPagesViewProps {
  pdfDoc: any;
  numPages: number;
  currentPage: number;
  onPageClick: (page: number) => void;
}

const AllPagesView: React.FC<AllPagesViewProps> = ({
  pdfDoc,
  numPages,
  currentPage,
  onPageClick,
}) => {
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    const generateThumbnails = async () => {
      const thumbs: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          thumbs.push(canvas.toDataURL());
        } catch (error) {
          console.error(`썸네일 생성 에러 (페이지 ${i}):`, error);
          thumbs.push('');
        }
      }

      setThumbnails(thumbs);
    };

    if (pdfDoc) {
      generateThumbnails();
    }
  }, [pdfDoc, numPages]);

  return (
    <div className="all-pages-section">
      <h3>모든 페이지</h3>
      <div className="thumbnails-grid">
        {thumbnails.map((thumbnail, index) => (
          <div
            key={index}
            className={`thumbnail-wrapper ${
              currentPage === index + 1 ? 'active' : ''
            }`}
            onClick={() => onPageClick(index + 1)}
          >
            <p className="page-label">페이지 {index + 1}</p>
            {thumbnail ? (
              <img src={thumbnail} alt={`페이지 ${index + 1}`} />
            ) : (
              <div className="thumbnail-placeholder">로딩 중...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PDFViewer;
