import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { PDFDocument } from 'pdf-lib';
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import fs from 'fs';
import sharp from 'sharp';

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '';

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg'];
    const ext = extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

async function compressImages(files, options = {}) {
  const { quality = 80, maxWidth = null, maxHeight = null } = options;
  console.log(`Compressing ${files.length} images with quality ${quality}${maxWidth ? `, maxWidth ${maxWidth}` : ''}${maxHeight ? `, maxHeight ${maxHeight}` : ''}`);
  
  const compressedFiles = [];
  
  for (const file of files) {
    try {
      let sharpImage = sharp(file.buffer);
      
      // Get original dimensions
      const metadata = await sharpImage.metadata();
      console.log(`Original ${file.originalname}: ${metadata.width}x${metadata.height}, ${file.buffer.length} bytes`);
      
      // Resize if dimensions are specified
      if (maxWidth || maxHeight) {
        sharpImage = sharpImage.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      const compressedBuffer = await sharpImage
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      
      compressedFiles.push({
        ...file,
        buffer: compressedBuffer
      });
      
      const reduction = Math.round((1 - compressedBuffer.length / file.buffer.length) * 100);
      console.log(`Compressed ${file.originalname}: ${file.buffer.length} -> ${compressedBuffer.length} bytes (${reduction}% reduction)`);
    } catch (error) {
      console.error(`Error compressing ${file.originalname}: ${error.message}`);
      compressedFiles.push(file);
    }
  }
  
  return compressedFiles;
}

async function createPdfFromBuffers(files, maxSizeBytes = null) {
  if (!files || files.length === 0) {
    throw new Error('No files provided');
  }

  console.log(`Creating PDF from ${files.length} images`);
  console.log(`File order received:`, files.map((f, i) => `${i + 1}. ${f.originalname}`));
  if (maxSizeBytes) {
    console.log(`Size limit: ${(maxSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  }
  
  // First attempt with original images
  let currentFiles = files;
  let pdfBytes = await generatePdfFromFiles(currentFiles);
  
  // If size limit is set and exceeded, try compression
  if (maxSizeBytes && pdfBytes.length > maxSizeBytes) {
    console.log(`PDF size (${(pdfBytes.length / (1024 * 1024)).toFixed(2)} MB) exceeds limit, applying compression...`);
    
    // Compression strategies: progressively more aggressive
    const compressionStrategies = [
      { quality: 70 },
      { quality: 60 },
      { quality: 50 },
      { quality: 40, maxWidth: 2048, maxHeight: 2048 },
      { quality: 35, maxWidth: 1920, maxHeight: 1920 },
      { quality: 30, maxWidth: 1600, maxHeight: 1600 },
      { quality: 25, maxWidth: 1200, maxHeight: 1200 },
      { quality: 20, maxWidth: 1024, maxHeight: 1024 },
      { quality: 15, maxWidth: 800, maxHeight: 800 }
    ];
    
    for (const strategy of compressionStrategies) {
      const compressedFiles = await compressImages(files, strategy);
      const compressedPdfBytes = await generatePdfFromFiles(compressedFiles);
      
      const sizeMB = (compressedPdfBytes.length / (1024 * 1024)).toFixed(2);
      const strategyDesc = `Quality ${strategy.quality}${strategy.maxWidth ? `, resize ${strategy.maxWidth}px` : ''}`;
      console.log(`${strategyDesc}: PDF size ${sizeMB} MB`);
      
      if (compressedPdfBytes.length <= maxSizeBytes) {
        console.log(`✅ Size target achieved with ${strategyDesc}`);
        return compressedPdfBytes;
      }
      pdfBytes = compressedPdfBytes; // Keep the last attempt
    }
    
    console.log(`⚠️ Could not achieve size limit, using most compressed result`);
  }

  return pdfBytes;
}

async function generatePdfFromFiles(files) {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      console.log(`Processing image ${i + 1}: ${file.originalname}`);
      
      const image = await pdfDoc.embedJpg(file.buffer);
      const imageDims = image.scale(1);
      
      const page = pdfDoc.addPage([imageDims.width, imageDims.height]);
      
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: imageDims.width,
        height: imageDims.height,
      });
      
    } catch (error) {
      console.error(`Error processing ${file.originalname}: ${error.message}`);
      throw new Error(`Failed to process ${file.originalname}: ${error.message}`);
    }
  }

  return await pdfDoc.save();
}

app.post(`${BASE_PATH}/api/generate-pdf`, upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    console.log(`Received ${req.files.length} files for PDF generation`);
    
    let maxSizeBytes = null;
    if (req.body.maxSizeMB) {
      maxSizeBytes = parseFloat(req.body.maxSizeMB) * 1024 * 1024;
      console.log(`File size limit: ${req.body.maxSizeMB} MB`);
    }
    
    const pdfBytes = await createPdfFromBuffers(req.files, maxSizeBytes);
    
    console.log(`Final PDF size: ${(pdfBytes.length / (1024 * 1024)).toFixed(2)} MB`);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="generated.pdf"');
    res.send(Buffer.from(pdfBytes));
    
  } catch (error) {
    console.error('PDF generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get(`${BASE_PATH}/api/health`, (req, res) => {
  res.json({ status: 'OK', message: 'JPG2PDF API is running' });
});

const frontendDistPath = join(process.cwd(), 'frontend/dist');
const indexHtmlPath = join(frontendDistPath, 'index.html');

if (fs.existsSync(indexHtmlPath)) {
  app.use(BASE_PATH, express.static('frontend/dist'));
  
  app.get(`${BASE_PATH}*`, (req, res) => {
    res.sendFile(indexHtmlPath);
  });
  
  console.log(`📁 Serving frontend from dist/ at ${BASE_PATH || '/'}`);
} else {
  app.get(`${BASE_PATH}/`, (req, res) => {
    res.json({ 
      message: 'JPG2PDF API Server', 
      frontend: 'Run frontend separately in development mode',
      api: `${BASE_PATH}/api/generate-pdf`
    });
  });
  
  console.log('🔧 Development mode: Frontend runs separately');
}

app.listen(PORT, () => {
  console.log(`🚀 JPG2PDF server running on http://localhost:${PORT}${BASE_PATH}`);
  console.log(`📁 API endpoint: http://localhost:${PORT}${BASE_PATH}/api/generate-pdf`);
});
