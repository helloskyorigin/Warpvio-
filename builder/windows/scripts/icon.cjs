'use strict';

const zlib = require('node:zlib');

const ICON_SIZE = 256;
const BITMAP = Object.freeze({
  A:['01110','10001','10001','11111','10001','10001','10001'],
  B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01111','10000','10000','10111','10001','10001','01111'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],
  J:['00111','00010','00010','00010','10010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],
  L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  N:['10001','11001','10101','10011','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','10101','01010'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
  Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10011','10101','10101','10101','11001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01111','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','00100','00100','00100'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','11110']
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n=0; n<8; n++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : (crc >>> 1);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type,data) {
  const typeBytes=Buffer.from(type,'ascii');
  const body=Buffer.concat([typeBytes,data]);
  const result=Buffer.alloc(body.length+8);
  result.writeUInt32BE(data.length,0);
  body.copy(result,4);
  result.writeUInt32BE(crc32(body),body.length+4);
  return result;
}

function rgbaImage(hex,letter) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error('Invalid icon accent color.');
  const primary=[
    parseInt(hex.slice(1,3),16),
    parseInt(hex.slice(3,5),16),
    parseInt(hex.slice(5,7),16)
  ];
  const secondary=[135,82,246];
  const scanline=ICON_SIZE*4+1;
  const raw=Buffer.alloc(ICON_SIZE*scanline);
  const roundedRadius=52;

  function insideRoundedSquare(x,y) {
    const dx=Math.max(0, roundedRadius-x, x-(ICON_SIZE-1-roundedRadius));
    const dy=Math.max(0, roundedRadius-y, y-(ICON_SIZE-1-roundedRadius));
    return dx*dx+dy*dy <= roundedRadius*roundedRadius;
  }
  const glyph=BITMAP[String(letter).toUpperCase()]||BITMAP.W;
  const cell=22, startX=Math.floor((ICON_SIZE-cell*5)/2), startY=Math.floor((ICON_SIZE-cell*7)/2);

  for(let y=0;y<ICON_SIZE;y++){
    const start=y*scanline;
    raw[start]=0; // PNG filter: None
    for(let x=0;x<ICON_SIZE;x++){
      const offset=start+1+x*4;
      if(!insideRoundedSquare(x,y))continue;
      const ratio=(x+y)/(ICON_SIZE*2);
      const white= x>=startX && x<startX+5*cell &&
        y>=startY && y<startY+7*cell &&
        glyph[Math.floor((y-startY)/cell)]?.[Math.floor((x-startX)/cell)]==='1';
      if(white){
        raw[offset]=255;raw[offset+1]=255;raw[offset+2]=255;
      }else{
        for(let c=0;c<3;c++){
          raw[offset+c]=Math.round(primary[c]*(1-ratio)+secondary[c]*ratio);
        }
      }
      raw[offset+3]=255;
    }
  }
  return raw;
}

function createPng(hex='#3478f6',letter='W') {
  const raw=rgbaImage(hex,letter);
  const header=Buffer.alloc(13);
  header.writeUInt32BE(ICON_SIZE,0);
  header.writeUInt32BE(ICON_SIZE,4);
  header[8]=8; // 8-bit channels
  header[9]=6; // RGBA
  header[10]=0;header[11]=0;header[12]=0;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a','hex'),
    chunk('IHDR',header),
    chunk('IDAT',zlib.deflateSync(raw,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
}

function isValidPng256(buffer) {
  return Buffer.isBuffer(buffer) &&
    buffer.length>40 && buffer.length<4*1024*1024 &&
    buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) &&
    buffer.toString('ascii',12,16)==='IHDR' &&
    buffer.readUInt32BE(16)===256 &&
    buffer.readUInt32BE(20)===256;
}

function pngToIco(png) {
  if(!isValidPng256(png)) throw new Error('Custom icon must be a 256×256 PNG image.');
  // ICO supports one embedded PNG image since Windows Vista.
  const header=Buffer.alloc(22);
  header.writeUInt16LE(0,0);
  header.writeUInt16LE(1,2); // icon
  header.writeUInt16LE(1,4); // one image
  header[6]=0;header[7]=0; // 0 means 256x256
  header[8]=0;header[9]=0;
  header.writeUInt16LE(1,10);
  header.writeUInt16LE(32,12);
  header.writeUInt32LE(png.length,14);
  header.writeUInt32LE(22,18);
  return Buffer.concat([header,png]);
}

module.exports={ICON_SIZE,createPng,isValidPng256,pngToIco,crc32};
