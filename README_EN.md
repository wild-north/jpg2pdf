# JPG to PDF Converter

Simple and fast Node.js application for converting JPG images to PDF with web interface.

## 📋 Description

This application provides two ways to work:
1. **Web Interface** - convenient drag-n-drop interface with ability to reorder pages
2. **CLI Script** - scans the `input` folder for JPG files and creates a single PDF file

## 🚀 Quick Start

### Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### Option 1: Web Interface (Recommended)

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Open browser** at `http://localhost:5173`

3. **Upload JPG files** via drag-n-drop or upload button

4. **Reorder images** by dragging them around

5. **Click "Generate PDF"** and save the result

### Option 2: CLI Script

1. **Place JPG files** in the `input/` folder:
   ```
   input/
   ├── 01-page.jpg
   ├── 02-page.jpg
   ├── 03-page.jpg
   └── ...
   ```

2. **Run the script**:
   ```bash
   npm run cli
   ```

3. **Find the generated PDF** in `output/output.pdf`

## 📁 Project Structure

```
jpg2pdf/
├── input/          # Folder for JPG files
├── output/         # Folder for generated PDF
├── src/
│   └── index.js    # Main script
├── package.json
└── README.md
```

## ⚙️ Supported Formats

- `.jpg`
- `.jpeg`

## 📝 Features

### Web Interface
- **Drag-n-Drop Upload**: Drag files directly into browser
- **Interactive Sorting**: Reorder pages by dragging
- **Image Preview**: See all uploaded files
- **Progress Bar**: Track PDF generation progress
- **Instant Download**: Save generated PDF with one click
- **Responsive Design**: Works on all devices

### CLI Mode
- **Automatic sorting**: Pages are added in alphabetical order by file names
- **Quality preservation**: Images are inserted into PDF without quality loss
- **Auto-scaling**: PDF page size automatically adjusts to image size
- **Informative messages**: Detailed logs of the conversion process
- **Error handling**: Clear error messages

## 🔧 Additional Commands

### Development mode (with auto-restart)
```bash
npm run dev
```

## 📋 Usage Example

```bash
# 1. Add images to input/ folder
input/001-cover.jpg
input/002-page1.jpg
input/003-page2.jpg

# 2. Run the script
npm start

# Output:
# 🔄 Starting JPG to PDF conversion...
# Found 3 JPG files:
# - 001-cover.jpg
# - 002-page1.jpg  
# - 003-page2.jpg
# Processing: 001-cover.jpg
# Added page 1: 001-cover.jpg
# Processing: 002-page1.jpg
# Added page 2: 002-page1.jpg
# Processing: 003-page2.jpg
# Added page 3: 003-page2.jpg
# ✅ PDF created successfully: output/output.pdf
# 📄 Total pages: 3
```

## ❗ Troubleshooting

### Error "No JPG files found"
- Check if there are JPG files in the `input/` folder
- Make sure files have `.jpg` or `.jpeg` extension

### Error "Error reading input directory"
- Check if the `input/` folder exists
- Check folder access permissions

### Error during file processing
- Check if the JPG file is corrupted
- Try opening the file in another image editor

## 🛠 Technical Requirements

- Node.js >= 18.0.0
- npm or yarn

## 📦 Used Libraries

- [pdf-lib](https://pdf-lib.js.org/) - for creating PDF files
- Node.js File System API - for file operations

## 📄 License

MIT

---

**Author**: Serhii  
**Version**: 1.0.0
