// User-selected raster files only. No remote requests or native paths.
export async function convertProgressImage(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024||!file.size)throw new Error('Choose a PNG, JPEG or WebP image up to 5 MiB.');
 const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read image.'));reader.readAsDataURL(file);});
 const raw=atob(source.split(',')[1]||'');const starts=(...bytes)=>bytes.every((b,i)=>raw.charCodeAt(i)===b);
 const valid=file.type==='image/png'?starts(137,80,78,71,13,10,26,10):file.type==='image/jpeg'?starts(255,216,255):raw.slice(0,4)==='RIFF'&&raw.slice(8,12)==='WEBP';
 if(!valid)throw new Error('File contents do not match a supported raster image.');
 const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Image could not be decoded. Choose a valid raster image.'));img.src=source;});
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;if(!width||!height||width*height>40000000)throw new Error('Image dimensions are too large (40 megapixels maximum).');
 const canvas=document.createElement('canvas');let scale=Math.min(1,1280/Math.max(width,height)),dataUrl;
 for(let attempt=0;attempt<10;attempt++){canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image conversion is unavailable.');ctx.drawImage(image,0,0,canvas.width,canvas.height);dataUrl=canvas.toDataURL('image/png');if(dataUrl.startsWith('data:image/png;base64,')&&atob(dataUrl.split(',')[1]).length<=256*1024)return {id:crypto.randomUUID(),name:file.name.slice(0,200)||'image.png',mime:'image/png',dataUrl};scale*=0.7;}
 throw new Error('Image cannot fit the 256 KiB attachment limit. Choose a smaller image.');
}
