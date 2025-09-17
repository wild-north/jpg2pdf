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

async function compressImages(files, quality = 80) {
  console.log(`Compressing ${files.length} images with quality ${quality}`);
  
  const compressedFiles = [];
  
  for (const file of files) {
    try {
      const compressedBuffer = await sharp(file.buffer)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      
      compressedFiles.push({
        ...file,
        buffer: compressedBuffer
      });
      
      console.log(`Compressed ${file.originalname}: ${file.buffer.length} -> ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length / file.buffer.length) * 100)}% reduction)`);
    } catch (error) {
      console.error(`Error compressing ${file.originalname}: ${error.message}`);
      // If compression fails, use original
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
    
    // Try different quality levels: 70, 60, 50, 40, 30
    const qualityLevels = [70, 60, 50, 40, 30];
    
    for (const quality of qualityLevels) {
      const compressedFiles = await compressImages(files, quality);
      const compressedPdfBytes = await generatePdfFromFiles(compressedFiles);
      
      console.log(`Quality ${quality}: PDF size ${(compressedPdfBytes.length / (1024 * 1024)).toFixed(2)} MB`);
      
      if (compressedPdfBytes.length <= maxSizeBytes) {
        console.log(`✅ Size target achieved with quality ${quality}`);
        return compressedPdfBytes;
      }
      
      pdfBytes = compressedPdfBytes; // Keep the last attempt
    }
    
    console.log(`⚠️ Could not achieve size limit, using lowest quality result`);
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

app.post('/api/generate-pdf', upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    console.log(`Received ${req.files.length} files for PDF generation`);
    
    // Get file size limit from form data
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'JPG2PDF API is running' });
});

// Serve static files only if build exists (production mode)
const frontendDistPath = join(process.cwd(), 'frontend/dist');
const indexHtmlPath = join(frontendDistPath, 'index.html');

if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static('frontend/dist'));
  
  app.get('*', (req, res) => {
    res.sendFile(indexHtmlPath);
  });
  
  console.log('📁 Serving frontend from dist/');
} else {
  // In development mode, frontend runs on its own port
  app.get('*', (req, res) => {
    res.json({ 
      message: 'JPG2PDF API Server', 
      frontend: 'Run frontend separately in development mode',
      api: '/api/generate-pdf'
    });
  });
  
  console.log('🔧 Development mode: Frontend runs separately');
}

app.listen(PORT, () => {
  console.log(`🚀 JPG2PDF server running on http://localhost:${PORT}`);
  console.log(`📁 API endpoint: http://localhost:${PORT}/api/generate-pdf`);
});
