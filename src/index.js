import { PDFDocument } from 'pdf-lib';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const INPUT_DIR = 'input';
const OUTPUT_DIR = 'output';
const OUTPUT_FILENAME = 'output.pdf';

async function getJpgFiles(inputPath) {
  try {
    const files = await readdir(inputPath);
    
    const jpgFiles = files
      .filter(file => {
        const ext = extname(file).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg';
      })
      .sort();

    return jpgFiles;
  } catch (error) {
    throw new Error(`Error reading input directory: ${error.message}`);
  }
}

async function createPdfFromImages(jpgFiles, inputPath, outputPath) {
  if (jpgFiles.length === 0) {
    throw new Error('No JPG files found in input directory');
  }

  console.log(`Found ${jpgFiles.length} JPG files:`);
  jpgFiles.forEach(file => console.log(`- ${file}`));

  const pdfDoc = await PDFDocument.create();

  for (const fileName of jpgFiles) {
    try {
      console.log(`Processing: ${fileName}`);
      
      const imagePath = join(inputPath, fileName);
      const imageBytes = await readFile(imagePath);
      
      const image = await pdfDoc.embedJpg(imageBytes);
      const imageDims = image.scale(1);
      
      const page = pdfDoc.addPage([imageDims.width, imageDims.height]);
      
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: imageDims.width,
        height: imageDims.height,
      });
      
      console.log(`Added page ${pdfDoc.getPageCount()}: ${fileName}`);
    } catch (error) {
      console.error(`Error processing ${fileName}: ${error.message}`);
      throw error;
    }
  }

  const pdfBytes = await pdfDoc.save();
  await writeFile(outputPath, pdfBytes);
}

async function main() {
  try {
    console.log('🔄 Starting JPG to PDF conversion...');
    
    const jpgFiles = await getJpgFiles(INPUT_DIR);
    const outputPath = join(OUTPUT_DIR, OUTPUT_FILENAME);
    
    await createPdfFromImages(jpgFiles, INPUT_DIR, outputPath);
    
    console.log(`✅ PDF created successfully: ${outputPath}`);
    console.log(`📄 Total pages: ${jpgFiles.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
