let library;
export async function extractPdfFeedback(file){
 library ||= import('/vendor/build/pdf.mjs');
 const pdfjs=await library;pdfjs.GlobalWorkerOptions.workerSrc='/vendor/build/pdf.worker.mjs';
 let task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'}),doc;
 try{doc=await task.promise;if(doc.numPages>200)throw Error('Please use a PDF with 200 pages or fewer.');let pages=[];
 for(let p=1;p<=doc.numPages;p++){let page=await doc.getPage(p),content=await page.getTextContent(),lines=[],line='',lastY=null;
 for(let item of content.items){if(!('str'in item))continue;let y=item.transform[5];if(lastY!==null&&Math.abs(y-lastY)>3&&line.trim()){lines.push(line.trim());line=''}line+=(line&&!line.endsWith(' ')?' ':'')+item.str;lastY=y;if(item.hasEOL&&line.trim()){lines.push(line.trim());line='';lastY=null}}if(line.trim())lines.push(line.trim());pages.push(lines.join('\n'))}
 let text=pages.join('\n');if(!text.trim())throw Error('No selectable text found. Scanned PDFs need OCR; paste the text or use a text-based PDF.');
 // Explicit response labels keep wrapped sentences together, including the supplied sample PDF.
 if(/^RESPONSE\s+\d+\s*$/im.test(text)){
 text=text.split(/^RESPONSE\s+\d+\s*$/im).slice(1).map(part=>part.split(/Fictional sample feedback\s*\|/i)[0].replace(/^\d+\s*$/gm,'').trim().replace(/\s*\n\s*/g,' ')).filter(Boolean).join('\n');
 }
 return text;
 }catch(err){if(err.name==='PasswordException')throw Error('This PDF is password protected. Import an unlocked copy.');throw err}finally{await task.destroy()}
};
