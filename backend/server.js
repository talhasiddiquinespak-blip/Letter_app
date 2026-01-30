import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import Tesseract from 'tesseract.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import XLSX from 'xlsx';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Gemini API
const genAI = new GoogleGenerativeAI('AIzaSyBIeBsNaJcn2_E8VAWCTuNXrRovY7LfS1A');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Create directories
const uploadsDir = join(__dirname, 'uploads');
const storageDir = join(__dirname, 'storage');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

// Static files
app.use('/uploads', express.static(uploadsDir));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${uuidv4()}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// Database (in-memory for Railway)
let scansDB = [];
let scanIdCounter = 1;

// Excel file path
const excelPath = join(storageDir, 'registry.xlsx');

// Initialize Excel
function initExcel() {
  if (!fs.existsSync(excelPath)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['ID', 'Date', 'From', 'To', 'Subject', 'File Name', 'Timestamp', 'Confidence', 'Status']
    ]);
    ws['!cols'] = [
      { wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, 
      { wch: 40 }, { wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Letters Registry');
    XLSX.writeFile(wb, excelPath);
  }
}

// Add to Excel
function addToExcel(data) {
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets['Letters Registry'];
  const rows = XLSX.utils.sheet_to_json(ws);
  
  const newId = rows.length > 0 ? Math.max(...rows.map(r => r.ID || 0)) + 1 : 1;
  
  const newRow = {
    ID: newId,
    Date: data.date || '',
    From: data.from || '',
    To: data.to || '',
    Subject: data.subject || '',
    'File Name': data.fileName || '',
    Timestamp: new Date().toISOString(),
    Confidence: data.confidence ? `${(data.confidence * 100).toFixed(1)}%` : 'N/A',
    Status: 'completed'
  };
  
  rows.push(newRow);
  const newWs = XLSX.utils.json_to_sheet(rows);
  newWs['!cols'] = ws['!cols'];
  wb.Sheets['Letters Registry'] = newWs;
  XLSX.writeFile(wb, excelPath);
  
  return newId;
}

// OCR function
async function extractText(imagePath) {
  try {
    const processedBuffer = await sharp(imagePath)
      .grayscale()
      .normalize()
      .sharpen()
      .toBuffer();
    
    const { data } = await Tesseract.recognize(processedBuffer, 'eng');
    return {
      text: data.text,
      confidence: data.confidence / 100
    };
  } catch (error) {
    console.error('OCR error:', error);
    throw error;
  }
}

// AI parsing function
async function parseFields(text, ocrConfidence) {
  try {
    const prompt = `You are an expert at reading business letters. Extract information from this letter following these rules:

EXTRACTION RULES:
1. FROM (Sender):
   - Look for company letterhead at the top
   - Check signature at the bottom
   - Look for "for [Company Name]" 
   - Check who signed (usually near signature)
   - Format: "Name, Company" or just "Company Name"

2. TO (Recipient):
   - First look for explicit "To:", "Dear", "Attention:"
   - If not found, look at address block (usually after reference number)
   - Look for "Embassy of", "Ministry of", organization names
   - Format: "Name/Organization, Address"

3. DATE:
   - Look at top-right corner (most common)
   - Check for formats: "July 12, 2024", "12-07-2024", "2024-07-12"
   - Convert to YYYY-MM-DD format
   - Common positions: top-right, below letterhead, above address

4. SUBJECT:
   - Look for underlined text
   - Check for "Re:", "Subject:", "Regarding:"
   - If not explicit, check first paragraph for purpose
   - Look for visa requests, meeting requests, application letters
   - Keep it under 100 characters

LETTER TEXT:
${text}

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "from": "sender name/company",
  "to": "recipient name/organization",
  "date": "YYYY-MM-DD",
  "subject": "main purpose of letter",
  "confidence_score": 0.0 to 1.0
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    const combined = (parsed.confidence_score * 0.6) + (ocrConfidence * 0.4);
    
    // Smart fallback - enhance AI results with regex if fields are null
    let from = parsed.from;
    let to = parsed.to;
    let date = parsed.date;
    let subject = parsed.subject;
    
    // Fallback for FROM if null
    if (!from || from === 'null') {
      const fromMatches = [
        text.match(/for\s+([A-Z][^\n]{10,80}(?:Limited|Ltd|Corporation|Corp|Company|Services|Pvt))/i),
        text.match(/(?:Sincerely|Regards)[,\s\n]*for\s+([A-Z][^\n]{10,60})/i),
        text.match(/\(([A-Z\s]{10,50})\)\s*(?:General Manager|Manager|Director|Head)/i)
      ];
      for (const match of fromMatches) {
        if (match && match[1]) {
          from = match[1].trim();
          break;
        }
      }
    }
    
    // Fallback for TO if null
    if (!to || to === 'null') {
      const toMatches = [
        text.match(/(Embassy of [^\n]{5,70})/i),
        text.match(/(Ministry of [^\n]{5,70})/i),
        text.match(/(?:To|Dear|Attention):\s*([^\n]{10,80})/i)
      ];
      for (const match of toMatches) {
        if (match && match[1]) {
          to = match[1].trim();
          break;
        }
      }
    }
    
    // Fallback for DATE if null
    if (!date || date === 'null') {
      const dateMatches = [
        text.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/),
        text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/),
        text.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/)
      ];
      for (const match of dateMatches) {
        if (match && match[1]) {
          date = match[1].trim();
          break;
        }
      }
    }
    
    // Fallback for SUBJECT if null
    if (!subject || subject === 'null') {
      const subjectMatches = [
        text.match(/(?:Subject|Re|Regarding):\s*([^\n]{10,150})/i),
        text.match(/(?:Request to|Application for|Invitation)\s+([^\n]{10,100})/i),
        text.match(/__+\s*([^\n_]{10,150})\s*__+/)
      ];
      for (const match of subjectMatches) {
        if (match && match[1]) {
          subject = match[1].trim().substring(0, 100);
          break;
        }
      }
      
      // Keyword-based subject inference
      if (!subject) {
        if (/visa/i.test(text)) subject = "Visa Application";
        else if (/meeting/i.test(text)) subject = "Meeting Request";
        else if (/invitation/i.test(text)) subject = "Invitation";
      }
    }
    
    return {
      from: from,
      to: to,
      date: date,
      subject: subject,
      confidence_score: combined
    };
  } catch (error) {
    console.error('AI parsing error:', error);
    return {
      from: null,
      to: null,
      date: null,
      subject: null,
      confidence_score: ocrConfidence * 0.5
    };
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/scan', upload.single('letter'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('Processing:', req.file.originalname);

    // OCR
    const ocrResult = await extractText(req.file.path);
    console.log('OCR confidence:', ocrResult.confidence);

    // AI parsing
    const aiResult = await parseFields(ocrResult.text, ocrResult.confidence);
    console.log('AI parsed:', aiResult);

    // Save to DB
    const scan = {
      id: scanIdCounter++,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      extractedText: ocrResult.text,
      fromField: aiResult.from,
      toField: aiResult.to,
      dateField: aiResult.date,
      subject: aiResult.subject,
      ocrConfidence: ocrResult.confidence,
      aiConfidence: aiResult.confidence_score,
      processingStatus: 'completed',
      createdAt: new Date().toISOString()
    };
    scansDB.push(scan);

    // Add to Excel
    const rowNumber = addToExcel({
      date: aiResult.date,
      from: aiResult.from,
      to: aiResult.to,
      subject: aiResult.subject,
      fileName: req.file.originalname,
      confidence: aiResult.confidence_score
    });

    res.json({
      success: true,
      message: 'Letter processed successfully',
      data: {
        scanId: scan.id,
        fileName: req.file.originalname,
        extractedFields: {
          from: aiResult.from,
          to: aiResult.to,
          date: aiResult.date,
          subject: aiResult.subject
        },
        confidence: {
          ocr: ocrResult.confidence,
          ai: aiResult.confidence_score,
          combined: aiResult.confidence_score
        },
        excel: {
          updated: true,
          rowNumber: rowNumber
        }
      }
    });
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process scan',
      error: error.message
    });
  }
});

app.get('/api/scan', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const sorted = [...scansDB].reverse();
  const paginated = sorted.slice(skip, skip + limit);
  
  res.json({
    success: true,
    data: paginated.map(s => ({
      id: s.id,
      fileName: s.fileName,
      originalName: s.originalName,
      fromField: s.fromField,
      toField: s.toField,
      dateField: s.dateField,
      subject: s.subject,
      ocrConfidence: s.ocrConfidence,
      aiConfidence: s.aiConfidence,
      processingStatus: s.processingStatus,
      createdAt: s.createdAt
    })),
    pagination: {
      page,
      limit,
      total: scansDB.length,
      totalPages: Math.ceil(scansDB.length / limit)
    }
  });
});

app.get('/api/scan/stats', (req, res) => {
  const completed = scansDB.filter(s => s.processingStatus === 'completed').length;
  const failed = scansDB.filter(s => s.processingStatus === 'failed').length;
  
  const avgOcr = scansDB.length > 0 
    ? scansDB.reduce((sum, s) => sum + (s.ocrConfidence || 0), 0) / scansDB.length 
    : 0;
  
  const avgAi = scansDB.length > 0
    ? scansDB.reduce((sum, s) => sum + (s.aiConfidence || 0), 0) / scansDB.length
    : 0;
  
  res.json({
    success: true,
    data: {
      totals: {
        scans: scansDB.length,
        completed,
        failed,
        processing: scansDB.length - completed - failed
      },
      averages: {
        ocrConfidence: avgOcr,
        aiConfidence: avgAi
      },
      recent: scansDB.slice(-5).reverse().map(s => ({
        id: s.id,
        originalName: s.originalName,
        processingStatus: s.processingStatus,
        createdAt: s.createdAt
      }))
    }
  });
});

app.get('/api/excel/download', (req, res) => {
  if (!fs.existsSync(excelPath)) {
    initExcel();
  }
  res.download(excelPath, 'letter-registry.xlsx');
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Letter Scanner API', 
    version: '1.0.0',
    endpoints: {
      scan: 'POST /api/scan',
      list: 'GET /api/scan',
      stats: 'GET /api/scan/stats',
      excel: 'GET /api/excel/download',
      health: 'GET /api/health'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Initialize
initExcel();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 API: http://localhost:${PORT}`);
});
